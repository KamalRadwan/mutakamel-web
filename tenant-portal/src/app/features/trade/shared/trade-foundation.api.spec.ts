import { describe, expect, it } from 'vitest';
import type { CoreQuery, CoreWriteMethod, CoreWriteResult } from '../../../core/api/core-http';
import { ApiError } from './trade-api';
import {
  getItem,
  getItemSummary,
  itemName,
  listCategoryOptions,
  listChannels,
  listReasons,
  listReferenceData,
  listUoms,
  searchAccounts,
  searchCommercialAccounts,
  searchItemSummaries,
  searchItems,
  toSummary,
  uomById,
} from './trade-foundation.api';
import type {
  CategoryOption,
  Channel,
  CommercialAccount,
  ItemCompanyProfile,
  ItemDetail,
  ItemEligibility,
  ItemRow,
  Page,
  ReasonCode,
  ReferenceData,
  Tax,
  Uom,
} from './trade-foundation.model';
import { bindTradeHttpForTest, type TradeHttpTransport, type TradeReadOptions, type TradeWriteOptions } from './trade-http';
import { TradeHttpStub } from './testing/trade-http-testing';

const C1 = { companyId: 'comp-1' };
const C1_B1 = { companyId: 'comp-1', branchId: 'br-1' };

function makeUom(overrides: Partial<Uom> = {}): Uom {
  return {
    id: 'uom-pcs',
    code: 'PCS',
    displayName: 'Piece',
    localizedNames: { en: 'Piece', ar: 'قطعة' },
    status: 'ACTIVE',
    version: 1,
    updatedAt: '2026-11-23T08:00:00.000Z',
    ...overrides,
  };
}

function makeEligibility(overrides: Partial<ItemEligibility> = {}): ItemEligibility {
  return {
    companyProfileId: 'cp-1',
    companyProfileVersion: 2,
    companyProfileStatus: 'ACTIVE',
    canSell: true,
    canPurchase: true,
    canPos: false,
    salesPrice: '1850.000',
    currencyCode: 'EGP',
    salesTaxId: 'tax-vat14',
    purchaseTaxId: 'tax-vat14',
    baseUomId: 'uom-pcs',
    defaultSalesUomId: 'uom-pcs',
    defaultPurchaseUomId: 'uom-pcs',
    branchProfileId: null,
    branchProfileVersion: null,
    isAssorted: null,
    ...overrides,
  };
}

function makeItemRow(overrides: Partial<ItemRow> = {}): ItemRow {
  return {
    id: 'item-1',
    canonicalCode: 'ST-220',
    itemKind: 'PRODUCT',
    status: 'ACTIVE',
    localizedNames: { en: 'Steel shelf', ar: 'رف فولاذي' },
    baseUomId: 'uom-pcs',
    categoryId: 'cat-1',
    barcode: '6221234000012',
    ownerUserId: 'usr-1',
    weightKg: '2.500',
    volumeM3: null,
    notes: null,
    quotationDescription: null,
    salesOrderDescription: null,
    receiptDescription: null,
    deliveryOrderDescription: null,
    variantIdentity: null,
    currentImageId: null,
    image: null,
    categorySummary: null,
    eligibility: makeEligibility(),
    version: 2,
    createdAt: '2026-11-20T08:00:00.000Z',
    updatedAt: '2026-11-21T08:00:00.000Z',
    createdBy: 'usr-1',
    updatedBy: 'usr-1',
    ...overrides,
  };
}

function makeCompanyProfile(overrides: Partial<ItemCompanyProfile> = {}): ItemCompanyProfile {
  return {
    id: 'cp-1',
    itemId: 'item-1',
    companyId: 'comp-1',
    canSell: true,
    canPurchase: true,
    canPos: false,
    trackInventory: true,
    trackingMode: 'LOT',
    taxClassificationKey: null,
    defaultSalesUomId: null,
    defaultPurchaseUomId: null,
    salesPrice: '1850.000',
    currencyCode: 'EGP',
    salesTaxId: 'tax-vat14',
    purchaseTaxId: 'tax-vat14',
    capabilitySet: [],
    capabilitySetVersion: 1,
    accountingMappingKey: null,
    status: 'ACTIVE',
    version: 1,
    updatedAt: '2026-11-20T08:00:00.000Z',
    ...overrides,
  };
}

function makeItemDetail(overrides: Partial<ItemDetail> = {}): ItemDetail {
  const { eligibility: _elig, ...row } = makeItemRow();
  return {
    ...row,
    companyProfile: makeCompanyProfile(),
    branchProfile: null,
    comboComponents: [],
    optionalProducts: [],
    ...overrides,
  };
}

function makeTax(overrides: Partial<Tax> = {}): Tax {
  return {
    id: 'tax-vat14',
    code: 'VAT14',
    name: 'VAT 14%',
    rate: '14.000',
    isInclusive: false,
    companyId: 'comp-1',
    ...overrides,
  };
}

function makeRefData(taxes: Tax[] = [makeTax()]): ReferenceData {
  return {
    owners: [{ id: 'usr-1', name: 'Hany Mostafa' }],
    taxes,
    companyCurrencyCode: 'EGP',
  };
}

function makeChannel(overrides: Partial<Channel> = {}): Channel {
  return {
    id: 'ch-1',
    companyId: 'comp-1',
    code: 'INT-SALES',
    name: 'Internal sales',
    channelType: 'INTERNAL_SALES',
    status: 'ACTIVE',
    configurationProfileVersionId: null,
    activeBranchCount: 2,
    version: 1,
    createdAt: '2026-11-20T08:00:00.000Z',
    updatedAt: '2026-11-20T08:00:00.000Z',
    ...overrides,
  };
}

function makeAccount(overrides: Partial<CommercialAccount> = {}): CommercialAccount {
  return {
    id: 'acc-1',
    partyId: 'pty-1',
    companyId: 'comp-1',
    accountRole: 'CUSTOMER',
    paymentTermsId: null,
    creditLimit: '50000.000',
    creditCurrencyCode: 'EGP',
    priceBookId: null,
    creditPolicyVersionId: null,
    terms: {},
    status: 'ACTIVE',
    blockReasonCode: null,
    version: 1,
    createdAt: '2026-11-20T08:00:00.000Z',
    updatedAt: '2026-11-20T08:00:00.000Z',
    ...overrides,
  };
}

function makeReason(overrides: Partial<ReasonCode> = {}): ReasonCode {
  return {
    id: 'rsn-1',
    kind: 'DOCUMENT_CANCEL',
    code: 'CUSTOMER_REQUEST',
    localizedNames: { en: 'Customer request', ar: 'طلب العميل' },
    requiresNote: false,
    isActive: true,
    sortOrder: 1024,
    isSystem: false,
    version: 1,
    updatedAt: '2026-11-20T08:00:00.000Z',
    ...overrides,
  };
}

describe('trade-foundation.api', () => {
  describe('itemName', () => {
    it('resolves active language, falls back to en, then first non-empty entry', () => {
      expect(itemName({ localizedNames: { en: 'Steel', ar: 'فولاذ' } }, 'ar')).toBe('فولاذ');
      expect(itemName({ localizedNames: { en: 'Steel', ar: '' } }, 'fr')).toBe('Steel');
      expect(itemName({ localizedNames: { ar: 'فولاذ' } }, 'fr')).toBe('فولاذ');
      expect(itemName({ localizedNames: {} }, 'en')).toBe('');
    });
  });

  describe('searchItems', () => {
    it('calls GET /items with query names, OPTIONAL scope, and unwraps { items, total, page, limit }', async () => {
      const page: Page<ItemRow> = { items: [makeItemRow()], total: 1, page: 2, limit: 25 };
      const stub = new TradeHttpStub({ 'GET /items': page });
      const dispose = bindTradeHttpForTest(stub);
      try {
        const result = await searchItems(C1_B1, {
          page: 2,
          limit: 25,
          itemKind: 'PRODUCT',
          status: 'ACTIVE',
          purpose: 'SALES',
          categoryId: 'cat-1',
          search: '  st-220  ',
        });

        expect(result).toEqual(page);
        expect(stub.recordedReads()).toEqual([
          {
            path: '/items',
            query: {
              page: 2,
              limit: 25,
              itemKind: 'PRODUCT',
              status: 'ACTIVE',
              purpose: 'SALES',
              categoryId: 'cat-1',
              search: 'st-220',
            },
            scope: C1_B1,
          },
        ]);

        await searchItems({}, {});
        expect(stub.recordedReads()[1]).toEqual({
          path: '/items',
          query: undefined,
          scope: {},
        });
      } finally {
        dispose();
      }
    });

    it('propagates 400 validation details and 422 purpose scope errors', async () => {
      const validationErr = new ApiError(400, 'TRADE.VALIDATION_FAILED', { limit: ['must not be greater than 100'] });
      const stub = new TradeHttpStub({ 'GET /items': validationErr });
      const dispose = bindTradeHttpForTest(stub);
      try {
        await expect(searchItems(C1, { limit: 101 })).rejects.toMatchObject({
          status: 400,
          code: 'TRADE.VALIDATION_FAILED',
          details: { limit: ['must not be greater than 100'] },
        });

        const purposeErr = new ApiError(422, 'TRADE.CATALOG.COMPANY_PROFILE_INVALID');
        stub.register('GET', '/items', purposeErr);
        await expect(searchItems({}, { purpose: 'SALES' })).rejects.toBe(purposeErr);
      } finally {
        dispose();
      }
    });
  });

  describe('searchItemSummaries', () => {
    it('maps wire ItemRow eligibility into ItemSummary and resolves taxes via GET /items/reference-data', async () => {
      const row = makeItemRow({
        baseUomId: 'uom-pcs',
        eligibility: makeEligibility({
          defaultSalesUomId: 'uom-box',
          defaultPurchaseUomId: 'uom-ctn',
          salesTaxId: 'tax-vat14',
          purchaseTaxId: 'tax-vat14i',
        }),
      });
      const stub = new TradeHttpStub({
        'GET /items': { items: [row], total: 1, page: 1, limit: 25 },
        'GET /items/reference-data': makeRefData([
          makeTax({ id: 'tax-vat14', code: 'VAT14', rate: '14.000', isInclusive: false }),
          makeTax({ id: 'tax-vat14i', code: 'VAT14I', name: 'VAT 14% incl', rate: '14.000', isInclusive: true }),
        ]),
      });
      const dispose = bindTradeHttpForTest(stub);
      try {
        const res = await searchItemSummaries(C1, { search: 'ST-220' });
        expect(res.total).toBe(1);
        expect(res.items[0].defaultUomId).toBe('uom-box');
        expect(res.items[0].defaultPurchaseUomId).toBe('uom-ctn');
        expect(res.items[0].salesTaxDefault).toEqual({
          taxId: 'tax-vat14',
          code: 'VAT14',
          name: 'VAT 14%',
          rate: '14.000',
          isInclusive: false,
        });
        expect(res.items[0].purchaseTaxDefault?.isInclusive).toBe(true);
        expect(stub.recordedReads().map((r) => r.path)).toEqual(['/items', '/items/reference-data']);
      } finally {
        dispose();
      }
    });

    it('skips reference-data when no tax IDs are present and falls back to null when reference-data fails', async () => {
      const noTaxRow = makeItemRow({ eligibility: makeEligibility({ salesTaxId: null, purchaseTaxId: null }) });
      const stub = new TradeHttpStub({
        'GET /items': { items: [noTaxRow], total: 1, page: 1, limit: 25 },
      });
      const dispose = bindTradeHttpForTest(stub);
      try {
        const clean = await searchItemSummaries(C1);
        expect(clean.items[0].salesTaxDefault).toBeNull();
        expect(stub.recordedReads()).toHaveLength(1);

        const taxedRow = makeItemRow({ eligibility: makeEligibility({ salesTaxId: 'tax-vat14', purchaseTaxId: null }) });
        stub.register('GET', '/items', { items: [taxedRow], total: 1, page: 1, limit: 25 });
        stub.register('GET', '/items/reference-data', new ApiError(500, 'COMMON.GENERIC.INTERNAL_ERROR'));
        const fallback = await searchItemSummaries(C1);
        expect(fallback.items[0].salesTaxDefault).toBeNull();
      } finally {
        dispose();
      }
    });
  });

  describe('getItem', () => {
    it('calls GET /items/:id with OPTIONAL scope and unwraps detail; propagates 404 ApiError', async () => {
      const detail = makeItemDetail();
      const stub = new TradeHttpStub({ 'GET /items/:id': detail });
      const dispose = bindTradeHttpForTest(stub);
      try {
        const result = await getItem(C1_B1, 'item-1');
        expect(result).toEqual(detail);
        expect(stub.recordedReads()[0]).toEqual({
          path: '/items/item-1',
          query: undefined,
          scope: C1_B1,
        });

        const notFound = new ApiError(404, 'TRADE.CATALOG.ITEM_NOT_FOUND');
        stub.register('GET', '/items/:id', notFound);
        await expect(getItem(C1, 'item-missing')).rejects.toBe(notFound);
      } finally {
        dispose();
      }
    });
  });

  describe('getItemSummary and toSummary fallbacks', () => {
    it('resolves defaultUomId from defaultSalesUomId and resolves salesTaxDefault/purchaseTaxDefault from reference-data', async () => {
      const detail = makeItemDetail({
        baseUomId: 'uom-ton',
        companyProfile: makeCompanyProfile({
          trackingMode: 'SERIAL',
          defaultSalesUomId: 'uom-kg',
          defaultPurchaseUomId: 'uom-ctn',
          salesTaxId: 'tax-vat14i',
          purchaseTaxId: 'tax-vat14',
        }),
      });
      const stub = new TradeHttpStub({
        'GET /items/:id': detail,
        'GET /items/reference-data': makeRefData([
          makeTax({ id: 'tax-vat14', code: 'VAT14', rate: '14.000', isInclusive: false }),
          makeTax({ id: 'tax-vat14i', code: 'VAT14I', name: 'VAT 14% incl', rate: '14.000', isInclusive: true }),
        ]),
      });
      const dispose = bindTradeHttpForTest(stub);
      try {
        const summary = await getItemSummary(C1, 'item-1');
        expect(summary.sku).toBe('ST-220');
        expect(summary.trackingMode).toBe('SERIAL');
        expect(summary.baseUomId).toBe('uom-ton');
        expect(summary.defaultUomId).toBe('uom-kg');
        expect(summary.defaultPurchaseUomId).toBe('uom-ctn');
        expect(summary.salesTaxDefault?.code).toBe('VAT14I');
        expect(summary.salesTaxDefault?.isInclusive).toBe(true);
        expect(summary.purchaseTaxDefault?.code).toBe('VAT14');
      } finally {
        dispose();
      }
    });

    it('falls back to baseUomId when defaultSalesUomId/defaultPurchaseUomId are null, and null taxes when companyProfile is null or tax is unknown', async () => {
      const noDefaultUom = makeItemDetail({
        baseUomId: 'uom-pcs',
        companyProfile: makeCompanyProfile({
          defaultSalesUomId: null,
          defaultPurchaseUomId: null,
          salesTaxId: 'tax-unknown',
          purchaseTaxId: null,
        }),
      });
      const stub = new TradeHttpStub({
        'GET /items/:id': noDefaultUom,
        'GET /items/reference-data': makeRefData([makeTax({ id: 'tax-vat14' })]),
      });
      const dispose = bindTradeHttpForTest(stub);
      try {
        const res1 = await getItemSummary(C1, 'item-1');
        expect(res1.defaultUomId).toBe('uom-pcs');
        expect(res1.defaultPurchaseUomId).toBe('uom-pcs');
        expect(res1.salesTaxDefault).toBeNull();
        expect(res1.purchaseTaxDefault).toBeNull();

        stub.reset();
        stub.register('GET', '/items/:id', makeItemDetail({ baseUomId: 'uom-pcs', companyProfile: null }));
        const res2 = await getItemSummary({}, 'item-1');
        expect(res2.companyProfile).toBeNull();
        expect(res2.trackingMode).toBe('NONE');
        expect(res2.defaultUomId).toBe('uom-pcs');
        expect(res2.defaultPurchaseUomId).toBe('uom-pcs');
        expect(res2.salesTaxDefault).toBeNull();
        expect(stub.recordedReads()).toHaveLength(1);

        const notFound = new ApiError(404, 'TRADE.CATALOG.ITEM_NOT_FOUND');
        stub.register('GET', '/items/:id', notFound);
        await expect(getItemSummary(C1, 'missing')).rejects.toBe(notFound);
      } finally {
        dispose();
      }

      const directFallback = toSummary(makeItemRow({ baseUomId: 'uom-m2', eligibility: null }), {});
      expect(directFallback.defaultUomId).toBe('uom-m2');
      expect(directFallback.companyProfile).toBeNull();
    });
  });

  describe('listUoms and uomById', () => {
    it('calls GET /uoms with OPTIONAL scope and status filter, and caches results for uomById', async () => {
      const pcs = makeUom({ id: 'uom-pcs', code: 'PCS' });
      const kg = makeUom({ id: 'uom-kg', code: 'KG', displayName: 'Kilogram' });
      const doz = makeUom({ id: 'uom-doz', code: 'DOZ', status: 'RETIRED' });
      const stub = new TradeHttpStub({
        'GET /uoms': { items: [pcs, kg], total: 2, page: 1, limit: 100 },
      });
      const dispose = bindTradeHttpForTest(stub);
      try {
        const all = await listUoms(undefined, C1_B1);
        expect(all).toEqual([pcs, kg]);
        expect(stub.recordedReads()[0]).toEqual({
          path: '/uoms',
          query: { page: 1, limit: 100 },
          scope: C1_B1,
        });
        expect(uomById('uom-kg')?.code).toBe('KG');
        expect(uomById('uom-nope')).toBeUndefined();

        stub.register('GET', '/uoms', { items: [doz], total: 1, page: 1, limit: 100 });
        const retired = await listUoms({ status: 'RETIRED' });
        expect(retired).toEqual([doz]);
        expect(stub.recordedReads()[1]).toEqual({
          path: '/uoms',
          query: { page: 1, limit: 100, status: 'RETIRED' },
          scope: {},
        });
      } finally {
        dispose();
      }
    });

    it('merges pages when GET /uoms total exceeds 100', async () => {
      const page1Items = Array.from({ length: 100 }, (_, i) => makeUom({ id: `uom-${i + 1}`, code: `U${i + 1}` }));
      const page2Items = [makeUom({ id: 'uom-101', code: 'U101' })];
      const reads: { path: string; query?: CoreQuery; scope?: TradeReadOptions['scope'] }[] = [];

      const pagedTransport: TradeHttpTransport = {
        async read<T>(path: string, query?: CoreQuery, options?: TradeReadOptions): Promise<T> {
          reads.push({ path, query, scope: options?.scope });
          const pageNum = Number(query?.['page'] ?? 1);
          return {
            items: pageNum === 1 ? page1Items : page2Items,
            total: 101,
            page: pageNum,
            limit: 100,
          } as T;
        },
        readBlob(): Promise<Blob> {
          throw new Error('unused');
        },
        write<T>(_m: CoreWriteMethod, _p: string, _b: unknown, _o: TradeWriteOptions): Promise<CoreWriteResult<T>> {
          throw new Error('unused');
        },
        writeMultipart<T>(): Promise<CoreWriteResult<T>> {
          throw new Error('unused');
        },
      };

      const dispose = bindTradeHttpForTest(pagedTransport);
      try {
        const result = await listUoms();
        expect(result).toHaveLength(101);
        expect(reads.map((r) => r.query?.['page'])).toEqual([1, 2]);
      } finally {
        dispose();
      }
    });

    it('calls GET /catalog/uoms when itemId is provided, resolves companyId fallback, and propagates errors', async () => {
      const stub = new TradeHttpStub({
        'GET /catalog/uoms': {
          items: [
            {
              id: 'uom-ton',
              code: 'TON',
              displayName: 'Ton',
              localizedNames: { en: 'Ton', ar: 'طن' },
              version: 1,
            },
          ],
          total: 1,
          page: 1,
          limit: 100,
        },
      });
      const dispose = bindTradeHttpForTest(stub);
      try {
        const uoms = await listUoms({ itemId: 'item-54', purpose: 'SALES', companyId: 'comp-1' });
        expect(uoms).toHaveLength(1);
        expect(uoms[0].status).toBe('ACTIVE');
        expect(stub.recordedReads()[0]).toEqual({
          path: '/catalog/uoms',
          query: { page: 1, limit: 100, itemId: 'item-54', purpose: 'SALES' },
          scope: { companyId: 'comp-1' },
        });
        expect(uomById('uom-ton')?.code).toBe('TON');

        const notFound = new ApiError(404, 'TRADE.CATALOG.ITEM_NOT_FOUND');
        stub.register('GET', '/catalog/uoms', notFound);
        await expect(listUoms({ itemId: 'item-missing' }, C1)).rejects.toBe(notFound);
      } finally {
        dispose();
      }
    });
  });

  describe('listCategoryOptions', () => {
    it('calls GET /catalog/categories with OPTIONAL scope and unwraps items', async () => {
      const option: CategoryOption = {
        id: 'cat-1',
        code: 'ELEC',
        name: 'Electronics',
        path: [{ id: 'cat-1', code: 'ELEC', name: 'Electronics' }],
        depth: 1,
      };
      const stub = new TradeHttpStub({
        'GET /catalog/categories': { items: [option], total: 1, page: 1, limit: 100 },
      });
      const dispose = bindTradeHttpForTest(stub);
      try {
        const list = await listCategoryOptions(C1_B1, '  elec  ');
        expect(list).toEqual([option]);
        expect(stub.recordedReads()[0]).toEqual({
          path: '/catalog/categories',
          query: { limit: 100, search: 'elec' },
          scope: C1_B1,
        });

        const err = new ApiError(400, 'TRADE.CATALOG.CATEGORY_QUERY_INVALID', { search: ['invalid'] });
        stub.register('GET', '/catalog/categories', err);
        await expect(listCategoryOptions({})).rejects.toMatchObject({
          status: 400,
          code: 'TRADE.CATALOG.CATEGORY_QUERY_INVALID',
          details: { search: ['invalid'] },
        });
      } finally {
        dispose();
      }
    });
  });

  describe('listChannels', () => {
    it('calls GET /channels with COMPANY scope (stripping branchId), preserves activeBranchCount, and rejects missing company locally', async () => {
      const ch = makeChannel({ activeBranchCount: 3 });
      const stub = new TradeHttpStub({
        'GET /channels': { items: [ch], total: 1, page: 1, limit: 100 },
      });
      const dispose = bindTradeHttpForTest(stub);
      try {
        await expect(listChannels({})).rejects.toMatchObject({
          status: 400,
          code: 'TRADE.SCOPE.REQUIRED',
        });
        expect(stub.recordedReads()).toHaveLength(0);

        const channels = await listChannels(C1_B1);
        expect(channels).toEqual([ch]);
        expect(channels[0].activeBranchCount).toBe(3);
        expect(stub.recordedReads()[0]).toEqual({
          path: '/channels',
          query: { page: 1, limit: 100 },
          scope: { companyId: 'comp-1' },
        });
      } finally {
        dispose();
      }
    });
  });

  describe('searchAccounts and searchCommercialAccounts', () => {
    it('calls GET /commercial-accounts with accountRole query and OPTIONAL scope, unwraps items, and maps partyName', async () => {
      const acc = makeAccount();
      const stub = new TradeHttpStub({
        'GET /commercial-accounts': {
          items: [
            {
              ...acc,
              party: {
                id: 'pty-1',
                displayName: 'Nile Electronics Co.',
                displayNameAr: null,
                partyType: 'ORGANIZATION',
                code: null,
              },
            },
          ],
          total: 1,
          page: 1,
          limit: 100,
        },
      });
      const dispose = bindTradeHttpForTest(stub);
      try {
        const rows = await searchAccounts(C1_B1, { role: 'CUSTOMER', status: 'ACTIVE', search: '  Nile  ' });
        expect(rows).toEqual([
          {
            ...acc,
            party: {
              id: 'pty-1',
              displayName: 'Nile Electronics Co.',
              partyType: 'ORGANIZATION',
              code: null,
            },
          },
        ]);
        expect(stub.recordedReads()[0]).toEqual({
          path: '/commercial-accounts',
          query: { page: 1, limit: 100, accountRole: 'CUSTOMER', status: 'ACTIVE', search: 'Nile' },
          scope: C1_B1,
        });

        const summaries = await searchCommercialAccounts(C1, {});
        expect(summaries[0].partyName).toBe('Nile Electronics Co.');

        const missingCompany = new ApiError(400, 'TRADE.CONTEXT.MISSING_COMPANY');
        stub.register('GET', '/commercial-accounts', missingCompany);
        await expect(searchAccounts({})).rejects.toBe(missingCompany);
      } finally {
        dispose();
      }
    });
  });

  describe('listReferenceData', () => {
    it('calls GET /items/reference-data with OPTIONAL scope and unwraps owners, taxes, and companyCurrencyCode', async () => {
      const data = makeRefData();
      const stub = new TradeHttpStub({ 'GET /items/reference-data': data });
      const dispose = bindTradeHttpForTest(stub);
      try {
        const result = await listReferenceData(C1, '  vat  ');
        expect(result).toEqual(data);
        expect(stub.recordedReads()[0]).toEqual({
          path: '/items/reference-data',
          query: { limit: 50, search: 'vat' },
          scope: C1,
        });

        const err = new ApiError(422, 'TRADE.CATALOG.COMPANY_PROFILE_INVALID');
        stub.register('GET', '/items/reference-data', err);
        await expect(listReferenceData(C1)).rejects.toBe(err);
      } finally {
        dispose();
      }
    });
  });

  describe('listReasons', () => {
    it('calls GET /reason-codes with kind and includeInactive under OPTIONAL scope and unwraps { items }', async () => {
      const reason = makeReason();
      const stub = new TradeHttpStub({ 'GET /reason-codes': { items: [reason] } });
      const dispose = bindTradeHttpForTest(stub);
      try {
        const activeOnly = await listReasons('DOCUMENT_CANCEL');
        expect(activeOnly).toEqual([reason]);
        expect(stub.recordedReads()[0]).toEqual({
          path: '/reason-codes',
          query: { kind: 'DOCUMENT_CANCEL', includeInactive: false },
          scope: {},
        });

        const withInactive = await listReasons('DOCUMENT_DISCOUNT', { includeInactive: true }, C1_B1);
        expect(withInactive).toEqual([reason]);
        expect(stub.recordedReads()[1]).toEqual({
          path: '/reason-codes',
          query: { kind: 'DOCUMENT_DISCOUNT', includeInactive: true },
          scope: C1_B1,
        });
      } finally {
        dispose();
      }
    });

    it('handles empty list, passes through 403 forbidden without wrapping, and preserves 422 field details', async () => {
      const stub = new TradeHttpStub({ 'GET /reason-codes': { items: [] } });
      const dispose = bindTradeHttpForTest(stub);
      try {
        await expect(listReasons('DOCUMENT_CANCEL')).resolves.toEqual([]);

        const forbidden = new ApiError(403, 'TRADE.AUTH.TARGET_DENIED');
        stub.register('GET', '/reason-codes', forbidden);
        await expect(listReasons('DOCUMENT_CANCEL', undefined, C1)).rejects.toBe(forbidden);

        const badKind = new ApiError(422, 'TRADE.REASON.KIND_INVALID', { field: ['kind'] });
        stub.register('GET', '/reason-codes', badKind);
        await expect(listReasons('DOCUMENT_CANCEL')).rejects.toMatchObject({
          status: 422,
          code: 'TRADE.REASON.KIND_INVALID',
          details: { field: ['kind'] },
        });
      } finally {
        dispose();
      }
    });
  });
});
