import type { TemplateDataSourceKey, TemplateDataSourceSchemaDto } from '../templates.model';

/** Backend SALES_DRAFT_SCHEMA_PRECONDITION (template-platform.errors.ts). */
export const DRAFT_SCHEMA_PRECONDITION = 'draft-schema';

/**
 * If-Match for PATCH templates/:id/draft. When the loaded data-source schema advertises
 * `capabilities.draftSavePrecondition.kind === 'draft-schema'` (Sales Quotation, non-branch
 * scope) the strong tag `"draft-schema:<schemaChecksum>:<revision>"` is sent, so the backend
 * also rejects the save (409 CONCURRENCY.SCHEMA_CHANGED) when the retained draft schema
 * changed. Otherwise the plain `"<revision>"` draft ETag is sent unchanged.
 */
export function buildDraftSaveIfMatch(input: {
  plainEtag: string;
  revision: number;
  dataSourceKey: TemplateDataSourceKey | null | undefined;
  schema: Pick<TemplateDataSourceSchemaDto, 'adapterKey' | 'schemaChecksum' | 'capabilities'> | null | undefined;
}): string {
  const { plainEtag, revision, dataSourceKey, schema } = input;
  if (
    schema?.capabilities?.draftSavePrecondition?.kind !== DRAFT_SCHEMA_PRECONDITION ||
    !dataSourceKey ||
    schema.adapterKey !== dataSourceKey ||
    !/^[0-9a-f]{64}$/.test(schema.schemaChecksum)
  ) {
    return plainEtag;
  }
  const fromEtag = /^"([1-9][0-9]*)"$/.exec(plainEtag.trim())?.[1];
  return `"${DRAFT_SCHEMA_PRECONDITION}:${schema.schemaChecksum}:${fromEtag ?? revision}"`;
}
