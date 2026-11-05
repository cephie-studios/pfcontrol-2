import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  HelpCircle,
  Loader2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminPage from '../../components/admin/AdminPage';
import AdminSection from '../../components/admin/AdminSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { minDuration } from '@/lib/minDuration';
import { SIGNATURE_TONES } from '@/lib/signatureTones';
import { cn } from '@/lib/utils';
import {
  fetchCephieCharts,
  type CephieChartIndex,
} from '../../utils/fetch/charts';
import {
  analyzeChartLeak,
  type ForensicsMatch,
  type ForensicsResult,
  type ForensicsVerdict,
} from '../../utils/fetch/admin/chartForensics';

const MATCH_Z = 8;
const POSSIBLE_Z = 5;
const AUTO = 'auto';
const MIN_CONTRAST = 0.2;
const MAX_CONTRAST = 14;

const CARD = 'rounded-3xl border-2 border-zinc-800 bg-zinc-900 p-5';

function confidence(z: number): { label: string; className: string } {
  if (z >= MATCH_Z) return { label: 'Match', className: 'text-emerald-400' };
  if (z >= POSSIBLE_Z) {
    return { label: 'Possible', className: 'text-amber-400' };
  }
  return { label: 'Unlikely', className: 'text-zinc-500' };
}

function Verdict({
  verdict,
  top,
}: {
  verdict: ForensicsVerdict;
  top?: ForensicsMatch;
}) {
  if (verdict === 'match' && top) {
    return (
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-400" />
        <div>
          <p className="text-lg font-semibold">
            Watermark found: {top.username}
          </p>
          <p className="text-sm text-zinc-300">
            This image carries the fingerprint of user {top.userId}. A false
            match at this strength is practically impossible.
          </p>
        </div>
      </div>
    );
  }
  if (verdict === 'possible' && top) {
    return (
      <div className="flex items-start gap-3">
        <HelpCircle className="mt-0.5 size-6 shrink-0 text-amber-400" />
        <div>
          <p className="text-lg font-semibold">
            Possible match: {top.username}
          </p>
          <p className="text-sm text-zinc-300">
            A weak fingerprint for this user. The image may be small or heavily
            compressed, so treat this as a lead, not proof.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <HelpCircle className="mt-0.5 size-6 shrink-0 text-zinc-500" />
      <div>
        <p className="text-lg font-semibold">No known user matches</p>
        <p className="text-sm text-zinc-300">
          No fingerprint was found for the users tested. The image may be
          unmarked, or the leaker may not be in the tested set. Add their user
          ID under extra users.
        </p>
      </div>
    </div>
  );
}

function CropMap({
  chart,
  crop,
}: {
  chart: { width: number; height: number };
  crop: {
    dx: number;
    dy: number;
    width: number;
    height: number;
    scale?: number;
  };
}) {
  const whole = crop.width === chart.width && crop.height === chart.height;
  return (
    <div className="flex items-center gap-4">
      <div
        className="relative w-20 shrink-0 rounded-md border-2 border-zinc-700 bg-zinc-950"
        style={{ aspectRatio: `${chart.width} / ${chart.height}` }}
      >
        <div
          className="absolute border-2 border-blue-500 bg-blue-500/30"
          style={{
            left: `${(crop.dx / chart.width) * 100}%`,
            top: `${(crop.dy / chart.height) * 100}%`,
            width: `${(crop.width / chart.width) * 100}%`,
            height: `${(crop.height / chart.height) * 100}%`,
          }}
        />
      </div>
      <p className="text-sm text-zinc-300">
        {crop.scale && Math.abs(crop.scale - 1) > 0.002
          ? `Resized to ${Math.round(crop.scale * 100)}%${whole ? '' : `, showing ${crop.width}×${crop.height} at ${crop.dx}, ${crop.dy}`}`
          : whole
            ? 'Full chart'
            : `Cropped: ${crop.width}×${crop.height} at ${crop.dx}, ${crop.dy}`}
        <span className="block text-xs text-zinc-500">
          Chart is {chart.width}×{chart.height}
        </span>
      </p>
    </div>
  );
}

function Results({ result }: { result: ForensicsResult }) {
  if (!result.aligned) {
    return (
      <div className={cn(CARD, 'flex items-start gap-3')}>
        <AlertTriangle className="mt-0.5 size-6 shrink-0 text-amber-400" />
        <div>
          <p className="text-lg font-semibold">Could not analyse this image</p>
          <p className="text-sm text-zinc-300">{result.reason}</p>
        </div>
      </div>
    );
  }

  const top = result.matches[0];
  const found = result.verdict !== 'none';
  const strength = found
    ? Math.min(100, Math.round((top?.level ?? 0) * 100))
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className={CARD}>
        <Verdict verdict={result.verdict} top={top} />
      </div>

      <div className={cn(CARD, 'flex flex-col gap-1')}>
        <p className="text-sm font-medium text-zinc-300">Chart</p>
        <p className="text-lg font-semibold">
          {result.plate.icao} · {result.plate.name}
        </p>
        <p className="text-xs text-zinc-500">
          {result.identified.via === 'selected'
            ? 'Chosen by you'
            : result.identified.via === 'appearance'
              ? 'Found by comparing the image with every chart'
              : `Found by reading ${result.identified.wordsRead} words${
                  result.identified.matched.length
                    ? ` (${result.identified.matched.join(', ')})`
                    : ''
                }`}
        </p>
        {result.identified.via !== 'selected' &&
          result.identified.alternatives.length > 0 && (
            <p className="text-xs text-amber-400">
              Also fits:{' '}
              {result.identified.alternatives
                .map((chart) => `${chart.icao} ${chart.name}`)
                .join(', ')}
              . The visible area is the same on these charts, so the result
              holds either way.
            </p>
          )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className={cn(CARD, 'flex flex-col gap-3')}>
          <p className="text-sm font-medium text-zinc-300">Watermark level</p>
          <p className="text-3xl font-semibold tabular-nums">{strength}%</p>
          <Progress value={strength} />
          <p className="text-xs text-zinc-500">
            How much of the original fingerprint survived. Compression and
            re-saving lower it; cropping does not.
          </p>
          <p className="text-xs text-zinc-500">
            {result.cells.toLocaleString()} cells analysed · noise ±
            {result.noiseStd.toFixed(1)}
          </p>
        </div>
        <div className={cn(CARD, 'flex flex-col gap-3')}>
          <p className="text-sm font-medium text-zinc-300">Where it is</p>
          <CropMap chart={result.chart} crop={result.alignment} />
          <p className="text-xs text-zinc-500">
            Matched to the chart with{' '}
            {Math.round(result.alignment.quality * 100)}% agreement.
          </p>
        </div>
      </div>

      <div className={CARD}>
        <p className="mb-3 text-sm font-medium text-zinc-300">
          Most likely sources ({result.candidatesTested.toLocaleString()} users
          tested)
        </p>
        <ul className="flex flex-col gap-2">
          {result.matches.map((match, index) => {
            const { label, className } = confidence(match.z);
            return (
              <li
                key={match.userId}
                className="flex items-center gap-3 rounded-2xl border-2 border-zinc-800 px-4 py-2.5"
              >
                <span className="w-5 text-sm text-zinc-500 tabular-nums">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zinc-300">
                    {match.username}
                  </p>
                  <p className="truncate font-mono text-xs text-zinc-500">
                    {match.userId}
                  </p>
                </div>
                <span className="text-xs text-zinc-500 tabular-nums">
                  z {match.z.toFixed(1)}
                </span>
                <span className={cn('w-16 text-right text-sm', className)}>
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export default function AdminChartForensics() {
  const [index, setIndex] = useState<CephieChartIndex | null>(null);
  const [icao, setIcao] = useState(AUTO);
  const [kind, setKind] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [contrast, setContrast] = useState(1);
  const [extraIds, setExtraIds] = useState('');
  const [analysing, setAnalysing] = useState(false);
  const [result, setResult] = useState<ForensicsResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetchCephieCharts().then(setIndex);
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const airports = useMemo(() => Object.keys(index ?? {}).sort(), [index]);
  const auto = icao === AUTO;
  const charts = index?.[icao] ?? [];
  const ids = extraIds
    .split(/[\s,]+/)
    .map((id) => id.trim())
    .filter(Boolean);
  const canAnalyse = !!file && (auto || !!kind) && !analysing;

  const pick = (next: File | undefined) => {
    if (!next) return;
    if (!next.type.startsWith('image/')) {
      toast.error('That file is not an image');
      return;
    }
    setFile(next);
    setResult(null);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    pick(event.dataTransfer.files[0]);
  };

  const analyse = async () => {
    if (!file) return;
    setAnalysing(true);
    try {
      setResult(
        await minDuration(
          analyzeChartLeak(file, auto ? null : { icao, kind }, ids)
        )
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not analyse the image'
      );
    } finally {
      setAnalysing(false);
    }
  };

  return (
    <AdminLayout>
      <AdminPage
        title="Chart forensics"
        icon={FileSearch}
        description="Drop in a leaked Cephie chart to see which user it was served to. Works on cropped, resized and screenshotted copies, and on lossy re-saves such as JPEG and WebP."
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <AdminSection title="Image">
            <div className="flex flex-col gap-4">
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => input.current?.click()}
                className={cn(
                  'flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-zinc-800 bg-zinc-900 p-5 text-center transition-colors hover:border-zinc-700 hover:bg-zinc-800/60',
                  dragging && 'border-blue-600'
                )}
              >
                <Upload className="size-6 text-zinc-500" />
                <p className="text-sm text-zinc-300">
                  {file ? file.name : 'Drop an image here, or click to choose'}
                </p>
                {file && (
                  <p className="text-xs text-zinc-500">
                    {(file.size / 1024).toFixed(0)} KB
                  </p>
                )}
                <input
                  ref={input}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => pick(event.target.files?.[0])}
                />
              </div>

              <div className="grid gap-2">
                <Label>Airport</Label>
                <Select
                  value={icao}
                  onValueChange={(value) => {
                    setIcao(value);
                    setKind('');
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose an airport" />
                  </SelectTrigger>
                  <SelectContent className="shadcn-scope">
                    <SelectItem value={AUTO}>Auto-detect the chart</SelectItem>
                    {airports.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {auto ? (
                <p className="text-xs text-zinc-500">
                  The chart is found by comparing the image with every chart and
                  by reading its text. Pick an airport and chart yourself if
                  that fails.
                </p>
              ) : (
                <div className="grid gap-2">
                  <Label>Chart</Label>
                  <Select value={kind} onValueChange={setKind}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose the chart" />
                    </SelectTrigger>
                    <SelectContent className="shadcn-scope">
                      {charts.map((chart) => (
                        <SelectItem key={chart.kind} value={chart.kind}>
                          {chart.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="forensics-users">
                  Extra user IDs (optional)
                </Label>
                <Input
                  id="forensics-users"
                  value={extraIds}
                  onChange={(event) => setExtraIds(event.target.value)}
                  placeholder="Discord IDs, separated by commas"
                />
                <p className="text-xs text-zinc-500">
                  Supporters, testers and admins are always tested. Add anyone
                  else you suspect.
                </p>
              </div>

              <Button
                variant="ghost"
                disabled={!canAnalyse}
                onClick={() => void analyse()}
                className={SIGNATURE_TONES.blue}
              >
                {analysing ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <FileSearch />
                )}
                Analyse
              </Button>
            </div>
          </AdminSection>

          <AdminSection title="Result">
            <div className="flex flex-col gap-4">
              {result ? (
                <Results result={result} />
              ) : (
                <p className="text-sm text-zinc-500">
                  Choose an image and the chart it was taken from, then analyse.
                </p>
              )}

              {previewUrl && (
                <div className={cn(CARD, 'flex flex-col gap-3')}>
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-zinc-300">
                      Read the name in the noise
                    </p>
                    <div className="flex w-48 items-center gap-3">
                      <Slider
                        value={[contrast]}
                        min={MIN_CONTRAST}
                        max={MAX_CONTRAST}
                        step={0.1}
                        onValueChange={([value]) => setContrast(value)}
                        aria-label="Contrast"
                      />
                      <span className="w-8 text-right text-xs text-zinc-500 tabular-nums">
                        {contrast.toFixed(1)}×
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Raise the contrast to read the name, code and Discord ID in
                    the noise, or lower it to soften the image. Scroll over a
                    blank area at full size.
                  </p>
                  <div className="max-h-96 overflow-auto rounded-2xl border-2 border-zinc-800 bg-white">
                    <img
                      src={previewUrl}
                      alt="Uploaded chart"
                      className="max-w-none"
                      style={{
                        filter: `brightness(${contrast > 1 ? 1 - (contrast - 1) * 0.012 : 1}) contrast(${contrast})`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </AdminSection>
        </div>
      </AdminPage>
    </AdminLayout>
  );
}
