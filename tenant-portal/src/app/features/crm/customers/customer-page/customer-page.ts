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
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../core/i18n/translation-events';
import {
  ActivatedRoute,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  Params,
  Router,
  RouterLink,
} from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowLeft,
  tablerBuilding,
  tablerCalendarPlus,
  tablerCloudOff,
  tablerLock,
  tablerPhone,
  tablerTarget,
  tablerTrash,
  tablerUser,
  tablerUserPlus,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { filter } from 'rxjs';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { can } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { FullState, FullStateKind } from '../../../../shared/ui/full-state/full-state';
import { sessionBranch } from '../../shared/lookups/session-branch';
import { customerRecordError } from '../customer-form/customer-errors';
import { canManageFormStatus, listFormOwners } from '../customer-form/customer-lookups.api';
import { ActionItem, ActionSelection, ActionSwatch } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { ConflictDialog } from '../../../../shared/ui/conflict-dialog/conflict-dialog';
import { Field } from '../../../../shared/ui/field/field';
import { UnsavedDialog } from '../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { listActivities } from '../../../../shared/widgets/activities/activities.api';
import { PartyCalls } from '../../../../shared/widgets/party-calls/party-calls';
import { getPartyCallsSummary } from '../../../../shared/widgets/party-calls/party-calls.api';
import { RecordAttachments } from '../../../../shared/widgets/record-attachments/record-attachments';
import {
  countRecordAttachments,
} from '../../../../shared/widgets/record-attachments/record-attachments.api';
import { RecordHistory } from '../../../../shared/widgets/record-history/record-history';
import { HistoryCategoryOption } from '../../../../shared/widgets/record-history/record-history.model';
import { RecordActivitiesTab } from '../../shared/record/activities-tab/record-activities-tab';
import { DuplicateMatch } from '../../shared/record/duplicate-strip/duplicate.model';
import { RecordDraftStore } from '../../shared/record/nav/record-draft-store';
import { RecordNavContext, navPosition, nextNavTarget } from '../../shared/record/nav/record-nav';
import { CanLeaveRecord } from '../../shared/record/nav/record-page.guard';
import { RecordHeaderOwner, RecordPageHeader } from '../../shared/record/page/record-page-header/record-page-header';
import { RecordTab, RecordTabs } from '../../shared/record/page/record-tabs/record-tabs';
import { createVisitedTabs, syncTabWithQuery } from '../../shared/record/page/record-tabs/visited-tabs';
import { ContactChange, ContactErrors } from '../../shared/record/record-contact';
import { RecordRelatedBadges } from '../../shared/record/related/record-related-badges';
import { invalidateRelatedCounts } from '../../shared/record/related/related-records.api';
import { ApiError, errorCodeOf, newIdempotencyKey } from '../../settings/shared/settings-api';
import {
  canCreateCustomer,
  canDeleteCustomer,
  canUpdateCustomer,
  customerStatusBadgeClass,
  formatCustomerDate,
} from '../customer-card/customer-card';
import {
  CustomerCreateBody,
  CustomerDraft,
  DraftErrors,
  diffTags,
  draftFromDetail,
  draftsEqual,
  emptyDraft,
  mapServerErrors,
  toCreateBody,
  toPatchBody,
  validateDraft,
} from '../customer-form/customer-draft';
import { CUSTOMER_PAGE_SECTION_ERRORS, CustomerForm } from '../customer-form/customer-form';
import { CustomerContactSaveError, contactsAfterChange, hasCustomerContactChanges, saveCustomerContacts } from '../customer-form/customer-contact-save';
import { isManualStatus } from '../customer-statuses';
import {
  attachCustomerTags,
  createCustomer,
  deleteCustomer,
  detachCustomerTag,
  getCustomer,
  getCustomerCapabilities,
  patchCustomer,
  setCustomerColor,
  setCustomerRating,
  setCustomerStatus,
} from '../customers.api';
import {
  CARD_COLORS,
  CardColor,
  CustomerCapabilities,
  CustomerDetail,
  CustomerStatus,
  OwnerOption,
  nameIn,
  ownerFullName,
} from '../customers.model';
import { smoothScrollBehavior } from '../../../../shared/ui/scroll/scroll-into-view';

type ConflictChoice = 'reload' | 'keep' | 'dismiss';
export type CustomerPageTab = 'overview' | 'activities' | 'calls' | 'attachments' | 'history';

const CUSTOMER_PAGE_TABS: readonly CustomerPageTab[] = ['overview', 'activities', 'calls', 'attachments', 'history'];
const OVERVIEW_ERROR_PREFIXES = Object.values(CUSTOMER_PAGE_SECTION_ERRORS).flat();
const COLOR_KEYS = Object.keys(CARD_COLORS) as CardColor[];
const DELETE_REASON_MAX = 500;

interface CustomerRouteState {
  createdCustomer?: CustomerDetail;
  cameFromList?: boolean;
  backQueryParams?: Params;
}

function cleanBackParams(params: Params | undefined): Params {
  if (!params) return {};
  const { open: _, ...rest } = params;
  return rest;
}

function rebaseDraft(oldBase: CustomerDraft, freshBase: CustomerDraft, currentDraft: CustomerDraft): CustomerDraft {
  const next: Record<string, unknown> = { ...freshBase };
  for (const key of Object.keys(freshBase) as (keyof CustomerDraft)[]) {
    const curVal = currentDraft[key];
    const oldVal = oldBase[key];
    const unchanged =
      typeof curVal === 'object' && curVal !== null
        ? JSON.stringify(curVal) === JSON.stringify(oldVal)
        : curVal === oldVal;
    if (!unchanged) {
      next[key] = curVal;
    }
  }
  return next as unknown as CustomerDraft;
}

@Component({
  selector: 'app-customer-page',
  imports: [
    RouterLink,
    NgIcon,
    TranslocoPipe,
    Button,
    ConfirmDialog,
    ConflictDialog,
    Field,
    UnsavedDialog,
    CustomerForm,
    RecordPageHeader,
    RecordRelatedBadges,
    RecordTabs,
    RecordActivitiesTab,
    RecordAttachments,
    RecordHistory,
    PartyCalls,
    FullState,
  ],
  providers: [
    provideTranslocoScope(
      'customers',
      { scope: 'customer-page', alias: 'customerPage' },
      { scope: 'customer-form', alias: 'customerForm' },
      { scope: 'customer-modal', alias: 'customerModal' },
      { scope: 'record-form', alias: 'recordForm' },
      { scope: 'record-fields', alias: 'recordFields' },
      { scope: 'record-dup', alias: 'recordDup' },
      { scope: 'record-page', alias: 'recordPage' },
      { scope: 'record-attachments', alias: 'recordAttachments' },
      { scope: 'record-history', alias: 'recordHistory' },
      { scope: 'record-activities-tab', alias: 'recordActivitiesTab' },
      { scope: 'record-related', alias: 'recordRelated' },
    ),
    provideIcons({
      tablerArrowLeft,
      tablerBuilding,
      tablerCalendarPlus,
      tablerCloudOff,
      tablerLock,
      tablerPhone,
      tablerTarget,
      tablerTrash,
      tablerUser,
      tablerUserPlus,
      tablerUsers,
    }),
  ],
  templateUrl: './customer-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col p-12 gap-8' },
})
export class CustomerPage implements CanLeaveRecord {
  private static nextId = 0;
  protected readonly uid = `customer-page-${++CustomerPage.nextId}`;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly injector = inject(Injector);
  private readonly notify = inject(Notify);
  private readonly tenant = inject(TenantScopeState);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly draftStore = inject(RecordDraftStore);
  protected readonly language = inject(LanguageState).current;

  private readonly customerForm = viewChild(CustomerForm);
  protected readonly lookups = computed(() => this.customerForm()?.lookups ?? null);
  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');
  private readonly unsavedDialog = viewChild.required(UnsavedDialog);
  private readonly blacklistDialog = viewChild.required<ConfirmDialog>('blacklistDialog');
  private readonly deleteDialog = viewChild.required<ElementRef<HTMLDialogElement>>('deleteDialog');
  private readonly deleteCancelBtn = viewChild<Button, ElementRef<HTMLButtonElement>>('deleteCancelBtn', {
    read: ElementRef,
  });

  protected readonly customerId = signal<string | null>(this.route.snapshot.paramMap.get('id'));
  private readonly hasCarriedDraft = signal(false);
  private readonly base = signal<CustomerDraft>(emptyDraft());
  protected readonly draft = signal<CustomerDraft>(emptyDraft());
  protected readonly detail = signal<CustomerDetail | null>(null);
  protected readonly updatedAt = signal<string | null>(null);
  private readonly capabilities = signal<CustomerCapabilities | null>(null);
  protected readonly nav = signal<RecordNavContext | null>(null);

  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly scopeDenied = signal(false);
  protected readonly loadKind = signal<FullStateKind>('load-failure');
  protected readonly loadCorrelation = signal<string | null>(null);
  protected readonly loadMessage = signal('');
  protected readonly writeReadonly = signal(false);
  protected readonly reloadRequired = signal(false);
  protected readonly branchMissing = computed(() => { this.tenant.selection(); return !sessionBranch(); });
  protected readonly canRead = computed(() => { this.tenant.me(); return can('crm.customer_profiles.read'); });
  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);
  protected readonly instantBusy = signal(false);
  protected readonly conflictOpen = signal(false);
  private readonly submitted = signal(false);
  private readonly serverErrors = signal<DraftErrors>({});
  protected readonly formRevision = signal(0);
  private readonly lookupsSettled = signal(false);
  private readonly capabilitiesFailed = signal(false);

  protected readonly deleteReasonMax = DELETE_REASON_MAX;
  protected readonly deleteReason = signal('');
  protected readonly deleteConflictMessage = signal<string | null>(null);
  protected readonly deleteReasonError = computed(() => {
    this.i18n();
    return this.deleteReason().length > DELETE_REASON_MAX
      ? this.transloco.translate('customerPage.delete.reasonTooLong')
      : null;
  });

  protected readonly mode = computed<'create' | 'edit'>(() => (this.customerId() ? 'edit' : 'create'));
  private readonly allowedTabs = computed<readonly CustomerPageTab[]>(() =>
    this.mode() === 'create' ? ['overview'] : CUSTOMER_PAGE_TABS,
  );
  protected readonly activeTab = signal<CustomerPageTab>('overview');
  protected readonly visited = createVisitedTabs(this.activeTab, ['overview']);

  protected readonly activityCount = signal(0);
  protected readonly attachmentCount = signal(0);
  protected readonly callsTotal = signal(0);
  protected readonly callsMissed = signal(0);
  protected readonly callsReload = signal(0);
  protected readonly newActivityRequest = signal(0);
  protected readonly historyRefresh = signal(0);

  private readonly branchOwners = signal<readonly OwnerOption[]>([]);
  private ownersSeq = 0;
  private loadedOwnersBranchId: string | null = null;

  protected readonly emptyPartyIds: string[] = [];
  protected readonly customerHistoryEntityTypes = ['CustomerProfile'] as const;
  protected readonly historyCategories: readonly HistoryCategoryOption[] = [
    { id: 'record', labelKey: 'recordHistory.filter.details' },
    { id: 'contact', labelKey: 'recordHistory.filter.contact' },
    { id: 'activity', labelKey: 'recordHistory.filter.activity' },
  ];

  private readonly branchId = computed(() =>
    this.mode() === 'edit' ? (this.detail()?.branchId ?? this.draft().branchId) : this.draft().branchId,
  );
  protected readonly currentBranchId = computed(() => {
    const current = this.detail();
    return current && current.id === this.customerId() ? current.branchId : null;
  });
  protected readonly dirty = computed(() => !draftsEqual(this.base(), this.draft()));
  protected readonly hasUnsavedContact = computed(() => this.customerForm()?.contactUnsaved() ?? false);
  protected readonly saveContactBound = (change: ContactChange) => this.onSaveContact(change);

  private readonly scopesReady = computed(() => {
    const lang = this.language();
    const active = this.transloco.activeLang();
    this.i18n();
    if (active !== lang) return false;
    const dict = this.transloco.getTranslation(lang);
    return Boolean(
      dict['common.cancel'] &&
        dict['customers.title'] &&
        dict['customerPage.back'] &&
        dict['customerForm.sections.classification'] &&
        dict['recordForm.contacts.title'] &&
        dict['recordFields.scope.branch'] &&
        dict['recordDup.title'] &&
        dict['recordPage.save'],
    );
  });

  private readonly lookupsReady = computed(() => {
    const l = this.lookups();
    if (!l) return false;
    return !l.loading();
  });

  protected readonly showSkeleton = computed(
    () => !this.branchMissing() && (this.loading() || (!this.loadFailed() && !this.scopeDenied() && (!this.scopesReady() || !this.lookupsSettled()))),
  );

  /** "Log activity" and the activities tab follow the activity-create permission, not customer update. */
  protected readonly canLogActivity = computed(() => { this.tenant.me(); return can('activities.create'); });

  protected readonly canEdit = computed(() => {
    this.tenant.me();
    if (!this.canRead() || this.branchMissing() || this.writeReadonly() || this.reloadRequired()) return false;
    if (this.mode() === 'create') {
      const cap = this.capabilities();
      return cap ? canCreateCustomer(cap) : false;
    }
    const current = this.detail();
    if (!current) return false;
    return canUpdateCustomer(this.capabilities(), current);
  });

  protected readonly canDelete = computed(() => {
    if (!this.canRead() || this.writeReadonly() || this.reloadRequired() || this.branchMissing()) return false;
    if (this.mode() !== 'edit' || this.showSkeleton() || this.loadFailed() || this.scopeDenied()) {
      return false;
    }
    const current = this.detail();
    return Boolean(current && canDeleteCustomer(this.capabilities(), current));
  });

  protected readonly canUploadAttachments = computed(
    () => { this.tenant.me(); return Boolean(this.detail()) && can('crm.attachments.create'); },
  );

  protected readonly canDeleteAttachments = computed(
    () => { this.tenant.me(); return Boolean(this.detail()) && can('crm.attachments.delete'); },
  );

  protected readonly errors = computed<DraftErrors>(() => {
    const srv = this.serverErrors();
    if (!this.submitted()) return srv;
    return { ...validateDraft(this.draft(), this.mode(), this.lookups()?.customFields() ?? []), ...srv };
  });

  protected readonly overviewHasErrors = computed(() => {
    const keys = Object.keys(this.errors());
    if (keys.length === 0) return false;
    if (!this.submitted() && Object.keys(this.serverErrors()).length === 0) return false;
    return (
      keys.includes('form') ||
      keys.some((key) => OVERVIEW_ERROR_PREFIXES.some((prefix) => key === prefix || key.startsWith(`${prefix}.`)))
    );
  });

  protected readonly headerTile = 'bg-icon-blue';

  protected readonly headerTypeIcon = computed(() =>
    this.draft().profileType === 'CORPORATE' ? 'tablerBuilding' : 'tablerUser',
  );

  protected readonly displayName = computed(() => {
    const d = this.draft();
    if (d.profileType === 'INDIVIDUAL') {
      const name = [d.firstName.trim(), d.lastName.trim()].filter(Boolean).join(' ');
      if (name) return name;
    } else {
      const name = d.companyName.trim();
      if (name) return name;
    }
    return this.detail()?.displayName ?? '';
  });

  protected readonly headerTitle = computed(() => {
    this.i18n();
    const name = this.displayName();
    if (name) return name;
    return this.mode() === 'create' ? this.transloco.translate('customerPage.newTitle') : '';
  });

  protected readonly headerSubtitle = computed(() => {
    this.i18n();
    const lang = this.language();
    const d = this.draft();
    const parts: string[] = [];

    if (d.profileType === 'CORPORATE') {
      const primary = d.contacts.find((c) => c.isPrimary) ?? d.contacts[0];
      const contactName = primary
        ? [primary.firstName.trim(), primary.lastName.trim()].filter(Boolean).join(' ')
        : (this.detail()?.primaryContact?.displayName ?? this.detail()?.primaryContactName ?? '');
      if (contactName) parts.push(contactName);
    } else {
      const mobile =
        d.phones.map((p) => p.trim()).find(Boolean) ??
        this.detail()?.primaryMobile?.trim() ??
        this.detail()?.phones[0]?.trim() ??
        '';
      if (mobile) parts.push(`\u2066${mobile}\u2069`);
    }

    const branchId = d.branchId ?? this.detail()?.branchId ?? null;
    const branchName = branchId ? (this.lookups()?.branches().find((item) => item.id === branchId)?.name ?? null) : null;
    if (branchName) parts.push(branchName);

    if (this.mode() === 'edit' && this.detail()?.createdAt) {
      parts.push(
        this.transloco.translate('customerPage.header.customerSince', {
          date: formatCustomerDate(this.detail()!.createdAt, lang),
        }),
      );
    }
    return parts.join(' · ');
  });

  protected readonly edgeClass = computed(() => {
    const color = this.draft().cardColor ?? this.detail()?.cardColor ?? null;
    return color ? CARD_COLORS[color] : null;
  });

  protected readonly activeStatus = computed<CustomerStatus>(() =>
    this.mode() === 'edit' ? (this.detail()?.status ?? this.draft().status) : this.draft().status,
  );

  protected readonly headerStatus = computed(() => {
    if (this.mode() !== 'edit') return null;
    this.i18n();
    const lang = this.language();
    const status = this.activeStatus();
    const opt = this.lookups()?.statusOptions().find((item) => item.value === status);
    const label = opt
      ? lang === 'ar'
        ? opt.label.ar
        : opt.label.en
      : this.transloco.translate(`customers.statuses.${status}`);
    return {
      label,
      toneClass: customerStatusBadgeClass(status),
    };
  });

  protected readonly sourceLeadId = computed(() =>
    this.mode() === 'edit' ? (this.detail()?.sourceLeadId ?? null) : null,
  );

  protected readonly fallbackOwnerName = computed(() => {
    const owner = this.detail()?.owner ?? null;
    return ownerFullName(owner) || null;
  });

  protected readonly headerOwner = computed<RecordHeaderOwner | null>(() => {
    if (this.mode() !== 'edit') return null;
    const ownerId = this.draft().ownerUserId ?? this.detail()?.ownerUserId;
    if (!ownerId) return null;
    const found =
      this.lookups()?.owners().find((item) => item.userId === ownerId) ??
      this.branchOwners().find((item) => item.userId === ownerId);
    if (found) return { name: found.name, avatarUrl: found.avatarUrl };
    const detailOwner = this.detail()?.owner;
    if (detailOwner && detailOwner.userId === ownerId) {
      const name = ownerFullName(detailOwner);
      if (name) return { name, avatarUrl: detailOwner.avatarUrl };
    }
    return null;
  });

  protected readonly navPos = computed(() => (this.mode() === 'edit' ? navPosition(this.nav(), this.customerId()) : null));

  protected readonly actionItems = computed<ActionItem[]>(() => {
    this.i18n();
    const current = this.detail();
    if (this.mode() !== 'edit' || !current) return [];

    const items: ActionItem[] = [];
    const currentColor = this.draft().cardColor ?? current.cardColor;
    const status = this.activeStatus();

    if (this.canEdit()) {
      const swatches: ActionSwatch[] = [
        ...COLOR_KEYS.map((color) => ({
          id: color,
          label: this.transloco.translate(`customers.color.${color}`),
          color: CARD_COLORS[color],
          selected: currentColor === color,
        })),
        {
          id: null,
          label: this.transloco.translate('customers.color.none'),
          color: null,
          selected: currentColor === null,
        },
      ];
      items.push({
        id: 'color',
        title: this.transloco.translate('customerPage.header.changeColour'),
        icon: 'tablerPalette',
        tile: 'bg-icon-violet',
        swatches,
      });
    }

    if (status !== 'BLACKLISTED') {
      items.push({
        id: 'newOpportunity',
        title: this.transloco.translate('customerPage.header.newOpportunity'),
        icon: 'tablerTarget',
        tile: 'bg-icon-red',
      });
    }

    if (this.canDelete()) {
      const blacklisted = status === 'BLACKLISTED';
      items.push({
        id: 'delete',
        title: this.transloco.translate('customerPage.header.delete'),
        icon: 'tablerTrash',
        tile: 'bg-icon-red',
        danger: true,
        ...(blacklisted
          ? {
              disabled: true,
              reason: this.transloco.translate('customers.card.menu.deleteBlacklistedReason'),
            }
          : {}),
      });
    }

    return items;
  });

  protected readonly uploaderNameFn = computed(() => {
    const map = new Map<string, string>();
    for (const owner of this.branchOwners()) {
      map.set(owner.userId, owner.name);
    }
    const detailOwner = this.detail()?.owner;
    if (detailOwner) {
      const full = ownerFullName(detailOwner);
      if (full && !map.has(detailOwner.userId)) {
        map.set(detailOwner.userId, full);
      }
    }
    return (userId: string) => map.get(userId) ?? null;
  });

  protected readonly historyValueLabel = computed(() => {
    this.i18n();
    const lang = this.language();
    const l = this.lookups();
    const current = this.detail();

    const statusByValue = new Map((l?.statusOptions() ?? []).map((opt) => [opt.value, opt]));
    const sourceById = new Map((l?.allSources() ?? l?.sources() ?? []).map((source) => [source.id, source]));
    if (current?.acquisitionSource && !sourceById.has(current.acquisitionSource.id)) {
      sourceById.set(current.acquisitionSource.id, {
        ...current.acquisitionSource,
        iconUrl: current.acquisitionSourceIconUrl,
      });
    }

    const ownerById = new Map<string, string>();
    for (const owner of l?.owners() ?? []) {
      ownerById.set(owner.userId, owner.name);
    }
    for (const owner of this.branchOwners()) {
      if (!ownerById.has(owner.userId)) ownerById.set(owner.userId, owner.name);
    }
    if (current?.owner) {
      const full = ownerFullName(current.owner);
      if (full && !ownerById.has(current.owner.userId)) {
        ownerById.set(current.owner.userId, full);
      }
    }

    const branchById = new Map((l?.branches() ?? []).map((b) => [b.id, b.name]));
    const tagById = new Map((l?.tags() ?? []).map((t) => [t.id, t.name]));
    const none = this.transloco.translate('recordHistory.none');

    return (field: string, value: unknown): string | null => {
      if (field === 'status') {
        const raw = String(value);
        const opt = statusByValue.get(raw as CustomerStatus);
        if (opt) return lang === 'ar' ? opt.label.ar : opt.label.en;
        const key = `customers.statuses.${raw}`;
        const translated = this.transloco.translate(key);
        if (translated && translated !== key) return translated;
        return none;
      }
      if (field === 'ownerUserId') {
        const ownerId = String(value);
        // Unknown owners show a short id, the same way unresolved party ids read.
        return ownerById.get(ownerId) ?? (ownerId ? `${ownerId.slice(0, 8)}…` : none);
      }
      if (field === 'acquisitionSourceId') {
        const source = sourceById.get(String(value));
        return source ? nameIn(source, lang) : none;
      }
      if (field === 'cardColor') {
        const raw = value === null || value === undefined || value === '' ? 'none' : String(value);
        const key = `customers.color.${raw}`;
        const translated = this.transloco.translate(key);
        return translated && translated !== key ? translated : none;
      }
      if (field === 'profileType') {
        const raw = String(value);
        const key = `customers.types.${raw}`;
        const translated = this.transloco.translate(key);
        return translated && translated !== key ? translated : none;
      }
      if (field === 'rating') {
        const n = Number(value);
        return Number.isFinite(n) ? this.transloco.translate('customerPage.history.rating', { n }) : null;
      }
      if (field === 'branchId') {
        return branchById.get(String(value)) ?? null;
      }
      if (field === 'tagIds') {
        return tagById.get(String(value)) ?? null;
      }
      return null;
    };
  });

  protected readonly tabs = computed<RecordTab[]>(() => {
    this.i18n();
    this.language();
    const overview: RecordTab = {
      id: 'overview',
      icon: 'tablerLayoutList',
      label: this.transloco.translate('customerPage.tabs.overview'),
      errorDot: this.overviewHasErrors(),
    };
    if (this.mode() === 'create') {
      return [overview];
    }
    const missed = this.callsMissed();
    return [
      overview,
      {
        id: 'activities',
        icon: 'tablerCalendarEvent',
        label: this.transloco.translate('customerPage.tabs.activities'),
        count: this.activityCount(),
      },
      {
        id: 'calls',
        icon: 'tablerPhone',
        label: this.transloco.translate('customerPage.tabs.calls'),
        count: this.callsTotal(),
        alert: missed > 0 ? this.transloco.translate('customerPage.tabs.missed', { n: missed }) : null,
      },
      {
        id: 'attachments',
        icon: 'tablerPaperclip',
        label: this.transloco.translate('customerPage.tabs.attachments'),
        count: this.attachmentCount(),
      },
      {
        id: 'history',
        icon: 'tablerHistory',
        label: this.transloco.translate('customerPage.tabs.history'),
      },
    ];
  });

  protected readonly historyPartyIds = computed<string[]>(() => {
    const current = this.detail();
    if (!current || current.id !== this.customerId()) return [];
    const ids = [current.partyId, ...current.contacts.map((c) => c.partyId)].filter(Boolean);
    return Array.from(new Set(ids)).slice(0, 21);
  });

  private cameFromList = false;
  private navigatedWithinCustomerPage = false;
  private initializedRoute = false;
  private backQueryParams: Params = {};
  private loadSeq = 0;
  private capSeq = 0;
  private createIdempotencyKey: string | null = null;
  private lastCreateFingerprint: string | null = null;
  private confirmingLeave = false;
  private bypassGuard = false;
  private conflictResolver: ((choice: ConflictChoice) => void) | null = null;
  private lastNavStep: { fromId: string; dir: -1 | 1 } | null = null;
  private activityCountFromTab = false;
  private attachmentCountFromTab = false;
  private callsCountFromTab = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    const onVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        this.mode() === 'edit' &&
        this.activeTab() === 'calls' &&
        this.visited().has('calls')
      ) {
        this.callsReload.update((v) => v + 1);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      this.settleConflict('dismiss');
      const dialog = this.deleteDialog()?.nativeElement;
      if (dialog?.open) dialog.close();
    });

    const nav = this.router.currentNavigation() ?? this.router.lastSuccessfulNavigation();
    const initialState = nav?.extras?.state as CustomerRouteState | undefined;
    if (initialState?.cameFromList) {
      this.cameFromList = true;
      this.backQueryParams = cleanBackParams(initialState.backQueryParams);
    } else {
      const prevUrl = nav?.previousNavigation?.extractedUrl;
      if (prevUrl) {
        const path = '/' + prevUrl.root.children['primary']?.segments.map((s) => s.path).join('/');
        if (path === '/crm/customers') {
          this.cameFromList = true;
          this.backQueryParams = cleanBackParams(prevUrl.queryParams);
        }
      }
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

    syncTabWithQuery(this.route, this.router, this.activeTab, this.allowedTabs, 'overview', {
      onBeforeNavigate: () => {
        this.bypassGuard = true;
      },
      onAfterNavigate: () => {
        this.bypassGuard = false;
      },
    });

    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const nextId = params.get('id');
      const draftKey = this.route.snapshot.queryParamMap.get('draft');
      if (this.initializedRoute && nextId === this.customerId() && !draftKey) {
        return;
      }
      if (this.initializedRoute && nextId !== this.customerId()) {
        this.navigatedWithinCustomerPage = true;
      }
      this.initializedRoute = true;
      this.customerId.set(nextId);

      const navState = this.router.currentNavigation()?.extras.state as CustomerRouteState | undefined;
      if (navState?.cameFromList) {
        this.cameFromList = true;
        this.backQueryParams = cleanBackParams(navState.backQueryParams);
      }

      const carried = draftKey ? this.draftStore.take<CustomerDraft>(draftKey, 'customer') : null;
      if (draftKey) {
        this.bypassGuard = true;
        void this.router
          .navigate([], {
            relativeTo: this.route,
            queryParams: { draft: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          })
          .finally(() => {
            this.bypassGuard = false;
          });
      }

      this.submitted.set(false);
      this.serverErrors.set({});
      this.formRevision.update((v) => v + 1);
      this.createIdempotencyKey = null;
      this.lastCreateFingerprint = null;
      this.lookupsSettled.set(false);
      this.capabilitiesFailed.set(false);
      this.scopeDenied.set(false);
      this.activityCountFromTab = false;
      this.attachmentCountFromTab = false;
      this.callsCountFromTab = false;
      this.activityCount.set(0);
      this.attachmentCount.set(0);
      this.callsTotal.set(0);
      this.callsMissed.set(0);
      this.newActivityRequest.set(0);
      this.historyRefresh.set(0);

      if (nextId) {
        const matchedCarried = carried && carried.recordId === nextId ? carried : null;
        this.hasCarriedDraft.set(!!matchedCarried);
        if (matchedCarried) {
          this.nav.set(matchedCarried.nav ? { ...matchedCarried.nav, ids: [...matchedCarried.nav.ids] } : null);
        } else if (navState?.createdCustomer?.id === nextId || (this.nav() && !this.nav()!.ids.includes(nextId))) {
          this.nav.set(null);
        }

        if (!matchedCarried && navState?.createdCustomer?.id === nextId) {
          const created = navState.createdCustomer;
          const seq = ++this.loadSeq;
          this.lastNavStep = null;
          this.loadFailed.set(false);
          this.loading.set(false);
          this.detail.set(created);
          const mapped = draftFromDetail(created);
          this.base.set(mapped);
          this.draft.set(structuredClone(mapped));
          this.updatedAt.set(created.updatedAt);
          void this.refreshCapabilities(created.branchId);
          void this.loadInitialTabCounts(created, seq);
        } else {
          void this.loadCustomer(nextId, matchedCarried);
        }
      } else {
        this.lastNavStep = null;
        this.nav.set(null);
        this.activeTab.set('overview');
        this.detail.set(null);
        this.updatedAt.set(null);
        this.loadFailed.set(false);
        this.loading.set(false);
        this.hasCarriedDraft.set(!!carried);

        const statusQuery = this.route.snapshot.queryParamMap.get('status') as CustomerStatus | null;
        const preset: Partial<CustomerDraft> | undefined =
          !carried && statusQuery && isManualStatus(statusQuery) && canManageFormStatus()
            ? { status: statusQuery }
            : undefined;
        const fresh = emptyDraft(preset);
        this.base.set(fresh);
        this.draft.set(carried ? structuredClone(carried.draft) : structuredClone(fresh));
      }
    });

    effect(() => {
      const currentMode = this.mode();
      const branchId = this.branchId();
      const lookups = this.lookups();
      if (lookups) {
        lookups.setMode(currentMode);
        lookups.setBranch(branchId);
      }
    });

    effect(() => {
      const currentMode = this.mode();
      const branchId = this.branchId();
      if (currentMode === 'create') {
        void this.refreshCapabilities(branchId);
      }
    });

    effect(() => {
      const nextBranchId = this.currentBranchId();
      if (!nextBranchId) {
        this.ownersSeq++;
        this.branchOwners.set([]);
        this.loadedOwnersBranchId = null;
        return;
      }
      if (nextBranchId !== this.loadedOwnersBranchId) {
        untracked(() => void this.refreshBranchOwners(nextBranchId));
      }
    });

    effect(() => {
      if (!this.loading() && !this.loadFailed() && !this.scopeDenied() && this.lookupsReady()) {
        this.lookupsSettled.set(true);
      }
    });

    effect(() => {
      if (this.mode() !== 'create' || this.hasCarriedDraft()) return;
      const d = this.draft();
      const b = this.base();
      if ((b.companyId === null && d.companyId !== null) || (b.branchId === null && d.branchId !== null)) {
        this.base.set({
          ...b,
          companyId: b.companyId ?? d.companyId,
          branchId: b.branchId ?? d.branchId,
        });
      }
    });
  }

  async canDeactivate(): Promise<boolean> {
    if (this.bypassGuard) return true;
    const dirty = this.dirty();
    const contactDirty = this.hasUnsavedContact();
    if ((!dirty && !contactDirty) || !this.canEdit() || this.loading() || this.loadFailed() || this.scopeDenied()) {
      return true;
    }
    if (this.confirmingLeave) return false;
    this.confirmingLeave = true;
    try {
      const choice = await this.unsavedDialog().open();
      if (choice === 'cancel') return false;
      if (choice === 'discard') {
        this.customerForm()?.discardContactEdit();
        this.draft.set(structuredClone(this.base()));
        this.submitted.set(false);
        this.serverErrors.set({});
        return true;
      }
      if (contactDirty) {
        const contactSaved = await (this.customerForm()?.saveEditingContact() ?? Promise.resolve(true));
        if (!contactSaved) return false;
      }
      if (this.dirty()) {
        return await this.save({ navigateAfterCreate: false });
      }
      return true;
    } finally {
      this.confirmingLeave = false;
    }
  }

  protected async goBack(): Promise<void> {
    if (!(await this.canDeactivate())) return;
    this.bypassGuard = true;
    if (this.cameFromList && !this.navigatedWithinCustomerPage) {
      this.location.back();
    } else {
      try {
        await this.router.navigate(['/crm/customers'], { queryParams: this.backQueryParams });
      } finally {
        this.bypassGuard = false;
      }
    }
  }

  protected selectTab(tab: string): void {
    const candidate = (CUSTOMER_PAGE_TABS as readonly string[]).includes(tab) ? (tab as CustomerPageTab) : 'overview';
    const resolved: CustomerPageTab = this.mode() === 'create' ? 'overview' : candidate;
    const alreadyVisited = this.visited().has(resolved);
    const wasActive = this.activeTab() === resolved;
    if (resolved === 'calls' && alreadyVisited && !wasActive) {
      this.callsReload.update((v) => v + 1);
    }
    this.activeTab.set(resolved);
  }

  protected logActivity(): void {
    if (this.mode() !== 'edit' || !this.canLogActivity()) return;
    this.newActivityRequest.update((v) => v + 1);
    this.selectTab('activities');
  }

  protected onActivityCountChange(counts: { open: number; total: number }): void {
    this.activityCountFromTab = true;
    this.activityCount.set(counts.open);
  }

  protected onAttachmentCountChange(count: number): void {
    this.attachmentCountFromTab = true;
    this.attachmentCount.set(count);
  }

  protected onCallsTotal(total: number): void {
    this.callsCountFromTab = true;
    this.callsTotal.set(total);
  }

  protected onCallsMissed(missed: number): void {
    this.callsCountFromTab = true;
    this.callsMissed.set(missed);
  }

  protected onActionSelected(selection: ActionSelection): void {
    switch (selection.id) {
      case 'color':
        void this.onRecolor((selection.value as CardColor | null) ?? null);
        break;
      case 'newOpportunity': {
        const current = this.detail();
        if (current && this.activeStatus() !== 'BLACKLISTED') {
          void this.router.navigate(['/crm/opportunities/new'], {
            queryParams: { customerProfileId: current.id },
          });
        }
        break;
      }
      case 'delete':
        this.openDeleteDialog();
        break;
    }
  }

  protected async stepNav(dir: -1 | 1): Promise<void> {
    const currentNav = this.nav();
    const currentId = this.customerId();
    if (
      this.mode() !== 'edit' ||
      !currentNav ||
      !currentId ||
      this.loading() ||
      this.saving() ||
      this.deleting() ||
      this.instantBusy()
    ) {
      return;
    }
    const pos = navPosition(currentNav, currentId);
    if (!pos) return;
    if (dir === -1 && pos.index <= 1) return;
    if (dir === 1 && pos.index >= pos.total) return;

    if (!(await this.canDeactivate())) return;

    let target: { id: string; nav: RecordNavContext } | null = null;
    try {
      target = await nextNavTarget(currentNav, currentId, dir);
    } catch {
      this.notify.error(this.transloco.translate('customerPage.loadFailed'));
      return;
    }
    if (!target) return;

    this.nav.set(target.nav);
    this.lastNavStep = { fromId: currentId, dir };
    this.bypassGuard = true;
    const tabParam = this.activeTab() === 'overview' ? null : this.activeTab();
    try {
      await this.router.navigate(['/crm/customers', target.id], {
        queryParams: tabParam ? { tab: tabParam } : {},
        replaceUrl: false,
      });
    } finally {
      this.bypassGuard = false;
    }
  }

  protected onDraftChange(next: CustomerDraft): void {
    if (this.loading()) return;
    this.draft.set(next);
    if (Object.keys(this.serverErrors()).length > 0) {
      this.serverErrors.set({});
    }
  }

  protected undo(): void {
    this.draft.set(structuredClone(this.base()));
    this.submitted.set(false);
    this.serverErrors.set({});
    this.formRevision.update((v) => v + 1);
  }

  protected retryLoad(): void {
    if (this.reloadRequired()) { window.location.reload(); return; }
    const id = this.customerId();
    if (!id) return;
    this.lookupsSettled.set(false);
    this.capabilitiesFailed.set(false);
    this.scopeDenied.set(false);
    void this.loadCustomer(id, null);
  }

  protected onOpenDuplicate(match: DuplicateMatch): void {
    const leads = match.leads ?? [];
    if (leads.length > 0 && (!match.recordId || leads.some((item) => item.id === match.recordId))) {
      const targetLeadId = match.recordId ?? leads[0].id;
      void this.router.navigate(['/crm/leads', targetLeadId]);
      return;
    }
    if (match.recordId && !match.restricted && match.recordId !== this.customerId()) {
      void this.router.navigate(['/crm/customers', match.recordId]);
    }
  }

  protected async save(options?: { navigateAfterCreate?: boolean }): Promise<boolean> {
    if (this.saving() || !this.canEdit() || this.loading() || this.loadFailed() || this.scopeDenied()) return false;
    if (this.mode() === 'edit' && this.hasUnsavedContact()) {
      const contactSaved = await (this.customerForm()?.saveEditingContact() ?? Promise.resolve(true));
      if (!contactSaved) return false;
      if (!this.dirty()) return true;
    }
    return this.mode() === 'create'
      ? this.saveCreate(options?.navigateAfterCreate ?? true)
      : this.saveEdit();
  }

  protected async onRate(rating: number): Promise<void> {
    if (this.mode() !== 'edit') {
      this.onDraftChange({ ...this.draft(), rating });
      return;
    }
    const current = this.detail();
    if (!current || !this.canEdit() || this.instantBusy()) return;

    const prevDetail = current;
    const prevBase = this.base();
    const prevDraft = this.draft();

    this.detail.set({ ...current, rating });
    this.base.set({ ...prevBase, rating });
    this.draft.set({ ...prevDraft, rating });
    this.instantBusy.set(true);

    try {
      const saved = await setCustomerRating(current.id, rating);
      this.detail.set(saved);
      this.updatedAt.set(saved.updatedAt);
      this.historyRefresh.update((v) => v + 1);
    } catch (error) {
      this.detail.set(prevDetail);
      this.base.set(prevBase);
      this.draft.set(prevDraft);
      this.toastWriteError(error);
    } finally {
      this.instantBusy.set(false);
    }
  }

  protected async onRecolor(cardColor: CardColor | null): Promise<void> {
    if (this.mode() !== 'edit') {
      this.onDraftChange({ ...this.draft(), cardColor });
      return;
    }
    const current = this.detail();
    if (!current || !this.canEdit() || this.instantBusy()) return;

    const prevDetail = current;
    const prevBase = this.base();
    const prevDraft = this.draft();

    this.detail.set({ ...current, cardColor });
    this.base.set({ ...prevBase, cardColor });
    this.draft.set({ ...prevDraft, cardColor });
    this.instantBusy.set(true);

    try {
      const saved = await setCustomerColor(current.id, cardColor);
      this.detail.set(saved);
      this.updatedAt.set(saved.updatedAt);
      this.historyRefresh.update((v) => v + 1);
    } catch (error) {
      this.detail.set(prevDetail);
      this.base.set(prevBase);
      this.draft.set(prevDraft);
      this.toastWriteError(error);
    } finally {
      this.instantBusy.set(false);
    }
  }

  protected async onStatusChange(nextStatus: CustomerStatus): Promise<void> {
    if (this.mode() !== 'edit') {
      if (nextStatus !== 'ACTIVE_CUSTOMER') {
        this.onDraftChange({ ...this.draft(), status: nextStatus });
      }
      return;
    }
    const current = this.detail();
    if (
      !current ||
      !this.canEdit() ||
      !canManageFormStatus() ||
      this.instantBusy() ||
      nextStatus === 'ACTIVE_CUSTOMER' ||
      nextStatus === current.status
    ) {
      return;
    }

    if (nextStatus === 'BLACKLISTED') {
      const confirmed = await this.blacklistDialog().open();
      if (!confirmed) return;
    }

    const prevDetail = current;
    const prevBase = this.base();
    const prevDraft = this.draft();

    this.detail.set({ ...current, status: nextStatus });
    this.base.set({ ...prevBase, status: nextStatus });
    this.draft.set({ ...prevDraft, status: nextStatus });
    this.instantBusy.set(true);

    try {
      const saved = await setCustomerStatus(current.id, nextStatus, this.updatedAt() ?? current.updatedAt);
      this.detail.set(saved);
      this.base.update((b) => ({ ...b, status: saved.status }));
      this.draft.update((d) => ({ ...d, status: saved.status }));
      this.updatedAt.set(saved.updatedAt);
      this.historyRefresh.update((v) => v + 1);
      const statusLabel = this.localizedStatusLabel(saved.status);
      this.notify.success(this.transloco.translate('customers.board.moved', { status: statusLabel }));
    } catch (error) {
      this.detail.set(prevDetail);
      this.base.set(prevBase);
      this.draft.set(prevDraft);
      this.toastWriteError(error);
    } finally {
      this.instantBusy.set(false);
    }
  }

  protected openDeleteDialog(): void {
    const current = this.detail();
    if (!current || !this.canDelete() || this.activeStatus() === 'BLACKLISTED' || this.deleting() || this.saving()) {
      return;
    }
    this.deleteReason.set('');
    this.deleteConflictMessage.set(null);
    const dialog = this.deleteDialog().nativeElement;
    if (!dialog.open) {
      dialog.showModal();
    }
    this.deleteCancelBtn()?.nativeElement.focus();
  }

  protected closeDeleteDialog(): void {
    if (this.deleting()) return;
    const dialog = this.deleteDialog().nativeElement;
    if (dialog.open) {
      dialog.close();
    }
    this.deleteReason.set('');
    this.deleteConflictMessage.set(null);
  }

  protected onDeleteReasonInput(event: Event): void {
    this.deleteReason.set((event.target as HTMLTextAreaElement).value);
    if (this.deleteConflictMessage()) {
      this.deleteConflictMessage.set(null);
    }
  }

  protected onDeleteDialogEscape(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.closeDeleteDialog();
  }

  protected onDeleteDialogCancel(event: Event): void {
    if (this.deleting()) {
      event.preventDefault();
    }
  }

  protected onDeleteDialogClosed(): void {
    this.deleteReason.set('');
    this.deleteConflictMessage.set(null);
  }

  protected async submitDelete(): Promise<void> {
    const current = this.detail();
    if (!current || !this.canDelete() || this.deleting() || this.saving() || this.deleteReasonError()) return;

    const reason = this.deleteReason().trim();
    this.deleting.set(true);
    this.deleteConflictMessage.set(null);
    try {
      await deleteCustomer(current.id, reason || undefined);
      const dialog = this.deleteDialog().nativeElement;
      if (dialog.open) {
        dialog.close();
      }
      this.notify.success(this.transloco.translate('customerPage.delete.done'));
      this.bypassGuard = true;
      await this.router.navigate(['/crm/customers'], { queryParams: this.backQueryParams });
    } catch (error) {
      const mapped = customerRecordError(error, this.transloco);
      if (mapped.readOnly) this.writeReadonly.set(true);
      if (mapped.reloadRequired) this.reloadRequired.set(true);
      if (error instanceof ApiError && error.status === 409) {
        this.deleteConflictMessage.set(mapped.message);
        return;
      }
      const dialog = this.deleteDialog().nativeElement;
      if (dialog.open) {
        dialog.close();
      }
      this.toastWriteError(error);
    } finally {
      this.deleting.set(false);
      this.bypassGuard = false;
    }
  }

  protected onConflictChoice(choice: 'reload' | 'keep'): void {
    this.conflictOpen.set(false);
    this.settleConflict(choice);
  }

  protected onConflictOpenChange(open: boolean): void {
    this.conflictOpen.set(open);
    if (!open) {
      this.settleConflict('dismiss');
    }
  }

  private localizedStatusLabel(status: CustomerStatus): string {
    const opt = this.lookups()?.statusOptions().find((item) => item.value === status);
    if (opt) {
      return this.language() === 'ar' ? opt.label.ar : opt.label.en;
    }
    return this.transloco.translate(`customers.statuses.${status}`);
  }

  private async refreshBranchOwners(branchId: string): Promise<void> {
    const seq = ++this.ownersSeq;
    try {
      const owners = await listFormOwners(branchId, 'update');
      if (seq !== this.ownersSeq || this.currentBranchId() !== branchId) return;
      this.branchOwners.set(owners);
      this.loadedOwnersBranchId = branchId;
    } catch {
      // Unknown owners fall back to "—"
    }
  }

  private async loadCustomer(
    id: string,
    carried: { draft: CustomerDraft; recordId: string | null; baseUpdatedAt: string | null } | null,
  ): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.scopeDenied.set(false);
    this.reloadRequired.set(false);
    this.writeReadonly.set(false);
    this.loadCorrelation.set(null);
    this.loadMessage.set('');
    if (this.branchMissing() || !can('crm.customer_profiles.read')) {
      this.scopeDenied.set(true);
      this.loading.set(false);
      return;
    }
    try {
      const fresh = await getCustomer(id);
      if (seq !== this.loadSeq) return;
      this.lastNavStep = null;
      const lookups = this.lookups();
      if (lookups) {
        lookups.setMode('edit');
        lookups.setBranch(fresh.branchId);
      }
      let caps: CustomerCapabilities | null = null;
      try {
        caps = await getCustomerCapabilities(fresh.branchId);
        if (seq !== this.loadSeq) return;
        this.capabilitiesFailed.set(false);
      } catch (error) {
        if (seq !== this.loadSeq) return;
        this.capabilitiesFailed.set(true);
        if (error instanceof ApiError && error.status === 403) this.scopeDenied.set(true);
      }
      this.capabilities.set(caps);
      this.detail.set(fresh);
      const mapped = draftFromDetail(fresh);
      this.base.set(mapped);
      this.draft.set(carried ? structuredClone(carried.draft) : structuredClone(mapped));
      this.updatedAt.set(carried?.baseUpdatedAt ?? fresh.updatedAt);
      this.formRevision.update((v) => v + 1);
      void this.loadInitialTabCounts(fresh, seq);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (error instanceof ApiError && (error.status === 404 || error.code === 'CUSTOMER_PROFILE_NOT_FOUND')) {
        const currentNav = this.nav();
        const navIdx = currentNav ? currentNav.ids.indexOf(id) : -1;
        if (currentNav && navIdx >= 0) {
          this.notify.warning(this.transloco.translate('customerPage.navGone'));
          const nextIds = [...currentNav.ids.slice(0, navIdx), ...currentNav.ids.slice(navIdx + 1)];
          const updatedNav: RecordNavContext | null =
            nextIds.length > 0
              ? { ...currentNav, ids: nextIds, total: Math.max(nextIds.length, currentNav.total - 1) }
              : null;
          this.nav.set(updatedNav);

          const step = this.lastNavStep;
          this.lastNavStep = null;
          const tabParam = this.activeTab() === 'overview' ? null : this.activeTab();

          let fallbackId: string | null = null;
          if (updatedNav) {
            if (step?.dir === 1 && navIdx < updatedNav.ids.length) {
              fallbackId = updatedNav.ids[navIdx];
            } else if (step?.dir === -1 && navIdx - 1 >= 0) {
              fallbackId = updatedNav.ids[navIdx - 1];
            } else if (step?.fromId && updatedNav.ids.includes(step.fromId)) {
              fallbackId = step.fromId;
            } else {
              fallbackId = updatedNav.ids[Math.min(navIdx, updatedNav.ids.length - 1)] ?? null;
            }
          }

          this.bypassGuard = true;
          try {
            if (fallbackId) {
              await this.router.navigate(['/crm/customers', fallbackId], {
                queryParams: tabParam ? { tab: tabParam } : {},
                replaceUrl: true,
              });
            } else {
              await this.router.navigate(['/not-found'], { replaceUrl: true });
            }
          } finally {
            this.bypassGuard = false;
          }
          return;
        }
        this.loadKind.set('not-found');
        this.loadFailed.set(true);
        return;
      }
      if (error instanceof ApiError && (error.status === 403 || error.code === 'CRM_SCOPED_PERMISSION_DENIED')) {
        this.scopeDenied.set(true);
        return;
      }
      this.loadFailed.set(true);
      const failure = customerRecordError(error, this.transloco);
      this.loadKind.set(failure.kind);
      this.loadCorrelation.set(failure.correlationId);
      this.loadMessage.set(failure.message);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private async loadInitialTabCounts(customer: CustomerDetail, seq: number): Promise<void> {
    const [openResult, attachmentResult, callsResult] = await Promise.allSettled([
      listActivities({
        targetApp: 'CRM',
        targetType: 'CUSTOMER_PROFILE',
        targetId: customer.id,
        statuses: ['PLANNED', 'IN_PROGRESS'],
        page: 1,
        limit: 1,
      }),
      countRecordAttachments('CUSTOMER_PROFILE', customer.branchId, customer.id),
      getPartyCallsSummary({ partyType: 'CUSTOMER_PROFILE', partyId: customer.id }),
    ]);
    if (seq !== this.loadSeq || this.customerId() !== customer.id) return;
    if (openResult.status === 'fulfilled' && !this.activityCountFromTab) {
      this.activityCount.set(openResult.value.meta.total);
    }
    if (attachmentResult.status === 'fulfilled' && !this.attachmentCountFromTab) {
      this.attachmentCount.set(attachmentResult.value);
    }
    if (callsResult.status === 'fulfilled' && !this.callsCountFromTab) {
      this.callsTotal.set(callsResult.value.total);
      this.callsMissed.set(callsResult.value.missed);
    }
  }

  private async refreshCapabilities(branchId: string | null): Promise<void> {
    const seq = ++this.capSeq;
    if (!branchId || this.branchMissing() || !can('crm.customer_profiles.read')) {
      this.capabilities.set(null);
      this.capabilitiesFailed.set(false);
      return;
    }
    try {
      const caps = await getCustomerCapabilities(branchId);
      if (seq === this.capSeq) {
        this.capabilitiesFailed.set(false);
        this.capabilities.set(caps);
      }
    } catch {
      if (seq === this.capSeq) {
        this.capabilitiesFailed.set(true);
        this.capabilities.set(null);
      }
    }
  }

  private async saveCreate(navigateAfterCreate = true): Promise<boolean> {
    if (this.reloadRequired() || this.lookups()?.loading() || this.lookups()?.customFieldsUnavailable()) return false;
    this.submitted.set(true);
    this.serverErrors.set({});
    const validation = validateDraft(this.draft(), 'create', this.lookups()?.customFields() ?? []);
    if (Object.keys(validation).length > 0) {
      this.selectTab('overview');
      afterNextRender(() => this.customerForm()?.scrollToFirstError(), { injector: this.injector });
      return false;
    }

    const body: CustomerCreateBody = toCreateBody(this.draft());
    const fingerprint = JSON.stringify(body);
    if (fingerprint !== this.lastCreateFingerprint || !this.createIdempotencyKey) {
      this.createIdempotencyKey = newIdempotencyKey();
      this.lastCreateFingerprint = fingerprint;
    }

    this.saving.set(true);
    try {
      const created = await createCustomer(body, this.createIdempotencyKey);
      this.createIdempotencyKey = null;
      this.lastCreateFingerprint = null;
      const mapped = draftFromDetail(created, this.draft().companyId);
      this.detail.set(created);
      this.base.set(mapped);
      this.draft.set(structuredClone(mapped));
      this.updatedAt.set(created.updatedAt);
      this.submitted.set(false);
      this.formRevision.update((v) => v + 1);
      this.notify.success(this.transloco.translate('customerPage.created', { name: created.displayName }));
      if (navigateAfterCreate) {
        this.bypassGuard = true;
        await this.router.navigate(['/crm/customers', created.id], {
          replaceUrl: true,
          state: {
            createdCustomer: created,
            cameFromList: this.cameFromList,
            backQueryParams: this.backQueryParams,
          } satisfies CustomerRouteState,
        });
      }
      return true;
    } catch (error) {
      this.handleSaveError(error);
      return false;
    } finally {
      this.saving.set(false);
      this.bypassGuard = false;
    }
  }

  private async saveEdit(): Promise<boolean> {
    if (this.lookups()?.loading() || this.lookups()?.customFieldsUnavailable()) return false;
    const current = this.detail();
    const expectedUpdatedAt = this.updatedAt();
    if (!current || !expectedUpdatedAt) return false;

    this.submitted.set(true);
    this.serverErrors.set({});
    const validation = validateDraft(this.draft(), 'edit', this.lookups()?.customFields() ?? []);
    if (Object.keys(validation).length > 0) {
      this.selectTab('overview');
      afterNextRender(() => this.customerForm()?.scrollToFirstError(), { injector: this.injector });
      return false;
    }

    const prevPartyId = current.partyId;
    const prevStatus = current.status;
    const baseSnapshot = this.base();
    const draftSnapshot = this.draft();
    const body = toPatchBody(baseSnapshot, draftSnapshot, expectedUpdatedAt);
    const tagDiff = diffTags(baseSnapshot.tagIds, draftSnapshot.tagIds);
    const hasFieldPatch = Object.keys(body).length > 1;
    const hasTagChanges = tagDiff.added.length > 0 || tagDiff.removed.length > 0;

    if (!hasFieldPatch && !hasTagChanges && !hasCustomerContactChanges(baseSnapshot.contacts, draftSnapshot.contacts)) {
      this.submitted.set(false);
      return true;
    }

    this.saving.set(true);
    let latest = current;
    let patchedFields = false;
    try {
      if (hasFieldPatch) {
        latest = await patchCustomer(current.id, body);
        patchedFields = true;
      }

      latest = await saveCustomerContacts({ ...latest, updatedAt: patchedFields ? latest.updatedAt : expectedUpdatedAt },
        baseSnapshot.contacts, draftSnapshot.contacts);

      if (hasTagChanges) {
        try {
          if (tagDiff.added.length > 0) {
            await attachCustomerTags(current.id, tagDiff.added);
          }
          for (const tagId of tagDiff.removed) {
            await detachCustomerTag(current.id, tagId);
          }
          latest = await getCustomer(current.id);
        } catch (tagError) {
          try {
            const fresh = await getCustomer(current.id);
            const freshBase = draftFromDetail(fresh, baseSnapshot.companyId);
            this.detail.set(fresh);
            this.base.set(freshBase);
            this.draft.set(rebaseDraft(baseSnapshot, freshBase, draftSnapshot));
            this.updatedAt.set(fresh.updatedAt);
          } catch {
            if (patchedFields) {
              const partialBase = draftFromDetail(latest, baseSnapshot.companyId);
              this.detail.set(latest);
              this.base.set(partialBase);
              this.draft.set({ ...structuredClone(partialBase), tagIds: [...draftSnapshot.tagIds] });
              this.updatedAt.set(latest.updatedAt);
            }
          }
          this.handleSaveError(tagError);
          return false;
        }
      }

      const mapped = draftFromDetail(latest, baseSnapshot.companyId);
      this.detail.set(latest);
      this.base.set(mapped);
      this.draft.set(structuredClone(mapped));
      this.updatedAt.set(latest.updatedAt);
      this.submitted.set(false);
      if (latest.partyId !== prevPartyId || latest.status !== prevStatus) {
        invalidateRelatedCounts('CUSTOMER_PROFILE', latest.id);
      }
      this.historyRefresh.update((v) => v + 1);
      this.notify.success(this.transloco.translate('recordPage.saved'));
      return true;
    } catch (error) {
      if (error instanceof CustomerContactSaveError) {
        await this.handlePartialContacts(error);
        return false;
      }
      if (error instanceof ApiError && error.code === 'CRM.CUSTOMER_PROFILE.CONCURRENT_UPDATE') {
        this.saving.set(false);
        return await this.handleConflict(current.id);
      }
      this.handleSaveError(error);
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  private async handleConflict(customerId: string): Promise<boolean> {
    const choice = await this.openConflictDialog();
    if (choice === 'dismiss') {
      return false;
    }
    try {
      const fresh = await getCustomer(customerId);
      const freshDraft = draftFromDetail(fresh, this.base().companyId);
      if (choice === 'reload') {
        this.detail.set(fresh);
        this.base.set(freshDraft);
        this.draft.set(structuredClone(freshDraft));
        this.updatedAt.set(fresh.updatedAt);
        this.submitted.set(false);
        this.serverErrors.set({});
        this.formRevision.update((v) => v + 1);
        this.historyRefresh.update((v) => v + 1);
        return false;
      }

      this.updatedAt.set(fresh.updatedAt);
      return false;
    } catch (error) {
      this.toastWriteError(error);
      return false;
    }
  }

  protected async onSaveContact(change: ContactChange): Promise<ContactErrors | null> {
    const current = this.detail();
    const expectedUpdatedAt = this.updatedAt();
    if (!current || !expectedUpdatedAt || !this.canEdit() || this.saving() || this.deleting()) {
      return {};
    }

    const prevContactIds = current.contacts.map((c) => c.partyId).join(',');
    this.instantBusy.set(true);
    try {
      const updated = await saveCustomerContacts({ ...current, updatedAt: expectedUpdatedAt },
        this.base().contacts, contactsAfterChange(this.draft().contacts, change));
      if (this.detail()?.id !== current.id) return {};
      const oldBase = this.base();
      const userDraft = this.draft();
      const freshBase = draftFromDetail(updated, oldBase.companyId);
      const rebased = rebaseDraft(oldBase, freshBase, userDraft);
      rebased.contacts = freshBase.contacts.map((c) => ({ ...c, phones: [...c.phones] }));
      this.detail.set(updated);
      this.base.set(freshBase);
      this.draft.set(rebased);
      this.updatedAt.set(updated.updatedAt);
      if (updated.contacts.map((c) => c.partyId).join(',') !== prevContactIds) {
        invalidateRelatedCounts('CUSTOMER_PROFILE', updated.id);
      }
      this.historyRefresh.update((v) => v + 1);
      return null;
    } catch (error) {
      if (error instanceof CustomerContactSaveError) {
        await this.handlePartialContacts(error);
        return this.mapContactErrors(error.error, change);
      }
      if (error instanceof ApiError && error.code === 'CRM.CUSTOMER_PROFILE.CONCURRENT_UPDATE') {
        this.instantBusy.set(false);
        await this.handleConflict(current.id);
        return {};
      }
      this.toastWriteError(error);
      return this.mapContactErrors(error, change);
    } finally {
      this.instantBusy.set(false);
    }
  }

  private async handlePartialContacts(error: CustomerContactSaveError): Promise<void> {
    const oldBase = this.base();
    if (error.fresh) {
      const freshBase = draftFromDetail(error.fresh, oldBase.companyId);
      const rebased = rebaseDraft(oldBase, freshBase, this.draft());
      rebased.contacts = error.remaining;
      this.detail.set(error.fresh);
      this.base.set(freshBase);
      this.draft.set(rebased);
      this.updatedAt.set(error.fresh.updatedAt);
      this.historyRefresh.update((value) => value + 1);
      invalidateRelatedCounts('CUSTOMER_PROFILE', error.fresh.id);
    } else {
      this.draft.update((draft) => ({ ...draft, contacts: error.remaining }));
    }
    this.toastWriteError(error.error, error.saved);
    if (error.error instanceof ApiError && error.error.code === 'CRM.CUSTOMER_PROFILE.CONCURRENT_UPDATE') {
      this.instantBusy.set(false);
      this.saving.set(false);
      await this.handleConflict(this.detail()!.id);
    }
  }

  private mapContactErrors(error: unknown, change: ContactChange): ContactErrors {
    const mapped = mapServerErrors(error, this.draft());
    const out: ContactErrors = {};
    const editedContact = change.op === 'ADD' || change.op === 'UPDATE' ? change.contact : null;
    const editingKey = editedContact?.key ?? null;

    if (mapped['contacts']) {
      out['contacts'] = this.translateFormError(mapped['contacts']);
    }
    if (editingKey && editedContact) {
      const code = errorCodeOf(error);
      if (
        (code === 'CUSTOMER_PROFILE_CONTACT_NAME_REQUIRED' ||
          code?.endsWith('.CUSTOMER_PROFILE_CONTACT_NAME_REQUIRED')) &&
        !editedContact.firstName.trim()
      ) {
        out[`${editingKey}.firstName`] = this.translateFormError('required');
      }
      for (const [key, raw] of Object.entries(mapped)) {
        if (!raw || !key.startsWith('contacts.')) continue;
        const rest = key.slice('contacts.'.length);
        const dot = rest.indexOf('.');
        if (dot >= 0) {
          const field = rest.slice(dot + 1);
          out[`${editingKey}.${field}`] = this.translateFormError(raw);
        }
      }
    }
    return out;
  }

  private translateFormError(raw: string): string {
    if (raw.includes('.')) {
      const direct = this.transloco.translate(raw);
      return direct !== raw ? direct : raw;
    }
    const formKey = `customerForm.errors.${raw}`;
    const formMsg = this.transloco.translate(formKey);
    if (formMsg !== formKey) return formMsg;
    const serverKey = `customerForm.server.${raw}`;
    const serverMsg = this.transloco.translate(serverKey);
    return serverMsg !== serverKey ? serverMsg : raw;
  }

  private openConflictDialog(): Promise<ConflictChoice> {
    this.settleConflict('dismiss');
    this.conflictOpen.set(true);
    return new Promise<ConflictChoice>((resolve) => {
      this.conflictResolver = resolve;
    });
  }

  private settleConflict(choice: ConflictChoice): void {
    const resolve = this.conflictResolver;
    this.conflictResolver = null;
    resolve?.(choice);
  }

  private toastWriteError(error: unknown, saved?: readonly string[]): void {
    const mapped = customerRecordError(error, this.transloco, this.draft());
    if (mapped.readOnly) this.writeReadonly.set(true);
    if (mapped.reloadRequired) this.reloadRequired.set(true);
    this.notify.error(mapped.message, saved
      ? [this.transloco.translate('customerForm.server.notSaved'),
        ...(saved.length ? [`${this.transloco.translate('recordForm.contacts.saved')}: ${saved.join('; ')}`] : [])].join(' ')
      : '');
  }

  private handleSaveError(error: unknown): void {
    const mapped = customerRecordError(error, this.transloco, this.draft());
    if (this.mode() === 'create' && !mapped.keepKey) {
      this.createIdempotencyKey = null;
      this.lastCreateFingerprint = null;
    }
    if (mapped.readOnly) this.writeReadonly.set(true);
    if (mapped.reloadRequired) this.reloadRequired.set(true);
    const fieldErrors = mapped.fields;
    const errKeys = Object.keys(fieldErrors);
    const contactsOnly = errKeys.length > 0 && errKeys.every((key) => key === 'contacts' || key.startsWith('contacts.'));

    if (errKeys.length > 0) {
      this.serverErrors.set(fieldErrors);
      this.selectTab('overview');
      if (contactsOnly) {
        afterNextRender(
          () => {
            const container = this.scrollContainer()?.nativeElement;
            const contactTarget = container?.querySelector<HTMLElement>(
              '#cf-contacts input:not([disabled]), #cf-contacts button:not([disabled])',
            );
            contactTarget?.scrollIntoView({ behavior: smoothScrollBehavior(), block: 'center' });
            contactTarget?.focus({ preventScroll: true });
          },
          { injector: this.injector },
        );
      } else {
        afterNextRender(() => this.customerForm()?.scrollToFirstError(), { injector: this.injector });
      }
    }

    this.notify.error(mapped.message);
  }
}
