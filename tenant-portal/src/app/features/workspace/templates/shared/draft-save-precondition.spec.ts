import { describe, expect, it } from 'vitest';
import { buildDraftSaveIfMatch } from './draft-save-precondition';

const sha = 'c'.repeat(64);
const advertised = {
  adapterKey: 'TRADE_QUOTATION_PRINT_V1' as const,
  schemaChecksum: sha,
  capabilities: { draftSavePrecondition: { kind: 'draft-schema' as const, scope: { type: 'TENANT' as const } } },
};

describe('buildDraftSaveIfMatch', () => {
  it('sends the strong draft-schema tag when the schema advertises it', () => {
    expect(
      buildDraftSaveIfMatch({ plainEtag: '"7"', revision: 7, dataSourceKey: 'TRADE_QUOTATION_PRINT_V1', schema: advertised }),
    ).toBe(`"draft-schema:${sha}:7"`);
  });

  it('keeps the plain tag without the capability, for another adapter, or without a schema', () => {
    const withoutCapability = { adapterKey: advertised.adapterKey, schemaChecksum: sha };
    expect(
      buildDraftSaveIfMatch({ plainEtag: '"7"', revision: 7, dataSourceKey: 'TRADE_QUOTATION_PRINT_V1', schema: withoutCapability }),
    ).toBe('"7"');
    expect(
      buildDraftSaveIfMatch({ plainEtag: '"7"', revision: 7, dataSourceKey: 'TRADE_SALES_ORDER_PRINT_V1', schema: advertised }),
    ).toBe('"7"');
    expect(
      buildDraftSaveIfMatch({ plainEtag: '"7"', revision: 7, dataSourceKey: 'TRADE_QUOTATION_PRINT_V1', schema: null }),
    ).toBe('"7"');
  });
});
