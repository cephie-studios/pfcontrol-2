import { sql } from 'kysely';
import { mainDb } from './connection.js';

export const CLAIM_REPORT_STATUSES = ['open', 'resolved', 'dismissed'] as const;
export type ClaimReportStatus = (typeof CLAIM_REPORT_STATUSES)[number];

export async function insertSessionClaimReport(input: {
  requestId: string;
  sessionId: string;
  keyId: string;
  developerUserId: string;
  requesterName: string;
  attempts24h: number;
  reporterId: string;
}): Promise<boolean> {
  const row = await mainDb
    .insertInto('session_claim_reports')
    .values({
      request_id: input.requestId,
      session_id: input.sessionId,
      key_id: input.keyId,
      developer_user_id: input.developerUserId,
      requester_name: input.requesterName,
      attempts_24h: input.attempts24h,
      reporter_id: input.reporterId,
    })
    .onConflict((oc) =>
      oc.constraint('session_claim_reports_request_reporter_unique').doNothing()
    )
    .returning('id')
    .executeTakeFirst();
  return Boolean(row);
}

export async function listSessionClaimReports(params: {
  status: ClaimReportStatus | 'all';
  page: number;
  limit: number;
  search: string;
}) {
  let base = mainDb
    .selectFrom('session_claim_reports as r')
    .leftJoin('users as reporter', 'reporter.id', 'r.reporter_id')
    .leftJoin('users as dev', 'dev.id', 'r.developer_user_id')
    .leftJoin('developer_api_keys as k', (join) =>
      join.on(sql`k.id::text`, '=', sql.ref('r.key_id'))
    );
  if (params.status !== 'all')
    base = base.where('r.status', '=', params.status);
  if (params.search) {
    const q = `%${params.search}%`;
    base = base.where((eb) =>
      eb.or([
        eb('r.requester_name', 'ilike', q),
        eb('r.session_id', 'ilike', q),
        eb('reporter.username', 'ilike', q),
        eb('dev.username', 'ilike', q),
        eb('k.name', 'ilike', q),
      ])
    );
  }

  const [rows, total] = await Promise.all([
    base
      .select([
        'r.id',
        'r.session_id',
        'r.key_id',
        'r.developer_user_id',
        'r.requester_name',
        'r.attempts_24h',
        'r.reporter_id',
        'r.status',
        'r.admin_note',
        'r.reviewed_by',
        'r.reviewed_at',
        'r.created_at',
        'reporter.username as reporter_username',
        'reporter.avatar as reporter_avatar',
        'dev.username as developer_username',
        'k.name as key_name',
        'k.prefix as key_prefix',
        'k.revoked_at as key_revoked_at',
        sql<number>`(select count(*) from session_claim_reports r2 where r2.key_id = r.key_id)::int`.as(
          'key_report_count'
        ),
      ])
      .orderBy('r.created_at', 'desc')
      .limit(params.limit)
      .offset((params.page - 1) * params.limit)
      .execute(),
    base
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .executeTakeFirst(),
  ]);

  const totalCount = Number(total?.count ?? 0);
  return {
    reports: rows.map((r) => ({
      id: String(r.id),
      sessionId: r.session_id,
      keyId: r.key_id,
      keyName: r.key_name ?? null,
      keyPrefix: r.key_prefix ?? null,
      keyRevoked: Boolean(r.key_revoked_at),
      developerUserId: r.developer_user_id,
      developerUsername: r.developer_username ?? null,
      requesterName: r.requester_name,
      attempts24h: r.attempts_24h,
      keyReportCount: Number(r.key_report_count ?? 0),
      reporterId: r.reporter_id,
      reporterUsername: r.reporter_username ?? null,
      reporterAvatar: r.reporter_avatar ?? null,
      status: r.status,
      adminNote: r.admin_note,
      reviewedBy: r.reviewed_by,
      reviewedAt: r.reviewed_at,
      createdAt: r.created_at,
    })),
    pagination: {
      page: params.page,
      limit: params.limit,
      total: totalCount,
      pages: Math.max(1, Math.ceil(totalCount / params.limit)),
    },
  };
}

export async function countOpenSessionClaimReports(): Promise<number> {
  const row = await mainDb
    .selectFrom('session_claim_reports')
    .select(({ fn }) => fn.countAll<string>().as('count'))
    .where('status', '=', 'open')
    .executeTakeFirst();
  return Number(row?.count ?? 0);
}

export async function updateSessionClaimReportStatus(input: {
  id: string;
  status: ClaimReportStatus;
  note: string | null;
  reviewedBy: string;
}) {
  return mainDb
    .updateTable('session_claim_reports')
    .set({
      status: input.status,
      admin_note: input.note,
      reviewed_by: input.status === 'open' ? null : input.reviewedBy,
      reviewed_at: input.status === 'open' ? null : new Date(),
    })
    .where('id', '=', input.id)
    .returning(['id', 'key_id', 'developer_user_id', 'requester_name'])
    .executeTakeFirst();
}

export async function resolveOpenReportsForKey(
  keyId: string,
  reviewedBy: string
): Promise<void> {
  await mainDb
    .updateTable('session_claim_reports')
    .set({
      status: 'resolved',
      reviewed_by: reviewedBy,
      reviewed_at: new Date(),
    })
    .where('key_id', '=', keyId)
    .where('status', '=', 'open')
    .execute();
}
