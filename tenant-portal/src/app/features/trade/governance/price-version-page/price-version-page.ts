import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerArchive,
  tablerArrowBackUp,
  tablerArrowDown,
  tablerArrowLeft,
  tablerArrowRight,
  tablerArrowsLeftRight,
  tablerArrowUp,
  tablerBook,
  tablerCheck,
  tablerCircleCheck,
  tablerCircleX,
  tablerCloudOff,
  tablerCopy,
  tablerDeviceFloppy,
  tablerEdit,
  tablerFlask,
  tablerHistory,
  tablerLayoutList,
  tablerPercentage,
  tablerPlus,
  tablerRefresh,
  tablerRocket,
  tablerTrash,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { type ActionItem, type ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { DateField } from '../../../../shared/ui/date-time/date-field';
import { TimeField } from '../../../../shared/ui/date-time/time-field';
import { Field } from '../../../../shared/ui/field/field';
import { type TabItem, Tabs, tabButtonId, tabPanelId } from '../../../../shared/ui/tabs/tabs';
import { UnsavedDialog } from '../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { ApiError, type TradeContext, newIdempotencyKey, tradeContext } from '../../shared/trade-api';
import {
  getItem,
  itemName,
  listChannels,
  listUoms,
  searchCommercialAccounts,
} from '../../shared/trade-foundation.api';
import type {
  Channel,
  CommercialAccountSummary,
  Uom,
} from '../../shared/trade-foundation.model';
import { FAKE_ME, actorDisplayName } from '../governance-fake-actors';
import { ConflictDialog } from '../governance-shared/conflict-dialog/conflict-dialog';
import { type LifecycleStep, LifecycleStepper } from '../governance-shared/lifecycle-stepper/lifecycle-stepper';
import { ReasonDialog, type ReasonDialogResult } from '../governance-shared/reason-dialog/reason-dialog';
import { VersionStatusBadge } from '../governance-shared/version-status-badge/version-status-badge';
import {
  changeEntries,
  changePromotions,
  deleteVersion,
  getPriceVersion,
  getReferenceData,
  listEntries,
  retireVersion,
  testVersion,
  updateVersion,
} from '../pricing.api';
import type {
  EntryInput,
  GovernanceAuditEntry,
  PriceEntry,
  PriceTestEvidence,
  PriceTestResult,
  PriceVersionDetail,
  PriceVersionHeadDetail,
  PriceVersionRow,
  PromotionInput,
  PromotionRule,
  ReferenceBranch,
} from '../pricing.model';
import {
  formatDateTime,
  isLiveScheduled,
  promotionToInput,
  rangeText,
} from '../pricing.service';
import { resolvePricingError } from '../new-version-modal/new-version-modal';
import { formatMoney, formatQty } from '../../shared/trade-format';
import { PriceDiff } from '../price-diff/price-diff';
import {
  type PriceLineRow,
  PriceLinesTable,
  hasLineErrors,
  validateLineRow,
} from '../price-lines-table/price-lines-table';
import { PromotionModal } from '../promotion-modal/promotion-modal';
import { PublishPriceDialog } from '../publish-price-dialog/publish-price-dialog';

const CAN = { manage: true, test: true, approve: true, publish: true }; // later from the session

export type PriceVersionTab = 'lines' | 'promotions' | 'test' | 'compare' | 'history';

const VALID_TABS: readonly PriceVersionTab[] = ['lines', 'promotions', 'test', 'compare', 'history'];
const DEFAULT_PAGE_SIZE = 50;
const MAX_TOTAL_OPS_PER_SAVE = 5000;
const MAX_ENTRY_OPS_PER_CALL = 1000;
const MAX_PROMO_OPS_PER_CALL = 500;

interface LocalDateTimeParts {
  date: string | null;
  time: string | null;
}

interface ParsedLineConflict {
  kind: 'NO_ENTRIES' | 'OVERLAP' | 'UNKNOWN';
  raw: string;
  idA?: string;
  idB?: string;
  lineA?: number;
  lineB?: number;
}

interface ParsedPromoConflict {
  kind: 'EQUAL_PRECEDENCE' | 'DUPLICATE' | 'INVALID_BENEFIT' | 'UNKNOWN';
  raw: string;
  codeA?: string;
  codeB?: string;
}

function parseTabParam(raw: string | null): PriceVersionTab {
  return raw && (VALID_TABS as readonly string[]).includes(raw)
    ? (raw as PriceVersionTab)
    : 'lines';
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isoToLocalParts(iso: string | null | undefined): LocalDateTimeParts {
  if (!iso || !iso.trim()) {
    return { date: null, time: null };
  }
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) {
    return { date: null, time: null };
  }
  return {
    date: `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`,
    time: `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`,
  };
}

function localPartsToUtcIso(dateStr: string | null, timeStr: string | null): string | null {
  if (!dateStr || !timeStr) return null;
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeStr.trim());
  if (!dateMatch || !timeMatch) return null;
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const dt = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day ||
    dt.getHours() !== hours ||
    dt.getMinutes() !== minutes
  ) {
    return null;
  }
  return dt.toISOString();
}

function toEntryInput(row: PriceLineRow, currencyCode: string): EntryInput {
  return {
    ...(row.id && !row.id.startsWith('temp-') ? { id: row.id } : {}),
    itemId: row.itemId,
    uomId: row.uomId,
    currencyCode,
    minimumQuantity: row.minimumQuantity.trim(),
    maximumQuantity: row.maximumQuantity?.trim() ? row.maximumQuantity.trim() : null,
    unitPrice: row.unitPrice.trim(),
    minimumAllowedPrice: row.minimumAllowedPrice?.trim() ? row.minimumAllowedPrice.trim() : null,
    priority: row.priority,
  };
}

/** PromotionChangeDto: a flat body; unsaved rows carry no id. */
function toPromotionInput(promo: PromotionRule): PromotionInput {
  const { id, ...input } = promotionToInput(promo);
  return promo.id && !promo.id.startsWith('temp-') ? { id, ...input } : input;
}

/** The page keeps the version head; lines are paged through GET .../entries. */
type VersionView = Omit<PriceVersionDetail, 'entries'>;

function toVersionView(head: PriceVersionHeadDetail): VersionView {
  const { versionHead, version: _ifMatch, ...rest } = head;
  return { ...rest, version: versionHead };
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

@Component({
  selector: 'app-price-version-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Button,
    ConfirmDialog,
    ConflictDialog,
    DateField,
    Field,
    LifecycleStepper,
    PriceDiff,
    PriceLinesTable,
    PromotionModal,
    PublishPriceDialog,
    ReasonDialog,
    Tabs,
    TimeField,
    UnsavedDialog,
    VersionStatusBadge,
  ],
  providers: [
    provideTranslocoScope({ scope: 'trade-governance', alias: 'governance' }, { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-gov-pricing', alias: 'pricing' }),
    provideIcons({
      tablerAlertTriangle,
      tablerArchive,
      tablerArrowBackUp,
      tablerArrowDown,
      tablerArrowLeft,
      tablerArrowRight,
      tablerArrowsLeftRight,
      tablerArrowUp,
      tablerBook,
      tablerCheck,
      tablerCircleCheck,
      tablerCircleX,
      tablerCloudOff,
      tablerCopy,
      tablerDeviceFloppy,
      tablerEdit,
      tablerFlask,
      tablerHistory,
      tablerLayoutList,
      tablerPercentage,
      tablerPlus,
      tablerRefresh,
      tablerRocket,
      tablerTrash,
      tablerX,
    }),
  ],
  templateUrl: './price-version-page.html',
  host: {
    class: 'flex min-h-0 flex-1 flex-col gap-8 p-12',
    '(window:beforeunload)': 'onBeforeUnload($event)',
  },
})
export class PriceVersionPage {
  private static nextId = 0;
  private static tempLineSeq = 0;
  protected readonly uid = `gov-price-version-${++PriceVersionPage.nextId}`;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scope = inject(ScopeState);
  protected readonly lang = inject(LanguageState).current;
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly promotionModal = viewChild.required(PromotionModal);
  private readonly publishDialog = viewChild.required(PublishPriceDialog);
  private readonly retireDialog = viewChild.required(ReasonDialog);
  private readonly conflictDialog = viewChild.required(ConflictDialog);
  private readonly returnToDraftDialog = viewChild.required<ConfirmDialog>('returnToDraftDialog');
  private readonly deleteDraftDialog = viewChild.required<ConfirmDialog>('deleteDraftDialog');
  private readonly unsavedDialog = viewChild.required(UnsavedDialog);

  protected readonly tabButtonId = tabButtonId;
  protected readonly tabPanelId = tabPanelId;
  protected readonly can = CAN;

  // Route parameters
  protected readonly bookId = signal('');
  protected readonly versionId = signal('');
  protected readonly activeTab = signal<PriceVersionTab>('lines');
  protected readonly visited = signal<ReadonlySet<PriceVersionTab>>(new Set<PriceVersionTab>(['lines']));
  protected readonly compareBaselineId = signal<string | null>(null);

  // Version detail & optimistic concurrency token
  protected readonly detail = signal<VersionView | null>(null);
  protected readonly currentIfMatch = signal(1);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly notFound = signal(false);

  // Header date-time draft
  private baseFromParts: LocalDateTimeParts = { date: null, time: null };
  private baseToParts: LocalDateTimeParts = { date: null, time: null };
  protected readonly fromDate = signal<string | null>(null);
  protected readonly fromTime = signal<string | null>(null);
  protected readonly toDate = signal<string | null>(null);
  protected readonly toTime = signal<string | null>(null);
  protected readonly headerSubmitted = signal(false);

  // Paged entries state
  protected readonly serverEntries = signal<readonly PriceEntry[]>([]);
  protected readonly serverTotal = signal(0);
  protected readonly linesLoading = signal(false);
  protected readonly linesLoadFailed = signal(false);
  protected readonly linePage = signal(1);
  protected readonly linePageSize = signal(DEFAULT_PAGE_SIZE);
  protected readonly lineSearch = signal('');
  protected readonly lineUomFilter = signal('');
  protected readonly focusLineId = signal<string | null>(null);
  protected readonly showLineErrors = signal(false);
  protected readonly serverOverlapErrors = signal<ReadonlyMap<string, number>>(new Map());

  // Change sets (never copy all lines into memory)
  protected readonly entryUpserts = signal<ReadonlyMap<string, PriceLineRow>>(new Map());
  protected readonly entryDeletes = signal<ReadonlySet<string>>(new Set());
  protected readonly promoUpserts = signal<ReadonlyMap<string, PromotionRule>>(new Map());
  protected readonly promoDeletes = signal<ReadonlySet<string>>(new Set());
  protected readonly pageRowOrder = signal<readonly string[] | null>(null);

  // Lookups
  protected readonly uoms = signal<readonly Uom[]>([]);
  protected readonly branches = signal<readonly ReferenceBranch[]>([]);
  protected readonly channels = signal<readonly Channel[]>([]);
  protected readonly accounts = signal<readonly CommercialAccountSummary[]>([]);
  protected readonly itemNamesById = signal<Readonly<Record<string, string>>>({});

  // Session test result + action busy states
  protected readonly sessionTestResult = signal<{ result: PriceTestResult; testedAt: string } | null>(null);
  protected readonly saving = signal(false);
  protected readonly testing = signal(false);
  protected readonly retiring = signal(false);
  protected readonly deleting = signal(false);

  private versionSeq = 0;
  private entriesSeq = 0;
  private lookupsSeq = 0;
  private confirmingLeave = false;
  private pendingPublishQuery = false;

  protected readonly promoGrid =
    'grid-cols-trade-price-promo-row-actions';

  protected readonly companyContext = computed<TradeContext>(() => tradeContext(this.scope, 'COMPANY'));

  protected readonly busy = computed(
    () => this.saving() || this.testing() || this.retiring() || this.deleting(),
  );

  protected readonly status = computed(() => this.detail()?.version.status ?? 'DRAFT');

  protected readonly editable = computed(() => {
    const s = this.status();
    return this.can.manage && (s === 'DRAFT' || s === 'TESTED');
  });

  protected readonly liveScheduled = computed(() => {
    const v = this.detail()?.version;
    return v ? isLiveScheduled(v) : false;
  });

  protected readonly publishBlocked = computed(() => {
    const d = this.detail();
    if (!d) return false;
    return d.version.createdByUserId === FAKE_ME && !d.soloOwnerGovernanceEligible;
  });

  protected readonly makerCheckerCaption = computed(() => {
    this.i18n();
    if (!this.editable() || !this.publishBlocked()) return null;
    return this.transloco.translate('pricing.lines.makerCheckerNote');
  });

  protected readonly bookDisplayName = computed(() => {
    const b = this.detail()?.book;
    if (!b) return '';
    const language = this.lang();
    return b.localizedNames[language] || b.localizedNames['en'] || b.localizedNames['ar'] || b.name || b.code;
  });

  protected readonly createdByText = computed(() => {
    this.i18n();
    const v = this.detail()?.version;
    if (!v) return '';
    const name = actorDisplayName(v.createdByUserId, this.lang()) || v.createdByDisplayName;
    if (v.createdByUserId === FAKE_ME) {
      return `${name} ${this.transloco.translate('governance.common.you')}`;
    }
    return name;
  });

  protected readonly effectiveRangeDisplay = computed(() => {
    const v = this.detail()?.version;
    if (!v) return '—';
    return rangeText(v.effectiveFrom, v.supersededAt ?? v.effectiveTo, this.lang());
  });

  protected readonly headerDirty = computed(() => {
    if (!this.detail()) return false;
    return (
      this.fromDate() !== this.baseFromParts.date ||
      this.fromTime() !== this.baseFromParts.time ||
      this.toDate() !== this.baseToParts.date ||
      this.toTime() !== this.baseToParts.time
    );
  });

  protected readonly dirty = computed(
    () =>
      this.entryUpserts().size > 0 ||
      this.entryDeletes().size > 0 ||
      this.promoUpserts().size > 0 ||
      this.promoDeletes().size > 0 ||
      this.headerDirty(),
  );

  protected readonly fromError = computed<string | null>(() => {
    this.i18n();
    if (!this.editable() || (!this.headerSubmitted() && !this.headerDirty())) return null;
    if (!this.fromDate() || !this.fromTime()) {
      return this.transloco.translate('pricing.header.dateRequired');
    }
    if (!localPartsToUtcIso(this.fromDate(), this.fromTime())) {
      return this.transloco.translate('pricing.header.invalidDate');
    }
    return null;
  });

  protected readonly toError = computed<string | null>(() => {
    this.i18n();
    if (!this.editable() || (!this.headerSubmitted() && !this.headerDirty())) return null;
    const td = this.toDate();
    const tt = this.toTime();
    if (!td && !tt) return null;
    const toIso = localPartsToUtcIso(td, tt);
    if (!toIso) {
      return this.transloco.translate('pricing.header.invalidDate');
    }
    const fromIso = localPartsToUtcIso(this.fromDate(), this.fromTime());
    if (fromIso && Date.parse(toIso) <= Date.parse(fromIso)) {
      return this.transloco.translate('pricing.header.endAfterStart');
    }
    return null;
  });

  protected readonly fromDescribedBy = computed(() => {
    const base = `${this.uid}-from-hint`;
    return this.fromError() ? `${base} ${this.uid}-from-error` : base;
  });

  protected readonly toDescribedBy = computed(() => {
    const base = `${this.uid}-to-hint`;
    return this.toError() ? `${base} ${this.uid}-to-error` : base;
  });

  protected readonly hasEffectiveTo = computed(() => Boolean(this.toDate() || this.toTime()));

  protected readonly stepperSteps = computed<LifecycleStep[]>(() => {
    this.i18n();
    return [
      { key: 'DRAFT', label: this.transloco.translate('pricing.stepper.draft') },
      { key: 'TESTED', label: this.transloco.translate('pricing.stepper.tested') },
      { key: 'LIVE', label: this.transloco.translate('pricing.stepper.live') },
      { key: 'RETIRED', label: this.transloco.translate('pricing.stepper.retired') },
    ];
  });

  protected readonly stepperCurrent = computed(() => {
    const s = this.status();
    if (s === 'PUBLISHED' || s === 'SCHEDULED') return 'LIVE';
    return s;
  });

  // Effective promotions (server promotions merged with local change set)
  protected readonly effectivePromotions = computed<PromotionRule[]>(() => {
    const serverPromos = this.detail()?.promotions ?? [];
    const upserts = this.promoUpserts();
    const deletes = this.promoDeletes();
    const list: PromotionRule[] = [];
    for (const promo of serverPromos) {
      if (deletes.has(promo.id)) continue;
      list.push(upserts.get(promo.id) ?? promo);
    }
    for (const promo of upserts.values()) {
      if (promo.id.startsWith('temp-promo-')) {
        list.push(promo);
      }
    }
    return list;
  });

  // Effective line counts and visible page rows
  protected readonly allNewLines = computed<PriceLineRow[]>(() => {
    const list: PriceLineRow[] = [];
    for (const row of this.entryUpserts().values()) {
      if (row.id.startsWith('temp-')) {
        list.push(row);
      }
    }
    return list;
  });

  protected readonly matchingNewLines = computed<PriceLineRow[]>(() => {
    const needle = this.lineSearch().trim().toLowerCase();
    const uomFilter = this.lineUomFilter();
    return this.allNewLines().filter((row) => {
      if (row.isNew && !row.itemId && !row.uomId) return true;
      if (uomFilter && row.uomId !== uomFilter) return false;
      if (needle) {
        const codeMatch = row.itemCode.toLowerCase().includes(needle);
        const nameMatch = Object.values(row.itemLocalizedNames).some((n) =>
          n.toLowerCase().includes(needle),
        );
        if (!codeMatch && !nameMatch) return false;
      }
      return true;
    });
  });

  protected readonly effectiveEntryCount = computed(() => {
    const baseCount = this.detail()?.entryCount ?? 0;
    return Math.max(0, baseCount - this.entryDeletes().size + this.allNewLines().length);
  });

  protected readonly effectiveFilteredLinesTotal = computed(() => {
    const baseFiltered = this.serverTotal();
    const deletedCount = this.lineSearch() || this.lineUomFilter()
      ? this.serverEntries().filter((e) => this.entryDeletes().has(e.id)).length
      : this.entryDeletes().size;
    return Math.max(0, baseFiltered - deletedCount + this.matchingNewLines().length);
  });

  protected readonly visiblePageEntries = computed<PriceLineRow[]>(() => {
    const serverRows = this.serverEntries();
    const upserts = this.entryUpserts();
    const deletes = this.entryDeletes();
    const page = this.linePage();
    const pageSize = this.linePageSize();
    const totalPages = Math.max(1, Math.ceil(this.effectiveFilteredLinesTotal() / pageSize));

    const merged: PriceLineRow[] = [];
    for (const entry of serverRows) {
      if (deletes.has(entry.id)) continue;
      merged.push(upserts.get(entry.id) ?? entry);
    }

    if (page >= totalPages) {
      for (const newRow of this.matchingNewLines()) {
        merged.push(newRow);
      }
    }

    const order = this.pageRowOrder();
    if (!order || order.length === 0) {
      return merged;
    }

    const byId = new Map(merged.map((r) => [r.id, r]));
    const ordered: PriceLineRow[] = [];
    for (const id of order) {
      const row = byId.get(id);
      if (row) {
        ordered.push(row);
        byId.delete(id);
      }
    }
    for (const row of byId.values()) {
      ordered.push(row);
    }
    return ordered;
  });

  protected readonly allUpsertRows = computed<PriceLineRow[]>(() =>
    Array.from(this.entryUpserts().values()),
  );

  protected readonly tabs = computed<TabItem[]>(() => {
    this.i18n();
    return [
      {
        id: 'lines',
        label: this.transloco.translate('pricing.tabs.lines'),
        icon: 'tablerLayoutList',
        count: this.effectiveEntryCount(),
      },
      {
        id: 'promotions',
        label: this.transloco.translate('pricing.tabs.promotions'),
        icon: 'tablerPercentage',
        count: this.effectivePromotions().length,
      },
      {
        id: 'test',
        label: this.transloco.translate('pricing.tabs.test'),
        icon: 'tablerFlask',
      },
      {
        id: 'compare',
        label: this.transloco.translate('pricing.tabs.compare'),
        icon: 'tablerArrowsLeftRight',
      },
      {
        id: 'history',
        label: this.transloco.translate('pricing.tabs.history'),
        icon: 'tablerHistory',
      },
    ];
  });

  protected readonly moreActions = computed<ActionItem[]>(() => {
    this.i18n();
    const items: ActionItem[] = [
      {
        id: 'copy',
        title: this.transloco.translate('pricing.actions.copyDraft'),
        icon: 'tablerCopy',
        tile: 'bg-icon-gray',
      },
    ];
    if (this.status() === 'DRAFT' && this.can.manage) {
      items.push({
        id: 'deleteDraft',
        title: this.transloco.translate('pricing.actions.deleteDraft'),
        icon: 'tablerTrash',
        tile: 'bg-icon-red',
        danger: true,
      });
    }
    return items;
  });

  protected readonly activeTestEvidence = computed<PriceTestEvidence | null>(() => {
    const session = this.sessionTestResult();
    const server = this.detail()?.latestTestEvidence ?? null;
    if (session) {
      return {
        id: session.result.evidenceId,
        aggregateVersion: session.result.version,
        contentHash: session.result.checksum,
        passed: session.result.passed,
        testedAt: session.testedAt,
        report: session.result,
      };
    }
    return server;
  });

  protected readonly parsedLineConflicts = computed<ParsedLineConflict[]>(() => {
    const list = this.activeTestEvidence()?.report.conflicts ?? [];
    return list.map((raw) => {
      if (raw === 'NO_ENTRIES') {
        return { kind: 'NO_ENTRIES', raw };
      }
      if (raw.startsWith('OVERLAP:')) {
        const parts = raw.split(':');
        return {
          kind: 'OVERLAP',
          raw,
          idA: parts[1],
          idB: parts[2],
          lineA: Number(parts[3]) || undefined,
          lineB: Number(parts[4]) || undefined,
        };
      }
      return { kind: 'UNKNOWN', raw };
    });
  });

  protected readonly parsedPromoConflicts = computed<ParsedPromoConflict[]>(() => {
    const list = this.activeTestEvidence()?.report.promotionConflicts ?? [];
    return list.map((raw) => {
      if (raw.startsWith('EQUAL_PRECEDENCE:')) {
        const [, codeA, codeB] = raw.split(':');
        return { kind: 'EQUAL_PRECEDENCE', raw, codeA, codeB };
      }
      if (raw.startsWith('DUPLICATE:')) {
        const [, codeA] = raw.split(':');
        return { kind: 'DUPLICATE', raw, codeA };
      }
      if (raw.startsWith('INVALID_BENEFIT:')) {
        const [, codeA] = raw.split(':');
        return { kind: 'INVALID_BENEFIT', raw, codeA };
      }
      return { kind: 'UNKNOWN', raw };
    });
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const nextBookId = params.get('id') ?? '';
      const nextVersionId = params.get('versionId') ?? '';
      const qp = this.route.snapshot.queryParamMap;
      const initialTab = parseTabParam(qp.get('tab'));
      const base = qp.get('base');
      this.pendingPublishQuery = qp.get('publish') === '1';

      this.bookId.set(nextBookId);
      this.versionId.set(nextVersionId);
      this.activeTab.set(initialTab);
      this.visited.set(new Set<PriceVersionTab>(['lines', initialTab]));
      this.compareBaselineId.set(base?.trim() || null);

      this.linePage.set(1);
      this.lineSearch.set('');
      this.lineUomFilter.set('');
      this.resetDraftState();
      this.sessionTestResult.set(null);

      if (nextVersionId) {
        void this.loadVersion(true);
      }
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((qp) => {
      const tab = parseTabParam(qp.get('tab'));
      this.markTabVisited(tab);
      this.activeTab.set(tab);
      const base = qp.get('base')?.trim() || null;
      if (base !== this.compareBaselineId()) {
        this.compareBaselineId.set(base);
      }
    });

    effect(() => {
      const ctx = this.companyContext();
      const purpose = this.detail()?.book.purpose;
      if (!purpose) return;
      untracked(() => void this.loadLookups(ctx, purpose));
    });

    effect(() => {
      const promos = this.effectivePromotions();
      const ctx = this.companyContext();
      const cached = untracked(() => this.itemNamesById());
      const missingIds = Array.from(
        new Set(
          promos
            .map((p) => p.selector.itemId)
            .filter((id): id is string => Boolean(id && !cached[id])),
        ),
      );
      if (missingIds.length === 0) return;
      untracked(() => void this.resolveItemNames(ctx, missingIds));
    });

    effect(() => {
      const vId = this.versionId();
      const page = this.linePage();
      const limit = this.linePageSize();
      const q = this.lineSearch();
      const uomId = this.lineUomFilter();
      if (!vId) return;
      untracked(() => void this.loadEntriesPage(vId, page, limit, q, uomId));
    });
  }

  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty() && this.editable()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  async canDeactivate(): Promise<boolean> {
    if (!this.dirty() || !this.editable() || this.loading() || this.loadFailed() || this.notFound()) {
      return true;
    }
    if (this.confirmingLeave) return false;
    this.confirmingLeave = true;
    try {
      const choice = await this.unsavedDialog().open();
      if (choice === 'cancel') return false;
      if (choice === 'discard') {
        this.undoChanges();
        return true;
      }
      return await this.save();
    } finally {
      this.confirmingLeave = false;
    }
  }

  protected async goBack(): Promise<void> {
    if (!(await this.canDeactivate())) return;
    await this.router.navigate(['/trade/governance/price-books', this.bookId()]);
  }

  protected selectTab(tab: string): void {
    const resolved = parseTabParam(tab);
    this.markTabVisited(resolved);
    this.activeTab.set(resolved);
    const param = resolved === 'lines' ? null : resolved;
    if ((this.route.snapshot.queryParamMap.get('tab') ?? null) !== param) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { tab: param },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  protected onBaselineChange(baseId: string | null): void {
    this.compareBaselineId.set(baseId);
    const param = baseId?.trim() || null;
    if ((this.route.snapshot.queryParamMap.get('base') ?? null) !== param) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { base: param },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  protected onFromDateChange(date: string | null): void {
    this.fromDate.set(date);
    if (date && !this.fromTime()) {
      this.fromTime.set('00:00');
    }
  }

  protected onToDateChange(date: string | null): void {
    this.toDate.set(date);
    if (date && !this.toTime()) {
      this.toTime.set('23:59');
    } else if (!date) {
      this.toTime.set(null);
    }
  }

  protected onToTimeChange(time: string | null): void {
    this.toTime.set(time);
    if (time && !this.toDate()) {
      this.toDate.set(this.fromDate() ?? isoToLocalParts(new Date().toISOString()).date);
    } else if (!time) {
      this.toDate.set(null);
    }
  }

  protected clearEffectiveTo(): void {
    this.toDate.set(null);
    this.toTime.set(null);
  }

  protected undoChanges(): void {
    this.resetDraftState();
    const v = this.detail()?.version;
    if (v) {
      this.syncHeaderFromVersion(v.effectiveFrom, v.effectiveTo);
    }
    this.focusLineId.set(null);
  }

  protected async save(): Promise<boolean> {
    const d = this.detail();
    if (!d || !this.editable() || !this.dirty() || this.busy()) {
      return false;
    }

    this.headerSubmitted.set(true);
    if (this.fromError() || this.toError()) {
      return false;
    }

    const totalOps =
      this.entryUpserts().size +
      this.entryDeletes().size +
      this.promoUpserts().size +
      this.promoDeletes().size;

    if (totalOps > MAX_TOTAL_OPS_PER_SAVE) {
      this.notify.warning(this.transloco.translate('pricing.toasts.tooManyChanges'));
      return false;
    }

    // Validate all pending entry upserts
    const translate = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(key, params);
    const upsertsList = Array.from(this.entryUpserts().values());
    const firstBadRow = upsertsList.find((row) => hasLineErrors(validateLineRow(row, translate)));
    if (firstBadRow) {
      this.showLineErrors.set(true);
      this.selectTab('lines');
      this.focusLineId.set(firstBadRow.id);
      return false;
    }

    // Validate header ISO conversion
    const fromIso = this.headerDirty()
      ? localPartsToUtcIso(this.fromDate(), this.fromTime())
      : null;
    const toIso =
      this.headerDirty() && this.hasEffectiveTo()
        ? localPartsToUtcIso(this.toDate(), this.toTime())
        : null;
    if (this.headerDirty() && !fromIso) {
      return false;
    }

    if (d.version.status === 'TESTED') {
      const confirmed = await this.returnToDraftDialog().open();
      if (!confirmed) return false;
    }

    this.saving.set(true);
    this.serverOverlapErrors.set(new Map());
    const versionId = d.version.id;
    const currencyCode = d.book.currencyCode;

    try {
      // 1. Entry changes in sequential chunks <= 1000 ops
      const deleteIds = Array.from(this.entryDeletes());
      const upsertInputs = upsertsList.map((row) => ({
        rowId: row.id,
        input: toEntryInput(row, currencyCode),
      }));

      let deleteIdx = 0;
      let upsertIdx = 0;
      while (deleteIdx < deleteIds.length || upsertIdx < upsertInputs.length) {
        const chunkDeletes: string[] = [];
        const chunkUpserts: { rowId: string; input: EntryInput }[] = [];

        while (
          deleteIdx < deleteIds.length &&
          chunkDeletes.length + chunkUpserts.length < MAX_ENTRY_OPS_PER_CALL
        ) {
          chunkDeletes.push(deleteIds[deleteIdx++]);
        }
        while (
          upsertIdx < upsertInputs.length &&
          chunkDeletes.length + chunkUpserts.length < MAX_ENTRY_OPS_PER_CALL
        ) {
          chunkUpserts.push(upsertInputs[upsertIdx++]);
        }

        const res = await changeEntries(
          versionId,
          {
            ...(chunkDeletes.length ? { deletes: chunkDeletes } : {}),
            ...(chunkUpserts.length ? { upserts: chunkUpserts.map((u) => u.input) } : {}),
          },
          this.currentIfMatch(),
          newIdempotencyKey(),
        );
        this.currentIfMatch.set(res.version);

        this.entryDeletes.update((set) => {
          const next = new Set(set);
          for (const id of chunkDeletes) next.delete(id);
          return next;
        });
        this.entryUpserts.update((map) => {
          const next = new Map(map);
          for (const u of chunkUpserts) next.delete(u.rowId);
          return next;
        });
      }

      // 2. Promotion changes in sequential chunks <= 500 ops
      const promoDeleteIds = Array.from(this.promoDeletes());
      const promoUpsertsList = Array.from(this.promoUpserts().values());
      let pDelIdx = 0;
      let pUpIdx = 0;
      while (pDelIdx < promoDeleteIds.length || pUpIdx < promoUpsertsList.length) {
        const chunkDeletes: string[] = [];
        const chunkUpserts: PromotionRule[] = [];

        while (
          pDelIdx < promoDeleteIds.length &&
          chunkDeletes.length + chunkUpserts.length < MAX_PROMO_OPS_PER_CALL
        ) {
          chunkDeletes.push(promoDeleteIds[pDelIdx++]);
        }
        while (
          pUpIdx < promoUpsertsList.length &&
          chunkDeletes.length + chunkUpserts.length < MAX_PROMO_OPS_PER_CALL
        ) {
          chunkUpserts.push(promoUpsertsList[pUpIdx++]);
        }

        const res = await changePromotions(
          versionId,
          {
            ...(chunkDeletes.length ? { deletes: chunkDeletes } : {}),
            ...(chunkUpserts.length ? { upserts: chunkUpserts.map(toPromotionInput) } : {}),
          },
          this.currentIfMatch(),
          newIdempotencyKey(),
        );
        this.currentIfMatch.set(res.version);

        this.promoDeletes.update((set) => {
          const next = new Set(set);
          for (const id of chunkDeletes) next.delete(id);
          return next;
        });
        this.promoUpserts.update((map) => {
          const next = new Map(map);
          for (const p of chunkUpserts) next.delete(p.id);
          return next;
        });
      }

      // 3. Header fields patch if changed
      if (this.headerDirty() && fromIso) {
        const updated = await updateVersion(
          versionId,
          {
            effectiveFrom: fromIso,
            effectiveTo: toIso,
          },
          this.currentIfMatch(),
          newIdempotencyKey(),
        );
        this.currentIfMatch.set(updated.version);
      }

      this.resetDraftState();
      this.sessionTestResult.set(null);
      this.notify.success(this.transloco.translate('pricing.toasts.saved'));
      await this.loadVersion(false);
      await this.loadEntriesPage(
        versionId,
        this.linePage(),
        this.linePageSize(),
        this.lineSearch(),
        this.lineUomFilter(),
      );
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.code === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.conflictDialog().open();
        return false;
      }
      if (error instanceof ApiError && error.code === 'TRADE.PRICE.TIER_OVERLAP') {
        const entryIds = error.details?.['entryIds'] ?? [];
        await this.handleServerTierOverlap(versionId, entryIds);
        return false;
      }
      this.notify.error(resolvePricingError(this.transloco, error));
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  protected async runTest(): Promise<void> {
    const d = this.detail();
    if (!d || this.dirty() || this.busy() || !this.can.test) return;

    this.testing.set(true);
    try {
      const result = await testVersion(d.version.id, this.currentIfMatch(), newIdempotencyKey());
      this.currentIfMatch.set(result.version);
      this.sessionTestResult.set({ result, testedAt: new Date().toISOString() });
      await this.loadVersion(false);

      if (result.passed) {
        this.notify.success(this.transloco.translate('pricing.toasts.testPassed'));
      } else {
        const count = result.conflicts.length + result.promotionConflicts.length;
        this.notify.warning(
          this.transloco.translate('pricing.toasts.testFailed', { count }),
          this.transloco.translate('pricing.toasts.testFailedDetail'),
        );
        this.selectTab('test');
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.conflictDialog().open();
        return;
      }
      this.notify.error(resolvePricingError(this.transloco, error));
    } finally {
      this.testing.set(false);
    }
  }

  protected openPublishDialog(): void {
    const d = this.detail();
    if (!d || d.version.status !== 'TESTED' || this.dirty() || !this.can.publish) return;
    if (this.publishBlocked()) {
      this.notify.warning(this.transloco.translate('governance.makerChecker.self'));
      return;
    }
    this.publishDialog().open();
  }

  /** Publish returns the bare version row; reload the head for the detail view. */
  protected async onPublished(updated: PriceVersionRow): Promise<void> {
    this.currentIfMatch.set(updated.version);
    await this.loadVersion(false);
    await this.loadEntriesPage(
      updated.id,
      this.linePage(),
      this.linePageSize(),
      this.lineSearch(),
      this.lineUomFilter(),
    );
  }

  protected onConflictFromChild(): void {
    this.conflictDialog().open();
  }

  protected openRetireDialog(): void {
    const d = this.detail();
    if (!d || (d.version.status !== 'PUBLISHED' && d.version.status !== 'SCHEDULED') || !this.can.manage) {
      return;
    }
    void this.retireDialog().open();
  }

  protected async onRetireConfirmed(result: ReasonDialogResult): Promise<void> {
    const d = this.detail();
    if (!d || this.retiring()) return;

    this.retiring.set(true);
    try {
      const updated = await retireVersion(
        d.version.id,
        { reasonCode: result.reasonCode, ...(result.reasonNote ? { reasonNote: result.reasonNote } : {}) },
        this.currentIfMatch(),
        newIdempotencyKey(),
      );
      this.currentIfMatch.set(updated.version);
      await this.loadVersion(false);
      this.notify.success(this.transloco.translate('pricing.toasts.retired'));
    } catch (error) {
      if (error instanceof ApiError && error.code === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.conflictDialog().open();
        return;
      }
      this.notify.error(resolvePricingError(this.transloco, error));
    } finally {
      this.retiring.set(false);
    }
  }

  protected async onMoreAction(selection: ActionSelection): Promise<void> {
    if (selection.id === 'copy') {
      if (!(await this.canDeactivate())) return;
      await this.router.navigate(['/trade/governance/price-books', this.bookId()], {
        queryParams: { newVersion: this.versionId() },
      });
      return;
    }
    if (selection.id === 'deleteDraft') {
      const d = this.detail();
      if (!d || d.version.status !== 'DRAFT' || !this.can.manage) return;
      const confirmed = await this.deleteDraftDialog().open();
      if (!confirmed) return;

      this.deleting.set(true);
      try {
        await deleteVersion(d.version.id, this.currentIfMatch(), newIdempotencyKey());
        this.resetDraftState();
        this.syncHeaderFromVersion(d.version.effectiveFrom, d.version.effectiveTo);
        this.notify.success(this.transloco.translate('pricing.toasts.deleted'));
        await this.router.navigate(['/trade/governance/price-books', this.bookId()]);
      } catch (error) {
        if (error instanceof ApiError && error.code === 'TRADE.CONCURRENCY.STALE_VERSION') {
          this.conflictDialog().open();
          return;
        }
        this.notify.error(resolvePricingError(this.transloco, error));
      } finally {
        this.deleting.set(false);
      }
    }
  }

  protected async onConflictReload(): Promise<void> {
    this.resetDraftState();
    this.sessionTestResult.set(null);
    await this.loadVersion(true);
    await this.loadEntriesPage(
      this.versionId(),
      this.linePage(),
      this.linePageSize(),
      this.lineSearch(),
      this.lineUomFilter(),
    );
  }

  protected onConflictKeep(): void {
    // Keep user's pending change set intact.
  }

  // Lines tab handlers
  protected onLineSearchChange(q: string): void {
    this.lineSearch.set(q);
    this.linePage.set(1);
    this.pageRowOrder.set(null);
  }

  protected onLineUomFilterChange(uomId: string): void {
    this.lineUomFilter.set(uomId);
    this.linePage.set(1);
    this.pageRowOrder.set(null);
  }

  protected onLinePageChange(page: number): void {
    this.linePage.set(page);
    this.pageRowOrder.set(null);
  }

  protected onLinePageSizeChange(size: number): void {
    this.linePageSize.set(size);
    this.linePage.set(1);
    this.pageRowOrder.set(null);
  }

  protected reloadLines(): void {
    void this.loadEntriesPage(
      this.versionId(),
      this.linePage(),
      this.linePageSize(),
      this.lineSearch(),
      this.lineUomFilter(),
    );
  }

  protected onEntryChange(updated: PriceLineRow): void {
    this.serverOverlapErrors.update((map) => {
      if (!map.has(updated.id)) return map;
      const next = new Map(map);
      next.delete(updated.id);
      return next;
    });
    this.entryUpserts.update((map) => {
      const next = new Map(map);
      next.set(updated.id, updated);
      return next;
    });
  }

  protected onEntryRemove(rowId: string): void {
    this.serverOverlapErrors.update((map) => {
      if (!map.has(rowId)) return map;
      const next = new Map(map);
      next.delete(rowId);
      return next;
    });
    this.entryUpserts.update((map) => {
      if (!map.has(rowId)) return map;
      const next = new Map(map);
      next.delete(rowId);
      return next;
    });
    if (!rowId.startsWith('temp-')) {
      this.entryDeletes.update((set) => {
        const next = new Set(set);
        next.add(rowId);
        return next;
      });
    }
    this.pageRowOrder.update((order) => (order ? order.filter((id) => id !== rowId) : null));
  }

  protected onAddLine(): void {
    const d = this.detail();
    if (!d || !this.editable()) return;
    const totalPages = Math.max(
      1,
      Math.ceil((this.effectiveFilteredLinesTotal() + 1) / this.linePageSize()),
    );
    if (this.linePage() !== totalPages) {
      this.linePage.set(totalPages);
      this.pageRowOrder.set(null);
    }

    const tempId = `temp-line-${++PriceVersionPage.tempLineSeq}`;
    const newRow: PriceLineRow = {
      id: tempId,
      version: 1,
      itemId: '',
      itemCode: '',
      itemCompanyProfileId: '',
      itemLocalizedNames: {},
      uomId: '',
      uomCode: '',
      uomDisplayName: null,
      uomLocalizedNames: {},
      currencyCode: d.book.currencyCode,
      minimumQuantity: '1',
      maximumQuantity: null,
      unitPrice: '',
      minimumAllowedPrice: null,
      priority: 100,
      standardCost: null,
      catalogSalesPrice: null,
      isNew: true,
    };

    this.entryUpserts.update((map) => {
      const next = new Map(map);
      next.set(tempId, newRow);
      return next;
    });
    this.focusLineId.set(tempId);
  }

  protected onReorderLines(ev: { fromIndex: number; toIndex: number }): void {
    const ids = this.visiblePageEntries().map((r) => r.id);
    if (
      ev.fromIndex < 0 ||
      ev.toIndex < 0 ||
      ev.fromIndex >= ids.length ||
      ev.toIndex >= ids.length ||
      ev.fromIndex === ev.toIndex
    ) {
      return;
    }
    const [moved] = ids.splice(ev.fromIndex, 1);
    ids.splice(ev.toIndex, 0, moved);
    this.pageRowOrder.set(ids);
  }

  // Promotions tab helpers
  protected openCreatePromotion(): void {
    if (!this.editable()) return;
    this.promotionModal().openCreate();
  }

  protected openEditPromotion(promo: PromotionRule): void {
    if (!this.editable()) return;
    this.promotionModal().openEdit(promo);
  }

  protected onPromotionSaved(promo: PromotionRule): void {
    this.promoDeletes.update((set) => {
      if (!set.has(promo.id)) return set;
      const next = new Set(set);
      next.delete(promo.id);
      return next;
    });
    this.promoUpserts.update((map) => {
      const next = new Map(map);
      next.set(promo.id, promo);
      return next;
    });
  }

  protected removePromotion(promoId: string): void {
    if (!this.editable()) return;
    this.promoUpserts.update((map) => {
      if (!map.has(promoId)) return map;
      const next = new Map(map);
      next.delete(promoId);
      return next;
    });
    if (!promoId.startsWith('temp-promo-')) {
      this.promoDeletes.update((set) => {
        const next = new Set(set);
        next.add(promoId);
        return next;
      });
    }
  }

  protected promotionMenuItems(): ActionItem[] {
    this.i18n();
    return [
      {
        id: 'edit',
        title: this.transloco.translate('pricing.promotions.edit'),
        icon: 'tablerEdit',
        tile: 'bg-icon-orange',
      },
      {
        id: 'remove',
        title: this.transloco.translate('pricing.promotions.remove'),
        icon: 'tablerTrash',
        tile: 'bg-icon-red',
        danger: true,
      },
    ];
  }

  protected onPromotionAction(promo: PromotionRule, selection: ActionSelection): void {
    if (selection.id === 'edit') {
      this.openEditPromotion(promo);
    } else if (selection.id === 'remove') {
      this.removePromotion(promo.id);
    }
  }

  protected formatBenefit(promo: PromotionRule): string {
    const currency = this.detail()?.book.currencyCode ?? '';
    if (promo.benefit.type === 'PERCENTAGE') {
      return `${promo.benefit.value} %`;
    }
    return formatMoney(currency, promo.benefit.value);
  }

  protected promotionSelectorChips(promo: PromotionRule): string[] {
    this.i18n();
    const language = this.lang();
    const sel = promo.selector;
    const chips: string[] = [];

    if (sel.itemId) {
      const label = this.itemNamesById()[sel.itemId] ?? sel.itemId;
      chips.push(this.transloco.translate('pricing.promotions.chips.item', { value: label }));
    }
    if (sel.uomId) {
      const u = this.uoms().find((item) => item.id === sel.uomId);
      const label = u ? itemName(u, language) || u.code : sel.uomId;
      chips.push(this.transloco.translate('pricing.promotions.chips.unit', { value: label }));
    }
    if (sel.branchId) {
      const b = this.branches().find((item) => item.id === sel.branchId);
      const label = b ? (language === 'ar' ? b.nameAr : b.nameEn) : sel.branchId;
      chips.push(this.transloco.translate('pricing.promotions.chips.branch', { value: label }));
    }
    if (sel.channelId) {
      const c = this.channels().find((item) => item.id === sel.channelId);
      const label = c ? c.name : sel.channelId;
      chips.push(this.transloco.translate('pricing.promotions.chips.channel', { value: label }));
    }
    if (sel.partyId) {
      const acc = this.accounts().find((a) => a.partyId === sel.partyId || a.id === sel.partyId);
      const label = acc ? acc.partyName : sel.partyId;
      chips.push(this.transloco.translate('pricing.promotions.chips.account', { value: label }));
    }

    const minStr = sel.minimumQuantity?.trim() || '0';
    const maxStr = sel.maximumQuantity?.trim() || null;
    if (maxStr) {
      chips.push(
        this.transloco.translate('pricing.promotions.chips.qtyRange', {
          min: formatQty(minStr),
          max: formatQty(maxStr),
        }),
      );
    } else if (minStr !== '0' && minStr !== '1') {
      chips.push(
        this.transloco.translate('pricing.promotions.chips.qtyFrom', {
          min: formatQty(minStr),
        }),
      );
    }

    return chips;
  }

  // Test result jump helper
  protected jumpToLine(entryId?: string, lineNumber?: number): void {
    if (this.lineSearch() || this.lineUomFilter()) {
      this.lineSearch.set('');
      this.lineUomFilter.set('');
    }
    if (lineNumber && lineNumber > 0) {
      const targetPage = Math.max(1, Math.ceil(lineNumber / this.linePageSize()));
      if (this.linePage() !== targetPage) {
        this.linePage.set(targetPage);
      }
    }
    if (entryId) {
      this.focusLineId.set(entryId);
    }
    this.selectTab('lines');
  }

  // History helpers
  protected formatTestTime(iso: string): string {
    return formatDateTime(iso, this.lang());
  }

  protected actorInitials(entry: GovernanceAuditEntry): string {
    const name = actorDisplayName(entry.actorUserId, this.lang()) || entry.actorDisplayName;
    return initialsOf(name);
  }

  protected auditActorName(entry: GovernanceAuditEntry): string {
    return actorDisplayName(entry.actorUserId, this.lang()) || entry.actorDisplayName;
  }

  protected auditActionText(action: string): string {
    const key = `pricing.history.audit.${action}`;
    const translated = this.transloco.translate(key);
    return translated === key ? action : translated;
  }

  protected auditReasonLabel(entry: GovernanceAuditEntry): string | null {
    const language = this.lang();
    const localized = language === 'ar' ? entry.reasonNameAr : entry.reasonNameEn;
    if (localized && entry.reason) {
      return `${localized} — ${entry.reason}`;
    }
    return localized || entry.reason || entry.reasonCode || null;
  }

  protected async retryLoad(): Promise<void> {
    await this.loadVersion(true);
  }

  private markTabVisited(tab: PriceVersionTab): void {
    this.visited.update((set) => {
      if (set.has(tab)) return set;
      const next = new Set(set);
      next.add(tab);
      return next;
    });
  }

  private syncHeaderFromVersion(effectiveFrom: string, effectiveTo: string | null): void {
    const fromParts = isoToLocalParts(effectiveFrom);
    const toParts = isoToLocalParts(effectiveTo);
    this.baseFromParts = fromParts;
    this.baseToParts = toParts;
    this.fromDate.set(fromParts.date);
    this.fromTime.set(fromParts.time);
    this.toDate.set(toParts.date);
    this.toTime.set(toParts.time);
    this.headerSubmitted.set(false);
  }

  private resetDraftState(): void {
    this.entryUpserts.set(new Map());
    this.entryDeletes.set(new Set());
    this.promoUpserts.set(new Map());
    this.promoDeletes.set(new Set());
    this.pageRowOrder.set(null);
    this.serverOverlapErrors.set(new Map());
    this.showLineErrors.set(false);
    this.headerSubmitted.set(false);
  }

  private async loadVersion(showPageLoader: boolean): Promise<void> {
    const vId = this.versionId();
    if (!vId) return;
    const seq = ++this.versionSeq;
    if (showPageLoader) {
      this.loading.set(true);
    }
    this.loadFailed.set(false);
    this.notFound.set(false);

    try {
      const detail = toVersionView(await getPriceVersion(vId, { include: 'none' }));
      if (seq !== this.versionSeq) return;
      this.detail.set(detail);
      this.currentIfMatch.set(detail.version.version);
      this.syncHeaderFromVersion(detail.version.effectiveFrom, detail.version.effectiveTo);

      if (this.pendingPublishQuery) {
        this.pendingPublishQuery = false;
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { publish: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
        if (detail.version.status === 'TESTED' && this.can.publish) {
          queueMicrotask(() => this.openPublishDialog());
        }
      }
    } catch (error) {
      if (seq !== this.versionSeq) return;
      if (error instanceof ApiError && error.status === 404) {
        this.notFound.set(true);
      } else {
        this.loadFailed.set(true);
      }
    } finally {
      if (seq === this.versionSeq) {
        this.loading.set(false);
      }
    }
  }

  private async loadEntriesPage(
    versionId: string,
    page: number,
    limit: number,
    q: string,
    uomId: string,
  ): Promise<void> {
    const seq = ++this.entriesSeq;
    this.linesLoading.set(true);
    this.linesLoadFailed.set(false);
    try {
      const res = await listEntries(versionId, {
        page,
        limit,
        ...(q.trim() ? { q: q.trim() } : {}),
        ...(uomId ? { uomId } : {}),
      });
      if (seq !== this.entriesSeq) return;
      this.serverEntries.set(res.items);
      this.serverTotal.set(res.total);
    } catch {
      if (seq !== this.entriesSeq) return;
      this.serverEntries.set([]);
      this.linesLoadFailed.set(true);
    } finally {
      if (seq === this.entriesSeq) {
        this.linesLoading.set(false);
      }
    }
  }

  private async loadLookups(
    ctx: TradeContext,
    purpose: 'SALES' | 'PURCHASE',
  ): Promise<void> {
    const seq = ++this.lookupsSeq;
    const role = purpose === 'PURCHASE' ? 'SUPPLIER' : 'CUSTOMER';
    const [uomList, refData, channelList, accountList] = await Promise.all([
      listUoms().catch(() => [] as Uom[]),
      getReferenceData().catch(() => ({ branches: [], currencies: [] })),
      ctx.companyId ? listChannels(ctx).catch(() => [] as Channel[]) : Promise.resolve([] as Channel[]),
      ctx.companyId
        ? searchCommercialAccounts(ctx, { role }).catch(() => [] as CommercialAccountSummary[])
        : Promise.resolve([] as CommercialAccountSummary[]),
    ]);
    if (seq !== this.lookupsSeq) return;
    this.uoms.set(uomList);
    this.branches.set(
      ctx.companyId
        ? refData.branches.filter((b) => b.companyId === ctx.companyId)
        : refData.branches,
    );
    this.channels.set(channelList);
    this.accounts.set(accountList);
  }

  private async resolveItemNames(ctx: TradeContext, ids: readonly string[]): Promise<void> {
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const item = await getItem(ctx, id);
          return [id, itemName(item, this.lang()) || item.canonicalCode] as const;
        } catch {
          return null;
        }
      }),
    );
    const additions: Record<string, string> = {};
    for (const pair of results) {
      if (pair) {
        additions[pair[0]] = pair[1];
      }
    }
    if (Object.keys(additions).length > 0) {
      this.itemNamesById.update((prev) => ({ ...prev, ...additions }));
    }
  }

  private async handleServerTierOverlap(
    versionId: string,
    conflictIds: readonly string[],
  ): Promise<void> {
    if (conflictIds.length === 0) {
      this.notify.error(
        resolvePricingError(
          this.transloco,
          new ApiError(422, 'TRADE.PRICE.TIER_OVERLAP'),
        ),
      );
      return;
    }

    const targets = new Set(conflictIds);
    const foundLineById = new Map<string, number>();

    try {
      let page = 1;
      let offset = 0;
      const limit = 200;
      while (foundLineById.size < targets.size) {
        const res = await listEntries(versionId, { page, limit });
        const deletes = this.entryDeletes();
        for (const item of res.items) {
          if (deletes.has(item.id)) continue;
          offset += 1;
          if (targets.has(item.id)) {
            foundLineById.set(item.id, offset);
          }
        }
        if (page * limit >= res.total || res.items.length === 0) break;
        page += 1;
      }

      for (const newRow of this.allNewLines()) {
        offset += 1;
        if (targets.has(newRow.id)) {
          foundLineById.set(newRow.id, offset);
        }
      }
    } catch {
      // Fallback below if scanning pages failed
    }

    const overlapMap = new Map<string, number>();
    if (conflictIds.length >= 2) {
      const [idA, idB] = conflictIds;
      const lineA = foundLineById.get(idA) ?? 1;
      const lineB = foundLineById.get(idB) ?? 2;
      overlapMap.set(idA, lineB);
      overlapMap.set(idB, lineA);
    } else {
      const onlyId = conflictIds[0];
      overlapMap.set(onlyId, foundLineById.get(onlyId) ?? 1);
    }

    this.serverOverlapErrors.set(overlapMap);
    this.showLineErrors.set(true);
    const firstId = conflictIds[0];
    const firstLine = foundLineById.get(firstId);
    this.jumpToLine(firstId, firstLine);
  }
}
