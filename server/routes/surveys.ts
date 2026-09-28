import express from 'express';
import requireAuth from '../middleware/auth.js';
import {
  parseSurveyDuration,
  publicSurvey,
  validateSurveyAnswers,
} from '../surveys/definitions.js';
import {
  getActiveSurvey,
  hasSurveyResponse,
  insertSurveyResponse,
} from '../db/surveys.js';

const router = express.Router();

router.get('/active', requireAuth, async (req, res) => {
  try {
    const survey = await getActiveSurvey();
    if (!survey || (await hasSurveyResponse(survey.id, req.user!.userId))) {
      return res.json({ survey: null });
    }
    res.json({ survey: publicSurvey(survey) });
  } catch (error) {
    console.error('Error fetching active survey:', error);
    res.status(500).json({ error: 'Failed to load survey' });
  }
});

router.post('/:surveyId/responses', requireAuth, async (req, res) => {
  try {
    const survey = await getActiveSurvey();
    if (!survey || survey.id !== req.params.surveyId) {
      return res.status(404).json({ error: 'Survey not found' });
    }
    const answers = validateSurveyAnswers(survey, req.body?.answers);
    if (!answers) {
      return res
        .status(400)
        .json({ error: 'Please answer every question with yes or no.' });
    }
    const inserted = await insertSurveyResponse(
      survey.id,
      req.user!.userId,
      answers,
      parseSurveyDuration(req.body?.durationMs)
    );
    res.status(inserted ? 201 : 200).json({ ok: true });
  } catch (error) {
    console.error('Error saving survey response:', error);
    res.status(500).json({ error: 'Failed to save your answers' });
  }
});

export default router;
