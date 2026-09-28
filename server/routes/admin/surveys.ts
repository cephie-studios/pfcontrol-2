import express from 'express';
import { createAuditLogger } from '../../middleware/auditLogger.js';
import { requirePermission } from '../../middleware/rolePermissions.js';
import { logAdminAction } from '../../db/audit.js';
import { getClientIp } from '../../utils/getIpAddress.js';
import { getUserById } from '../../db/users.js';
import {
  SURVEY_FULL_WEIGHT_MS_PER_QUESTION,
  newSurveyId,
  surveyResponseWeight,
  validateSurveyInput,
} from '../../surveys/definitions.js';
import {
  countSurveyResponses,
  createSurvey,
  deleteSurvey,
  deleteSurveyResponse,
  getSurveyAnswerCombinations,
  getSurveyById,
  listSurveyResponses,
  listSurveyResponseTimings,
  listSurveys,
  setSurveyActive,
  updateSurvey,
} from '../../db/surveys.js';

const router = express.Router();

router.use(requirePermission('admin'));

router.get('/', async (_req, res) => {
  try {
    const [surveys, counts] = await Promise.all([
      listSurveys(),
      countSurveyResponses(),
    ]);
    res.json({
      surveys: surveys.map((s) => ({
        id: s.id,
        title: s.title,
        active: s.active,
        questionCount: s.questions.length,
        totalResponses: counts.get(s.id) ?? 0,
        createdAt: s.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error listing surveys:', error);
    res.status(500).json({ error: 'Failed to list surveys' });
  }
});

router.post('/', createAuditLogger('SURVEY_CREATED'), async (req, res) => {
  try {
    const parsed = validateSurveyInput(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const survey = await createSurvey(
      newSurveyId(),
      parsed.value,
      req.user?.userId ?? null
    );
    res.status(201).json({ survey });
  } catch (error) {
    console.error('Error creating survey:', error);
    res.status(500).json({ error: 'Failed to create survey' });
  }
});

router.get('/:surveyId', async (req, res) => {
  try {
    const survey = await getSurveyById(req.params.surveyId);
    if (!survey) return res.status(404).json({ error: 'Survey not found' });

    const [combinations, timings] = await Promise.all([
      getSurveyAnswerCombinations(survey.id),
      listSurveyResponseTimings(survey.id),
    ]);
    const totalResponses = combinations.reduce((n, c) => n + c.count, 0);
    const weights = timings.map((t) =>
      surveyResponseWeight(t.durationMs, survey.questions.length)
    );
    const questions = survey.questions.map((q) => {
      const yes = combinations
        .filter((c) => c.answers[q.id] === true)
        .reduce((n, c) => n + c.count, 0);
      const no = combinations
        .filter((c) => c.answers[q.id] === false)
        .reduce((n, c) => n + c.count, 0);
      let weightedYes = 0;
      let weightedNo = 0;
      timings.forEach((t, i) => {
        if (t.answers[q.id] === true) weightedYes += weights[i];
        else if (t.answers[q.id] === false) weightedNo += weights[i];
      });
      return { id: q.id, text: q.text, yes, no, weightedYes, weightedNo };
    });

    const durations = timings
      .map((t) => t.durationMs)
      .filter((d): d is number => d != null)
      .sort((a, b) => a - b);
    const medianDurationMs =
      durations.length === 0
        ? null
        : durations.length % 2
          ? durations[(durations.length - 1) / 2]
          : Math.round(
              (durations[durations.length / 2 - 1] +
                durations[durations.length / 2]) /
                2
            );

    res.json({
      survey: {
        id: survey.id,
        title: survey.title,
        description: survey.description,
        active: survey.active,
      },
      totalResponses,
      questions,
      combinations,
      timing: {
        timedResponses: durations.length,
        medianDurationMs,
        reducedWeightResponses: weights.filter((w) => w < 1).length,
        fullWeightMsPerQuestion: SURVEY_FULL_WEIGHT_MS_PER_QUESTION,
      },
    });
  } catch (error) {
    console.error('Error fetching survey results:', error);
    res.status(500).json({ error: 'Failed to fetch survey results' });
  }
});

router.put(
  '/:surveyId',
  createAuditLogger('SURVEY_UPDATED'),
  async (req, res) => {
    try {
      const parsed = validateSurveyInput(req.body);
      if (!parsed.ok) return res.status(400).json({ error: parsed.error });
      const survey = await updateSurvey(req.params.surveyId, parsed.value);
      if (!survey) return res.status(404).json({ error: 'Survey not found' });
      res.json({ survey });
    } catch (error) {
      console.error('Error updating survey:', error);
      res.status(500).json({ error: 'Failed to update survey' });
    }
  }
);

router.post(
  '/:surveyId/activate',
  createAuditLogger('SURVEY_ACTIVATED'),
  async (req, res) => {
    try {
      const survey = await setSurveyActive(req.params.surveyId, true);
      if (!survey) return res.status(404).json({ error: 'Survey not found' });
      res.json({ survey });
    } catch (error) {
      console.error('Error activating survey:', error);
      res.status(500).json({ error: 'Failed to activate survey' });
    }
  }
);

router.post(
  '/:surveyId/deactivate',
  createAuditLogger('SURVEY_DEACTIVATED'),
  async (req, res) => {
    try {
      const survey = await setSurveyActive(req.params.surveyId, false);
      if (!survey) return res.status(404).json({ error: 'Survey not found' });
      res.json({ survey });
    } catch (error) {
      console.error('Error deactivating survey:', error);
      res.status(500).json({ error: 'Failed to deactivate survey' });
    }
  }
);

router.delete(
  '/:surveyId',
  createAuditLogger('SURVEY_DELETED'),
  async (req, res) => {
    try {
      const deleted = await deleteSurvey(req.params.surveyId);
      if (!deleted) return res.status(404).json({ error: 'Survey not found' });
      res.json({ ok: true });
    } catch (error) {
      console.error('Error deleting survey:', error);
      res.status(500).json({ error: 'Failed to delete survey' });
    }
  }
);

router.get('/:surveyId/responses', async (req, res) => {
  try {
    const survey = await getSurveyById(req.params.surveyId);
    if (!survey) return res.status(404).json({ error: 'Survey not found' });
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.max(
      1,
      Math.min(100, parseInt(req.query.limit as string, 10) || 25)
    );
    const search =
      typeof req.query.search === 'string' ? req.query.search.trim() : '';
    res.json(await listSurveyResponses(survey.id, page, limit, search));
  } catch (error) {
    console.error('Error listing survey responses:', error);
    res.status(500).json({ error: 'Failed to list survey responses' });
  }
});

router.delete('/:surveyId/responses/:userId', async (req, res) => {
  try {
    const survey = await getSurveyById(req.params.surveyId);
    if (!survey) return res.status(404).json({ error: 'Survey not found' });
    const { userId } = req.params;
    const deleted = await deleteSurveyResponse(survey.id, userId);
    if (!deleted) return res.status(404).json({ error: 'Response not found' });

    if (req.user?.userId) {
      const target = await getUserById(userId);
      const ip = getClientIp(req);
      await logAdminAction({
        adminId: req.user.userId,
        adminUsername: req.user.username || 'Unknown',
        actionType: 'SURVEY_RESPONSE_RESET',
        targetUserId: userId,
        targetUsername: target?.username ?? null,
        ipAddress: Array.isArray(ip) ? ip.join(', ') : ip,
        userAgent: req.get('User-Agent'),
        details: { surveyId: survey.id },
      });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('Error resetting survey response:', error);
    res.status(500).json({ error: 'Failed to reset survey response' });
  }
});

export default router;
