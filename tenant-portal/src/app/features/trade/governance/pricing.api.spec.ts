import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../shared/trade-api';
import { bindTradeHttpForTest } from '../shared/trade-http';
import { TradeHttpStub } from '../shared/testing/trade-http-testing';
import {
  changeEntries,
  changePromotions,
  cloneVersion,
  createPriceBook,
  createVersion,
  deleteCompanyDefault,
  deleteVersion,
  evaluate,
  getDiff,
  getKpis,
  getPriceBook,
  getPriceVersion,
  getReferenceData,
  listCompanyDefaults,
  listEntries,
  listPriceBooks,
  publishVersion,
  retireVersion,
  testVersion,
  updatePriceBook,
  updateVersion,
  upsertCompanyDefault,
} from './pricing.api';
import type {
  ChangeEntriesResult,
  ChangePromotionsResult,
  CompanyDefaultList,
  CompanyDefaultRow,
  CreatedPriceBook,
  DeletedResult,
  PriceBookDossier,
  PriceBookHeader,
  PriceBookKpis,
  PriceBookListItem,
  PriceDiff,
  PriceEntry,
  PriceTestResult,
  PriceVersionDetail,
  PriceVersionHeadDetail,
  PriceVersionRow,
  PricingDecision,
  SavedPriceVersion,
} from './pricing.model';
import { isAwaitingActivation } from './pricing.service';

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMPANY_CTX = { companyId: 'comp-1', branchId: 'br-1' };

function makeBookHeader(overrides: Partial<PriceBookHeader> = {}): PriceBookHeader {
  return {
    id: 'pb-1',
    companyId: 'comp-1',
    code: 'RETAIL-EGP',
    purpose: 'SALES',
    currencyCode: 'EGP',
    status: 'ACTIVE',
    version: 2,
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-21T10:00:00.000Z',
    name: 'Retail',
    localizedNames: { en: 'Retail', ar: 'التجزئة' },
    description: null,
    ...overrides,
  };
}

function makeVersionRow(overrides: Partial<PriceVersionRow> = {}): PriceVersionRow {
  return {
    id: 'pv-1',
    priceBookId: 'pb-1',
    versionNumber: 1,
    status: 'DRAFT',
    effectiveFrom: '2026-12-01T00:00:00.000Z',
    effectiveTo: null,
    supersededByVersionId: null,
    supersededAt: null,
    checksum: 'abc123',
    version: 3,
    createdBy: null,
    updatedBy: null,
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-21T10:00:00.000Z',
    ...overrides,
  };
}

describe('pricing.api', () => {
  let stub: TradeHttpStub;
  let dispose: () => void;

  beforeEach(() => {
    stub = new TradeHttpStub();
    dispose = bindTradeHttpForTest(stub);
  });

  afterEach(() => {
    dispose();
  });

  describe('reads (OPTIONAL scope)', () => {
    it('listPriceBooks calls GET /price-books with query and OPTIONAL scope', async () => {
      const page = {
        items: [{ ...makeBookHeader(), versionCount: 1, versions: [], isCompanyDefault: false, linkedAccountsCount: 0, entryCount: 0, promotionCount: 0 } satisfies PriceBookListItem],
        total: 1,
        page: 1,
        limit: 24,
      };
      stub.register('GET', '/price-books', page);

      const res = await listPriceBooks({
        page: 1,
        limit: 24,
        purpose: 'SALES',
        status: 'ACTIVE',
        currencyCode: 'EGP',
        q: 'ret',
        governanceState: 'PUBLISHED',
      });
      expect(res).toEqual(page);
      expect(stub.recordedReads()[0]).toEqual({
        path: '/price-books',
        query: {
          page: 1,
          limit: 24,
          purpose: 'SALES',
          status: 'ACTIVE',
          currencyCode: 'EGP',
          q: 'ret',
          governanceState: 'PUBLISHED',
        },
        scope: {},
      });

      await listPriceBooks({}, COMPANY_CTX);
      expect(stub.recordedReads()[1].scope).toEqual(COMPANY_CTX);
    });

    it('getKpis calls GET /price-books/kpis with OPTIONAL scope', async () => {
      const kpis: PriceBookKpis = {
        total: 3,
        active: 2,
        inactive: 1,
        sales: 2,
        purchase: 1,
        publishedBooks: 1,
        scheduledBooks: 1,
        testedBooks: 0,
        draftOnlyBooks: 1,
        mappedDefaults: 1,
        distinctCurrencies: ['EGP'],
      };
      stub.register('GET', '/price-books/kpis', kpis);

      const res = await getKpis({ purpose: 'SALES', currencyCode: 'EGP' }, COMPANY_CTX);
      expect(res).toEqual(kpis);
      expect(stub.recordedReads()[0]).toEqual({
        path: '/price-books/kpis',
        query: { purpose: 'SALES', currencyCode: 'EGP' },
        scope: COMPANY_CTX,
      });
    });

    it('getPriceBook calls GET /price-books/:id with OPTIONAL scope and nullable createdByUserId (P-4)', async () => {
      const dossier: PriceBookDossier = {
        book: { ...makeBookHeader(), isCompanyDefault: true },
        companyDefaultMapping: null,
        versions: [
          {
            id: 'pv-1',
            versionNumber: 1,
            status: 'DRAFT',
            effectiveFrom: '2026-12-01T00:00:00.000Z',
            effectiveTo: null,
            supersededAt: null,
            supersededByVersionId: null,
            version: 1,
            checksum: 'chk',
            createdByUserId: null,
            createdByDisplayName: null,
            createdByEmail: null,
            createdAt: '2026-11-20T00:00:00.000Z',
            updatedAt: '2026-11-20T00:00:00.000Z',
            entryCount: 0,
            promotionCount: 0,
            latestTestPassed: null,
            latestTestedAt: null,
            notes: null,
            clonedFromVersionId: null,
            sourceMode: 'EMPTY_DRAFT',
          },
        ],
        linkedAccounts: [],
        activeLocksCount: 0,
        auditTrail: [],
      };
      stub.register('GET', '/price-books/:id', dossier);

      const res = await getPriceBook('pb/1', { companyId: 'comp-1' });
      expect(res.versions[0].createdByUserId).toBeNull();
      expect(stub.recordedReads()[0]).toEqual({
        path: '/price-books/pb%2F1',
        query: undefined,
        scope: { companyId: 'comp-1' },
      });
    });

    it('getPriceVersion calls GET /price-book-versions/:id, passes include, and handles nullable entry labels (P-1)', async () => {
      const detail: PriceVersionDetail = {
        canViewCost: false,
        entryCount: 1,
        soloOwnerGovernanceEligible: false,
        book: {
          id: 'pb-1',
          code: 'PB1',
          purpose: 'SALES',
          currencyCode: 'EGP',
          status: 'ACTIVE',
          version: 1,
          name: 'PB1',
          localizedNames: { en: 'PB1' },
          description: null,
          versions: [],
        },
        version: {
          id: 'pv-1',
          versionNumber: 1,
          status: 'DRAFT',
          effectiveFrom: '2026-12-01T00:00:00.000Z',
          effectiveTo: null,
          supersededAt: null,
          supersededByVersionId: null,
          version: 1,
          checksum: 'chk',
          createdByUserId: null,
          createdByDisplayName: null,
          createdByEmail: null,
          notes: null,
          clonedFromVersionId: null,
          sourceMode: 'MANUAL',
        },
        entries: [
          {
            id: 'pe-1',
            version: 1,
            itemCompanyProfileId: 'icp-1',
            itemId: 'item-1',
            itemCode: null,
            itemLocalizedNames: null,
            uomId: 'uom-1',
            uomCode: null,
            uomDisplayName: null,
            uomLocalizedNames: null,
            currencyCode: 'EGP',
            minimumQuantity: '1',
            maximumQuantity: null,
            unitPrice: '10',
            minimumAllowedPrice: null,
            priority: 100,
            standardCost: null,
            catalogSalesPrice: null,
          },
        ],
        promotions: [],
        latestTestEvidence: null,
        auditTrail: [],
      };
      stub.register('GET', '/price-book-versions/:id', detail);

      const full = await getPriceVersion('pv-1');
      expect(full.entries[0].itemCode).toBeNull();
      expect(full.entries[0].uomLocalizedNames).toBeNull();
      expect(stub.recordedReads()[0]).toEqual({
        path: '/price-book-versions/pv-1',
        query: undefined,
        scope: {},
      });

      const headFixture: PriceVersionHeadDetail = {
        canViewCost: true,
        entryCount: 0,
        soloOwnerGovernanceEligible: false,
        book: detail.book,
        versionHead: detail.version,
        version: 1,
        promotions: [],
        latestTestEvidence: null,
        auditTrail: [],
      };
      stub.register('GET', '/price-book-versions/:id', headFixture);

      const headOnly = await getPriceVersion('pv-1', { include: 'none' }, { companyId: 'comp-1' });
      expect(headOnly.versionHead.id).toBe('pv-1');
      expect(stub.recordedReads()[1]).toEqual({
        path: '/price-book-versions/pv-1',
        query: { include: 'none' },
        scope: { companyId: 'comp-1' },
      });
    });

    it('listEntries calls GET /price-book-versions/:id/entries with query params', async () => {
      const page = { items: [] as PriceEntry[], total: 0, page: 2, limit: 50 };
      stub.register('GET', '/price-book-versions/:id/entries', page);

      await listEntries('pv-1', {
        page: 2,
        limit: 50,
        q: 'flour',
        uomId: 'u1',
        itemId: 'i1',
        sort: 'unitPrice',
        dir: 'asc',
      });
      expect(stub.recordedReads()[0]).toEqual({
        path: '/price-book-versions/pv-1/entries',
        query: { page: 2, limit: 50, q: 'flour', uomId: 'u1', itemId: 'i1', sort: 'unitPrice', dir: 'asc' },
        scope: {},
      });
    });

    it('getDiff calls GET /price-book-versions/:id/diff/:compareVersionId', async () => {
      const diff: PriceDiff = {
        currencyCode: 'EGP',
        targetVersion: { id: 'pv-2', priceBookId: 'pb-1', priceBookCode: 'PB', versionNumber: 2, status: 'DRAFT' },
        baselineVersion: { id: 'pv-1', priceBookId: 'pb-1', priceBookCode: 'PB', versionNumber: 1, status: 'PUBLISHED' },
        summary: { totalCompared: 0, added: 0, removed: 0, increased: 0, decreased: 0, unchanged: 0, promotionsChanged: 0 },
        entries: [],
        promotions: [],
      };
      stub.register('GET', '/price-book-versions/:id/diff/:compareVersionId', diff);

      const res = await getDiff('pv-2', 'pv-1', { companyId: 'comp-1' });
      expect(res).toEqual(diff);
      expect(stub.recordedReads()[0]).toEqual({
        path: '/price-book-versions/pv-2/diff/pv-1',
        query: undefined,
        scope: { companyId: 'comp-1' },
      });
    });

    it('getReferenceData normalizes backend wire branches/currencies and preserves canViewCost (P-2)', async () => {
      stub.register('GET', '/pricing/reference-data', {
        canViewCost: true,
        items: [
          {
            itemId: 'i-1',
            canonicalCode: 'SUGAR',
            itemKind: 'PRODUCT',
            localizedNames: { en: 'Sugar' },
            baseUomId: 'u-1',
            defaultSalesUomId: 'u-1',
            defaultPurchaseUomId: null,
            canSell: true,
            canPurchase: false,
            salesPrice: '25',
            standardCost: '15',
            currencyCode: 'EGP',
          },
        ],
        uoms: [{ id: 'u-1', code: 'KG', displayName: 'Kilogram', localizedNames: { en: 'Kilogram' } }],
        branches: [{ id: 'b-1', code: 'HQ', name: 'Main Branch', isHeadquarters: true }],
        channels: [{ id: 'ch-1', code: 'POS', name: 'POS', channelType: 'POS' }],
        commercialAccounts: [],
        currencies: [{ code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', decimalPlaces: 2, isDefault: true }],
      });

      const data = await getReferenceData({ companyId: 'comp-1' });
      expect(data.canViewCost).toBe(true);
      expect(data.items).toHaveLength(1);
      expect(data.uoms).toHaveLength(1);
      expect(data.channels).toHaveLength(1);
      expect(data.branches).toEqual([
        {
          id: 'b-1',
          code: 'HQ',
          name: 'Main Branch',
          nameEn: 'Main Branch',
          nameAr: 'Main Branch',
          companyId: 'comp-1',
          isHeadquarters: true,
        },
      ]);
      expect(data.currencies).toEqual([
        {
          code: 'EGP',
          name: 'Egyptian Pound',
          nameEn: 'Egyptian Pound',
          nameAr: 'Egyptian Pound',
          symbol: 'E£',
          decimalPlaces: 2,
          isDefault: true,
        },
      ]);
    });

    it('listCompanyDefaults calls GET /configuration/company-default-price-books', async () => {
      const list: CompanyDefaultList = { items: [] };
      stub.register('GET', '/configuration/company-default-price-books', list);

      const res = await listCompanyDefaults({ companyId: 'comp-1' });
      expect(res).toEqual(list);
      expect(stub.recordedReads()[0]).toEqual({
        path: '/configuration/company-default-price-books',
        query: undefined,
        scope: { companyId: 'comp-1' },
      });
    });
  });

  describe('writes (COMPANY scope + UUIDv7 x-idempotency-key + If-Match)', () => {
    it('createPriceBook sends POST /price-books with COMPANY scope, UUIDv7 key, no If-Match, and requires companyId', async () => {
      const created: CreatedPriceBook = {
        id: 'pb-1',
        companyId: 'comp-1',
        code: 'WHOLESALE',
        purpose: 'SALES',
        currencyCode: 'EGP',
        status: 'ACTIVE',
        version: 1,
        createdAt: '2026-11-23T00:00:00.000Z',
        updatedAt: '2026-11-23T00:00:00.000Z',
      };
      stub.register('POST', '/price-books', created);

      await expect(
        createPriceBook({ code: 'WHOLESALE', purpose: 'SALES', currencyCode: 'EGP' }),
      ).rejects.toMatchObject({ status: 400, code: 'TRADE.SCOPE.REQUIRED' });

      const res = await createPriceBook(
        { code: 'WHOLESALE', purpose: 'SALES', currencyCode: 'EGP', name: 'Wholesale' },
        undefined,
        COMPANY_CTX,
      );
      expect(res).toEqual(created);
      const write = stub.recordedWrites()[0];
      expect(write.method).toBe('POST');
      expect(write.path).toBe('/price-books');
      expect(write.scope).toEqual({ companyId: 'comp-1' });
      expect(write.key).toMatch(UUID_V7_REGEX);
      expect(write.ifMatch).toBeUndefined();
      expect(write.body).toEqual({
        code: 'WHOLESALE',
        purpose: 'SALES',
        currencyCode: 'EGP',
        name: 'Wholesale',
      });
    });

    it('updatePriceBook sends PATCH /price-books/:id with If-Match and rejects missing If-Match', async () => {
      stub.register('PATCH', '/price-books/:id', makeBookHeader({ version: 3 }));

      await expect(
        updatePriceBook('pb-1', { status: 'INACTIVE' }, undefined, undefined, COMPANY_CTX),
      ).rejects.toMatchObject({ status: 400, code: 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED' });

      await updatePriceBook('pb-1', { status: 'INACTIVE' }, 2, undefined, COMPANY_CTX);
      const write = stub.recordedWrites()[0];
      expect(write.method).toBe('PATCH');
      expect(write.path).toBe('/price-books/pb-1');
      expect(write.ifMatch).toBe('"2"');
      expect(write.key).toMatch(UUID_V7_REGEX);
      expect(write.scope).toEqual({ companyId: 'comp-1' });
    });

    it('createVersion & updateVersion strip id from entries/promotions (P-5)', async () => {
      const saved: SavedPriceVersion = { ...makeVersionRow(), entryCount: 1, promotionCount: 1 };
      stub.register('POST', '/price-books/:id/versions', saved);
      stub.register('PATCH', '/price-book-versions/:id', saved);

      await createVersion(
        'pb-1',
        {
          effectiveFrom: '2026-12-01T00:00:00.000Z',
          entries: [
            {
              id: 'temp-1',
              itemId: 'i-1',
              uomId: 'u-1',
              currencyCode: 'EGP',
              minimumQuantity: '1',
              unitPrice: '10',
            },
          ],
          promotions: [
            {
              id: 'temp-p-1',
              code: 'P10',
              name: '10% off',
              benefitType: 'PERCENTAGE',
              discountValue: '10',
              exclusive: false,
            },
          ],
        },
        2,
        undefined,
        COMPANY_CTX,
      );

      const createBody = stub.recordedWrites()[0].body as {
        entries: Record<string, unknown>[];
        promotions: Record<string, unknown>[];
      };
      expect(createBody.entries[0]['id']).toBeUndefined();
      expect(createBody.promotions[0]['id']).toBeUndefined();
      expect(stub.recordedWrites()[0].ifMatch).toBe('"2"');

      await updateVersion(
        'pv-1',
        {
          entries: [
            {
              id: 'entry-1',
              itemId: 'i-1',
              uomId: 'u-1',
              currencyCode: 'EGP',
              minimumQuantity: '1',
              unitPrice: '12',
            },
          ],
        },
        3,
        undefined,
        COMPANY_CTX,
      );
      const patchBody = stub.recordedWrites()[1].body as { entries: Record<string, unknown>[] };
      expect(patchBody.entries[0]['id']).toBeUndefined();
      expect(stub.recordedWrites()[1].ifMatch).toBe('"3"');
    });

    it('cloneVersion enforces S1 boolean guard and sends POST /price-books/:id/versions/clone', async () => {
      const saved: SavedPriceVersion = { ...makeVersionRow(), entryCount: 0, promotionCount: 0 };
      stub.register('POST', '/price-books/:id/versions/clone', saved);

      await expect(
        cloneVersion(
          'pb-1',
          {
            sourceMode: 'CLONE_VERSION',
            sourceVersionId: 'pv-0',
            effectiveFrom: '2026-12-01T00:00:00.000Z',
            includePromotions: 'true' as unknown as boolean,
          },
          1,
          undefined,
          COMPANY_CTX,
        ),
      ).rejects.toMatchObject({ status: 400, code: 'TRADE.VALIDATION_FAILED' });

      await cloneVersion(
        'pb-1',
        {
          sourceMode: 'EMPTY_DRAFT',
          effectiveFrom: '2026-12-01T00:00:00.000Z',
          includePromotions: false,
        },
        1,
        undefined,
        COMPANY_CTX,
      );
      expect(stub.recordedWrites()[0].path).toBe('/price-books/pb-1/versions/clone');
      expect(stub.recordedWrites()[0].ifMatch).toBe('"1"');
    });

    it('changeEntries keeps id when present, omits id for new rows, sends single batch, and propagates 409 conflict', async () => {
      const result: ChangeEntriesResult = {
        id: 'pv-1',
        status: 'DRAFT',
        checksum: 'chk2',
        version: 4,
        entryCount: 2,
        promotionCount: 0,
        changedEntryIds: ['e-1', 'e-2'],
      };
      stub.register('POST', '/price-book-versions/:id/entries/changes', result);

      const res = await changeEntries(
        'pv-1',
        {
          upserts: [
            {
              id: 'e-1',
              itemId: 'i-1',
              uomId: 'u-1',
              currencyCode: 'EGP',
              minimumQuantity: '1',
              unitPrice: '15',
            },
            {
              itemId: 'i-2',
              uomId: 'u-1',
              currencyCode: 'EGP',
              minimumQuantity: '1',
              unitPrice: '20',
            },
          ],
          deletes: ['e-old'],
        },
        3,
        undefined,
        COMPANY_CTX,
      );
      expect(res).toEqual(result);
      expect(stub.recordedWrites()).toHaveLength(1);
      const write = stub.recordedWrites()[0];
      expect(write.path).toBe('/price-book-versions/pv-1/entries/changes');
      expect(write.ifMatch).toBe('"3"');
      expect(write.scope).toEqual({ companyId: 'comp-1' });
      expect(write.body).toEqual({
        upserts: [
          {
            id: 'e-1',
            itemId: 'i-1',
            uomId: 'u-1',
            currencyCode: 'EGP',
            minimumQuantity: '1',
            unitPrice: '15',
          },
          {
            itemId: 'i-2',
            uomId: 'u-1',
            currencyCode: 'EGP',
            minimumQuantity: '1',
            unitPrice: '20',
          },
        ],
        deletes: ['e-old'],
      });

      const conflict = new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
      stub.register('POST', '/price-book-versions/:id/entries/changes', conflict);
      await expect(
        changeEntries('pv-1', { deletes: ['e-1'] }, 3, undefined, COMPANY_CTX),
      ).rejects.toMatchObject({ status: 409, code: 'TRADE.CONCURRENCY.STALE_VERSION' });
    });

    it('changePromotions keeps optional id, enforces boolean exclusive, and calls POST .../promotions/changes', async () => {
      const result: ChangePromotionsResult = {
        id: 'pv-1',
        status: 'DRAFT',
        checksum: 'chk3',
        version: 5,
        entryCount: 1,
        promotionCount: 1,
        changedPromotionIds: ['pr-1'],
      };
      stub.register('POST', '/price-book-versions/:id/promotions/changes', result);

      await expect(
        changePromotions(
          'pv-1',
          {
            upserts: [
              {
                code: 'BAD',
                name: 'Bad',
                benefitType: 'PERCENTAGE',
                discountValue: '5',
                exclusive: 'false' as unknown as boolean,
              },
            ],
          },
          4,
          undefined,
          COMPANY_CTX,
        ),
      ).rejects.toMatchObject({ status: 400, code: 'TRADE.VALIDATION_FAILED' });

      const res = await changePromotions(
        'pv-1',
        {
          upserts: [
            {
              id: 'pr-1',
              code: 'SAVE10',
              name: 'Save 10',
              benefitType: 'PERCENTAGE',
              discountValue: '10',
              exclusive: true,
            },
          ],
          deletes: [],
        },
        4,
        undefined,
        COMPANY_CTX,
      );
      expect(res).toEqual(result);
      expect(stub.recordedWrites()[0].ifMatch).toBe('"4"');
    });

    it('deleteVersion & testVersion require positive If-Match and send empty body', async () => {
      const deleted: DeletedResult = { id: 'pv-1', deleted: true };
      const testRes: PriceTestResult = {
        evidenceId: 'ev-1',
        checksum: 'chk',
        version: 4,
        passed: true,
        entryCount: 1,
        promotionCount: 0,
        conflicts: [],
        promotionConflicts: [],
      };
      stub.register('DELETE', '/price-book-versions/:id', deleted);
      stub.register('POST', '/price-book-versions/:id/test', testRes);

      expect(await deleteVersion('pv-1', 3, undefined, COMPANY_CTX)).toEqual(deleted);
      expect(await testVersion('pv-1', 3, undefined, COMPANY_CTX)).toEqual(testRes);
      expect(stub.recordedWrites()[0]).toMatchObject({
        method: 'DELETE',
        path: '/price-book-versions/pv-1',
        body: undefined,
        ifMatch: '"3"',
      });
      expect(stub.recordedWrites()[1]).toMatchObject({
        method: 'POST',
        path: '/price-book-versions/pv-1/test',
        body: undefined,
        ifMatch: '"3"',
      });
    });

    it('publishVersion enforces boolean soloOwnerAttestation and handles nullable createdBy/updatedBy (P-4)', async () => {
      const published = makeVersionRow({ status: 'PUBLISHED', createdBy: null, updatedBy: null });
      stub.register('POST', '/price-book-versions/:id/publish', published);

      await expect(
        publishVersion(
          'pv-1',
          { soloOwnerAttestation: 'true' as unknown as boolean },
          3,
          undefined,
          COMPANY_CTX,
        ),
      ).rejects.toMatchObject({ status: 400, code: 'TRADE.VALIDATION_FAILED' });

      const res = await publishVersion(
        'pv-1',
        { soloOwnerAttestation: true, approvalNotes: 'ok' },
        3,
        undefined,
        COMPANY_CTX,
      );
      expect(res.createdBy).toBeNull();
      expect(res.updatedBy).toBeNull();
      expect(stub.recordedWrites()[0].body).toEqual({
        soloOwnerAttestation: true,
        approvalNotes: 'ok',
      });
    });

    it('retireVersion sends only reasonCode and optional reasonNote, never deprecated reason (P-6)', async () => {
      const retired = makeVersionRow({ status: 'RETIRED' });
      stub.register('POST', '/price-book-versions/:id/retire', retired);

      await retireVersion(
        'pv-1',
        { reasonCode: 'SUPERCEDED', reasonNote: 'Old seasonal list', reason: 'deprecated' } as never,
        3,
        undefined,
        COMPANY_CTX,
      );
      const write = stub.recordedWrites()[0];
      expect(write.path).toBe('/price-book-versions/pv-1/retire');
      expect(write.ifMatch).toBe('"3"');
      expect(write.body).toEqual({
        reasonCode: 'SUPERCEDED',
        reasonNote: 'Old seasonal list',
      });
    });

    it('upsertCompanyDefault allows If-Match "0" (create) and positive version, and deleteCompanyDefault requires positive version', async () => {
      const row: CompanyDefaultRow = {
        id: 'cd-1',
        companyId: 'comp-1',
        purpose: 'SALES',
        currencyCode: 'EGP',
        priceBookId: 'pb-1',
        version: 1,
        createdAt: '2026-11-23T00:00:00.000Z',
        updatedAt: '2026-11-23T00:00:00.000Z',
      };
      const deleted: DeletedResult = { id: 'cd-1', deleted: true };
      stub.register('POST', '/configuration/company-default-price-books/:purpose/:currencyCode/upsert', row);
      stub.register('DELETE', '/configuration/company-default-price-books/:purpose/:currencyCode', deleted);

      await upsertCompanyDefault('SALES', 'EGP', 'pb-1', 0, undefined, COMPANY_CTX);
      await upsertCompanyDefault('SALES', 'EGP', 'pb-1', 2, undefined, COMPANY_CTX);
      await deleteCompanyDefault('SALES', 'EGP', 2, undefined, COMPANY_CTX);

      expect(stub.recordedWrites()[0]).toMatchObject({
        method: 'POST',
        path: '/configuration/company-default-price-books/SALES/EGP/upsert',
        ifMatch: '"0"',
        body: { priceBookId: 'pb-1' },
        scope: { companyId: 'comp-1' },
      });
      expect(stub.recordedWrites()[1].ifMatch).toBe('"2"');
      expect(stub.recordedWrites()[2]).toMatchObject({
        method: 'DELETE',
        path: '/configuration/company-default-price-books/SALES/EGP',
        ifMatch: '"2"',
        body: undefined,
      });

      await expect(
        deleteCompanyDefault('SALES', 'EGP', 0, undefined, COMPANY_CTX),
      ).rejects.toMatchObject({ status: 400, code: 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED' });
    });
  });

  describe('evaluate (single POST, OPTIONAL scope)', () => {
    it('posts whitelisted DTO in one call with OPTIONAL scope and fresh UUIDv7 key', async () => {
      const decision: PricingDecision = {
        priceBookSource: 'COMPANY_DEFAULT',
        engineVersion: 'trade-pricing-engine.v1',
        decisionId: 'dec-1',
        decisionType: 'SALES_PRICE',
        outcome: 'ALLOW',
        unitPrice: '90',
        currencyCode: 'EGP',
        priceBookId: 'pb-1',
        priceBookVersionId: 'pv-1',
        priceBookVersion: 1,
        checksum: 'chk',
        matchedEntryId: 'e-1',
        baselineUnitPrice: '100',
        minimumAllowedPrice: '80',
        matchedPromotions: [],
        rejectedPromotions: [],
        components: [{ kind: 'BASE_PRICE', referenceId: 'e-1', amount: '100' }],
        rejectedCandidates: [],
        inputFingerprint: 'fp-1',
        evaluatedAt: '2026-11-23T12:00:00.000Z',
        taxFinal: false,
      };
      stub.register('POST', '/pricing/evaluate', decision);

      const res = await evaluate(
        {
          purpose: 'SALES',
          itemId: 'i-1',
          uomId: 'u-1',
          quantity: '2',
          currencyCode: 'EGP',
          branchId: 'br-1',
        },
        COMPANY_CTX,
      );
      expect(res).toEqual(decision);
      expect(stub.recordedWrites()).toHaveLength(1);
      expect(stub.recordedReads()).toHaveLength(0);
      expect(stub.recordedWrites()[0]).toMatchObject({
        method: 'POST',
        path: '/pricing/evaluate',
        scope: COMPANY_CTX,
      });
      expect(stub.recordedWrites()[0].key).toMatch(UUID_V7_REGEX);
    });
  });

  describe('isAwaitingActivation (B5)', () => {
    it('returns true only when status is SCHEDULED and effectiveFrom is in the future', () => {
      const now = Date.parse('2026-11-23T12:00:00.000Z');
      expect(
        isAwaitingActivation(
          { status: 'SCHEDULED', effectiveFrom: '2026-12-01T00:00:00.000Z' },
          now,
        ),
      ).toBe(true);
      expect(
        isAwaitingActivation(
          { status: 'SCHEDULED', effectiveFrom: '2026-11-23T12:00:00.000Z' },
          now,
        ),
      ).toBe(false);
      expect(
        isAwaitingActivation(
          { status: 'PUBLISHED', effectiveFrom: '2026-12-01T00:00:00.000Z' },
          now,
        ),
      ).toBe(false);
    });
  });
});
