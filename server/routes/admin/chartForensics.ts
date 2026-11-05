import express from 'express';
import { mainDb } from '../../db/connection.js';
import { logAdminAction } from '../../db/audit.js';
import { requirePermission } from '../../middleware/rolePermissions.js';
import { type Candidate } from '../../utils/chartForensics.js';
import { analyzeLeak, type PreAligned } from '../../utils/chartAnalysis.js';
import { findChart } from '../../utils/chartFinder.js';
import {
  buildVocabulary,
  type CephieIndexChart,
  type ChartRef,
  type Vocabulary,
} from '../../utils/chartIdentify.js';
import { readChartText } from '../../utils/chartOcr.js';
import { getAirportData } from '../../utils/getData.js';
import { fetchChartGen } from '../../utils/chartGen.js';
import { getClientIp } from '../../utils/getIpAddress.js';

const router = express.Router();
router.use(requirePermission('admin'));

const MAX_IMAGE_BYTES = 40 * 1024 * 1024;
const MAX_EXTRA_USERS = 100;
const MAX_CANDIDATES = 5000;
const ICAO_PATTERN = /^[A-Z0-9]{2,7}$/;
const KIND_PATTERN = /^[a-z0-9-]{1,24}$/;
const USER_ID_PATTERN = /^[0-9]{5,25}$/;

interface CephieIndex {
  version: string;
  airports: Record<string, CephieIndexChart[]>;
}

let vocabularyCache: { version: string; vocabulary: Vocabulary } | null = null;

function vocabularyFor(index: CephieIndex): Vocabulary {
  if (vocabularyCache?.version !== index.version) {
    vocabularyCache = {
      version: index.version,
      vocabulary: buildVocabulary(index.airports, getAirportData()),
    };
  }
  return vocabularyCache.vocabulary;
}

async function fetchOriginal(version: string, chart: ChartRef) {
  const response = await fetchChartGen(
    `/cephie/${version}/${chart.icao}/${chart.kind}.webp`
  );
  return response?.status === 200 ? response.body : null;
}

async function loadCandidates(extraIds: string[]): Promise<Candidate[]> {
  const adminIds = (process.env.ADMIN_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  const [granted, testers, named] = await Promise.all([
    mainDb
      .selectFrom('users')
      .select(['id', 'username'])
      .where((eb) =>
        eb('id', 'in', eb.selectFrom('plan_grants').select('user_id'))
      )
      .limit(MAX_CANDIDATES)
      .execute(),
    mainDb
      .selectFrom('users')
      .select(['id', 'username'])
      .where((eb) => eb('id', 'in', eb.selectFrom('testers').select('user_id')))
      .execute(),
    adminIds.length + extraIds.length > 0
      ? mainDb
          .selectFrom('users')
          .select(['id', 'username'])
          .where('id', 'in', [...adminIds, ...extraIds])
          .execute()
      : Promise.resolve([]),
  ]);

  const unique = new Map<string, Candidate>();
  for (const row of [...granted, ...testers, ...named]) {
    unique.set(row.id, { userId: row.id, username: row.username });
  }
  for (const id of extraIds) {
    if (!unique.has(id))
      unique.set(id, { userId: id, username: 'Unknown user' });
  }
  return [...unique.values()];
}

router.post(
  '/',
  express.raw({ type: () => true, limit: MAX_IMAGE_BYTES }),
  async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');

    const icao = String(req.query.icao ?? '').toUpperCase();
    const kind = String(req.query.kind ?? '').toLowerCase();
    const selected = icao !== '' || kind !== '';
    if (selected && (!ICAO_PATTERN.test(icao) || !KIND_PATTERN.test(kind))) {
      return res.status(400).json({ error: 'Choose an airport and a chart' });
    }
    const leaked = req.body;
    if (!Buffer.isBuffer(leaked) || leaked.length === 0) {
      return res.status(400).json({ error: 'Upload an image' });
    }
    const extraIds = String(req.query.userIds ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (
      extraIds.length > MAX_EXTRA_USERS ||
      !extraIds.every((id) => USER_ID_PATTERN.test(id))
    ) {
      return res.status(400).json({ error: 'Invalid extra user IDs' });
    }

    const indexResponse = await fetchChartGen('/cephie');
    if (!indexResponse || indexResponse.status !== 200) {
      return res.status(503).json({ error: 'Chart generator unavailable' });
    }
    const index = JSON.parse(indexResponse.body.toString()) as CephieIndex;
    if (!index.version || !index.airports) {
      return res.status(503).json({ error: 'Chart generator unavailable' });
    }

    let chart: ChartRef | null = null;
    let original: Buffer | null = null;
    let preAligned: PreAligned | undefined;
    let identified:
      | { via: 'selected' }
      | {
          via: 'appearance' | 'text';
          wordsRead: number;
          tried: number;
          matched: string[];
          alternatives: ChartRef[];
        } = { via: 'selected' };

    if (icao && kind) {
      const found = index.airports[icao]?.find((entry) => entry.kind === kind);
      if (!found) return res.status(404).json({ error: 'Chart not found' });
      chart = { icao, kind, name: found.name };
      original = await fetchOriginal(index.version, chart);
      if (!original) {
        return res.status(503).json({ error: 'Original chart unavailable' });
      }
    } else {
      try {
        const result = await findChart({
          version: index.version,
          charts: Object.entries(index.airports).flatMap(([code, list]) =>
            list.map((entry) => ({
              icao: code,
              kind: entry.kind,
              name: entry.name,
            }))
          ),
          vocabulary: vocabularyFor(index),
          leaked,
          fetchOriginal: (ref) => fetchOriginal(index.version, ref),
          readText: readChartText,
        });
        if (!result.found) {
          return res.json({
            aligned: false,
            reason: `The chart could not be identified (compared with every chart${result.wordsRead ? `, read ${result.wordsRead} words` : ''}). The image may be scaled, too small, or from a different chart version. Choose the chart manually.`,
          });
        }
        chart = result.found.chart;
        original = result.found.original;
        preAligned = result.found.preAligned;
        identified = {
          via: result.found.via,
          wordsRead: result.wordsRead,
          tried: result.tried,
          matched: result.found.matchedWords.slice(0, 12),
          alternatives: result.alternatives,
        };
      } catch (error) {
        console.error('[Admin] Chart identification failed:', error);
        return res.status(422).json({ error: 'The image could not be read' });
      }
    }

    try {
      const candidates = await loadCandidates(extraIds);
      const analysis = await analyzeLeak({
        leaked,
        original,
        candidates,
        preAligned,
      });

      await logAdminAction({
        adminId: req.user!.userId,
        adminUsername: req.user!.username || 'Unknown',
        actionType: 'CHART_FORENSICS_RUN',
        ipAddress: getClientIp(req),
        userAgent: req.get('User-Agent') ?? null,
        details: {
          chart: `${chart.icao}/${chart.kind}`,
          identified: identified.via,
          verdict: analysis.aligned ? analysis.verdict : 'not_aligned',
          topMatch: analysis.aligned
            ? (analysis.matches[0]?.userId ?? null)
            : null,
        },
      });

      res.json({
        plate: { ...chart, version: index.version },
        identified,
        ...analysis,
      });
    } catch (error) {
      console.error('[Admin] Chart forensics failed:', error);
      res.status(422).json({ error: 'The image could not be read' });
    }
  }
);

export default router;
