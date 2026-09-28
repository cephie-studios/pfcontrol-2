import { describe, expect, it } from 'vitest';
import {
  SURVEY_DURATION_MAX_MS,
  SURVEY_FULL_WEIGHT_MS_PER_QUESTION,
  SURVEY_LIMITS,
  SURVEY_MIN_WEIGHT,
  parseSurveyDuration,
  surveyResponseWeight,
  validateSurveyInput,
} from '../../../server/surveys/definitions.js';

describe('validateSurveyInput', () => {
  const base = {
    title: ' Title ',
    description: ' Desc ',
    questions: [{ id: 'keep_me', text: ' First? ' }, { text: 'Second?' }],
  };

  it('trims text, keeps valid ids and generates missing ones', () => {
    const r = validateSurveyInput(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.title).toBe('Title');
    expect(r.value.description).toBe('Desc');
    expect(r.value.questions[0]).toEqual({ id: 'keep_me', text: 'First?' });
    expect(r.value.questions[1].id).toMatch(/^q_[0-9a-f]{8}$/);
  });

  it('replaces duplicate ids so answers cannot collide', () => {
    const r = validateSurveyInput({
      ...base,
      questions: [
        { id: 'same', text: 'A?' },
        { id: 'same', text: 'B?' },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.questions[0].id).toBe('same');
    expect(r.value.questions[1].id).not.toBe('same');
  });

  it.each([
    [{ ...base, title: '   ' }],
    [{ ...base, questions: [] }],
    [{ ...base, questions: [{ text: '' }] }],
    [
      {
        ...base,
        questions: Array.from(
          { length: SURVEY_LIMITS.maxQuestions + 1 },
          () => ({
            text: 'Q?',
          })
        ),
      },
    ],
    [{ ...base, description: 'x'.repeat(SURVEY_LIMITS.description + 1) }],
    [null],
  ])('rejects invalid input %#', (input) => {
    expect(validateSurveyInput(input).ok).toBe(false);
  });
});

describe('parseSurveyDuration', () => {
  it('rounds valid durations and caps them', () => {
    expect(parseSurveyDuration(1234.4)).toBe(1234);
    expect(parseSurveyDuration(SURVEY_DURATION_MAX_MS * 5)).toBe(
      SURVEY_DURATION_MAX_MS
    );
  });

  it('ignores missing or invalid values', () => {
    expect(parseSurveyDuration(undefined)).toBeNull();
    expect(parseSurveyDuration('500')).toBeNull();
    expect(parseSurveyDuration(-1)).toBeNull();
    expect(parseSurveyDuration(Number.NaN)).toBeNull();
  });
});

describe('surveyResponseWeight', () => {
  const full = SURVEY_FULL_WEIGHT_MS_PER_QUESTION;

  it('gives full weight to untimed or unhurried responses', () => {
    expect(surveyResponseWeight(null, 3)).toBe(1);
    expect(surveyResponseWeight(full * 3, 3)).toBe(1);
    expect(surveyResponseWeight(full * 30, 3)).toBe(1);
  });

  it('scales down fast responses with a floor', () => {
    expect(surveyResponseWeight((full * 3) / 2, 3)).toBeCloseTo(0.5);
    expect(surveyResponseWeight(0, 3)).toBe(SURVEY_MIN_WEIGHT);
  });
});
