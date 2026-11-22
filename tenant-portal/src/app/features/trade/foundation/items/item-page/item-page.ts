import { Location } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, NavigationCancel, NavigationEnd, NavigationError, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowLeft,
  tablerBan,
  tablerBox,
  tablerBroadcast,
  tablerBuilding,
  tablerBuildingStore,
  tablerChevronLeft,
  tablerChevronRight,
  tablerCloudOff,
  tablerCopy,
  tablerFileSearch,
  tablerLayoutList,
  tablerPackages,
  tablerPlayerPause,
  tablerPlayerPlay,
  tablerRefresh,
  tablerTool,
} from '@ng-icons/tabler-icons';
import { filter } from 'rxjs';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ScopeState } from '../../../../../core/scope/scope';
import { ActionsMenu, type ActionItem, type ActionSelection } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../../shared/ui/button/button';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { TradeReasonPicker, type ReasonPickerValue } from '../../../shared/pickers/reason-picker/reason-picker';
import { ApiError, errorCodeOf, newIdempotencyKey, tradeContext } from '../../../shared/trade-api';
import { itemName, listUoms } from '../../../shared/trade-foundation.api';
import type {
  ItemBranchProfile,
  ItemCompanyProfile,
  ItemDetail,
  ItemStatus,
  Owner,
  Tax,
  Uom,
} from '../../../shared/trade-foundation.model';
import { itemThumbUrl, releaseThumbUrl } from '../../../shared/trade-image';
import {
  ALLOWED_ITEM_STATUS_MOVES,
  BADGE_CLASS,
  ITEM_KIND_KEY,
  ITEM_KIND_TILE,
  ITEM_STATUS_KEY,
  ITEM_STATUS_TONE,
} from '../../../shared/trade-labels';
import {
  createBranchProfile,
  createCompanyProfile,
  createItem,
  deleteItemImage,
  getItemDetail,
  getReferenceData,
  getStandardCost,
  itemErrorKey,
  listFulfillmentNodeOptions,
  moveItemStatus,
  patchBranchProfile,
  patchCompanyProfile,
  patchItem,
  patchStandardCost,
  putItemImage,
} from '../items.api';
import { actionKey, fileSignature } from '../../action-keys';
import type { FulfillmentNodeOption, ItemStatusReason } from '../items.model';
import {
  draftFromDetail,
  draftsEqual,
  emptyDraft,
  mapItemServerError,
  rebaseItemDraft,
  toCreateBody,
  toPatchBody,
  validateDraft,
  type DraftErrors,
  type FieldError,
  type ItemDraft,
} from '../item-form/item-draft';
import { ItemDraftStore } from '../item-form/item-draft-store';
import { ItemForm } from '../item-form/item-form';
import { BranchTab } from '../item-profile-tabs/branch-tab/branch-tab';
import {
  branchProfileDraftFromModel,
  branchProfileDraftsEqual,
  emptyBranchProfileDraft,
  rebaseBranchProfileDraft,
  toBranchProfileCreateBody,
  toBranchProfilePatchBody,
  validateBranchProfileDraft,
  type BranchProfileDraft,
} from '../item-profile-tabs/branch-tab/branch-tab';
import { ChannelsTab } from '../item-profile-tabs/channels-tab/channels-tab';
import {
  CompanyProfileTab,
  companyProfileDraftFromModel,
  companyProfileDraftsEqual,
  emptyCompanyProfileDraft,
  rebaseCompanyProfileDraft,
  toCompanyProfileCreateBody,
  toCompanyProfilePatchBody,
  validateCompanyProfileDraft,
  type CompanyProfileDraft,
} from '../item-profile-tabs/company-profile-tab/company-profile-tab';
import { smoothScrollBehavior } from '../../../../../shared/ui/scroll/scroll-into-view';

const CAN_MANAGE = true; // later from the session permissions
const CAN_VIEW_COST = true; // later from the session permissions
const CAN_MANAGE_COST = true; // later from the session permissions

export type ItemPageTab = 'overview' | 'company' | 'branch' | 'channels';
type HeaderActionId = 'activate' | 'deactivate' | 'discontinue' | 'copyCode';

const ITEM_PAGE_TABS: readonly ItemPageTab[] = ['overview', 'company', 'branch', 'channels'];

function parseTabParam(raw: string | null): ItemPageTab {
  return raw && (ITEM_PAGE_TABS as readonly string[]).includes(raw) ? (raw as ItemPageTab) : 'overview';
}

function readListIdsFromHistory(): string[] {
  if (typeof history === 'undefined') return [];
  const state = history.state as { listIds?: unknown } | null;
  if (!Array.isArray(state?.listIds)) return [];
  return state.listIds.filter((id): id is string => typeof id === 'string');
}

@Component({
  selector: 'app-item-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Button,
    Modal,
    TradeReasonPicker,
    UnsavedDialog,
    ItemForm,
    CompanyProfileTab,
    BranchTab,
    ChannelsTab,
  ],
  providers: [
    provideTranslocoScope(
      'settings',
      { scope: 'trade-item-form', alias: 'itemForm' },
      { scope: 'trade-items', alias: 'tradeItems' },
      { scope: 'trade-shared', alias: 'tradeShared' },
    ),
    provideIcons({
      tablerArrowLeft,
      tablerBan,
      tablerBox,
      tablerBroadcast,
      tablerBuilding,
      tablerBuildingStore,
      tablerChevronLeft,
      tablerChevronRight,
      tablerCloudOff,
      tablerCopy,
      tablerFileSearch,
      tablerLayoutList,
      tablerPackages,
      tablerPlayerPause,
      tablerPlayerPlay,
      tablerRefresh,
      tablerTool,
    }),
  ],
  templateUrl: './item-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col p-12 gap-8' },
})
export class ItemPage {
  private static nextId = 0;
  protected readonly uid = `item-page-${++ItemPage.nextId}`;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly injector = inject(Injector);
  private readonly scopeState = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly draftStore = inject(ItemDraftStore);
  protected readonly language = inject(LanguageState).current;

  private readonly itemForm = viewChild(ItemForm);
  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');
  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabBtn');
  private readonly unsavedDialog = viewChild.required<UnsavedDialog>('unsavedDialog');
  private readonly conflictDialog = viewChild.required<UnsavedDialog>('conflictDialog');
  private readonly discontinueModal = viewChild.required<Modal>('discontinueModal');
  protected readonly discontinueReasonPicker = viewChild<TradeReasonPicker>('discontinueReasonPicker');

  readonly idParam = input<string | undefined>(undefined, { alias: 'id' });
  readonly tabParam = input<string | undefined>(undefined, { alias: 'tab' });

  protected readonly canManage = CAN_MANAGE;
  protected readonly canViewCost = CAN_VIEW_COST;
  protected readonly canManageCost = CAN_MANAGE_COST;

  protected readonly itemId = signal<string | null>(null);
  protected readonly mode = computed<'create' | 'edit'>(() => (this.itemId() ? 'edit' : 'create'));
  protected readonly listIds = signal<string[]>(readListIdsFromHistory());

  protected readonly detail = signal<ItemDetail | null>(null);
  protected readonly itemVersion = signal(1);
  protected readonly itemBase = signal<ItemDraft>(emptyDraft());
  protected readonly itemDraft = signal<ItemDraft>(emptyDraft());
  protected readonly pendingImageFile = signal<File | null>(null);

  protected readonly companyProfile = signal<ItemCompanyProfile | null>(null);
  protected readonly companyProfileVersion = signal(1);
  protected readonly companyBase = signal<CompanyProfileDraft>(emptyCompanyProfileDraft(null));
  protected readonly companyDraft = signal<CompanyProfileDraft>(emptyCompanyProfileDraft(null));

  protected readonly standardCostBase = signal('');
  protected readonly standardCostDraft = signal('');

  protected readonly branchProfile = signal<ItemBranchProfile | null>(null);
  protected readonly branchProfileVersion = signal(1);
  protected readonly branchBase = signal<BranchProfileDraft>(emptyBranchProfileDraft());
  protected readonly branchDraft = signal<BranchProfileDraft>(emptyBranchProfileDraft());

  protected readonly owners = signal<readonly Owner[]>([]);
  protected readonly taxes = signal<readonly Tax[]>([]);
  protected readonly uoms = signal<readonly Uom[]>([]);
  protected readonly companyCurrencyCode = signal<string | null>(null);
  protected readonly fulfillmentNodes = signal<readonly FulfillmentNodeOption[]>([]);
  private readonly trackingLockedKeys = signal<ReadonlySet<string>>(new Set());

  protected readonly loading = signal(false);
  protected readonly notFound = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly saving = signal(false);
  protected readonly uploadingImage = signal(false);
  protected readonly updatingStatus = signal(false);
  protected readonly submitted = signal(false);
  protected readonly discontinueOpen = signal(false);
  protected readonly discontinueSubmitted = signal(false);
  protected readonly discontinueReason = signal<ReasonPickerValue>({ reasonCodeId: null, note: '' });
  private discontinueResolver: ((reason: ItemStatusReason | null) => void) | null = null;

  protected readonly itemServerErrors = signal<DraftErrors>({});
  protected readonly companyServerErrors = signal<DraftErrors>({});
  protected readonly branchServerErrors = signal<DraftErrors>({});

  protected readonly activeTab = signal<ItemPageTab>('overview');
  protected readonly visited = signal<ReadonlySet<ItemPageTab>>(new Set<ItemPageTab>(['overview']));

  private readonly headerThumbSignal = signal<string | null>(null);
  protected readonly headerThumbUrl = this.headerThumbSignal.asReadonly();

  private cameFromList = false;
  private navigatedWithinPage = false;
  private initializedRoute = false;
  private bypassGuard = false;
  private confirmingLeave = false;
  private loadSeq = 0;
  private scopeLoadSeq = 0;

  private itemKey: string | null = null;
  private itemFingerprint: string | null = null;
  private imageKey: string | null = null;
  private imageFile: File | null = null;
  private companyKey: string | null = null;
  private companyFingerprint: string | null = null;
  private costKey: string | null = null;
  private costFingerprint: string | null = null;
  private branchKey: string | null = null;
  private branchFingerprint: string | null = null;

  protected readonly companyName = computed(() => {
    const company = this.scopeState.company();
    return this.language() === 'ar' ? company.nameAr : company.nameEn;
  });

  protected readonly branchName = computed(() => {
    const branch = this.scopeState.branch();
    return this.language() === 'ar' ? branch.nameAr : branch.nameEn;
  });

  protected readonly isTrackingLocked = computed(() => {
    const id = this.itemId();
    if (!id) return false;
    return this.trackingLockedKeys().has(`${id}:${this.scopeState.company().id}`);
  });

  protected readonly itemDirty = computed(
    () => !draftsEqual(this.itemBase(), this.itemDraft()) || this.pendingImageFile() !== null,
  );

  protected readonly companyDirty = computed(
    () =>
      this.mode() === 'edit' &&
      this.companyDraft().enabled &&
      !companyProfileDraftsEqual(this.companyBase(), this.companyDraft()),
  );

  protected readonly costDirty = computed(
    () =>
      this.mode() === 'edit' &&
      this.canManageCost &&
      (this.companyProfile() !== null || this.companyDraft().enabled) &&
      this.standardCostBase().trim() !== this.standardCostDraft().trim(),
  );

  protected readonly branchDirty = computed(
    () =>
      this.mode() === 'edit' &&
      this.branchDraft().enabled &&
      !branchProfileDraftsEqual(this.branchBase(), this.branchDraft()),
  );

  protected readonly anyDirty = computed(
    () => this.itemDirty() || this.companyDirty() || this.costDirty() || this.branchDirty(),
  );

  protected readonly itemErrors = computed<DraftErrors>(() => {
    const srv = this.itemServerErrors();
    if (!this.submitted()) return srv;
    return { ...validateDraft(this.itemDraft(), this.mode(), this.itemId()), ...srv };
  });

  protected readonly companyErrors = computed<DraftErrors>(() => {
    const srv = this.companyServerErrors();
    if (!this.submitted()) return srv;
    const client = validateCompanyProfileDraft(
      this.companyDraft(),
      this.standardCostDraft(),
      this.canManageCost,
      this.companyProfile() !== null,
    );
    return { ...client, ...srv };
  });

  protected readonly branchErrors = computed<DraftErrors>(() => {
    const srv = this.branchServerErrors();
    if (!this.submitted()) return srv;
    return { ...validateBranchProfileDraft(this.branchDraft()), ...srv };
  });

  protected readonly overviewHasErrors = computed(() => Object.keys(this.itemErrors()).length > 0);
  protected readonly companyHasErrors = computed(() => Object.keys(this.companyErrors()).length > 0);
  protected readonly branchHasErrors = computed(() => Object.keys(this.branchErrors()).length > 0);

  protected readonly kindTile = computed(() => ITEM_KIND_TILE[this.itemDraft().itemKind]);

  protected readonly displayName = computed(() => {
    const lang = this.language();
    const d = this.itemDraft();
    const local = lang === 'ar' ? d.nameAr.trim() || d.nameEn.trim() : d.nameEn.trim() || d.nameAr.trim();
    if (local) return local;
    const loaded = this.detail();
    return loaded ? itemName(loaded, lang) : '';
  });

  protected readonly headerTitle = computed(() => {
    this.i18n();
    const name = this.displayName();
    if (name) return name;
    return this.mode() === 'create'
      ? this.transloco.translate('itemForm.modal.newTitle')
      : this.transloco.translate('itemForm.modal.title');
  });

  protected readonly headerSubtitle = computed(() => {
    this.i18n();
    const d = this.itemDraft();
    const parts: string[] = [];
    const code = d.canonicalCode.trim().toUpperCase();
    if (code) parts.push(code);
    parts.push(this.transloco.translate(ITEM_KIND_KEY[d.itemKind]));
    const cat = this.categoryLabel();
    if (cat) parts.push(cat);
    return parts.join(' · ');
  });

  protected readonly statusBadgeClass = computed(() => BADGE_CLASS[ITEM_STATUS_TONE[this.itemDraft().status]]);
  protected readonly statusLabelKey = computed(() => ITEM_STATUS_KEY[this.itemDraft().status]);

  protected readonly baseUom = computed<Uom | null>(() => {
    const id = this.itemDraft().baseUomId;
    return id ? (this.uoms().find((u) => u.id === id) ?? null) : null;
  });

  protected readonly categoryLabel = computed(() => {
    const summary = this.detail()?.categorySummary;
    if (!summary || summary.path.length === 0) return '';
    return summary.path.map((part) => part.name).join(' › ');
  });

  protected readonly navPosition = computed<{ index: number; total: number } | null>(() => {
    if (this.mode() !== 'edit') return null;
    const id = this.itemId();
    const ids = this.listIds();
    if (!id || ids.length === 0) return null;
    const idx = ids.indexOf(id);
    return idx >= 0 ? { index: idx + 1, total: ids.length } : null;
  });

  protected readonly actionItems = computed<ActionItem[]>(() => {
    this.i18n();
    const current = this.detail();
    if (this.mode() !== 'edit' || !current) return [];

    const items: ActionItem[] = [];
    const legalMoves = ALLOWED_ITEM_STATUS_MOVES[current.status];
    if (this.canManage) {
      if (legalMoves.includes('ACTIVE')) {
        items.push({
          id: 'activate',
          title: this.transloco.translate('tradeItems.actions.activate'),
          icon: 'tablerPlayerPlay',
          tile: 'bg-icon-green',
        });
      }
      if (legalMoves.includes('INACTIVE')) {
        items.push({
          id: 'deactivate',
          title: this.transloco.translate('tradeItems.actions.deactivate'),
          icon: 'tablerPlayerPause',
          tile: 'bg-icon-gray',
        });
      }
    }

    items.push({
      id: 'copyCode',
      title: this.transloco.translate('tradeItems.actions.copyCode'),
      icon: 'tablerCopy',
      tile: 'bg-icon-teal',
    });

    if (this.canManage && legalMoves.includes('DISCONTINUED')) {
      items.push({
        id: 'discontinue',
        title: this.transloco.translate('tradeItems.actions.discontinue'),
        icon: 'tablerBan',
        tile: 'bg-icon-red',
        danger: true,
      });
    }
    return items;
  });

  protected readonly tabs = computed(() => {
    if (this.mode() === 'create') {
      return [
        {
          id: 'overview' as const,
          icon: 'tablerLayoutList',
          labelKey: 'itemForm.tabs.overview',
          hasError: this.overviewHasErrors(),
        },
      ];
    }
    return [
      {
        id: 'overview' as const,
        icon: 'tablerLayoutList',
        labelKey: 'itemForm.tabs.overview',
        hasError: this.overviewHasErrors(),
      },
      {
        id: 'company' as const,
        icon: 'tablerBuildingStore',
        labelKey: 'itemForm.tabs.company',
        hasError: this.companyHasErrors(),
      },
      {
        id: 'branch' as const,
        icon: 'tablerBuilding',
        labelKey: 'itemForm.tabs.branch',
        hasError: this.branchHasErrors(),
      },
      {
        id: 'channels' as const,
        icon: 'tablerBroadcast',
        labelKey: 'itemForm.tabs.channels',
        hasError: false,
      },
    ];
  });

  constructor() {
    const destroyRef = inject(DestroyRef);

    const nav = this.router.currentNavigation() ?? this.router.lastSuccessfulNavigation();
    const prevUrl = nav?.previousNavigation?.extractedUrl;
    if (prevUrl) {
      const path = '/' + prevUrl.root.children['primary']?.segments.map((s) => s.path).join('/');
      if (path === '/trade/foundation/items') {
        this.cameFromList = true;
      }
    }
    const navListIds = (nav?.extras?.state as { listIds?: unknown } | undefined)?.listIds;
    if (Array.isArray(navListIds) && navListIds.every((id): id is string => typeof id === 'string')) {
      this.listIds.set(navListIds);
    }

    this.router.events
      .pipe(
        filter(
          (event) =>
            event instanceof NavigationEnd ||
            event instanceof NavigationCancel ||
            event instanceof NavigationError,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.bypassGuard = false;
      });

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((query) => {
      const snapId = this.route.snapshot.paramMap.get('id');
      if (!snapId || snapId === 'new') {
        this.activeTab.set('overview');
        return;
      }
      const nextTab = parseTabParam(query.get('tab'));
      this.visited.update((set) => {
        if (set.has(nextTab)) return set;
        const next = new Set(set);
        next.add(nextTab);
        return next;
      });
      this.activeTab.set(nextTab);
    });

    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const rawId = params.get('id');
      const nextId = !rawId || rawId === 'new' ? null : rawId;
      if (this.initializedRoute && nextId === this.itemId()) {
        return;
      }
      if (this.initializedRoute && nextId !== this.itemId()) {
        this.navigatedWithinPage = true;
      }
      this.initializedRoute = true;
      this.itemId.set(nextId);

      const routeState = this.router.currentNavigation()?.extras?.state as { listIds?: unknown } | undefined;
      if (Array.isArray(routeState?.listIds) && routeState.listIds.every((id): id is string => typeof id === 'string')) {
        this.listIds.set(routeState.listIds);
      }

      this.resetDraftKeys();
      this.submitted.set(false);
      this.itemServerErrors.set({});
      this.companyServerErrors.set({});
      this.branchServerErrors.set({});

      if (nextId) {
        const initialTab = parseTabParam(this.route.snapshot.queryParamMap.get('tab'));
        const nextVisited = new Set<ItemPageTab>(['overview']);
        nextVisited.add(initialTab);
        this.visited.set(nextVisited);
        this.activeTab.set(initialTab);
        void this.loadAllForEdit(nextId);
      } else {
        this.visited.set(new Set<ItemPageTab>(['overview']));
        this.activeTab.set('overview');
        this.detail.set(null);
        this.companyProfile.set(null);
        this.branchProfile.set(null);
        this.notFound.set(false);
        this.loadFailed.set(false);
        this.loading.set(false);
        const carried = this.draftStore.take();
        const fresh = emptyDraft();
        this.itemBase.set(fresh);
        this.itemDraft.set(carried ? structuredClone(carried.draft) : structuredClone(fresh));
        this.pendingImageFile.set(carried?.file ?? null);
        void this.loadCreateLookups();
      }
    });

    let lastScopeKey = `${this.scopeState.company().id}:${this.scopeState.branch().id}`;
    effect(() => {
      const companyId = this.scopeState.company().id;
      const branchId = this.scopeState.branch().id;
      const nextKey = `${companyId}:${branchId}`;
      const id = this.itemId();
      const mode = this.mode();
      if (nextKey === lastScopeKey) return;
      lastScopeKey = nextKey;
      if (mode === 'edit' && id) {
        untracked(() => void this.handleScopeChange(id));
      }
    });

    let thumbSeq = 0;
    let activeThumbUrl: string | null = null;
    const setThumb = (next: string | null) => {
      if (activeThumbUrl && activeThumbUrl !== next) {
        releaseThumbUrl(activeThumbUrl);
      }
      activeThumbUrl = next;
      this.headerThumbSignal.set(next);
    };
    effect(() => {
      const current = this.detail();
      const seq = ++thumbSeq;
      if (!current?.image) {
        setThumb(null);
        return;
      }
      void itemThumbUrl(current.id, current.image).then((url) => {
        if (seq !== thumbSeq) {
          releaseThumbUrl(url);
          return;
        }
        setThumb(url);
      });
    });

    destroyRef.onDestroy(() => {
      thumbSeq += 1;
      releaseThumbUrl(activeThumbUrl);
      activeThumbUrl = null;
      this.settleDiscontinue(null);
    });
  }

  async confirmLeave(): Promise<boolean> {
    if (this.bypassGuard) return true;
    if (
      !this.canManage ||
      !this.anyDirty() ||
      this.loading() ||
      this.loadFailed() ||
      this.notFound()
    ) {
      return true;
    }
    if (this.confirmingLeave) return false;
    this.confirmingLeave = true;
    try {
      const choice = await this.unsavedDialog().open();
      if (choice === 'cancel') return false;
      if (choice === 'discard') {
        this.undoAll();
        return true;
      }
      return await this.save({ navigateAfterCreate: false });
    } finally {
      this.confirmingLeave = false;
    }
  }

  protected async goBack(): Promise<void> {
    if (!(await this.confirmLeave())) return;
    this.bypassGuard = true;
    if (this.cameFromList && !this.navigatedWithinPage) {
      this.location.back();
      return;
    }
    try {
      await this.router.navigate(['/trade/foundation/items']);
    } finally {
      this.bypassGuard = false;
    }
  }

  protected selectTab(tab: ItemPageTab): void {
    const resolved: ItemPageTab = this.mode() === 'create' ? 'overview' : tab;
    if (!this.visited().has(resolved)) {
      this.visited.update((set) => {
        const next = new Set(set);
        next.add(resolved);
        return next;
      });
    }
    this.activeTab.set(resolved);
    const targetParam = resolved === 'overview' ? null : resolved;
    if ((this.route.snapshot.queryParamMap.get('tab') ?? null) !== targetParam) {
      this.bypassGuard = true;
      void this.router
        .navigate([], {
          relativeTo: this.route,
          queryParams: { tab: targetParam },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        })
        .finally(() => {
          this.bypassGuard = false;
        });
    }
  }

  protected onTabKeydown(event: KeyboardEvent, index: number): void {
    const visibleTabs = this.tabs();
    const rtl = this.language() === 'ar';
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') {
      nextIndex = rtl ? (index - 1 + visibleTabs.length) % visibleTabs.length : (index + 1) % visibleTabs.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = rtl ? (index + 1) % visibleTabs.length : (index - 1 + visibleTabs.length) % visibleTabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = visibleTabs.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    const targetTab = visibleTabs[nextIndex];
    if (!targetTab) return;
    this.tabButtons()[nextIndex]?.nativeElement.focus();
    this.selectTab(targetTab.id);
  }

  protected async stepNav(dir: -1 | 1): Promise<void> {
    const pos = this.navPosition();
    if (!pos || this.loading() || this.saving() || this.uploadingImage() || this.updatingStatus()) return;
    const targetIdx = pos.index - 1 + dir;
    const ids = this.listIds();
    if (targetIdx < 0 || targetIdx >= ids.length) return;
    const targetId = ids[targetIdx];
    if (!targetId || targetId === this.itemId()) return;

    if (!(await this.confirmLeave())) return;

    const tabParam = this.activeTab() === 'overview' ? null : this.activeTab();
    this.bypassGuard = true;
    try {
      await this.router.navigate(['/trade/foundation/items', targetId], {
        queryParams: tabParam ? { tab: tabParam } : {},
        state: { listIds: ids },
      });
    } finally {
      this.bypassGuard = false;
    }
  }

  protected onItemDraftChange(next: ItemDraft): void {
    this.itemDraft.set(next);
    if (Object.keys(this.itemServerErrors()).length > 0) {
      this.itemServerErrors.set({});
    }
  }

  protected onCompanyDraftChange(next: CompanyProfileDraft): void {
    this.companyDraft.set(next);
    if (Object.keys(this.companyServerErrors()).length > 0) {
      this.companyServerErrors.set({});
    }
  }

  protected onStandardCostChange(next: string): void {
    this.standardCostDraft.set(next);
    if (this.companyServerErrors()['standardCost']) {
      this.companyServerErrors.update((prev) => {
        const copy = { ...prev };
        delete copy['standardCost'];
        return copy;
      });
    }
  }

  protected onBranchDraftChange(next: BranchProfileDraft): void {
    this.branchDraft.set(next);
    if (Object.keys(this.branchServerErrors()).length > 0) {
      this.branchServerErrors.set({});
    }
  }

  protected onImageClientError(err: FieldError | null): void {
    this.itemServerErrors.update((prev) => {
      const next = { ...prev };
      if (err) {
        next['image'] = err;
      } else {
        delete next['image'];
      }
      return next;
    });
  }

  protected async onImagePicked(file: File): Promise<void> {
    if (!this.canManage) return;
    if (this.mode() === 'create') {
      this.pendingImageFile.set(file);
      this.onImageClientError(null);
      return;
    }
    const id = this.itemId();
    if (!id || this.uploadingImage() || this.saving()) return;
    await this.uploadImageEdit(id, file);
  }

  protected async onImageRemove(): Promise<void> {
    if (!this.canManage) return;
    if (this.mode() === 'create') {
      this.pendingImageFile.set(null);
      this.onImageClientError(null);
      return;
    }
    const id = this.itemId();
    if (!id || this.uploadingImage() || this.saving()) return;
    await this.removeImageEdit(id);
  }

  protected onActionSelected(selection: ActionSelection): void {
    switch (selection.id as HeaderActionId) {
      case 'activate':
        void this.onStatusChange('ACTIVE');
        break;
      case 'deactivate':
        void this.onStatusChange('INACTIVE');
        break;
      case 'discontinue':
        void this.onStatusChange('DISCONTINUED');
        break;
      case 'copyCode':
        void this.copyCode();
        break;
    }
  }

  protected confirmDiscontinue(): void {
    this.discontinueSubmitted.set(true);
    if (!this.discontinueReasonPicker()?.valid()) return;
    const val = this.discontinueReason();
    if (!val.reasonCodeId) return;
    const note = val.note.trim();
    this.settleDiscontinue({
      reasonCodeId: val.reasonCodeId,
      ...(note ? { reasonNote: note } : {}),
    });
    this.discontinueModal().close();
  }

  protected cancelDiscontinue(): void {
    this.settleDiscontinue(null);
    this.discontinueModal().close();
  }

  protected onDiscontinueClosed(): void {
    this.discontinueOpen.set(false);
    this.settleDiscontinue(null);
  }

  protected async onStatusChange(targetStatus: ItemStatus): Promise<void> {
    if (!this.canManage || this.mode() !== 'edit') return;
    const current = this.detail();
    const id = this.itemId();
    if (
      !current ||
      !id ||
      this.updatingStatus() ||
      this.saving() ||
      this.uploadingImage() ||
      this.discontinueOpen()
    ) {
      return;
    }
    if (!ALLOWED_ITEM_STATUS_MOVES[current.status].includes(targetStatus)) return;

    let reason: ItemStatusReason | undefined;
    if (targetStatus === 'DISCONTINUED') {
      const picked = await this.promptDiscontinueReason();
      if (!picked) return;
      reason = picked;
    }

    if (current.itemKind === 'COMBO' && targetStatus === 'ACTIVE') {
      const components = this.itemDraft().comboComponents;
      const valid = await this.checkComboComponentsActive(
        components.map((row) => row.componentItemId).filter((cid): cid is string => Boolean(cid)),
        components.length,
      );
      if (!valid) {
        this.itemServerErrors.update((prev) => ({
          ...prev,
          status: { key: 'itemForm.validation.comboInactive' },
        }));
        this.selectTab('overview');
        return;
      }
    }

    await this.executeStatusMove(id, targetStatus, reason);
  }

  private promptDiscontinueReason(): Promise<ItemStatusReason | null> {
    this.settleDiscontinue(null);
    this.discontinueReason.set({ reasonCodeId: null, note: '' });
    this.discontinueSubmitted.set(false);
    this.discontinueOpen.set(true);
    this.discontinueModal().open();
    return new Promise<ItemStatusReason | null>((resolve) => {
      this.discontinueResolver = resolve;
    });
  }

  private settleDiscontinue(result: ItemStatusReason | null): void {
    const resolve = this.discontinueResolver;
    this.discontinueResolver = null;
    resolve?.(result);
  }

  protected undoAll(): void {
    if (this.saving() || this.uploadingImage() || this.updatingStatus()) return;
    this.itemDraft.set(structuredClone(this.itemBase()));
    this.pendingImageFile.set(null);
    this.companyDraft.set(structuredClone(this.companyBase()));
    this.standardCostDraft.set(this.standardCostBase());
    this.branchDraft.set(structuredClone(this.branchBase()));
    this.submitted.set(false);
    this.itemServerErrors.set({});
    this.companyServerErrors.set({});
    this.branchServerErrors.set({});
    this.resetDraftKeys();
  }

  protected retryLoad(): void {
    const id = this.itemId();
    if (!id) return;
    void this.loadAllForEdit(id);
  }

  protected async save(options?: { navigateAfterCreate?: boolean }): Promise<boolean> {
    if (
      !this.canManage ||
      this.saving() ||
      this.uploadingImage() ||
      this.updatingStatus() ||
      this.loading() ||
      this.loadFailed() ||
      this.notFound()
    ) {
      return false;
    }

    if (this.mode() === 'create') {
      return this.saveCreate(options?.navigateAfterCreate ?? true);
    }
    return this.saveEditAll();
  }

  private async saveCreate(navigateAfterCreate: boolean): Promise<boolean> {
    this.submitted.set(true);
    this.itemServerErrors.set({});
    const validation = validateDraft(this.itemDraft(), 'create', null);
    if (Object.keys(validation).length > 0) {
      this.selectTab('overview');
      afterNextRender(() => this.itemForm()?.scrollToFirstError(), { injector: this.injector });
      return false;
    }

    const body = toCreateBody(this.itemDraft());
    const fp = JSON.stringify(body);
    if (fp !== this.itemFingerprint || !this.itemKey) {
      this.itemFingerprint = fp;
      this.itemKey = newIdempotencyKey();
    }
    const pendingFile = this.pendingImageFile();
    if (pendingFile !== this.imageFile || !this.imageKey) {
      this.imageFile = pendingFile;
      this.imageKey = newIdempotencyKey();
    }

    this.saving.set(true);
    try {
      const created = await createItem(body, this.itemKey);
      this.itemKey = null;
      this.itemFingerprint = null;

      let imageFailed = false;
      if (pendingFile) {
        try {
          await putItemImage(created.id, created.version, pendingFile, this.imageKey);
          this.pendingImageFile.set(null);
          this.imageFile = null;
          this.imageKey = null;
        } catch {
          imageFailed = true;
        }
      }

      if (imageFailed) {
        this.notify.warning(this.transloco.translate('itemForm.toast.imageFailed'));
      } else {
        this.notify.success(this.transloco.translate('itemForm.toast.created'));
      }

      if (navigateAfterCreate) {
        this.bypassGuard = true;
        await this.router.navigate(['/trade/foundation/items', created.id], {
          replaceUrl: true,
          state: { listIds: this.listIds() },
        });
      }
      return true;
    } catch (error) {
      const mapped = mapItemServerError(error);
      if (mapped) {
        this.itemServerErrors.set(mapped);
        this.selectTab('overview');
        afterNextRender(() => this.itemForm()?.scrollToFirstError(), { injector: this.injector });
      }
      this.notify.error(this.transloco.translate(itemErrorKey(error)));
      return false;
    } finally {
      this.saving.set(false);
      this.bypassGuard = false;
    }
  }

  private async saveEditAll(): Promise<boolean> {
    const id = this.itemId();
    if (!id) return false;

    this.submitted.set(true);
    this.itemServerErrors.set({});
    this.companyServerErrors.set({});
    this.branchServerErrors.set({});

    const iErr = this.itemDirty() ? validateDraft(this.itemDraft(), 'edit', id) : {};
    const cErr =
      this.companyDirty() || this.costDirty()
        ? validateCompanyProfileDraft(
            this.companyDraft(),
            this.standardCostDraft(),
            this.canManageCost,
            this.companyProfile() !== null,
          )
        : {};
    const bErr = this.branchDirty() ? validateBranchProfileDraft(this.branchDraft()) : {};

    if (Object.keys(iErr).length > 0) {
      this.focusTabError('overview');
      return false;
    }
    if (Object.keys(cErr).length > 0) {
      this.focusTabError('company');
      return false;
    }
    if (Object.keys(bErr).length > 0) {
      this.focusTabError('branch');
      return false;
    }

    if (!this.anyDirty()) return true;

    const companyCtx = tradeContext(this.scopeState, 'COMPANY');
    const branchCtx = tradeContext(this.scopeState, 'BRANCH');

    this.saving.set(true);
    let currentStep: ItemPageTab = 'overview';

    try {
      // 1. Item PATCH
      if (this.itemDirty()) {
        currentStep = 'overview';
        const patch = toPatchBody(this.itemBase(), this.itemDraft());
        const fp = JSON.stringify({ id, version: this.itemVersion(), patch });
        if (fp !== this.itemFingerprint || !this.itemKey) {
          this.itemFingerprint = fp;
          this.itemKey = newIdempotencyKey();
        }
        await patchItem(id, this.itemVersion(), patch, this.itemKey);
        this.itemKey = null;
        this.itemFingerprint = null;

        const fresh = await getItemDetail(branchCtx, id);
        this.detail.set(fresh);
        this.itemVersion.set(fresh.version);
        const mapped = draftFromDetail(fresh);
        this.itemBase.set(mapped);
        this.itemDraft.set(structuredClone(mapped));
      }

      // 2. Company profile POST / PATCH
      if (this.companyDirty()) {
        currentStep = 'company';
        const existingCp = this.companyProfile();
        const cpDraft = this.companyDraft();
        const cpFp = JSON.stringify({
          companyId: companyCtx.companyId,
          create: existingCp === null,
          version: this.companyProfileVersion(),
          cpDraft,
        });
        if (cpFp !== this.companyFingerprint || !this.companyKey) {
          this.companyFingerprint = cpFp;
          this.companyKey = newIdempotencyKey();
        }

        const savedCp =
          existingCp === null
            ? await createCompanyProfile(companyCtx, id, toCompanyProfileCreateBody(cpDraft), this.companyKey)
            : await patchCompanyProfile(
                companyCtx,
                id,
                this.companyProfileVersion(),
                toCompanyProfilePatchBody(this.companyBase(), cpDraft),
                this.companyKey,
              );

        this.companyKey = null;
        this.companyFingerprint = null;
        this.companyProfile.set(savedCp);
        this.companyProfileVersion.set(savedCp.version);
        const mappedCp = companyProfileDraftFromModel(savedCp, this.companyCurrencyCode());
        this.companyBase.set(mappedCp);
        this.companyDraft.set(structuredClone(mappedCp));
      }

      // 3. Standard cost PATCH (uses the profile version returned by company profile save)
      if (this.costDirty() && this.companyProfile() !== null) {
        currentStep = 'company';
        const cleanCost = this.standardCostDraft().trim() || null;
        const costFp = JSON.stringify({
          companyId: companyCtx.companyId,
          version: this.companyProfileVersion(),
          cleanCost,
        });
        if (costFp !== this.costFingerprint || !this.costKey) {
          this.costFingerprint = costFp;
          this.costKey = newIdempotencyKey();
        }
        const savedCost = await patchStandardCost(
          companyCtx,
          id,
          this.companyProfileVersion(),
          cleanCost,
          this.costKey,
        );
        this.costKey = null;
        this.costFingerprint = null;
        this.companyProfileVersion.set(savedCost.version);
        this.companyProfile.update((p) => (p ? { ...p, version: savedCost.version } : p));
        const costVal = savedCost.standardCost ?? '';
        this.standardCostBase.set(costVal);
        this.standardCostDraft.set(costVal);
      }

      // 4. Branch profile POST / PATCH
      if (this.branchDirty()) {
        currentStep = 'branch';
        const existingBp = this.branchProfile();
        const bpDraft = this.branchDraft();
        const bpFp = JSON.stringify({
          branchId: branchCtx.branchId,
          create: existingBp === null,
          version: this.branchProfileVersion(),
          bpDraft,
        });
        if (bpFp !== this.branchFingerprint || !this.branchKey) {
          this.branchFingerprint = bpFp;
          this.branchKey = newIdempotencyKey();
        }

        const savedBp =
          existingBp === null
            ? await createBranchProfile(branchCtx, id, toBranchProfileCreateBody(bpDraft), this.branchKey)
            : await patchBranchProfile(
                branchCtx,
                id,
                this.branchProfileVersion(),
                toBranchProfilePatchBody(this.branchBase(), bpDraft),
                this.branchKey,
              );

        this.branchKey = null;
        this.branchFingerprint = null;
        this.branchProfile.set(savedBp);
        this.branchProfileVersion.set(savedBp.version);
        const mappedBp = branchProfileDraftFromModel(savedBp);
        this.branchBase.set(mappedBp);
        this.branchDraft.set(structuredClone(mappedBp));
      }

      this.submitted.set(false);
      this.notify.success(this.transloco.translate('itemForm.toast.saved'));
      return true;
    } catch (error) {
      const code = errorCodeOf(error);

      if (code === 'TRADE.CATALOG.TRACKING_LOCKED') {
        const lockKey = `${id}:${this.scopeState.company().id}`;
        this.trackingLockedKeys.update((prev) => {
          const next = new Set(prev);
          next.add(lockKey);
          return next;
        });
        const existing = this.companyProfile();
        const restoredTrack = existing?.trackInventory ?? false;
        const restoredMode = existing?.trackingMode ?? 'NONE';
        this.companyBase.update((b) => ({ ...b, trackInventory: restoredTrack, trackingMode: restoredMode }));
        this.companyDraft.update((d) => ({ ...d, trackInventory: restoredTrack, trackingMode: restoredMode }));
        this.companyKey = null;
        this.companyFingerprint = null;
        this.selectTab('company');
        this.notify.error(this.transloco.translate(itemErrorKey(error)));
        return false;
      }

      if (code === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.saving.set(false);
        return this.handleConflictAll(id);
      }

      if (currentStep === 'overview') {
        const mapped = mapItemServerError(error);
        if (mapped) {
          this.itemServerErrors.set(mapped);
        }
        this.focusTabError('overview');
      } else if (currentStep === 'company') {
        if (code === 'TRADE.CATALOG.COMPANY_PROFILE_INVALID') {
          this.companyServerErrors.set({
            salesPrice: { key: 'tradeShared.errors.TRADE_CATALOG_COMPANY_PROFILE_INVALID' },
          });
        } else if (code === 'TRADE.CATALOG.UOM_INVALID') {
          this.companyServerErrors.set({
            defaultSalesUomId: { key: 'tradeShared.errors.TRADE_CATALOG_UOM_INVALID' },
          });
        }
        this.focusTabError('company');
      } else if (currentStep === 'branch') {
        if (code === 'TRADE.CATALOG.BRANCH_MISMATCH') {
          this.branchServerErrors.set({
            defaultFulfillmentNodeId: { key: 'tradeShared.errors.TRADE_CATALOG_BRANCH_MISMATCH' },
          });
        }
        this.focusTabError('branch');
      }

      this.notify.error(this.transloco.translate(itemErrorKey(error)));
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  private async handleConflictAll(id: string): Promise<boolean> {
    const choice = await this.unsavedDialogConflictOpen();
    if (choice === 'cancel') return false;

    const oldItemBase = this.itemBase();
    const oldItemDraft = this.itemDraft();
    const oldCpBase = this.companyBase();
    const oldCpDraft = this.companyDraft();
    const oldCostBase = this.standardCostBase();
    const oldCostDraft = this.standardCostDraft();
    const oldBpBase = this.branchBase();
    const oldBpDraft = this.branchDraft();

    await this.loadAllForEdit(id);
    if (this.loadFailed() || this.notFound()) return false;

    if (choice === 'save') {
      this.submitted.set(false);
      return false;
    }

    this.itemDraft.set(rebaseItemDraft(oldItemBase, this.itemBase(), oldItemDraft));
    this.companyDraft.set(rebaseCompanyProfileDraft(oldCpBase, this.companyBase(), oldCpDraft));
    if (oldCostDraft.trim() !== oldCostBase.trim()) {
      this.standardCostDraft.set(oldCostDraft);
    }
    this.branchDraft.set(rebaseBranchProfileDraft(oldBpBase, this.branchBase(), oldBpDraft));
    this.resetDraftKeys();
    if (!this.anyDirty()) {
      this.submitted.set(false);
      this.notify.success(this.transloco.translate('itemForm.toast.saved'));
      return true;
    }
    return this.saveEditAll();
  }

  private unsavedDialogConflictOpen(): Promise<'save' | 'discard' | 'cancel'> {
    return this.conflictDialog().open();
  }

  private focusTabError(tab: ItemPageTab): void {
    this.selectTab(tab);
    if (tab === 'overview') {
      afterNextRender(() => this.itemForm()?.scrollToFirstError(), { injector: this.injector });
      return;
    }
    afterNextRender(
      () => {
        const container = this.scrollContainer()?.nativeElement;
        const target = container?.querySelector<HTMLElement>(
          `#${this.uid}-panel-${tab} [aria-invalid="true"]`,
        );
        if (!target) return;
        const focusEl = target.matches('input, textarea, select, button, [tabindex]')
          ? target
          : target.querySelector<HTMLElement>('input, textarea, select, button, [tabindex]');
        (focusEl ?? target).scrollIntoView({ block: 'nearest', behavior: smoothScrollBehavior() });
        (focusEl ?? target).focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  private async loadCreateLookups(): Promise<void> {
    const companyCtx = tradeContext(this.scopeState, 'COMPANY');
    const [refRes, uomRes] = await Promise.allSettled([getReferenceData(companyCtx), listUoms()]);
    if (refRes.status === 'fulfilled') {
      this.owners.set(refRes.value.owners);
      this.taxes.set(refRes.value.taxes);
      this.companyCurrencyCode.set(refRes.value.companyCurrencyCode);
    }
    if (uomRes.status === 'fulfilled') {
      this.uoms.set(uomRes.value);
    }
  }

  private async loadAllForEdit(id: string): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.notFound.set(false);
    this.loadFailed.set(false);

    const companyCtx = tradeContext(this.scopeState, 'COMPANY');
    const branchCtx = tradeContext(this.scopeState, 'BRANCH');

    try {
      const [detailRes, refRes, uomRes, nodesRes] = await Promise.all([
        getItemDetail(branchCtx, id),
        getReferenceData(companyCtx).catch(() => null),
        listUoms().catch(() => null),
        listFulfillmentNodeOptions(branchCtx).catch(() => [] as FulfillmentNodeOption[]),
      ]);
      if (seq !== this.loadSeq) return;

      if (refRes) {
        this.owners.set(refRes.owners);
        this.taxes.set(refRes.taxes);
        this.companyCurrencyCode.set(refRes.companyCurrencyCode);
      }
      if (uomRes) {
        this.uoms.set(uomRes);
      }
      this.fulfillmentNodes.set(nodesRes);

      this.detail.set(detailRes);
      this.itemVersion.set(detailRes.version);
      const mappedItem = draftFromDetail(detailRes);
      this.itemBase.set(mappedItem);
      this.itemDraft.set(structuredClone(mappedItem));

      const currency = refRes?.companyCurrencyCode ?? detailRes.companyProfile?.currencyCode ?? null;
      this.applyScopeProfiles(detailRes, currency);

      if (detailRes.companyProfile && this.canViewCost) {
        try {
          const costRes = await getStandardCost(companyCtx, id);
          if (seq !== this.loadSeq) return;
          const costVal = costRes.standardCost ?? '';
          this.standardCostBase.set(costVal);
          this.standardCostDraft.set(costVal);
        } catch {
          if (seq !== this.loadSeq) return;
          this.standardCostBase.set('');
          this.standardCostDraft.set('');
        }
      } else {
        this.standardCostBase.set('');
        this.standardCostDraft.set('');
      }
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (error instanceof ApiError && error.status === 404) {
        this.notFound.set(true);
      } else {
        this.loadFailed.set(true);
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private async handleScopeChange(id: string): Promise<void> {
    const seq = ++this.scopeLoadSeq;
    const hadDirtyProfiles = this.companyDirty() || this.costDirty() || this.branchDirty();
    if (hadDirtyProfiles) {
      this.notify.warning(this.transloco.translate('itemForm.toast.scopeChanged'));
    }

    this.companyKey = null;
    this.companyFingerprint = null;
    this.costKey = null;
    this.costFingerprint = null;
    this.branchKey = null;
    this.branchFingerprint = null;
    this.companyServerErrors.set({});
    this.branchServerErrors.set({});

    const companyCtx = tradeContext(this.scopeState, 'COMPANY');
    const branchCtx = tradeContext(this.scopeState, 'BRANCH');

    try {
      const [detailRes, refRes, nodesRes] = await Promise.all([
        getItemDetail(branchCtx, id),
        getReferenceData(companyCtx).catch(() => null),
        listFulfillmentNodeOptions(branchCtx).catch(() => [] as FulfillmentNodeOption[]),
      ]);
      if (seq !== this.scopeLoadSeq || this.itemId() !== id) return;

      if (refRes) {
        this.taxes.set(refRes.taxes);
        this.companyCurrencyCode.set(refRes.companyCurrencyCode);
      }
      this.fulfillmentNodes.set(nodesRes);

      this.detail.set(detailRes);
      this.itemVersion.set(detailRes.version);
      const currency = refRes?.companyCurrencyCode ?? detailRes.companyProfile?.currencyCode ?? null;
      this.applyScopeProfiles(detailRes, currency);

      if (detailRes.companyProfile && this.canViewCost) {
        try {
          const costRes = await getStandardCost(companyCtx, id);
          if (seq !== this.scopeLoadSeq || this.itemId() !== id) return;
          const costVal = costRes.standardCost ?? '';
          this.standardCostBase.set(costVal);
          this.standardCostDraft.set(costVal);
        } catch {
          if (seq !== this.scopeLoadSeq || this.itemId() !== id) return;
          this.standardCostBase.set('');
          this.standardCostDraft.set('');
        }
      } else {
        this.standardCostBase.set('');
        this.standardCostDraft.set('');
      }
    } catch (error) {
      if (seq !== this.scopeLoadSeq || this.itemId() !== id) return;
      this.notify.error(this.transloco.translate(itemErrorKey(error)));
    }
  }

  private applyScopeProfiles(detailRes: ItemDetail, currency: string | null): void {
    const cp = detailRes.companyProfile;
    this.companyProfile.set(cp);
    this.companyProfileVersion.set(cp?.version ?? 1);
    const mappedCp = companyProfileDraftFromModel(cp, currency);
    this.companyBase.set(mappedCp);
    this.companyDraft.set(structuredClone(mappedCp));

    const bp = detailRes.branchProfile;
    this.branchProfile.set(bp);
    this.branchProfileVersion.set(bp?.version ?? 1);
    const mappedBp = branchProfileDraftFromModel(bp);
    this.branchBase.set(mappedBp);
    this.branchDraft.set(structuredClone(mappedBp));
  }

  private async executeStatusMove(
    id: string,
    targetStatus: ItemStatus,
    reason?: ItemStatusReason,
  ): Promise<void> {
    this.updatingStatus.set(true);
    try {
      const action = actionKey('status', id, this.itemVersion(), targetStatus, reason);
      const saved = await moveItemStatus(id, this.itemVersion(), targetStatus, action.key, reason);
      action.done();
      this.itemVersion.set(saved.version);
      this.itemBase.update((b) => ({ ...b, status: saved.status }));
      this.itemDraft.update((d) => ({ ...d, status: saved.status }));
      this.detail.update((d) =>
        d ? { ...d, status: saved.status, version: saved.version, updatedAt: saved.updatedAt } : d,
      );
      this.itemServerErrors.update((prev) => {
        const next = { ...prev };
        delete next['status'];
        return next;
      });
      this.notify.success(this.transloco.translate('itemForm.toast.statusChanged'));
    } catch (error) {
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.updatingStatus.set(false);
        const choice = await this.conflictDialog().open();
        if (choice === 'cancel') return;
        const fresh = await getItemDetail(tradeContext(this.scopeState, 'BRANCH'), id);
        if (choice === 'save') {
          await this.loadAllForEdit(id);
          return;
        }
        this.detail.set(fresh);
        this.itemVersion.set(fresh.version);
        await this.executeStatusMove(id, targetStatus, reason);
        return;
      }
      const mapped = mapItemServerError(error);
      if (mapped) {
        this.itemServerErrors.set(mapped);
        this.focusTabError('overview');
      }
      this.notify.error(this.transloco.translate(itemErrorKey(error)));
    } finally {
      this.updatingStatus.set(false);
    }
  }

  private async uploadImageEdit(id: string, file: File): Promise<void> {
    this.uploadingImage.set(true);
    try {
      const action = actionKey('image', id, this.itemVersion(), fileSignature(file));
      const receipt = await putItemImage(id, this.itemVersion(), file, action.key);
      action.done();
      this.itemVersion.set(receipt.itemVersion);
      this.detail.update((d) =>
        d ? { ...d, version: receipt.itemVersion, image: receipt.image, currentImageId: receipt.image.id } : d,
      );
      this.onImageClientError(null);
      this.notify.success(this.transloco.translate('itemForm.toast.imageSaved'));
    } catch (error) {
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.uploadingImage.set(false);
        const choice = await this.conflictDialog().open();
        if (choice === 'cancel') return;
        if (choice === 'save') {
          await this.loadAllForEdit(id);
          return;
        }
        const fresh = await getItemDetail(tradeContext(this.scopeState, 'BRANCH'), id);
        this.detail.set(fresh);
        this.itemVersion.set(fresh.version);
        await this.uploadImageEdit(id, file);
        return;
      }
      const mapped = mapItemServerError(error);
      if (mapped) {
        this.itemServerErrors.set(mapped);
        this.focusTabError('overview');
      }
      this.notify.error(this.transloco.translate(itemErrorKey(error)));
    } finally {
      this.uploadingImage.set(false);
    }
  }

  private async removeImageEdit(id: string): Promise<void> {
    this.uploadingImage.set(true);
    try {
      const action = actionKey('image-remove', id, this.itemVersion());
      const removed = await deleteItemImage(id, this.itemVersion(), action.key);
      action.done();
      this.itemVersion.set(removed.itemVersion);
      this.detail.update((d) =>
        d ? { ...d, version: removed.itemVersion, image: null, currentImageId: null } : d,
      );
      this.onImageClientError(null);
      this.notify.success(this.transloco.translate('itemForm.toast.imageRemoved'));
    } catch (error) {
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.uploadingImage.set(false);
        const choice = await this.conflictDialog().open();
        if (choice === 'cancel') return;
        if (choice === 'save') {
          await this.loadAllForEdit(id);
          return;
        }
        const fresh = await getItemDetail(tradeContext(this.scopeState, 'BRANCH'), id);
        this.detail.set(fresh);
        this.itemVersion.set(fresh.version);
        await this.removeImageEdit(id);
        return;
      }
      this.notify.error(this.transloco.translate(itemErrorKey(error)));
    } finally {
      this.uploadingImage.set(false);
    }
  }

  private async checkComboComponentsActive(ids: readonly string[], expectedCount: number): Promise<boolean> {
    if (expectedCount < 1 || ids.length !== expectedCount) return false;
    try {
      const details = await Promise.all(ids.map((cid) => getItemDetail({}, cid)));
      return details.every((item) => item.itemKind === 'PRODUCT' && item.status === 'ACTIVE');
    } catch {
      return false;
    }
  }

  private async copyCode(): Promise<void> {
    const code = this.itemDraft().canonicalCode.trim().toUpperCase();
    if (!code) return;
    try {
      await navigator.clipboard?.writeText(code);
      this.notify.success(this.transloco.translate('tradeItems.actions.copied'));
    } catch {
      this.notify.success(this.transloco.translate('tradeItems.actions.copied'));
    }
  }

  private resetDraftKeys(): void {
    this.itemKey = null;
    this.itemFingerprint = null;
    this.imageKey = null;
    this.imageFile = null;
    this.companyKey = null;
    this.companyFingerprint = null;
    this.costKey = null;
    this.costFingerprint = null;
    this.branchKey = null;
    this.branchFingerprint = null;
  }
}
