import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, newIdempotencyKey } from '../../shared/trade-api';
import type {
  Channel,
  ChannelListing,
  ItemBranchProfile,
  ItemCompanyProfile,
  ItemDetail,
  ItemImageSummary,
  ItemRow,
  ItemStandardCost,
  Page,
  StatusCounts,
} from '../../shared/trade-foundation.model';
import { bindTradeHttpForTest } from '../../shared/trade-http';
import { TradeHttpStub } from '../../shared/testing/trade-http-testing';
import { itemImageRenditionUrl, itemThumbUrl, releaseThumbUrl } from '../../shared/trade-image';
import {
  countItemsByStatus,
  createBranchProfile,
  createCompanyProfile,
  createItem,
  createListing,
  deleteItemImage,
  getItemDetail,
  getReferenceData,
  getStandardCost,
  itemErrorKey,
  listFulfillmentNodeOptions,
  listItemListings,
  listItems,
  listListingChannels,
  moveItemStatus,
  patchBranchProfile,
  patchCompanyProfile,
  patchItem,
  patchListing,
  patchStandardCost,
  putItemImage,
} from './items.api';
import type {
  ItemImageReceipt,
  ItemImageRemoved,
  ItemReferenceData,
  ItemSaved,
} from './items.model';

const C1 = { companyId: '01900000-0000-7000-8000-0000000000c1' };
const C1_B1 = {
  companyId: '01900000-0000-7000-8000-0000000000c1',
  branchId: '01900000-0000-7000-8000-0000000000b1',
};
const ITEM_ID = '01900000-0000-7000-8000-000000000001';
const UOM_ID = '01900000-0000-7000-8000-000000000010';
const CH_ID = '01900000-0000-7000-8000-000000000020';
const IMG_ID = '01900000-0000-7000-8000-000000000030';
const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function makeImageSummary(): ItemImageSummary {
  return {
    id: IMG_ID,
    sequence: 1,
    thumb: {
      mimeType: 'image/webp',
      widthPx: 256,
      heightPx: 256,
      sha256: 'a'.repeat(64),
    },
    print: {
      mimeType: 'image/png',
      widthPx: 512,
      heightPx: 512,
    },
    hasAlpha: true,
    createdAt: '2026-11-23T09:00:00.000Z',
  };
}

function makeItemRow(overrides: Partial<ItemRow> = {}): ItemRow {
  return {
    id: ITEM_ID,
    canonicalCode: 'STEEL-01',
    itemKind: 'PRODUCT',
    status: 'DRAFT',
    localizedNames: { en: 'Steel shelf', ar: 'رف فولاذي' },
    baseUomId: UOM_ID,
    categoryId: null,
    barcode: null,
    ownerUserId: null,
    weightKg: null,
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
    eligibility: null,
    version: 1,
    createdAt: '2026-11-23T08:00:00.000Z',
    updatedAt: '2026-11-23T08:00:00.000Z',
    createdBy: 'usr-1',
    updatedBy: 'usr-1',
    ...overrides,
  };
}

function makeItemSaved(overrides: Partial<ItemSaved> = {}): ItemSaved {
  const { image: _img, categorySummary: _cat, eligibility: _elig, ...rest } = makeItemRow();
  return {
    ...rest,
    comboComponents: [],
    optionalProducts: [],
    ...overrides,
  };
}

function makeItemDetail(overrides: Partial<ItemDetail> = {}): ItemDetail {
  const { eligibility: _elig, ...row } = makeItemRow();
  return {
    ...row,
    companyProfile: null,
    branchProfile: null,
    comboComponents: [],
    optionalProducts: [],
    ...overrides,
  };
}

function makeCompanyProfile(overrides: Partial<ItemCompanyProfile> = {}): ItemCompanyProfile {
  return {
    id: 'cp-1',
    itemId: ITEM_ID,
    companyId: C1.companyId,
    canSell: true,
    canPurchase: true,
    canPos: false,
    trackInventory: true,
    trackingMode: 'LOT',
    taxClassificationKey: null,
    defaultSalesUomId: UOM_ID,
    defaultPurchaseUomId: UOM_ID,
    salesPrice: '150.00',
    currencyCode: 'EGP',
    salesTaxId: 'tax-1',
    purchaseTaxId: 'tax-2',
    capabilitySet: [],
    capabilitySetVersion: 1,
    accountingMappingKey: null,
    status: 'ACTIVE',
    version: 1,
    updatedAt: '2026-11-23T08:00:00.000Z',
    ...overrides,
  };
}

function makeBranchProfile(overrides: Partial<ItemBranchProfile> = {}): ItemBranchProfile {
  return {
    id: 'bp-1',
    itemCompanyProfileId: 'cp-1',
    companyId: C1.companyId,
    branchId: C1_B1.branchId,
    defaultFulfillmentNodeId: null,
    isAssorted: true,
    replenishmentPolicyKey: null,
    restrictions: {},
    version: 1,
    ...overrides,
  };
}

function makeListing(overrides: Partial<ChannelListing> = {}): ChannelListing {
  return {
    id: 'lst-1',
    channelId: CH_ID,
    branchId: null,
    publicationStatus: 'DRAFT',
    saleConstraints: {},
    version: 1,
    updatedAt: '2026-11-23T08:00:00.000Z',
    ...overrides,
  };
}

function makeChannel(overrides: Partial<Channel> = {}): Channel {
  return {
    id: CH_ID,
    companyId: C1.companyId,
    code: 'POS-1',
    name: 'Main POS',
    channelType: 'POS',
    status: 'ACTIVE',
    configurationProfileVersionId: null,
    activeBranchCount: 1,
    version: 1,
    createdAt: '2026-11-23T08:00:00.000Z',
    updatedAt: '2026-11-23T08:00:00.000Z',
    ...overrides,
  };
}

describe('items.api & trade-image', () => {
  const origCreateObjectURL = URL.createObjectURL;
  const origRevokeObjectURL = URL.revokeObjectURL;

  afterEach(() => {
    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it('listItems sends GET /items with query names and OPTIONAL scope and unwraps page', async () => {
    const page: Page<ItemRow> = { items: [makeItemRow()], total: 1, page: 2, limit: 24 };
    const stub = new TradeHttpStub({ 'GET /items': page });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const result = await listItems(C1_B1, {
        page: 2,
        limit: 24,
        status: 'ACTIVE',
        itemKind: 'PRODUCT',
        purpose: 'SALES',
        categoryId: 'cat-1',
        categoryIds: ['cat-1', 'cat-2'],
        includeSubcategories: false,
        ownerUserId: 'usr-1',
        hasImage: false,
        scope: 'COMPANY',
        sort: 'canonicalCode',
        direction: 'asc',
        search: '  shelf  ',
      });

      expect(result).toEqual(page);
      expect(stub.recordedReads()).toEqual([
        {
          path: '/items',
          query: {
            page: 2,
            limit: 24,
            status: 'ACTIVE',
            itemKind: 'PRODUCT',
            purpose: 'SALES',
            categoryId: 'cat-1',
            categoryIds: ['cat-1', 'cat-2'],
            includeSubcategories: false,
            ownerUserId: 'usr-1',
            hasImage: false,
            scope: 'COMPANY',
            sort: 'canonicalCode',
            direction: 'asc',
            search: 'shelf',
          },
          scope: C1_B1,
        },
      ]);

      const validationErr = new ApiError(400, 'TRADE.VALIDATION_FAILED', { limit: ['must not be greater than 100'] });
      stub.register('GET', '/items', validationErr);
      await expect(listItems({}, { page: 1, limit: 200 })).rejects.toMatchObject({
        status: 400,
        code: 'TRADE.VALIDATION_FAILED',
        details: { limit: ['must not be greater than 100'] },
      });
    } finally {
      dispose();
    }
  });

  it('countItemsByStatus sends one GET /items/status-counts request stripping list-only params', async () => {
    const counts: StatusCounts<'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED'> = {
      DRAFT: 3,
      ACTIVE: 5,
      INACTIVE: 1,
      DISCONTINUED: 2,
      total: 11,
    };
    const stub = new TradeHttpStub({ 'GET /items/status-counts': counts });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const res = await countItemsByStatus(C1, {
        status: 'ACTIVE',
        sort: 'name',
        direction: 'asc',
        itemKind: 'PRODUCT',
        scope: 'COMPANY',
        search: '  steel ',
      });

      expect(res).toEqual({
        ALL: 11,
        DRAFT: 3,
        ACTIVE: 5,
        INACTIVE: 1,
        DISCONTINUED: 2,
      });
      expect(stub.recordedReads()).toEqual([
        {
          path: '/items/status-counts',
          query: {
            itemKind: 'PRODUCT',
            scope: 'COMPANY',
            search: 'steel',
          },
          scope: C1,
        },
      ]);
    } finally {
      dispose();
    }
  });

  it('getItemDetail calls GET /items/:id with OPTIONAL scope and unwraps detail', async () => {
    const detail = makeItemDetail({ companyProfile: makeCompanyProfile(), branchProfile: makeBranchProfile() });
    const stub = new TradeHttpStub({ 'GET /items/:id': detail });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const res = await getItemDetail(C1_B1, ITEM_ID);
      expect(res).toEqual(detail);
      expect(stub.recordedReads()).toEqual([
        { path: `/items/${ITEM_ID}`, query: undefined, scope: C1_B1 },
      ]);
    } finally {
      dispose();
    }
  });

  it('createItem, patchItem, and moveItemStatus send key (+ If-Match on PATCH), NONE scope, and whitelisted DTO fields', async () => {
    const saved = makeItemSaved({ version: 2 });
    const stub = new TradeHttpStub({
      'POST /items': saved,
      'PATCH /items/:id': saved,
    });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const createKey = newIdempotencyKey();
      const created = await createItem(
        {
          canonicalCode: 'STEEL-01',
          itemKind: 'PRODUCT',
          localizedNames: { en: 'Steel shelf', ar: 'رف فولاذي' },
          baseUomId: UOM_ID,
          variantIdentity: { color: 'silver' },
          extensionProfileVersionId: 'ext-1',
          extensionValues: [],
        } as never,
        createKey,
      );
      expect(created).toEqual(saved);

      const patchKey = newIdempotencyKey();
      await patchItem(
        ITEM_ID,
        2,
        {
          canonicalCode: 'SHOULD-BE-STRIPPED',
          itemKind: 'SERVICE',
          baseUomId: UOM_ID,
          variantIdentity: { x: 1 },
          localizedNames: { en: 'Renamed' },
          notes: 'Updated',
        } as never,
        patchKey,
      );

      const moveKey = newIdempotencyKey();
      await moveItemStatus(ITEM_ID, 2, 'DISCONTINUED', moveKey, {
        reasonCodeId: 'rsn-1',
        reasonNote: 'End of line',
      });

      const writes = stub.recordedWrites();
      expect(writes).toHaveLength(3);
      expect(writes[0]).toEqual({
        method: 'POST',
        path: '/items',
        body: {
          canonicalCode: 'STEEL-01',
          itemKind: 'PRODUCT',
          localizedNames: { en: 'Steel shelf', ar: 'رف فولاذي' },
          baseUomId: UOM_ID,
        },
        key: createKey,
        ifMatch: undefined,
        scope: undefined,
        query: undefined,
      });
      expect(writes[0].key).toMatch(UUID_V7_REGEX);

      expect(writes[1]).toEqual({
        method: 'PATCH',
        path: `/items/${ITEM_ID}`,
        body: {
          localizedNames: { en: 'Renamed' },
          notes: 'Updated',
        },
        key: patchKey,
        ifMatch: '"2"',
        scope: undefined,
        query: undefined,
      });

      expect(writes[2]).toEqual({
        method: 'PATCH',
        path: `/items/${ITEM_ID}`,
        body: {
          status: 'DISCONTINUED',
          reasonCodeId: 'rsn-1',
          reasonNote: 'End of line',
        },
        key: moveKey,
        ifMatch: '"2"',
        scope: undefined,
        query: undefined,
      });

      await expect(
        createItem(
          {
            canonicalCode: 'A',
            itemKind: 'PRODUCT',
            localizedNames: { en: 'A' },
            baseUomId: UOM_ID,
          },
          '',
        ),
      ).rejects.toMatchObject({ status: 400, code: 'TRADE.IDEMPOTENCY.KEY_MISSING' });

      const conflict = new ApiError(409, 'TRADE.CATALOG.CODE_TAKEN', { field: ['canonicalCode'] });
      stub.register('POST', '/items', conflict);
      await expect(
        createItem(
          {
            canonicalCode: 'STEEL-01',
            itemKind: 'PRODUCT',
            localizedNames: { en: 'Steel' },
            baseUomId: UOM_ID,
          },
          newIdempotencyKey(),
        ),
      ).rejects.toMatchObject({
        status: 409,
        code: 'TRADE.CATALOG.CODE_TAKEN',
        details: { field: ['canonicalCode'] },
      });
    } finally {
      dispose();
    }
  });

  it('createCompanyProfile and patchCompanyProfile enforce COMPANY scope, preserve wire names without renames, and strip capabilitySet', async () => {
    const cp = makeCompanyProfile();
    const stub = new TradeHttpStub({
      'POST /items/:id/company-profile': cp,
      'PATCH /items/:id/company-profile': { ...cp, version: 2 },
    });
    const dispose = bindTradeHttpForTest(stub);
    try {
      await expect(
        createCompanyProfile(
          {},
          ITEM_ID,
          { canSell: true, canPurchase: false, trackInventory: false, trackingMode: 'NONE' },
          newIdempotencyKey(),
        ),
      ).rejects.toMatchObject({ status: 400, code: 'TRADE.SCOPE.REQUIRED' });

      const createKey = newIdempotencyKey();
      const created = await createCompanyProfile(
        C1_B1,
        ITEM_ID,
        {
          canSell: true,
          canPurchase: true,
          canPos: false,
          trackInventory: true,
          trackingMode: 'LOT',
          defaultSalesUomId: UOM_ID,
          salesTaxId: 'tax-1',
          purchaseTaxId: 'tax-2',
          capabilitySet: ['SHOULD_STRIP'],
        } as never,
        createKey,
      );
      expect(created.defaultSalesUomId).toBe(UOM_ID);
      expect(created.salesTaxId).toBe('tax-1');
      expect(created.purchaseTaxId).toBe('tax-2');

      const patchKey = newIdempotencyKey();
      const patched = await patchCompanyProfile(
        C1_B1,
        ITEM_ID,
        1,
        {
          defaultSalesUomId: 'uom-box',
          salesTaxId: 'tax-vat14',
          capabilitySet: ['SHOULD_STRIP'],
        } as never,
        patchKey,
      );
      expect(patched.version).toBe(2);

      const writes = stub.recordedWrites();
      expect(writes).toHaveLength(2);
      expect(writes[0]).toEqual({
        method: 'POST',
        path: `/items/${ITEM_ID}/company-profile`,
        body: {
          canSell: true,
          canPurchase: true,
          canPos: false,
          trackInventory: true,
          trackingMode: 'LOT',
          defaultSalesUomId: UOM_ID,
          salesTaxId: 'tax-1',
          purchaseTaxId: 'tax-2',
        },
        key: createKey,
        ifMatch: undefined,
        scope: C1,
        query: undefined,
      });
      expect(writes[1]).toEqual({
        method: 'PATCH',
        path: `/items/${ITEM_ID}/company-profile`,
        body: {
          defaultSalesUomId: 'uom-box',
          salesTaxId: 'tax-vat14',
        },
        key: patchKey,
        ifMatch: '"1"',
        scope: C1,
        query: undefined,
      });
    } finally {
      dispose();
    }
  });

  it('getStandardCost and patchStandardCost enforce COMPANY scope, key, and If-Match', async () => {
    const cost: ItemStandardCost = {
      itemId: ITEM_ID,
      companyProfileId: 'cp-1',
      standardCost: '120.50',
      currencyCode: 'EGP',
      version: 3,
    };
    const stub = new TradeHttpStub({
      'GET /items/:id/standard-cost': cost,
      'PATCH /items/:id/standard-cost': { ...cost, standardCost: '130.00', version: 4 },
    });
    const dispose = bindTradeHttpForTest(stub);
    try {
      expect(() => getStandardCost({}, ITEM_ID)).toThrowError(expect.objectContaining({
        status: 400,
        code: 'TRADE.SCOPE.REQUIRED',
      }));
      expect(stub.recordedReads()).toHaveLength(0);

      const loaded = await getStandardCost(C1_B1, ITEM_ID);
      expect(loaded).toEqual(cost);
      expect(stub.recordedReads()).toEqual([
        { path: `/items/${ITEM_ID}/standard-cost`, query: undefined, scope: C1 },
      ]);

      const key = newIdempotencyKey();
      const updated = await patchStandardCost(C1_B1, ITEM_ID, 3, '130.00', key);
      expect(updated.standardCost).toBe('130.00');
      expect(stub.recordedWrites()).toEqual([
        {
          method: 'PATCH',
          path: `/items/${ITEM_ID}/standard-cost`,
          body: { standardCost: '130.00' },
          key,
          ifMatch: '"3"',
          scope: C1,
          query: undefined,
        },
      ]);
    } finally {
      dispose();
    }
  });

  it('createBranchProfile and patchBranchProfile enforce BRANCH scope (missing branch -> local 400) and strip restrictions', async () => {
    const bp = makeBranchProfile();
    const stub = new TradeHttpStub({
      'POST /items/:id/branch-profile': bp,
      'PATCH /items/:id/branch-profile': { ...bp, isAssorted: false, version: 2 },
    });
    const dispose = bindTradeHttpForTest(stub);
    try {
      await expect(
        createBranchProfile(C1, ITEM_ID, { isAssorted: true }, newIdempotencyKey()),
      ).rejects.toMatchObject({ status: 400, code: 'TRADE.SCOPE.REQUIRED' });
      expect(stub.recordedWrites()).toHaveLength(0);

      const createKey = newIdempotencyKey();
      await createBranchProfile(
        C1_B1,
        ITEM_ID,
        {
          isAssorted: true,
          defaultFulfillmentNodeId: 'node-1',
          restrictions: { minQty: 5 },
        } as never,
        createKey,
      );

      const patchKey = newIdempotencyKey();
      const patched = await patchBranchProfile(
        C1_B1,
        ITEM_ID,
        1,
        { isAssorted: false, restrictions: { blocked: true } } as never,
        patchKey,
      );
      expect(patched.isAssorted).toBe(false);

      expect(stub.recordedWrites()).toEqual([
        {
          method: 'POST',
          path: `/items/${ITEM_ID}/branch-profile`,
          body: { isAssorted: true, defaultFulfillmentNodeId: 'node-1' },
          key: createKey,
          ifMatch: undefined,
          scope: C1_B1,
          query: undefined,
        },
        {
          method: 'PATCH',
          path: `/items/${ITEM_ID}/branch-profile`,
          body: { isAssorted: false },
          key: patchKey,
          ifMatch: '"1"',
          scope: C1_B1,
          query: undefined,
        },
      ]);
    } finally {
      dispose();
    }
  });

  it('listings: listItemListings, createListing (F-6/F-18), patchListing (F-7/F-18), and listListingChannels', async () => {
    const projection = makeListing({ publicationStatus: 'PUBLISHED' });
    const rawWriteEntity = {
      ...projection,
      itemCompanyProfileId: 'cp-1',
      companyId: C1.companyId,
      branchScopeKey: 'none',
    };
    const chActive = makeChannel({ id: CH_ID, activeBranchCount: 1, status: 'ACTIVE' });
    const chEmpty = makeChannel({ id: 'ch-empty', activeBranchCount: 0, status: 'ACTIVE' });
    const stub = new TradeHttpStub({
      'GET /items/:id/channel-listings': { items: [projection], total: 1, page: 1, limit: 50 },
      'POST /items/:id/channel-listings': rawWriteEntity,
      'PATCH /items/:id/channel-listings/:channelId': rawWriteEntity,
      'GET /channels': { items: [chActive, chEmpty], total: 2, page: 1, limit: 100 },
      'GET /channels/:id': { ...chActive, branches: [{ branchId: C1_B1.branchId, isActive: true }] },
    });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const list = await listItemListings(C1_B1, ITEM_ID, 1, 50);
      expect(list.items).toEqual([projection]);

      const createKey = newIdempotencyKey();
      const created = await createListing(C1, ITEM_ID, { channelId: CH_ID }, createKey);
      expect(created).toEqual(projection);
      expect('itemCompanyProfileId' in created).toBe(false);
      expect('branchScopeKey' in created).toBe(false);

      const patchKey = newIdempotencyKey();
      const patched = await patchListing(
        C1,
        ITEM_ID,
        CH_ID,
        1,
        { publicationStatus: 'PUBLISHED', saleConstraints: { max: 5 } } as never,
        patchKey,
      );
      expect(patched).toEqual(projection);

      expect(stub.recordedWrites()).toEqual([
        {
          method: 'POST',
          path: `/items/${ITEM_ID}/channel-listings`,
          body: { channelId: CH_ID },
          key: createKey,
          ifMatch: undefined,
          scope: C1,
          query: undefined,
        },
        {
          method: 'PATCH',
          path: `/items/${ITEM_ID}/channel-listings/${CH_ID}`,
          body: { publicationStatus: 'PUBLISHED' },
          key: patchKey,
          ifMatch: '"1"',
          scope: C1,
          query: undefined,
        },
      ]);

      const companyChannels = await listListingChannels(C1);
      expect(companyChannels.map((c) => c.linkedToBranch)).toEqual([null, null]);

      const branchChannels = await listListingChannels(C1_B1);
      expect(branchChannels.map((c) => c.linkedToBranch)).toEqual([true, false]);
      expect(stub.recordedReads().slice(-2)).toEqual([
        { path: '/channels', query: { page: 1, limit: 100 }, scope: C1 },
        { path: `/channels/${CH_ID}`, query: undefined, scope: C1 },
      ]);
    } finally {
      dispose();
    }
  });

  it('putItemImage sends PUT multipart with key + If-Match and NONE scope; deleteItemImage sends DELETE', async () => {
    const imgReceipt: ItemImageReceipt = {
      itemId: ITEM_ID,
      itemVersion: 2,
      image: makeImageSummary(),
      replaced: false,
    };
    const imgRemoved: ItemImageRemoved = {
      itemId: ITEM_ID,
      itemVersion: 3,
      removed: true,
    };
    const stub = new TradeHttpStub({
      'PUT /items/:id/image': imgReceipt,
      'DELETE /items/:id/image': imgRemoved,
    });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const file = new File([new Uint8Array([1, 2, 3])], 'shelf.png', { type: 'image/png' });
      const putKey = newIdempotencyKey();
      const receipt = await putItemImage(ITEM_ID, 1, file, putKey);
      expect(receipt).toEqual(imgReceipt);

      const delKey = newIdempotencyKey();
      const removed = await deleteItemImage(ITEM_ID, 2, delKey);
      expect(removed).toEqual(imgRemoved);

      const writes = stub.recordedWrites();
      expect(writes).toHaveLength(2);
      expect(writes[0].method).toBe('PUT');
      expect(writes[0].path).toBe(`/items/${ITEM_ID}/image`);
      expect(writes[0].key).toBe(putKey);
      expect(writes[0].ifMatch).toBe('"1"');
      expect(writes[0].scope).toBeUndefined();
      expect(writes[0].body).toBeInstanceOf(FormData);
      const uploadedFile = (writes[0].body as FormData).get('file') as File;
      expect(uploadedFile.name).toBe('shelf.png');

      expect(writes[1]).toEqual({
        method: 'DELETE',
        path: `/items/${ITEM_ID}/image`,
        body: undefined,
        key: delKey,
        ifMatch: '"2"',
        scope: undefined,
        query: undefined,
      });
    } finally {
      dispose();
    }
  });

  it('getReferenceData and listFulfillmentNodeOptions call their endpoints with expected scopes', async () => {
    const ref: ItemReferenceData = {
      owners: [{ id: 'usr-1', name: 'Hany' }],
      taxes: [],
      companyCurrencyCode: 'EGP',
    };
    const stub = new TradeHttpStub({
      'GET /items/reference-data': ref,
      'GET /inventory/nodes': [{ id: 'node-1', code: 'WH-1', name: 'Main warehouse', status: 'ACTIVE' }],
    });
    const dispose = bindTradeHttpForTest(stub);
    try {
      expect(await getReferenceData(C1, '  hany ')).toEqual(ref);
      await expect(listFulfillmentNodeOptions(C1)).rejects.toMatchObject({
        status: 400,
        code: 'TRADE.SCOPE.REQUIRED',
      });
      const nodes = await listFulfillmentNodeOptions(C1_B1);
      expect(nodes).toEqual([
        {
          id: 'node-1',
          branchId: C1_B1.branchId,
          localizedNames: { en: 'Main warehouse', ar: 'Main warehouse' },
        },
      ]);
      expect(stub.recordedReads()).toEqual([
        { path: '/items/reference-data', query: { limit: 50, search: 'hany' }, scope: C1 },
        { path: '/inventory/nodes', query: { status: 'ACTIVE' }, scope: C1_B1 },
      ]);
    } finally {
      dispose();
    }
  });

  it('trade-image reads rendition blob with OPTIONAL scope, creates object URL, and revokes blob URLs', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' });
    const createSpy = vi.fn(() => 'blob:https://test/item-thumb');
    const revokeSpy = vi.fn();
    URL.createObjectURL = createSpy;
    URL.revokeObjectURL = revokeSpy;

    const stub = new TradeHttpStub({
      'GET /items/:id/images/:imageId/:rendition': blob,
    });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const img = makeImageSummary();
      expect(await itemThumbUrl(ITEM_ID, null, C1)).toBeNull();
      expect(stub.recordedReads()).toHaveLength(0);

      const thumbUrl = await itemThumbUrl(ITEM_ID, img, C1_B1);
      expect(thumbUrl).toBe('blob:https://test/item-thumb');
      const printUrl = await itemImageRenditionUrl(ITEM_ID, img, 'print', C1);
      expect(printUrl).toBe('blob:https://test/item-thumb');

      expect(createSpy).toHaveBeenCalledTimes(2);
      expect(stub.recordedReads()).toEqual([
        { path: `/items/${ITEM_ID}/images/${IMG_ID}/thumb`, query: undefined, scope: C1_B1 },
        { path: `/items/${ITEM_ID}/images/${IMG_ID}/print`, query: undefined, scope: C1 },
      ]);

      releaseThumbUrl(thumbUrl);
      releaseThumbUrl('https://example.com/not-a-blob.png');
      releaseThumbUrl(null);
      expect(revokeSpy).toHaveBeenCalledTimes(1);
      expect(revokeSpy).toHaveBeenCalledWith('blob:https://test/item-thumb');
    } finally {
      dispose();
    }
  });

  it('itemErrorKey maps Trade ApiError codes and falls back for unknown errors', () => {
    expect(itemErrorKey(new ApiError(422, 'TRADE.CATALOG.ITEM_REFERENCE_INVALID'))).toBe(
      'tradeShared.errors.TRADE_CATALOG_ITEM_REFERENCE_INVALID',
    );
    expect(itemErrorKey(new ApiError(422, 'TRADE.CATALOG.ITEM_IMAGE_PRINT_BUDGET_EXCEEDED'))).toBe(
      'tradeShared.errors.TRADE_CATALOG_ITEM_IMAGE_PRINT_BUDGET_EXCEEDED',
    );
    expect(itemErrorKey(new Error('network'))).toBe('tradeShared.errors.generic');
  });
});
