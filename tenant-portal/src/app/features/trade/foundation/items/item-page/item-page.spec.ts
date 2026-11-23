import { Component, Injectable, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoLoader, TranslocoService, type Translation, provideTransloco } from '@jsverse/transloco';
import { map, timer } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import arGlobal from '../../../../../../../public/i18n/ar.json';
import enGlobal from '../../../../../../../public/i18n/en.json';
import arSettings from '../../../../../../../public/i18n/settings/ar.json';
import enSettings from '../../../../../../../public/i18n/settings/en.json';
import arItemForm from '../../../../../../../public/i18n/trade-item-form/ar.json';
import enItemForm from '../../../../../../../public/i18n/trade-item-form/en.json';
import arItems from '../../../../../../../public/i18n/trade-items/ar.json';
import enItems from '../../../../../../../public/i18n/trade-items/en.json';
import arShared from '../../../../../../../public/i18n/trade-shared/ar.json';
import enShared from '../../../../../../../public/i18n/trade-shared/en.json';
import { FAKE_TENANT_ME } from '../../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import type { ActionItem, ActionSelection } from '../../../../../shared/ui/actions-menu/actions-menu';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { UnsavedDialog, type UnsavedChoice } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import type { ReasonPickerValue } from '../../../shared/pickers/reason-picker/reason-picker';
import { ApiError } from '../../../shared/trade-api';
import type {
  Channel,
  ChannelListing,
  ItemCompanyProfile,
  ItemDetail,
  ItemImageSummary,
  ItemStandardCost,
  ItemStatus,
  Uom,
} from '../../../shared/trade-foundation.model';
import { bindTradeHttpForTest, tradeQueries } from '../../../shared/trade-http';
import { TradeHttpStub } from '../../../shared/testing/trade-http-testing';
import { actionKey, fileSignature } from '../../action-keys';
import type { DraftErrors, ItemDraft } from '../item-form/item-draft';
import { ChannelsTab } from '../item-profile-tabs/channels-tab/channels-tab';
import type { ItemImageReceipt, ItemImageRemoved, ItemReferenceData, ItemSaved } from '../items.model';
import { ItemPage } from './item-page';

const FILES: Record<string, Translation> = {
  en: enGlobal,
  ar: arGlobal,
  'settings/en': enSettings,
  'settings/ar': arSettings,
  'trade-item-form/en': enItemForm,
  'trade-item-form/ar': arItemForm,
  'trade-items/en': enItems,
  'trade-items/ar': arItems,
  'trade-shared/en': enShared,
  'trade-shared/ar': arShared,
};

@Injectable()
class AsyncFileLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return timer(0).pipe(map(() => FILES[path] ?? {}));
  }
}

@Component({ template: '' })
class ListStub {}

interface ItemPageView {
  loading(): boolean;
  notFound(): boolean;
  loadFailed(): boolean;
  isForbidden(): boolean;
  canRead(): boolean;
  canManageMaster(): boolean;
  canManageProfile(): boolean;
  canViewCost(): boolean;
  canManageCost(): boolean;
  detail(): ItemDetail | null;
  itemVersion(): number;
  itemDraft(): ItemDraft;
  itemServerErrors(): DraftErrors;
  itemDirty(): boolean;
  updatingStatus(): boolean;
  uploadingImage(): boolean;
  discontinueOpen(): boolean;
  actionItems(): ActionItem[];
  discontinueReason: WritableSignal<ReasonPickerValue>;
  onItemDraftChange(next: ItemDraft): void;
  onStandardCostChange(next: string): void;
  selectTab(tab: 'overview' | 'company' | 'branch' | 'channels'): void;
  save(): Promise<boolean>;
  onStatusChange(target: ItemStatus): Promise<void>;
  onActionSelected(selection: ActionSelection): void;
  confirmDiscontinue(): void;
  cancelDiscontinue(): void;
  onImagePicked(file: File): Promise<void>;
  onImageRemove(): Promise<void>;
  retryLoad(): void;
}

type DialogHandle = { close(choice: UnsavedChoice): void };

const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
const originalDialog = { showModal: dialogProto['showModal'], close: dialogProto['close'] };

const ITEM_ID = '01900000-0000-7000-8000-000000000001';
const UOM_ID = '01900000-0000-7000-8000-000000000010';
const IMG_ID = '01900000-0000-7000-8000-000000000030';
const CH_ID = '01900000-0000-7000-8000-000000000020';

function makeUom(): Uom {
  return {
    id: UOM_ID,
    code: 'PCS',
    displayName: 'Piece',
    localizedNames: { en: 'Piece', ar: 'قطعة' },
    status: 'ACTIVE',
    version: 1,
    updatedAt: '2026-11-23T08:00:00.000Z',
  };
}

function makeRefData(): ItemReferenceData {
  return {
    owners: [{ id: 'usr-1', name: 'Hany Mostafa' }],
    taxes: [],
    companyCurrencyCode: 'EGP',
  };
}

function makeCompanyProfile(overrides: Partial<ItemCompanyProfile> = {}): ItemCompanyProfile {
  return {
    id: 'cp-1',
    itemId: ITEM_ID,
    companyId: 'c1',
    canSell: true,
    canPurchase: true,
    canPos: false,
    trackInventory: true,
    trackingMode: 'NONE',
    taxClassificationKey: null,
    defaultSalesUomId: null,
    defaultPurchaseUomId: null,
    salesPrice: '100.00',
    currencyCode: 'EGP',
    salesTaxId: null,
    purchaseTaxId: null,
    capabilitySet: [],
    capabilitySetVersion: 1,
    accountingMappingKey: null,
    status: 'ACTIVE',
    version: 1,
    updatedAt: '2026-11-23T08:00:00.000Z',
    ...overrides,
  };
}

function makeDetail(overrides: Partial<ItemDetail> = {}): ItemDetail {
  return {
    id: ITEM_ID,
    canonicalCode: 'SPEC-IP-1',
    itemKind: 'PRODUCT',
    status: 'DRAFT',
    localizedNames: { en: 'Spec item 1', ar: 'صنف ١' },
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
    companyProfile: null,
    branchProfile: null,
    comboComponents: [],
    optionalProducts: [],
    version: 1,
    createdAt: '2026-11-23T08:00:00.000Z',
    updatedAt: '2026-11-23T08:00:00.000Z',
    createdBy: 'usr-1',
    updatedBy: 'usr-1',
    ...overrides,
  };
}

function toSaved(detail: ItemDetail): ItemSaved {
  const {
    image: _img,
    categorySummary: _cat,
    companyProfile: _cp,
    branchProfile: _bp,
    ...rest
  } = detail;
  return rest;
}

function makeImageSummary(): ItemImageSummary {
  return {
    id: IMG_ID,
    sequence: 1,
    thumb: { mimeType: 'image/webp', widthPx: 256, heightPx: 256, sha256: 'a'.repeat(64) },
    print: { mimeType: 'image/png', widthPx: 512, heightPx: 512 },
    hasAlpha: true,
    createdAt: '2026-11-23T09:00:00.000Z',
  };
}

const png = (name = 'photo.png', bytes = 64) =>
  new File([new Uint8Array(bytes)], name, { type: 'image/png', lastModified: 1 });

describe('ItemPage (TradeHttpStub)', () => {
  let notify: {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warning: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };
  let harness: RouterTestingHarness;
  let stub: TradeHttpStub;
  let dispose: () => void;
  let serverDetail: ItemDetail;
  const me = signal<TenantMe | null>(null);
  const selection = signal<{ companyId: string; branchId: string | null } | null>({
    companyId: 'c1',
    branchId: 'b1',
  });
  const origCreateObjectURL = URL.createObjectURL;
  const origRevokeObjectURL = URL.revokeObjectURL;

  function setPermissions(opts: {
    read?: boolean;
    masterTenantWide?: boolean;
    masterCompanyOnly?: boolean;
    itemsManageBranch?: boolean;
    viewCostBranch?: boolean;
    manageCostBranch?: boolean;
  } = {}): void {
    const {
      read = true,
      masterTenantWide = true,
      masterCompanyOnly = false,
      itemsManageBranch = true,
      viewCostBranch = true,
      manageCostBranch = true,
    } = opts;
    const permissions: string[] = [];
    const permissionScopes: TenantMe['permissionScopes'] = {};

    if (read) {
      permissions.push('trade.items.read');
      permissionScopes['trade.items.read'] = { tenantWide: true, companyIds: [], branchIds: [] };
    }
    if (masterTenantWide || masterCompanyOnly) {
      permissions.push('trade.catalog_master.manage');
      permissionScopes['trade.catalog_master.manage'] = masterTenantWide
        ? { tenantWide: true, companyIds: [], branchIds: [] }
        : { tenantWide: false, companyIds: ['c1'], branchIds: ['b1'] };
    }
    if (itemsManageBranch) {
      permissions.push('trade.items.manage');
      permissionScopes['trade.items.manage'] = { tenantWide: false, companyIds: [], branchIds: ['b1'] };
    }
    if (viewCostBranch) {
      permissions.push('trade.pricing.view_cost');
      permissionScopes['trade.pricing.view_cost'] = { tenantWide: false, companyIds: [], branchIds: ['b1'] };
    }
    if (manageCostBranch) {
      permissions.push('trade.pricing.manage');
      permissionScopes['trade.pricing.manage'] = { tenantWide: false, companyIds: [], branchIds: ['b1'] };
    }

    me.set({
      ...FAKE_TENANT_ME,
      isTenantOwner: false,
      permissions,
      permissionScopes,
    });
  }

  async function tick(ms = 1000): Promise<void> {
    harness.detectChanges();
    await vi.advanceTimersByTimeAsync(ms);
    harness.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    harness.detectChanges();
  }

  async function openPage(url = `/trade/foundation/items/${ITEM_ID}`): Promise<ItemPageView> {
    const page = await harness.navigateByUrl(url, ItemPage);
    await tick();
    return page as unknown as ItemPageView;
  }

  function dialogs(): { unsaved: DialogHandle; conflict: DialogHandle; conflictEl: HTMLDialogElement } {
    const found = harness.fixture.debugElement.queryAll(By.directive(UnsavedDialog));
    expect(found.length).toBe(2);
    return {
      unsaved: found[0].componentInstance as DialogHandle,
      conflict: found[1].componentInstance as DialogHandle,
      conflictEl: (found[1].nativeElement as HTMLElement).querySelector('dialog')!,
    };
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
    dialogProto['showModal'] = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    dialogProto['close'] = function (this: HTMLDialogElement) {
      if (!this.hasAttribute('open')) return;
      this.removeAttribute('open');
      setTimeout(() => this.dispatchEvent(new Event('close')), 0);
    };
    URL.createObjectURL = vi.fn(() => 'blob:https://test/item-thumb');
    URL.revokeObjectURL = vi.fn();

    serverDetail = makeDetail();
    stub = new TradeHttpStub({
      'GET /items/:id': serverDetail,
      'GET /items/reference-data': makeRefData(),
      'GET /uoms': { items: [makeUom()], total: 1, page: 1, limit: 100 },
      'GET /inventory/nodes': [],
      'GET /reason-codes': {
        items: [
          {
            id: 'rsn-item_discontinue-end_of_life',
            kind: 'ITEM_DISCONTINUE',
            code: 'END_OF_LIFE',
            localizedNames: { en: 'End of life', ar: 'نهاية العمر' },
            requiresNote: false,
            isActive: true,
            sortOrder: 1,
            isSystem: false,
            version: 1,
            updatedAt: '2026-11-23T08:00:00.000Z',
          },
        ],
      },
      'GET /items/:id/images/:imageId/:rendition': new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' }),
    });
    dispose = bindTradeHttpForTest(stub);
    setPermissions();

    notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'trade/foundation/items', component: ListStub },
          { path: 'trade/foundation/items/new', component: ItemPage },
          { path: 'trade/foundation/items/:id', component: ItemPage },
        ]),
        provideTransloco({
          config: { availableLangs: ['ar', 'en'], defaultLang: 'en', reRenderOnLangChange: true },
          loader: AsyncFileLoader,
        }),
        { provide: Notify, useValue: notify },
        { provide: TenantScopeState, useValue: { me, selection, branchesFor: () => ['b1'] } },
        { provide: LanguageState, useValue: { current: signal<'en' | 'ar'>('en') } },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    harness?.fixture.destroy();
    tradeQueries().clear();
    dispose();
    vi.useRealTimers();
    dialogProto['showModal'] = originalDialog.showModal;
    dialogProto['close'] = originalDialog.close;
    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = 'en';
  });

  it('loads the item into the form with its version and allowed status actions', async () => {
    const page = await openPage();

    expect(page.loading()).toBe(false);
    expect(page.notFound()).toBe(false);
    expect(page.loadFailed()).toBe(false);
    expect(page.detail()?.id).toBe(ITEM_ID);
    expect(page.itemVersion()).toBe(1);
    expect(page.itemDraft().canonicalCode).toBe('SPEC-IP-1');
    expect(page.itemDraft().nameEn).toBe('Spec item 1');
    expect(page.itemDirty()).toBe(false);
    expect(page.actionItems().map((a) => a.id)).toEqual(['activate', 'copyCode', 'discontinue']);
  });

  it('shows not found on 404 and loads on retry once available', async () => {
    stub.register('GET', '/items/:id', new ApiError(404, 'TRADE.CATALOG.ITEM_NOT_FOUND'));
    const page = await openPage();

    expect(page.notFound()).toBe(true);
    expect(page.loading()).toBe(false);

    stub.register('GET', '/items/:id', serverDetail);
    page.retryLoad();
    await tick();
    expect(page.notFound()).toBe(false);
    expect(page.detail()?.id).toBe(ITEM_ID);
  });

  it('saves a changed name with key, If-Match, NONE scope, then reloads the item', async () => {
    const page = await openPage();
    const updated = makeDetail({ localizedNames: { en: 'Renamed item', ar: 'صنف ١' }, version: 2 });
    stub.register('PATCH', '/items/:id', toSaved(updated));
    stub.register('GET', '/items/:id', updated);

    page.onItemDraftChange({ ...page.itemDraft(), nameEn: 'Renamed item' });
    expect(page.itemDirty()).toBe(true);

    const saved = page.save();
    await tick();
    expect(await saved).toBe(true);

    expect(stub.recordedWrites()).toHaveLength(1);
    expect(stub.recordedWrites()[0]).toMatchObject({
      method: 'PATCH',
      path: `/items/${ITEM_ID}`,
      body: { localizedNames: { en: 'Renamed item', ar: 'صنف ١' } },
      ifMatch: '"1"',
      scope: undefined,
    });
    expect(page.itemVersion()).toBe(2);
    expect(page.itemDirty()).toBe(false);
    expect(notify.success).toHaveBeenCalledWith(enItemForm.toast.saved);
  });

  it('409 conflict: keep mine rebases and retries; reload takes server copy; cancel preserves draft', async () => {
    const page = await openPage();
    const serverLatest = makeDetail({ localizedNames: { en: 'Server copy', ar: 'صنف ١' }, version: 2 });
    const merged = makeDetail({ localizedNames: { en: 'Mine', ar: 'صنف ١' }, version: 3 });

    stub.register('PATCH', '/items/:id', new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION'));
    page.onItemDraftChange({ ...page.itemDraft(), nameEn: 'Mine' });
    const cancelSave = page.save();
    await tick();
    dialogs().conflict.close('cancel');
    await tick();
    expect(await cancelSave).toBe(false);
    expect(page.itemDraft().nameEn).toBe('Mine');

    stub.register('GET', '/items/:id', serverLatest);
    const reloadSave = page.save();
    await tick();
    dialogs().conflict.close('save');
    await tick();
    expect(await reloadSave).toBe(false);
    expect(page.itemDraft().nameEn).toBe('Server copy');
    expect(page.itemVersion()).toBe(2);

    page.onItemDraftChange({ ...page.itemDraft(), nameEn: 'Mine' });
    const keepSave = page.save();
    await tick();
    stub.register('PATCH', '/items/:id', toSaved(merged));
    stub.register('GET', '/items/:id', merged);
    dialogs().conflict.close('discard');
    await tick();
    await tick();
    expect(await keepSave).toBe(true);
    expect(page.itemVersion()).toBe(3);
    expect(page.itemDraft().nameEn).toBe('Mine');
  });

  it('status moves: activates and discontinues with reason, reusing actionKey on retry', async () => {
    const page = await openPage();
    const pendingKey = actionKey('status', ITEM_ID, 1, 'ACTIVE', undefined).key;
    const activated = makeDetail({ status: 'ACTIVE', version: 2 });

    stub.register('PATCH', '/items/:id', new ApiError(500, 'COMMON.GENERIC.INTERNAL_ERROR'));
    await page.onStatusChange('ACTIVE');
    expect(notify.error).toHaveBeenCalled();

    stub.register('PATCH', '/items/:id', toSaved(activated));
    await page.onStatusChange('ACTIVE');
    expect(stub.recordedWrites()[1]).toMatchObject({
      method: 'PATCH',
      path: `/items/${ITEM_ID}`,
      body: { status: 'ACTIVE' },
      key: pendingKey,
      ifMatch: '"1"',
      scope: undefined,
    });
    expect(page.itemVersion()).toBe(2);

    const reasonCodeId = 'rsn-item_discontinue-end_of_life';
    const discKey = actionKey('status', ITEM_ID, 2, 'DISCONTINUED', { reasonCodeId }).key;
    const discontinued = makeDetail({ status: 'DISCONTINUED', version: 3 });
    stub.register('PATCH', '/items/:id', toSaved(discontinued));

    const move = page.onStatusChange('DISCONTINUED');
    await tick();
    expect(page.discontinueOpen()).toBe(true);
    page.discontinueReason.set({ reasonCodeId, note: '' });
    await tick();
    page.confirmDiscontinue();
    await tick();
    await move;

    expect(stub.recordedWrites()[2]).toMatchObject({
      method: 'PATCH',
      path: `/items/${ITEM_ID}`,
      body: { status: 'DISCONTINUED', reasonCodeId },
      key: discKey,
      ifMatch: '"2"',
      scope: undefined,
    });
    expect(page.actionItems().map((a) => a.id)).toEqual(['copyCode']);
  });

  it('image upload and remove send PUT/DELETE with key, If-Match, NONE scope, and handle 415/413 errors', async () => {
    const page = await openPage();
    const img = makeImageSummary();
    const receipt: ItemImageReceipt = { itemId: ITEM_ID, itemVersion: 2, image: img, replaced: false };
    const removed: ItemImageRemoved = { itemId: ITEM_ID, itemVersion: 3, removed: true };

    stub.register('PUT', '/items/:id/image', new ApiError(415, 'TRADE.CATALOG.ITEM_IMAGE_INVALID'));
    await page.onImagePicked(new File([new Uint8Array(8)], 'anim.gif', { type: 'image/gif' }));
    expect(page.itemServerErrors()['image']).toEqual({ key: 'tradeShared.errors.TRADE_CATALOG_ITEM_IMAGE_INVALID' });

    const file = png();
    const imgKey = actionKey('image', ITEM_ID, 1, fileSignature(file)).key;
    stub.register('PUT', '/items/:id/image', receipt);
    await page.onImagePicked(file);
    await tick();

    expect(page.detail()?.image?.id).toBe(IMG_ID);
    expect(page.itemVersion()).toBe(2);
    expect(stub.recordedWrites()[1]).toMatchObject({
      method: 'PUT',
      path: `/items/${ITEM_ID}/image`,
      key: imgKey,
      ifMatch: '"1"',
      scope: undefined,
    });
    expect(URL.createObjectURL).toHaveBeenCalled();

    const remKey = actionKey('image-remove', ITEM_ID, 2).key;
    stub.register('DELETE', '/items/:id/image', removed);
    await page.onImageRemove();
    await tick();

    expect(page.detail()?.image).toBeNull();
    expect(page.itemVersion()).toBe(3);
    expect(stub.recordedWrites()[2]).toMatchObject({
      method: 'DELETE',
      path: `/items/${ITEM_ID}/image`,
      key: remKey,
      ifMatch: '"2"',
      scope: undefined,
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:https://test/item-thumb');
  });

  it('permissions: hides create/edit without grants, allows cost-only edits with trade.pricing.manage, and shows FullState on missing read or server 403', async () => {
    // 1. No read permission -> forbidden FullState, 0 HTTP calls
    setPermissions({
      read: false,
      masterTenantWide: false,
      itemsManageBranch: false,
      viewCostBranch: false,
      manageCostBranch: false,
    });
    const noReadPage = await openPage();
    expect(noReadPage.isForbidden()).toBe(true);
    expect(stub.recordedReads()).toHaveLength(0);
    expect(harness.fixture.debugElement.query(By.directive(FullState))).not.toBeNull();

    // 2. Read + view/manage cost ONLY (no catalog_master.manage, no items.manage):
    // Overview/profile are readonly, standard cost saves independently via trade.pricing.manage.
    stub.reset();
    const withProfile = makeDetail({ companyProfile: makeCompanyProfile({ version: 2 }) });
    const cost: ItemStandardCost = {
      itemId: ITEM_ID,
      companyProfileId: 'cp-1',
      standardCost: '50.00',
      currencyCode: 'EGP',
      version: 2,
    };
    stub.register('GET', '/items/:id', withProfile);
    stub.register('GET', '/items/:id/standard-cost', cost);
    stub.register('PATCH', '/items/:id/standard-cost', { ...cost, standardCost: '75.00', version: 3 });

    setPermissions({
      read: true,
      masterTenantWide: false,
      masterCompanyOnly: true,
      itemsManageBranch: false,
      viewCostBranch: true,
      manageCostBranch: true,
    });
    await harness.navigateByUrl('/trade/foundation/items');
    const costOnlyPage = await openPage();
    expect(costOnlyPage.isForbidden()).toBe(false);
    expect(costOnlyPage.canManageMaster()).toBe(false);
    expect(costOnlyPage.canManageProfile()).toBe(false);
    expect(costOnlyPage.canViewCost()).toBe(true);
    expect(costOnlyPage.canManageCost()).toBe(true);

    costOnlyPage.selectTab('company');
    await tick();
    const costInput = harness.fixture.nativeElement.querySelector('input[id$="-cost"]') as HTMLInputElement;
    expect(costInput.readOnly).toBe(false);

    costOnlyPage.onStandardCostChange('75.00');
    await costOnlyPage.save();
    expect(stub.recordedWrites()).toHaveLength(1);
    expect(stub.recordedWrites()[0]).toMatchObject({
      method: 'PATCH',
      path: `/items/${ITEM_ID}/standard-cost`,
      body: { standardCost: '75.00' },
      ifMatch: '"2"',
      scope: { companyId: 'c1' },
    });

    // 3. Create route without tenant-wide catalog_master.manage -> forbidden FullState
    stub.reset();
    const forbiddenCreate = await openPage('/trade/foundation/items/new');
    expect(forbiddenCreate.isForbidden()).toBe(true);
    expect(stub.recordedReads()).toHaveLength(0);

    // 4. Server 403 -> FullState forbidden without error toast
    setPermissions();
    stub.reset();
    stub.register('GET', '/items/:id', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
    const server403Page = await openPage();
    expect(server403Page.isForbidden()).toBe(true);
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('F-18: ChannelsTab refetches GET /items/:id/channel-listings after listing create and patch, and propagates 403 to page forbidden', async () => {
    const cp = makeCompanyProfile({ status: 'ACTIVE', canSell: true });
    const activeDetail = makeDetail({ status: 'ACTIVE', companyProfile: cp });
    const channel: Channel = {
      id: CH_ID,
      companyId: 'c1',
      code: 'WEB',
      name: 'Online store',
      channelType: 'ECOMMERCE',
      status: 'ACTIVE',
      configurationProfileVersionId: null,
      activeBranchCount: 1,
      version: 1,
      createdAt: '2026-11-23T08:00:00.000Z',
      updatedAt: '2026-11-23T08:00:00.000Z',
    };
    const draftProjection: ChannelListing = {
      id: 'lst-1',
      channelId: CH_ID,
      branchId: null,
      publicationStatus: 'DRAFT',
      saleConstraints: {},
      version: 1,
      updatedAt: '2026-11-23T08:00:00.000Z',
    };
    const publishedProjection: ChannelListing = {
      ...draftProjection,
      publicationStatus: 'PUBLISHED',
      version: 2,
    };

    stub.register('GET', '/items/:id', activeDetail);
    stub.register('GET', '/items/:id/standard-cost', {
      itemId: ITEM_ID,
      companyProfileId: 'cp-1',
      standardCost: null,
      currencyCode: 'EGP',
      version: 1,
    });
    stub.register('GET', '/channels', { items: [channel], total: 1, page: 1, limit: 100 });
    stub.register('GET', '/items/:id/channel-listings', { items: [], total: 0, page: 1, limit: 50 });
    stub.register('POST', '/items/:id/channel-listings', {
      ...draftProjection,
      itemCompanyProfileId: 'cp-1',
      companyId: 'c1',
      branchScopeKey: 'none',
    });

    const page = await openPage();
    page.selectTab('channels');
    await tick();

    const channelsDe = harness.fixture.debugElement.query(By.directive(ChannelsTab));
    const channelsCmp = channelsDe.componentInstance as unknown as {
      selectedChannelId: WritableSignal<string>;
      listings(): ChannelListing[];
      addListing(): Promise<void>;
      onListingAction(listing: ChannelListing, sel: ActionSelection): void;
    };

    channelsCmp.selectedChannelId.set(CH_ID);
    stub.register('GET', '/items/:id/channel-listings', {
      items: [draftProjection],
      total: 1,
      page: 1,
      limit: 50,
    });
    await channelsCmp.addListing();
    await tick();
    expect(channelsCmp.listings()).toEqual([draftProjection]);

    stub.register('PATCH', '/items/:id/channel-listings/:channelId', {
      ...publishedProjection,
      itemCompanyProfileId: 'cp-1',
      companyId: 'c1',
      branchScopeKey: 'none',
    });
    stub.register('GET', '/items/:id/channel-listings', {
      items: [publishedProjection],
      total: 1,
      page: 1,
      limit: 50,
    });
    channelsCmp.onListingAction(draftProjection, { id: 'publish' });
    await tick();
    expect(channelsCmp.listings()).toEqual([publishedProjection]);

    stub.register('PATCH', '/items/:id/channel-listings/:channelId', new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
    channelsCmp.onListingAction(publishedProjection, { id: 'retire' });
    await tick();
    expect(page.isForbidden()).toBe(true);
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('renders cleanly in ar RTL dark mode without leaking raw translation keys', async () => {
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    document.documentElement.setAttribute('data-theme', 'dark');
    TestBed.inject(LanguageState).current.set('ar');
    TestBed.inject(TranslocoService).setActiveLang('ar');

    await openPage();
    await tick();

    const text = (harness.fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toMatch(/itemForm\.|tradeItems\.|tradeShared\./);
  });
});
