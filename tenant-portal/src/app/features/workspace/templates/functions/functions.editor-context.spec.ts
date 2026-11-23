import { describe, expect, it } from 'vitest';
import { TemplateApiError } from '../templates.api';
import {
  FAKE_TEMPLATE_IDS,
  fakeGetDataSourceSchema as getDataSourceSchema,
  fakeGetDraft as getDraft,
  fakeGetTemplate as getTemplate,
} from '../templates.fake';
import {
  fakeGetFunctionEditorContext as getFunctionEditorContext,
  fakeListFunctionVersions as listFunctionVersions,
  fakeListFunctions as listFunctions,
} from './functions.fake';
import type { FunctionEditorContextRequestDto } from './functions.model';

async function currentRequest(
  overrides: Partial<FunctionEditorContextRequestDto> = {},
): Promise<FunctionEditorContextRequestDto> {
  const templateId = FAKE_TEMPLATE_IDS.corporateQuotationId;
  const [def, draft] = await Promise.all([getTemplate(templateId), getDraft(templateId)]);
  const schema = await getDataSourceSchema(def.dataSourceKey, {
    scopeType: def.scope.type,
    companyId: def.scope.type === 'COMPANY' ? def.scope.companyId : undefined,
    schemaVersion: def.dataSourceSchemaVersion === 2 ? 2 : 1,
  });
  return {
    templateId,
    expectedDraftRevision: draft.revision,
    expectedContentChecksum: draft.contentChecksum,
    expectedOwnerContextFingerprint: schema.ownerContext?.fingerprint ?? '',
    functionVersionIds: [],
    currencyCodes: ['USD', 'EGP'],
    unitCodes: [],
    ...overrides,
  };
}

async function rejection(promise: Promise<unknown>): Promise<TemplateApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof TemplateApiError) return error;
    throw error;
  }
  throw new Error('Expected the call to reject.');
}

describe('functions fake editor-context contract', () => {
  it('returns a closed source-bound context valid for 30 seconds', async () => {
    const functions = await listFunctions({ limit: 100 });
    const withVersion = functions.items.find((f) => f.publishedVersionId && f.status === 'ACTIVE');
    const versionIds = withVersion ? [(await listFunctionVersions(withVersion.id)).items[0].id] : [];
    const request = await currentRequest({ functionVersionIds: versionIds });
    const ctx = await getFunctionEditorContext(request);

    expect(ctx.contract).toBe('template-native-editor-options.v1');
    expect(ctx.source).toEqual(
      expect.objectContaining({
        templateId: request.templateId,
        draftRevision: request.expectedDraftRevision,
        contentChecksum: request.expectedContentChecksum,
      }),
    );
    expect(ctx.request.currencyCodes).toEqual(['EGP', 'USD']);
    expect(ctx.rootFunctionVersionIds).toEqual([...versionIds].sort());
    for (const id of versionIds) expect(ctx.versions.map((v) => v.id)).toContain(id);
    expect(Date.parse(ctx.expiresAt) - Date.parse(ctx.issuedAt)).toBe(30_000);
    expect(ctx.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(ctx.release.ownerPackagePins).sort()).toEqual(['engine', 'provider', 'schema']);
    const def = await getTemplate(request.templateId);
    const schema = await getDataSourceSchema(def.dataSourceKey, {
      scopeType: def.scope.type,
      companyId: def.scope.type === 'COMPANY' ? def.scope.companyId : undefined,
      schemaVersion: def.dataSourceSchemaVersion === 2 ? 2 : 1,
    });
    expect(schema.ownerContext).toEqual(
      expect.objectContaining({
        contract: 'template-owner-context.v1',
        descriptorChecksum: schema.schemaChecksum,
        descriptorCanonicalSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );
    expect(schema.admission?.contract).toBe('template-data-source-admission.v1');
    expect(ctx.release.ownerPackagePins).toEqual(schema.ownerContext?.pins);
  });

  it('answers 412 STALE_REVISION for a changed draft revision', async () => {
    const request = await currentRequest();
    const error = await rejection(
      getFunctionEditorContext({ ...request, expectedDraftRevision: request.expectedDraftRevision + 1 }),
    );
    expect([error.status, error.code]).toEqual([412, 'CORE.TEMPLATE.CONCURRENCY.STALE_REVISION']);
  });

  it('answers 400 for an open body or duplicate list entries', async () => {
    const request = await currentRequest();
    const extra = await rejection(
      getFunctionEditorContext({ ...request, extra: true } as unknown as FunctionEditorContextRequestDto),
    );
    expect(extra.status).toBe(400);
    const dup = await rejection(getFunctionEditorContext({ ...request, currencyCodes: ['USD', 'USD'] }));
    expect(dup.status).toBe(400);
  });

  it('answers 422 for a currency the owner does not have active', async () => {
    const error = await rejection(getFunctionEditorContext(await currentRequest({ currencyCodes: ['XYZ'] })));
    expect([error.status, error.code]).toEqual([422, 'FUNCTION_DEFINITION_INVALID']);
  });
});
