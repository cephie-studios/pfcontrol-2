import { mainDb } from './connection.js';
import { decrypt, encrypt } from '../utils/encryption.js';
import type { ExternalAcarsProvidersTable } from './types/connection/main/ExternalAcarsProvidersTable.js';

export type ExternalAcarsProvider = {
  id: string;
  displayName: string;
  apiBaseUrl: string;
  tokenHeader: string;
  handoffUrl: string;
  handoffApiKey: string | null;
  enabled: boolean;
  isDefault: boolean;
};

export type ExternalAcarsProviderSummary = Omit<
  ExternalAcarsProvider,
  'handoffApiKey'
> & { hasHandoffApiKey: boolean };

function decodeApiKey(
  value: ExternalAcarsProvidersTable['handoff_api_key']
): string | null {
  const decrypted = value
    ? decrypt(value as Parameters<typeof decrypt>[0])
    : null;
  return typeof decrypted === 'string' ? decrypted : null;
}

function toProvider(
  row: Omit<
    ExternalAcarsProvidersTable,
    'created_at' | 'updated_at' | 'created_by' | 'updated_by'
  >
): ExternalAcarsProvider {
  return {
    id: row.id,
    displayName: row.display_name,
    apiBaseUrl: row.api_base_url,
    tokenHeader: row.token_header,
    handoffUrl: row.handoff_url,
    handoffApiKey: decodeApiKey(row.handoff_api_key),
    enabled: row.enabled,
    isDefault: row.is_default,
  };
}

function toSummary(
  provider: ExternalAcarsProvider
): ExternalAcarsProviderSummary {
  const { handoffApiKey, ...summary } = provider;
  return { ...summary, hasHandoffApiKey: Boolean(handoffApiKey) };
}

export async function listExternalAcarsProviders(): Promise<
  ExternalAcarsProviderSummary[]
> {
  const rows = await mainDb
    .selectFrom('external_acars_providers')
    .selectAll()
    .orderBy('display_name')
    .execute();
  return rows.map((row) => toSummary(toProvider(row)));
}

export async function getExternalAcarsProvider(
  id: string,
  requireEnabled = true
): Promise<ExternalAcarsProvider | null> {
  let query = mainDb
    .selectFrom('external_acars_providers')
    .selectAll()
    .where('id', '=', id);
  if (requireEnabled) query = query.where('enabled', '=', true);
  const row = await query.executeTakeFirst();
  return row ? toProvider(row) : null;
}

export async function getDefaultExternalAcarsProvider(): Promise<ExternalAcarsProvider | null> {
  const row = await mainDb
    .selectFrom('external_acars_providers')
    .selectAll()
    .where('enabled', '=', true)
    .where('is_default', '=', true)
    .executeTakeFirst();
  return row ? toProvider(row) : null;
}

export async function saveExternalAcarsProvider(
  input: ExternalAcarsProvider,
  updatedBy: string
): Promise<ExternalAcarsProviderSummary> {
  const key = input.handoffApiKey ? encrypt(input.handoffApiKey) : null;
  await mainDb.transaction().execute(async (trx) => {
    if (input.isDefault) {
      await trx
        .updateTable('external_acars_providers')
        .set({
          is_default: false,
          updated_by: updatedBy,
          updated_at: new Date(),
        })
        .where('id', '!=', input.id)
        .execute();
    }
    await trx
      .insertInto('external_acars_providers')
      .values({
        id: input.id,
        display_name: input.displayName,
        api_base_url: input.apiBaseUrl,
        token_header: input.tokenHeader,
        handoff_url: input.handoffUrl,
        handoff_api_key: key,
        enabled: input.enabled,
        is_default: input.isDefault,
        created_by: updatedBy,
        updated_by: updatedBy,
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          display_name: input.displayName,
          api_base_url: input.apiBaseUrl,
          token_header: input.tokenHeader,
          handoff_url: input.handoffUrl,
          ...(key ? { handoff_api_key: key } : {}),
          enabled: input.enabled,
          is_default: input.isDefault,
          updated_by: updatedBy,
          updated_at: new Date(),
        })
      )
      .execute();
  });

  const provider = await getExternalAcarsProvider(input.id, false);
  if (!provider) throw new Error('Provider was not saved');
  return toSummary(provider);
}

export async function deleteExternalAcarsProvider(
  id: string
): Promise<boolean> {
  const result = await mainDb
    .deleteFrom('external_acars_providers')
    .where('id', '=', id)
    .executeTakeFirst();
  return Number(result.numDeletedRows) > 0;
}
