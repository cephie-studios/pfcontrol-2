import { sql } from 'kysely';
import { mainDb } from './connection.js';
import type {
  SurveyDefinition,
  SurveyInput,
  SurveyQuestion,
} from '../surveys/definitions.js';

export type SurveyAnswers = Record<string, boolean>;

export interface StoredSurvey extends SurveyDefinition {
  createdAt: Date;
  updatedAt: Date;
}

function parseQuestions(raw: unknown): SurveyQuestion[] {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.filter(
    (q): q is SurveyQuestion =>
      !!q && typeof q.id === 'string' && typeof q.text === 'string'
  );
}

function toSurvey(row: {
  id: string;
  title: string;
  description: string;
  questions: unknown;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}): StoredSurvey {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    questions: parseQuestions(row.questions),
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSurveys(): Promise<StoredSurvey[]> {
  const rows = await mainDb
    .selectFrom('surveys')
    .selectAll()
    .orderBy('created_at', 'desc')
    .execute();
  return rows.map(toSurvey);
}

export async function getSurveyById(id: string): Promise<StoredSurvey | null> {
  const row = await mainDb
    .selectFrom('surveys')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
  return row ? toSurvey(row) : null;
}

export async function getActiveSurvey(): Promise<StoredSurvey | null> {
  const row = await mainDb
    .selectFrom('surveys')
    .selectAll()
    .where('active', '=', true)
    .executeTakeFirst();
  return row ? toSurvey(row) : null;
}

export async function createSurvey(
  id: string,
  input: SurveyInput,
  createdBy: string | null
): Promise<StoredSurvey> {
  const row = await mainDb
    .insertInto('surveys')
    .values({
      id,
      title: input.title,
      description: input.description,
      questions: sql`CAST(${JSON.stringify(input.questions)} AS jsonb)`,
      created_by: createdBy,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return toSurvey(row);
}

export async function updateSurvey(
  id: string,
  input: SurveyInput
): Promise<StoredSurvey | null> {
  const row = await mainDb
    .updateTable('surveys')
    .set({
      title: input.title,
      description: input.description,
      questions: sql`CAST(${JSON.stringify(input.questions)} AS jsonb)`,
      updated_at: new Date(),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst();
  return row ? toSurvey(row) : null;
}

export async function setSurveyActive(
  id: string,
  active: boolean
): Promise<StoredSurvey | null> {
  return mainDb.transaction().execute(async (trx) => {
    if (active) {
      await trx
        .updateTable('surveys')
        .set({ active: false, updated_at: new Date() })
        .where('active', '=', true)
        .where('id', '!=', id)
        .execute();
    }
    const row = await trx
      .updateTable('surveys')
      .set({ active, updated_at: new Date() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    return row ? toSurvey(row) : null;
  });
}

export async function deleteSurvey(id: string): Promise<boolean> {
  return mainDb.transaction().execute(async (trx) => {
    await trx
      .deleteFrom('survey_responses')
      .where('survey_id', '=', id)
      .execute();
    const result = await trx
      .deleteFrom('surveys')
      .where('id', '=', id)
      .executeTakeFirst();
    return Number(result.numDeletedRows ?? 0) > 0;
  });
}

export async function countSurveyResponses(): Promise<Map<string, number>> {
  const rows = await mainDb
    .selectFrom('survey_responses')
    .select(['survey_id', sql<string>`count(*)`.as('count')])
    .groupBy('survey_id')
    .execute();
  return new Map(rows.map((r) => [r.survey_id, Number(r.count)]));
}

function parseAnswers(raw: unknown): SurveyAnswers {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (e): e is [string, boolean] => typeof e[1] === 'boolean'
    )
  );
}

export async function hasSurveyResponse(
  surveyId: string,
  userId: string
): Promise<boolean> {
  const row = await mainDb
    .selectFrom('survey_responses')
    .select('id')
    .where('survey_id', '=', surveyId)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  return Boolean(row);
}

export async function insertSurveyResponse(
  surveyId: string,
  userId: string,
  answers: SurveyAnswers,
  durationMs: number | null
): Promise<boolean> {
  const result = await mainDb
    .insertInto('survey_responses')
    .values({
      survey_id: surveyId,
      user_id: userId,
      answers: sql`CAST(${JSON.stringify(answers)} AS jsonb)`,
      duration_ms: durationMs,
    })
    .onConflict((oc) => oc.columns(['survey_id', 'user_id']).doNothing())
    .executeTakeFirst();
  return Number(result.numInsertedOrUpdatedRows ?? 0) > 0;
}

export async function getSurveyAnswerCombinations(
  surveyId: string
): Promise<{ answers: SurveyAnswers; count: number }[]> {
  const rows = await mainDb
    .selectFrom('survey_responses')
    .select(['answers', sql<string>`count(*)`.as('count')])
    .where('survey_id', '=', surveyId)
    .groupBy('answers')
    .execute();
  return rows
    .map((r) => ({ answers: parseAnswers(r.answers), count: Number(r.count) }))
    .sort((a, b) => b.count - a.count);
}

export async function listSurveyResponseTimings(
  surveyId: string
): Promise<{ answers: SurveyAnswers; durationMs: number | null }[]> {
  const rows = await mainDb
    .selectFrom('survey_responses')
    .select(['answers', 'duration_ms'])
    .where('survey_id', '=', surveyId)
    .execute();
  return rows.map((r) => ({
    answers: parseAnswers(r.answers),
    durationMs: r.duration_ms,
  }));
}

export async function listSurveyResponses(
  surveyId: string,
  page: number,
  limit: number,
  search: string
) {
  let base = mainDb
    .selectFrom('survey_responses')
    .innerJoin('users', 'users.id', 'survey_responses.user_id')
    .where('survey_responses.survey_id', '=', surveyId);
  if (search) {
    const term = `%${search}%`;
    base = base.where((eb) =>
      eb.or([
        eb('users.username', 'ilike', term),
        eb('survey_responses.user_id', 'ilike', term),
      ])
    );
  }

  const [rows, totalRow] = await Promise.all([
    base
      .select([
        'survey_responses.user_id',
        'survey_responses.answers',
        'survey_responses.duration_ms',
        'survey_responses.created_at',
        'users.username',
        'users.avatar',
      ])
      .orderBy('survey_responses.created_at', 'desc')
      .limit(limit)
      .offset((page - 1) * limit)
      .execute(),
    base.select(sql<string>`count(*)`.as('count')).executeTakeFirst(),
  ]);

  const total = Number(totalRow?.count ?? 0);
  return {
    responses: rows.map((r) => ({
      userId: r.user_id,
      username: r.username,
      avatar: r.avatar ?? null,
      answers: parseAnswers(r.answers),
      durationMs: r.duration_ms,
      createdAt: r.created_at,
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function deleteSurveyResponse(
  surveyId: string,
  userId: string
): Promise<boolean> {
  const result = await mainDb
    .deleteFrom('survey_responses')
    .where('survey_id', '=', surveyId)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  return Number(result.numDeletedRows ?? 0) > 0;
}
