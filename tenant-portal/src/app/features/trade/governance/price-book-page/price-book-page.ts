import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerArchive,
  tablerArrowLeft,
  tablerArrowsRightLeft,
  tablerBook,
  tablerCopy,
  tablerEye,
  tablerFileSearch,
  tablerHistory,
  tablerPlayerPause,
  tablerPlayerPlay,
  tablerPlus,
  tablerRefresh,
  tablerSend,
  tablerStar,
  tablerStarOff,
  tablerTestPipe,
  tablerTrash,
  tablerUsers,
  tablerVersions,
} from '@ng-icons/tabler-icons';
import { tablerStarFill } from '@ng-icons/tabler-icons/fill';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { ActionsMenu, type ActionItem, type ActionSelection } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../shared/ui/field/field';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Switch } from '../../../../shared/ui/switch/switch';
import { UnsavedDialog } from '../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { ApiError, errorCodeOf, newIdempotencyKey, tradeContext } from '../../shared/trade-api';
import { ConflictDialog } from '../governance-shared/conflict-dialog/conflict-dialog';
import {
  GovernedVersionsTable,
  type GovernedRow,
  type GovernedRowAction,
  type GovernedRowActionEvent,
  type GovernedTableColumn,
} from '../governance-shared/governed-versions-table/governed-versions-table';
import { ReasonDialog, type ReasonDialogResult } from '../governance-shared/reason-dialog/reason-dialog';
import { VersionStatusBadge } from '../governance-shared/version-status-badge/version-status-badge';
import { NewVersionModal, resolvePricingError } from '../new-version-modal/new-version-modal';
import {
  deleteCompanyDefault,
  deleteVersion,
  getPriceBook,
  getReferenceData,
  retireVersion,
  testVersion,
  updatePriceBook,
  upsertCompanyDefault,
} from '../pricing.api';
import type {
  GovernanceAuditEntry,
  PriceBookDossier,
  PriceBookStatus,
  UpdatePriceBookInput,
  VersionSummary,
} from '../pricing.model';
import { formatMoney } from '../../shared/trade-format';
import {
  formatDateTime,
  hasPricingGrant,
  isAwaitingActivation,
  isForbiddenError,
  isLiveScheduled,
} from '../pricing.service';

type BookTab = 'versions' | 'accounts' | 'history';
const BOOK_TABS: readonly BookTab[] = ['versions', 'accounts', 'history'];
const MAX_NAME = 160;
const MAX_DESCRIPTION = 500;
const EN_INT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

interface DetailsDraft {
  nameEn: string;
  nameAr: string;
  description: string;
  status: PriceBookStatus;
}

function emptyDetailsDraft(): DetailsDraft {
  return { nameEn: '', nameAr: '', description: '', status: 'ACTIVE' };
}

function draftFromDossier(dossier: PriceBookDossier): DetailsDraft {
  return {
    nameEn: dossier.book.localizedNames['en'] ?? '',
    nameAr: dossier.book.localizedNames['ar'] ?? '',
    description: dossier.book.description ?? '',
    status: dossier.book.status,
  };
}

function parseTab(raw: string | null): BookTab {
  return raw && (BOOK_TABS as readonly string[]).includes(raw) ? (raw as BookTab) : 'versions';
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

@Component({
  selector: 'app-price-book-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Button,
    ConfirmDialog,
    ConflictDialog,
    Field,
    FullState,
    GovernedVersionsTable,
    NewVersionModal,
    ReasonDialog,
    Switch,
    UnsavedDialog,
    VersionStatusBadge,
  ],
  providers: [
    provideTranslocoScope({ scope: 'trade-governance', alias: 'governance' }, { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-gov-price-books', alias: 'priceBooks' }),
    provideIcons({
      tablerAlertTriangle,
      tablerArchive,
      tablerArrowLeft,
      tablerArrowsRightLeft,
      tablerBook,
      tablerCopy,
      tablerEye,
      tablerFileSearch,
      tablerHistory,
      tablerPlayerPause,
      tablerPlayerPlay,
      tablerPlus,
      tablerRefresh,
      tablerSend,
      tablerStar,
      tablerStarFill,
      tablerStarOff,
      tablerTestPipe,
      tablerTrash,
      tablerUsers,
      tablerVersions,
    }),
  ],
  templateUrl: './price-book-page.html',
  host: {
    class: 'flex min-h-0 flex-1 flex-col gap-8 p-12',
    '(window:beforeunload)': 'onBeforeUnload($event)',
  },
})
export class PriceBookPage {
  private static nextId = 0;
  protected readonly uid = `gov-pb-page-${++PriceBookPage.nextId}`;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly scope = inject(ScopeState);
  private readonly tenantScope = inject(TenantScopeState);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly notify = inject(Notify);
  protected readonly language = inject(LanguageState).current;

  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabBtn');
  private readonly newVersionModal = viewChild.required(NewVersionModal);
  private readonly retireDialog = viewChild.required(ReasonDialog);
  private readonly deactivateDialog = viewChild.required<ConfirmDialog>('deactivateDialog');
  private readonly deleteDraftDialog = viewChild.required<ConfirmDialog>('deleteDraftDialog');
  private readonly unsavedDialog = viewChild.required(UnsavedDialog);
  private readonly conflictDialog = viewChild.required(ConflictDialog);

  protected readonly forbidden = signal(false);
  protected readonly canRead = computed(() =>
    hasPricingGrant(this.injector, this.scope, 'trade.pricing.read'),
  );
  protected readonly canManage = computed(
    () => !this.forbidden() && hasPricingGrant(this.injector, this.scope, 'trade.pricing.manage'),
  );
  protected readonly canPublish = computed(
    () => !this.forbidden() && hasPricingGrant(this.injector, this.scope, 'trade.policy.publish'),
  );
  protected readonly canManageDefaults = computed(
    () =>
      !this.forbidden() &&
      hasPricingGrant(this.injector, this.scope, 'trade.configuration.manage'),
  );
  private readonly currentUserId = computed(() => this.tenantScope.me()?.id ?? '');
  protected readonly maxName = MAX_NAME;
  protected readonly maxDescription = MAX_DESCRIPTION;
  protected readonly versionColumns: readonly GovernedTableColumn[] = [
    'number',
    'status',
    'effective',
    'source',
    'counts',
    'tests',
    'by',
  ];

  protected readonly bookId = signal('');
  protected readonly dossier = signal<PriceBookDossier | null>(null);
  protected readonly currencyDecimals = signal(3);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly notFound = signal(false);

  protected readonly baseDetails = signal<DetailsDraft>(emptyDetailsDraft());
  protected readonly draftDetails = signal<DetailsDraft>(emptyDetailsDraft());
  protected readonly detailsSubmitted = signal(false);
  protected readonly savingDetails = signal(false);
  protected readonly actionBusy = signal(false);

  protected readonly activeTab = signal<BookTab>('versions');
  protected readonly retiringVersion = signal<VersionSummary | null>(null);
  protected readonly deletingVersion = signal<VersionSummary | null>(null);

  private backQueryParams: Params = {};
  private loadSeq = 0;
  private detailsIdempotencyKey: string | null = null;
  private detailsFingerprint: string | null = null;
  private pendingNewVersionParam: string | null = null;
  private conflictContext: 'details' | 'header' = 'details';

  protected readonly detailsDirty = computed(() => {
    const b = this.baseDetails();
    const d = this.draftDetails();
    return (
      b.nameEn !== d.nameEn ||
      b.nameAr !== d.nameAr ||
      b.description !== d.description ||
      b.status !== d.status
    );
  });

  protected readonly nameEnError = computed<string | null>(() => {
    this.i18n();
    if (!this.detailsSubmitted()) return null;
    if (this.draftDetails().nameEn.trim().length > MAX_NAME) {
      return this.transloco.translate('priceBooks.create.errors.nameMax');
    }
    return null;
  });

  protected readonly nameArError = computed<string | null>(() => {
    this.i18n();
    if (!this.detailsSubmitted()) return null;
    if (this.draftDetails().nameAr.trim().length > MAX_NAME) {
      return this.transloco.translate('priceBooks.create.errors.nameMax');
    }
    return null;
  });

  protected readonly descriptionError = computed<string | null>(() => {
    this.i18n();
    if (!this.detailsSubmitted()) return null;
    if (this.draftDetails().description.trim().length > MAX_DESCRIPTION) {
      return this.transloco.translate('priceBooks.create.errors.descriptionMax');
    }
    return null;
  });

  protected readonly displayTitle = computed(() => {
    const current = this.dossier();
    if (!current) return '';
    const lang = this.language();
    const d = this.draftDetails();
    if (lang === 'ar') {
      return d.nameAr.trim() || d.nameEn.trim() || current.book.code;
    }
    return d.nameEn.trim() || d.nameAr.trim() || current.book.code;
  });

  protected readonly headerActions = computed<ActionItem[]>(() => {
    this.i18n();
    const current = this.dossier();
    if (!current) return [];
    const items: ActionItem[] = [];

    if (this.canManageDefaults()) {
      if (current.book.status === 'ACTIVE' && !current.book.isCompanyDefault) {
        items.push({
          id: 'makeDefault',
          title: this.transloco.translate('priceBooks.actions.makeDefault'),
          icon: 'tablerStar',
          tile: 'bg-icon-orange',
        });
      } else if (current.book.isCompanyDefault) {
        items.push({
          id: 'removeDefault',
          title: this.transloco.translate('priceBooks.actions.removeDefault'),
          icon: 'tablerStarOff',
          tile: 'bg-icon-gray',
        });
      }
    }

    if (this.canManage()) {
      if (current.book.status === 'ACTIVE') {
        items.push({
          id: 'deactivate',
          title: this.transloco.translate('priceBooks.actions.deactivate'),
          icon: 'tablerPlayerPause',
          tile: 'bg-icon-gray',
        });
      } else {
        items.push({
          id: 'activate',
          title: this.transloco.translate('priceBooks.actions.activate'),
          icon: 'tablerPlayerPlay',
          tile: 'bg-icon-green',
        });
      }
    }

    return items;
  });

  protected readonly accountsBadge = computed(() => {
    const count = this.dossier()?.linkedAccounts.length ?? 0;
    return count >= 100 ? '100+' : String(count);
  });

  protected readonly tabs = computed(() => {
    const current = this.dossier();
    return [
      {
        id: 'versions' as const,
        icon: 'tablerVersions',
        labelKey: 'priceBooks.page.tabs.versions',
        counter: current ? String(current.versions.length) : null,
      },
      {
        id: 'accounts' as const,
        icon: 'tablerUsers',
        labelKey: 'priceBooks.page.tabs.accounts',
        counter: current ? this.accountsBadge() : null,
      },
      {
        id: 'history' as const,
        icon: 'tablerHistory',
        labelKey: 'priceBooks.page.tabs.history',
        counter: null as string | null,
      },
    ];
  });

  protected readonly versionRows = computed<GovernedRow[]>(() => {
    this.i18n();
    const lang = this.language();
    const current = this.dossier();
    if (!current) return [];

    const byId = new Map(current.versions.map((v) => [v.id, v]));
    const canCompare = current.versions.length > 1;
    const latestVersionNumber = Math.max(0, ...current.versions.map((v) => v.versionNumber));
    const selfMakerHint = this.transloco.translate('governance.makerChecker.self');

    return current.versions.map((v) => {
      const supersededBy = v.supersededByVersionId ? byId.get(v.supersededByVersionId) : undefined;
      let sourceLabel = this.transloco.translate(`priceBooks.sourceMode.${v.sourceMode}`);
      if (v.sourceMode === 'CLONE_VERSION' && v.clonedFromVersionId) {
        const clonedFrom = byId.get(v.clonedFromVersionId);
        if (clonedFrom) {
          sourceLabel = this.transloco.translate('priceBooks.sourceMode.CLONE_VERSION_OF', {
            version: clonedFrom.versionNumber,
          });
        }
      }

      const actions: GovernedRowAction[] = [
        {
          key: 'open',
          title: this.transloco.translate('governance.versionsTable.actionsList.open'),
          icon: 'tablerEye',
          tile: 'bg-icon-blue',
        },
      ];

      if ((v.status === 'DRAFT' || v.status === 'TESTED') && this.canManage()) {
        actions.push({
          key: 'test',
          title: this.transloco.translate('governance.versionsTable.actionsList.test'),
          icon: 'tablerTestPipe',
          tile: 'bg-icon-teal',
        });
      }

      if (v.status === 'TESTED' && this.canPublish()) {
        const meId = this.currentUserId();
        const isSelf = Boolean(meId && v.createdByUserId && v.createdByUserId === meId);
        actions.push({
          key: 'publish',
          title: this.transloco.translate('governance.versionsTable.actionsList.publish'),
          icon: 'tablerSend',
          tile: 'bg-icon-green',
          disabled: isSelf,
          reason: isSelf ? selfMakerHint : undefined,
        });
      }

      if (this.canManage()) {
        actions.push({
          key: 'clone',
          title: this.transloco.translate('governance.versionsTable.actionsList.clone'),
          icon: 'tablerCopy',
          tile: 'bg-icon-gray',
        });
      }

      if (canCompare) {
        actions.push({
          key: 'compare',
          title: this.transloco.translate('governance.versionsTable.actionsList.compare'),
          icon: 'tablerArrowsRightLeft',
          tile: 'bg-icon-violet',
        });
      }

      if ((v.status === 'PUBLISHED' || v.status === 'SCHEDULED') && this.canPublish()) {
        actions.push({
          key: 'retire',
          title: this.transloco.translate('governance.versionsTable.actionsList.retire'),
          icon: 'tablerArchive',
          tile: 'bg-icon-red',
          danger: true,
        });
      }

      if (v.status === 'DRAFT' && v.versionNumber === latestVersionNumber && this.canManage()) {
        actions.push({
          key: 'deleteDraft',
          title: this.transloco.translate('governance.versionsTable.actionsList.deleteDraft'),
          icon: 'tablerTrash',
          tile: 'bg-icon-red',
          danger: true,
        });
      }

      const actorDisplay = v.createdByDisplayName || v.createdByEmail || v.createdByUserId || '—';
      const meId = this.currentUserId();

      return {
        id: v.id,
        versionNumber: v.versionNumber,
        status: v.status,
        liveScheduled: isLiveScheduled(v),
        awaitingActivation: isAwaitingActivation(v),
        supersededByVersionNumber: supersededBy?.versionNumber ?? null,
        effectiveFrom: v.effectiveFrom,
        // Show where the version actually stops: supersededAt wins over the immutable effectiveTo.
        effectiveTo: v.supersededAt ?? v.effectiveTo,
        byPrimary: actorDisplay,
        byIsMe: Boolean(meId && v.createdByUserId && v.createdByUserId === meId),
        testPassed: v.latestTestPassed,
        sourceLabel,
        countsPrimary: this.transloco.translate('priceBooks.counts.lines', {
          count: EN_INT.format(v.entryCount),
        }),
        countsSecondary: this.transloco.translate('priceBooks.counts.promotions', {
          count: EN_INT.format(v.promotionCount),
        }),
        actions,
      };
    });
  });

  constructor() {
    const nav = this.router.currentNavigation() ?? this.router.lastSuccessfulNavigation();
    const state = (nav?.extras?.state ?? (typeof history !== 'undefined' ? history.state : undefined)) as
      | { backQueryParams?: Params }
      | undefined;
    if (state?.backQueryParams) {
      this.backQueryParams = { ...state.backQueryParams };
    } else {
      const prevUrl = nav?.previousNavigation?.extractedUrl;
      if (prevUrl) {
        const path = prevUrl.root.children['primary']?.segments.map((s) => s.path).join('/') ?? '';
        if (path === 'trade/governance/price-books') {
          this.backQueryParams = { ...prevUrl.queryParams };
        }
      }
    }

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((query) => {
      this.activeTab.set(parseTab(query.get('tab')));
      const nv = query.get('newVersion');
      if (nv && nv.trim()) {
        this.pendingNewVersionParam = nv.trim();
        this.tryOpenPendingNewVersion();
      }
    });

    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('id') ?? '';
      if (id === this.bookId() && this.dossier()) {
        return;
      }
      this.bookId.set(id);
      this.activeTab.set(parseTab(this.route.snapshot.queryParamMap.get('tab')));
      const nv = this.route.snapshot.queryParamMap.get('newVersion');
      this.pendingNewVersionParam = nv && nv.trim() ? nv.trim() : null;
      void this.loadBook(id);
    });

    let lastLang = this.language();
    effect(() => {
      const lang = this.language();
      if (lang === lastLang) return;
      lastLang = lang;
      const id = this.bookId();
      if (id && !untracked(() => this.detailsDirty())) {
        void this.loadBook(id);
      }
    });

    let lastCompanyId = this.scope.company()?.id ?? '';
    effect(() => {
      const companyId = this.scope.company()?.id ?? '';
      if (companyId === lastCompanyId) return;
      lastCompanyId = companyId;
      const id = this.bookId();
      if (id) {
        void untracked(() => this.loadBook(id));
      }
    });
  }

  protected goHome(): void {
    void this.router.navigate(['/']);
  }

  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.canManage() && this.detailsDirty()) {
      event.preventDefault();
    }
  }

  protected async goBack(): Promise<void> {
    if (!(await this.confirmLeaveIfDirty())) return;
    await this.router.navigate(['/trade/governance/price-books'], {
      queryParams: this.backQueryParams,
    });
  }

  protected selectTab(tab: BookTab): void {
    this.activeTab.set(tab);
    const param = tab === 'versions' ? null : tab;
    if ((this.route.snapshot.queryParamMap.get('tab') ?? null) !== param) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { tab: param },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  protected onTabKeydown(event: KeyboardEvent, index: number): void {
    const list = this.tabs();
    const rtl = this.language() === 'ar';
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') {
      nextIndex = rtl ? (index - 1 + list.length) % list.length : (index + 1) % list.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = rtl ? (index + 1) % list.length : (index - 1 + list.length) % list.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = list.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    const target = list[nextIndex];
    if (!target) return;
    this.tabButtons()[nextIndex]?.nativeElement.focus();
    this.selectTab(target.id);
  }

  protected onNameEnInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value.slice(0, MAX_NAME);
    this.draftDetails.update((d) => ({ ...d, nameEn: val }));
  }

  protected onNameArInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value.slice(0, MAX_NAME);
    this.draftDetails.update((d) => ({ ...d, nameAr: val }));
  }

  protected onDescriptionInput(event: Event): void {
    const val = (event.target as HTMLTextAreaElement).value.slice(0, MAX_DESCRIPTION);
    this.draftDetails.update((d) => ({ ...d, description: val }));
  }

  protected onActiveSwitchChange(active: boolean): void {
    this.draftDetails.update((d) => ({ ...d, status: active ? 'ACTIVE' : 'INACTIVE' }));
  }

  protected undoDetails(): void {
    this.draftDetails.set({ ...this.baseDetails() });
    this.detailsSubmitted.set(false);
    this.detailsIdempotencyKey = null;
    this.detailsFingerprint = null;
  }

  protected async saveDetails(): Promise<boolean> {
    const current = this.dossier();
    if (!current || !this.canManage() || this.savingDetails() || !this.detailsDirty()) {
      return true;
    }
    this.detailsSubmitted.set(true);
    if (this.nameEnError() || this.nameArError() || this.descriptionError()) {
      return false;
    }

    const base = this.baseDetails();
    const draft = this.draftDetails();
    const body: UpdatePriceBookInput = {};

    const enChanged = base.nameEn !== draft.nameEn;
    const arChanged = base.nameAr !== draft.nameAr;
    if (enChanged || arChanged) {
      body.localizedNames = {
        ...(enChanged ? { en: draft.nameEn.trim() } : {}),
        ...(arChanged ? { ar: draft.nameAr.trim() } : {}),
      };
      if (enChanged) {
        body.name = draft.nameEn.trim();
      }
    }
    if (base.description !== draft.description) {
      body.description = draft.description.trim() || null;
    }
    if (base.status !== draft.status) {
      body.status = draft.status;
    }

    const fingerprint = JSON.stringify({ id: current.book.id, version: current.book.version, body });
    if (!this.detailsIdempotencyKey || this.detailsFingerprint !== fingerprint) {
      this.detailsIdempotencyKey = newIdempotencyKey();
      this.detailsFingerprint = fingerprint;
    }

    this.savingDetails.set(true);
    try {
      await updatePriceBook(
        current.book.id,
        body,
        current.book.version,
        this.detailsIdempotencyKey,
        tradeContext(this.scope, 'COMPANY'),
      );
      this.notify.success(this.transloco.translate('priceBooks.page.details.saved'));
      this.detailsIdempotencyKey = null;
      this.detailsFingerprint = null;
      await this.loadBook(current.book.id, false);
      return true;
    } catch (error) {
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
        return false;
      }
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.conflictContext = 'details';
        this.conflictDialog().open();
        return false;
      }
      this.notify.error(resolvePricingError(this.transloco, error));
      return false;
    } finally {
      this.savingDetails.set(false);
    }
  }

  protected openNewVersionModal(sourceVersionId?: string | null): void {
    const current = this.dossier();
    if (!current || !this.canManage()) return;
    void this.newVersionModal().open({
      bookId: current.book.id,
      bookVersion: current.book.version,
      purpose: current.book.purpose,
      currencyCode: current.book.currencyCode,
      currencyDecimals: this.currencyDecimals(),
      preset: sourceVersionId
        ? { sourceMode: 'CLONE_VERSION', sourceVersionId }
        : null,
    });
  }

  protected onVersionCreated(event: { bookId: string; version: { id: string } }): void {
    void this.router.navigate(['/trade/governance/price-books', event.bookId, 'versions', event.version.id]);
  }

  protected onHeaderAction(selection: ActionSelection): void {
    const current = this.dossier();
    if (!current) return;
    switch (selection.id) {
      case 'makeDefault':
        void this.makeCompanyDefault(current);
        break;
      case 'removeDefault':
        void this.removeCompanyDefault(current);
        break;
      case 'deactivate':
        void this.toggleBookStatus(current, 'INACTIVE');
        break;
      case 'activate':
        void this.toggleBookStatus(current, 'ACTIVE');
        break;
    }
  }

  protected async onOpenVersionRow(row: GovernedRow): Promise<void> {
    if (!(await this.confirmLeaveIfDirty())) return;
    const id = this.bookId();
    if (!id) return;
    await this.router.navigate(['/trade/governance/price-books', id, 'versions', row.id]);
  }

  protected onVersionAction(event: GovernedRowActionEvent): void {
    const current = this.dossier();
    if (!current) return;
    const version = current.versions.find((v) => v.id === event.row.id);
    if (!version) return;

    switch (event.key) {
      case 'open':
        void this.onOpenVersionRow(event.row);
        break;
      case 'test':
        void this.runTest(version);
        break;
      case 'publish':
        void this.navigateToPublish(version);
        break;
      case 'retire':
        this.promptRetire(version);
        break;
      case 'clone':
        this.openNewVersionModal(version.id);
        break;
      case 'compare':
        void this.navigateToCompare(current, version);
        break;
      case 'deleteDraft':
        void this.confirmDeleteDraft(version);
        break;
    }
  }

  protected async onRetireConfirmed(result: ReasonDialogResult): Promise<void> {
    const version = this.retiringVersion();
    const id = this.bookId();
    if (!version || !id || this.actionBusy()) return;

    this.actionBusy.set(true);
    try {
      await retireVersion(
        version.id,
        { reasonCode: result.reasonCode, ...(result.reasonNote ? { reasonNote: result.reasonNote } : {}) },
        version.version,
        newIdempotencyKey(),
        tradeContext(this.scope, 'COMPANY'),
      );
      this.notify.success(this.transloco.translate('priceBooks.toasts.retired'));
      await this.loadBook(id, false);
    } catch (error) {
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
        return;
      }
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.conflictContext = 'header';
        this.conflictDialog().open();
        return;
      }
      this.notify.error(resolvePricingError(this.transloco, error));
    } finally {
      this.actionBusy.set(false);
      this.retiringVersion.set(null);
    }
  }

  protected onRetireCancelled(): void {
    this.retiringVersion.set(null);
  }

  protected async onConflictReload(): Promise<void> {
    const id = this.bookId();
    if (id) {
      await this.loadBook(id, false);
    }
  }

  protected async onConflictKeep(): Promise<void> {
    const id = this.bookId();
    if (!id) return;
    if (this.conflictContext !== 'details') {
      await this.loadBook(id, false);
      return;
    }
    const keptDraft = { ...this.draftDetails() };
    await this.loadBook(id, false);
    this.draftDetails.set(keptDraft);
  }

  protected retryLoad(): void {
    const id = this.bookId();
    if (id) {
      void this.loadBook(id);
    }
  }

  protected accountCreditLimit(amount: string | null, currency: string | null): string {
    return amount ? formatMoney(currency, amount) : '—';
  }

  protected auditActorDisplay(entry: GovernanceAuditEntry): string {
    return entry.actorDisplayName || entry.actorUserId || '—';
  }

  protected auditIsMe(entry: GovernanceAuditEntry): boolean {
    const meId = this.currentUserId();
    return Boolean(meId && entry.actorUserId && entry.actorUserId === meId);
  }

  protected auditInitials(entry: GovernanceAuditEntry): string {
    return initialsOf(this.auditActorDisplay(entry));
  }

  protected auditActionText(action: string): string {
    const key = `priceBooks.audit.${action}`;
    const dict = this.transloco.getTranslation(this.transloco.getActiveLang());
    return typeof dict[key] === 'string' ? this.transloco.translate(key) : action;
  }

  protected auditReasonLabel(entry: GovernanceAuditEntry): string | null {
    const lang = this.language();
    if (lang === 'ar') {
      return entry.reasonNameAr || entry.reasonNameEn || entry.reasonCode || null;
    }
    return entry.reasonNameEn || entry.reasonNameAr || entry.reasonCode || null;
  }

  protected auditTime(iso: string): string {
    return formatDateTime(iso, this.language());
  }

  private async confirmLeaveIfDirty(): Promise<boolean> {
    if (!this.canManage() || !this.detailsDirty() || this.loading() || this.loadFailed() || this.notFound()) {
      return true;
    }
    const choice = await this.unsavedDialog().open();
    if (choice === 'cancel') return false;
    if (choice === 'discard') {
      this.undoDetails();
      return true;
    }
    return this.saveDetails();
  }

  private async navigateToPublish(version: VersionSummary): Promise<void> {
    if (!(await this.confirmLeaveIfDirty())) return;
    await this.router.navigate(
      ['/trade/governance/price-books', this.bookId(), 'versions', version.id],
      { queryParams: { publish: '1' } },
    );
  }

  private async navigateToCompare(dossier: PriceBookDossier, version: VersionSummary): Promise<void> {
    if (!(await this.confirmLeaveIfDirty())) return;
    const base =
      dossier.versions.find(
        (v) => v.id !== version.id && (v.status === 'PUBLISHED' || v.status === 'SCHEDULED') && !v.supersededAt,
      ) ?? dossier.versions.find((v) => v.id !== version.id);
    await this.router.navigate(
      ['/trade/governance/price-books', this.bookId(), 'versions', version.id],
      { queryParams: { tab: 'compare', ...(base ? { base: base.id } : {}) } },
    );
  }

  private async runTest(version: VersionSummary): Promise<void> {
    if (this.actionBusy()) return;
    this.actionBusy.set(true);
    try {
      const result = await testVersion(
        version.id,
        version.version,
        newIdempotencyKey(),
        tradeContext(this.scope, 'COMPANY'),
      );
      if (result.passed) {
        this.notify.success(this.transloco.translate('priceBooks.test.passed'));
      } else {
        const count = result.conflicts.length + result.promotionConflicts.length;
        this.notify.warning(
          this.transloco.translate('priceBooks.test.failedTitle', { count }),
          this.transloco.translate('priceBooks.test.failedHint'),
        );
      }
      await this.loadBook(this.bookId(), false);
    } catch (error) {
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
        return;
      }
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.conflictContext = 'header';
        this.conflictDialog().open();
        return;
      }
      this.notify.error(resolvePricingError(this.transloco, error));
    } finally {
      this.actionBusy.set(false);
    }
  }

  private promptRetire(version: VersionSummary): void {
    this.retiringVersion.set(version);
    void this.retireDialog().open();
  }

  private async confirmDeleteDraft(version: VersionSummary): Promise<void> {
    if (this.actionBusy()) return;
    this.deletingVersion.set(version);
    const confirmed = await this.deleteDraftDialog().open();
    if (!confirmed) {
      this.deletingVersion.set(null);
      return;
    }
    this.actionBusy.set(true);
    try {
      await deleteVersion(
        version.id,
        version.version,
        newIdempotencyKey(),
        tradeContext(this.scope, 'COMPANY'),
      );
      this.notify.success(this.transloco.translate('priceBooks.toasts.draftDeleted'));
      await this.loadBook(this.bookId(), false);
    } catch (error) {
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
        return;
      }
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.conflictContext = 'header';
        this.conflictDialog().open();
        return;
      }
      this.notify.error(resolvePricingError(this.transloco, error));
    } finally {
      this.actionBusy.set(false);
      this.deletingVersion.set(null);
    }
  }

  private async makeCompanyDefault(current: PriceBookDossier): Promise<void> {
    if (this.actionBusy()) return;
    this.actionBusy.set(true);
    try {
      const mappingVersion = current.companyDefaultMapping?.version ?? 0;
      await upsertCompanyDefault(
        current.book.purpose,
        current.book.currencyCode,
        current.book.id,
        mappingVersion,
        newIdempotencyKey(),
        tradeContext(this.scope, 'COMPANY'),
      );
      this.notify.success(this.transloco.translate('priceBooks.toasts.defaultSet'));
      await this.loadBook(current.book.id, false);
    } catch (error) {
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
        return;
      }
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.conflictContext = 'header';
        this.conflictDialog().open();
        return;
      }
      this.notify.error(resolvePricingError(this.transloco, error));
    } finally {
      this.actionBusy.set(false);
    }
  }

  private async removeCompanyDefault(current: PriceBookDossier): Promise<void> {
    if (this.actionBusy() || !current.companyDefaultMapping?.isThisBook) return;
    this.actionBusy.set(true);
    try {
      await deleteCompanyDefault(
        current.book.purpose,
        current.book.currencyCode,
        current.companyDefaultMapping.version,
        newIdempotencyKey(),
        tradeContext(this.scope, 'COMPANY'),
      );
      this.notify.success(this.transloco.translate('priceBooks.toasts.defaultRemoved'));
      await this.loadBook(current.book.id, false);
    } catch (error) {
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
        return;
      }
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.conflictContext = 'header';
        this.conflictDialog().open();
        return;
      }
      this.notify.error(resolvePricingError(this.transloco, error));
    } finally {
      this.actionBusy.set(false);
    }
  }

  private async toggleBookStatus(current: PriceBookDossier, nextStatus: PriceBookStatus): Promise<void> {
    if (this.actionBusy()) return;
    if (nextStatus === 'INACTIVE') {
      const confirmed = await this.deactivateDialog().open();
      if (!confirmed) return;
    }

    this.actionBusy.set(true);
    try {
      await updatePriceBook(
        current.book.id,
        { status: nextStatus },
        current.book.version,
        newIdempotencyKey(),
        tradeContext(this.scope, 'COMPANY'),
      );
      this.notify.success(
        this.transloco.translate(
          nextStatus === 'ACTIVE' ? 'priceBooks.toasts.activated' : 'priceBooks.toasts.deactivated',
        ),
      );
      await this.loadBook(current.book.id, false);
    } catch (error) {
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
        return;
      }
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.conflictContext = 'header';
        this.conflictDialog().open();
        return;
      }
      this.notify.error(resolvePricingError(this.transloco, error));
    } finally {
      this.actionBusy.set(false);
    }
  }

  private tryOpenPendingNewVersion(): void {
    const param = this.pendingNewVersionParam;
    const current = this.dossier();
    if (!param || !current || this.loading()) return;
    this.pendingNewVersionParam = null;

    if (this.canManage()) {
      const preset =
        param === '1'
          ? { sourceMode: 'EMPTY_DRAFT' as const }
          : { sourceMode: 'CLONE_VERSION' as const, sourceVersionId: param };
      void this.newVersionModal().open({
        bookId: current.book.id,
        bookVersion: current.book.version,
        purpose: current.book.purpose,
        currencyCode: current.book.currencyCode,
        currencyDecimals: this.currencyDecimals(),
        preset,
      });
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { newVersion: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private async loadBook(id: string, showSkeleton = true): Promise<void> {
    if (!this.canRead()) {
      this.loading.set(false);
      return;
    }
    if (!id) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }
    const seq = ++this.loadSeq;
    if (showSkeleton) {
      this.loading.set(true);
    }
    this.loadFailed.set(false);
    this.notFound.set(false);
    this.forbidden.set(false);

    const ctx = tradeContext(this.scope, 'COMPANY');
    try {
      const [dossierData, refData] = await Promise.all([
        getPriceBook(id, ctx),
        getReferenceData(ctx).catch((error) => {
          if (isForbiddenError(error)) throw error;
          return { branches: [], currencies: [] };
        }),
      ]);
      if (seq !== this.loadSeq) return;

      this.dossier.set(dossierData);
      const dec =
        refData.currencies.find((c) => c.code === dossierData.book.currencyCode)?.decimalPlaces ?? 3;
      this.currencyDecimals.set(dec);

      const mapped = draftFromDossier(dossierData);
      this.baseDetails.set(mapped);
      this.draftDetails.set({ ...mapped });
      this.detailsSubmitted.set(false);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
      } else if (error instanceof ApiError && error.status === 404) {
        this.notFound.set(true);
      } else {
        this.loadFailed.set(true);
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
        this.tryOpenPendingNewVersion();
      }
    }
  }
}
