import { LeadConvert } from '../lead-convert/lead-convert';
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
import { ActivatedRoute, NavigationCancel, NavigationEnd, NavigationError, Params, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowLeft,
  tablerBuilding,
  tablerCalendarPlus,
  tablerCloudOff,
  tablerLock,
  tablerUser,
  tablerUserPlus,
} from '@ng-icons/tabler-icons';
import { filter } from 'rxjs';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ActionItem, ActionSelection } from '../../../../shared/ui/actions-menu/actions-menu';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { leadWriteState } from '../lead-list';
import { LeadDisqualify } from '../lead-disqualify/lead-disqualify';
import { sessionBranch } from '../../shared/lookups/session-branch';
import { leadActionRow } from './lead-record-access';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { ConflictDialog } from '../../../../shared/ui/conflict-dialog/conflict-dialog';
import { UnsavedDialog } from '../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { ActivitiesApi } from '../../../../shared/widgets/activities/activities.api';
import { PartyCalls } from '../../../../shared/widgets/party-calls/party-calls';
import { getPartyCallsSummary } from '../../../../shared/widgets/party-calls/party-calls.api';
import { RecordAttachments } from '../../../../shared/widgets/record-attachments/record-attachments';
import {
  countRecordAttachments,
} from '../../../../shared/widgets/record-attachments/record-attachments.api';
import { RecordHistory } from '../../../../shared/widgets/record-history/record-history';
import { HistoryCategoryOption } from '../../../../shared/widgets/record-history/record-history.model';
import { RecordActivitiesTab } from '../../shared/record/activities-tab/record-activities-tab';
import { RecordDraftStore } from '../../shared/record/nav/record-draft-store';
import { navPosition, nextNavTarget } from '../../shared/record/nav/record-nav';
import { CanLeaveRecord } from '../../shared/record/nav/record-page.guard';
import { RecordHeaderOwner, RecordPageHeader } from '../../shared/record/page/record-page-header/record-page-header';
import { RecordTab, RecordTabs } from '../../shared/record/page/record-tabs/record-tabs';
import { createVisitedTabs, syncTabWithQuery } from '../../shared/record/page/record-tabs/visited-tabs';
import { RecordRelatedBadges } from '../../shared/record/related/record-related-badges';
import { invalidateRelatedCounts } from '../../shared/record/related/related-records.api';
import { ApiError, errorCodeOf, newIdempotencyKey } from '../../settings/shared/settings-api';
import { leadActions } from '../lead-card/lead-card';
import {
  ContactDraft,
  DraftErrors,
  LeadDraft,
  draftFromDetail,
  draftsEqual,
  emptyDraft,
  toCreateBody,
  validateDraft,
} from '../lead-form/lead-draft';
import type { CreateLeadBody } from '../lead-form/lead-draft';
import { LEAD_PAGE_SECTION_ERRORS, LeadForm } from '../lead-form/lead-form';
import { LeadContactSaveError, saveLeadChanges } from '../lead-form/lead-save';
import { leadServerError } from '../lead-form/lead-server-error';
import {
  createLead,
  deleteLead,
  getLead,
  getLeadCapabilities,
  listBranchOwners,
  moveLead,
  updateLead,
} from '../leads.api';
import {
  CARD_COLORS,
  CardColor,
  LeadsCapabilities,
  LeadDetail,
  LeadNavContext,
  LeadRow,
  OwnerOption,
  nameIn,
} from '../leads.model';

type ConflictChoice = 'reload' | 'keep' | 'dismiss';
export type LeadPageTab = 'overview' | 'activities' | 'calls' | 'attachments' | 'history';

const LEAD_PAGE_TABS: readonly LeadPageTab[] = ['overview', 'activities', 'calls', 'attachments', 'history'];
const OVERVIEW_ERROR_PREFIXES = Object.values(LEAD_PAGE_SECTION_ERRORS).flat();

interface LeadRouteState {
  createdLead?: LeadDetail;
  cameFromList?: boolean;
  backQueryParams?: Params;
}

function rebaseDraft(oldBase: LeadDraft, freshBase: LeadDraft, currentDraft: LeadDraft): LeadDraft {
  const next: Record<string, unknown> = { ...freshBase };
  for (const key of Object.keys(freshBase) as (keyof LeadDraft)[]) {
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
  return next as unknown as LeadDraft;
}

@Component({
  selector: 'app-lead-page',
  imports: [
    LeadConvert,
    NgIcon,
    TranslocoPipe,
    Button,
    FullState,
    LeadDisqualify,
    ConfirmDialog,
    ConflictDialog,
    UnsavedDialog,
    LeadForm,
    RecordPageHeader,
    RecordRelatedBadges,
    RecordTabs,
    RecordActivitiesTab,
    RecordAttachments,
    RecordHistory,
    PartyCalls,
  ],
  providers: [
    provideTranslocoScope(
      { scope: 'leads', alias: 'leads' },
      { scope: 'lead-page', alias: 'leadPage' },
      { scope: 'lead-modal', alias: 'leadModal' },
      { scope: 'lead-form', alias: 'leadForm' },
      { scope: 'lead-form-side', alias: 'leadSide' },
      { scope: 'lead-dup', alias: 'leadDup' },
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
      tablerUser,
      tablerUserPlus,
    }),
  ],
  templateUrl: './lead-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col p-12 gap-8' },
})
export class LeadPage implements CanLeaveRecord {
  private static nextId = 0;
  protected readonly uid = `lead-page-${++LeadPage.nextId}`;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly injector = inject(Injector);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly draftStore = inject(RecordDraftStore);
  private readonly activitiesApi = inject(ActivitiesApi);
  protected readonly language = inject(LanguageState).current;

  private readonly leadForm = viewChild(LeadForm);
  protected readonly lookups = computed(() => this.leadForm()?.lookups ?? null);
  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');
  private readonly unsavedDialog = viewChild.required(UnsavedDialog);
  private readonly deleteDialogWrap = viewChild<ElementRef<HTMLElement>>('deleteDialogWrap');
  private readonly deleteDialog = viewChild.required<ConfirmDialog>('deleteDialog');

  protected readonly leadId = signal<string | null>(this.route.snapshot.paramMap.get('id'));
  private readonly hasCarriedDraft = signal(false);
  private readonly base = signal<LeadDraft>(emptyDraft());
  protected readonly draft = signal<LeadDraft>(emptyDraft());
  protected readonly detail = signal<LeadDetail | null>(null);
  protected readonly updatedAt = signal<string | null>(null);
  protected readonly capabilities = signal<LeadsCapabilities | null>(null);
  protected readonly nav = signal<LeadNavContext | null>(null);

  protected readonly notFound = signal(false);
  protected readonly chooseBranch = signal(false);
  protected readonly loadReference = signal('');
  private readonly disqualify = viewChild(LeadDisqualify);
  protected readonly writes = leadWriteState(this.capabilities,
    () => this.retryLoad(), (id) => getLead(id), (row) => {
      this.detail.update((current) => current ? { ...current, ...row } : current);
      this.updatedAt.set(row.updatedAt);
      this.base.update((draft) => ({ ...draft, rating: row.rating, cardColor: row.cardColor }));
      this.draft.update((draft) => ({ ...draft, rating: row.rating, cardColor: row.cardColor }));
    });
  protected readonly canUpdateRecord = computed(() => {
    const current = this.detail();
    return !!current && current.id === this.leadId() && !this.loading() && !this.loadFailed()
      && !this.scopeDenied() && !this.notFound() && !this.chooseBranch() && this.writes.canUpdate(leadActionRow(current));
  });

  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly scopeDenied = signal(false);
  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);
  protected readonly instantBusy = signal(false);
  protected readonly conflictOpen = signal(false);
  private readonly submitted = signal(false);
  private readonly serverErrors = signal<DraftErrors>({});
  protected readonly formRevision = signal(0);

  protected readonly mode = computed<'create' | 'edit'>(() => (this.leadId() ? 'edit' : 'create'));
  private readonly allowedTabs = computed<readonly LeadPageTab[]>(() =>
    this.mode() === 'create' ? ['overview'] : LEAD_PAGE_TABS,
  );
  protected readonly activeTab = signal<LeadPageTab>('overview');
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
  protected readonly leadHistoryEntityTypes = ['Lead'] as const;
  protected readonly historyCategories: readonly HistoryCategoryOption[] = [
    { id: 'lead', labelKey: 'leadPage.history.filter.lead' },
    { id: 'contact', labelKey: 'recordHistory.filter.contact' },
    { id: 'activity', labelKey: 'recordHistory.filter.activity' },
  ];

  private readonly branchId = computed(() =>
    this.mode() === 'edit' ? (this.detail()?.branchId ?? this.draft().branchId) : this.draft().branchId,
  );
  protected readonly currentBranchId = computed(() => {
    const current = this.detail();
    return current && current.id === this.leadId() ? current.branchId : null;
  });
  protected readonly dirty = computed(() => !draftsEqual(this.base(), this.draft()));
  protected readonly hasUnsavedContact = computed(() => this.leadForm()?.contactUnsaved() ?? false);
  protected readonly saveContactsBound = (contacts: ContactDraft[], editIndex?: number) =>
    this.onSaveContacts(contacts, editIndex);

  private readonly scopesReady = computed(() => {
    const lang = this.language();
    const active = this.transloco.activeLang();
    this.i18n();
    if (active !== lang) return false;
    const dict = this.transloco.getTranslation(lang);
    return Boolean(
      dict['common.cancel'] &&
        dict['leads.actions.delete'] &&
        dict['leadPage.back'] &&
        dict['leadModal.type.INDIVIDUAL'] &&
        dict['leadForm.sections.lead'] &&
        dict['leadForm.basics.type'] &&
        dict['leadSide.branch'] &&
        dict['leadDup.title'] &&
        dict['recordPage.save'],
    );
  });

  protected readonly showSkeleton = computed(
    () => this.loading() || (!this.loadFailed() && !this.scopeDenied() && !this.notFound() && !this.chooseBranch() && !this.scopesReady()),
  );

  protected readonly canEdit = computed(() => {
    const branch = sessionBranch();
    if (!branch || this.writes.readOnly() || this.chooseBranch() || this.scopeDenied() || this.notFound()) return false;
    if (this.mode() === 'create') {
      const capabilities = this.capabilities() ?? this.lookups()?.capabilities();
      return capabilities?.branchId === branch.branchId && !!capabilities.leads.create;
    }
    const current = this.detail();
    return !!current && current.branchId === branch.branchId && this.canUpdateRecord();
  });

  protected readonly canDelete = computed(
    () =>
      this.mode() === 'edit' &&
      !this.showSkeleton() &&
      !this.loadFailed() &&
      !this.scopeDenied() &&
      !this.notFound() && !this.chooseBranch() &&
      !!this.detail() && this.detail()!.id === this.leadId() && this.writes.canDelete(leadActionRow(this.detail()!)),
  );

  protected readonly canUploadAttachments = computed(() => {
    const current = this.detail();
    if (!current || current.status === 'CONVERTED') return false;
    const caps = this.capabilities();
    return this.scopeAllows(caps?.attachments.create);
  });

  protected readonly canDeleteAttachments = computed(() => {
    const current = this.detail();
    if (!current || current.status === 'CONVERTED') return false;
    const caps = this.capabilities();
    return this.scopeAllows(caps?.attachments.delete);
  });

  private scopeAllows(scope: LeadsCapabilities['activities']['create'] | undefined): boolean {
    const current = this.detail();
    return !!current && current.status !== 'CONVERTED' && !this.writes.readOnly() && !!scope
      && (scope.scope === 'all' || !!current.ownerUserId && !!scope.ownerUserIds?.includes(current.ownerUserId));
  }
  protected readonly canCreateActivity = computed(() => this.scopeAllows(this.capabilities()?.activities.create));

  protected readonly errors = computed<DraftErrors>(() => {
    const srv = this.serverErrors();
    if (!this.submitted()) return srv;
    return { ...validateDraft(this.draft(), this.mode(), this.lookups()?.customFields() ?? []), ...srv };
  });

  protected readonly overviewHasErrors = computed(() => {
    if (!this.submitted()) return false;
    const keys = Object.keys(this.errors());
    if (keys.length === 0) return false;
    return keys.some((key) =>
      OVERVIEW_ERROR_PREFIXES.some((prefix) => key === prefix || key.startsWith(`${prefix}.`)),
    );
  });

  protected readonly headerStages = computed(() => {
    const l = this.lookups();
    if (!l) return [];
    return this.mode() === 'create' ? l.stages() : l.allStages().filter((stage) => stage.isActive);
  });

  protected readonly headerTile = computed(() =>
    this.mode() === 'create'
      ? 'bg-icon-green'
      : this.draft().leadProfileType === 'CORPORATE'
        ? 'bg-icon-navy'
        : 'bg-icon-blue',
  );

  protected readonly headerTypeIcon = computed(() =>
    this.mode() === 'create'
      ? 'tablerUserPlus'
      : this.draft().leadProfileType === 'CORPORATE'
        ? 'tablerBuilding'
        : 'tablerUser',
  );

  protected readonly displayName = computed(() => {
    const d = this.draft();
    if (d.leadProfileType === 'INDIVIDUAL') {
      const name = [d.firstName.trim(), d.lastName.trim()].filter(Boolean).join(' ');
      if (name) return name;
    } else {
      const name = d.existingCompanyPartyId ? (d.existingCompanyName ?? '').trim() : d.companyName.trim();
      if (name) return name;
    }
    return this.detail()?.displayName ?? '';
  });

  protected readonly headerTitle = computed(() => {
    this.i18n();
    const name = this.displayName();
    if (name) return name;
    return this.mode() === 'create' ? this.transloco.translate('leadPage.newTitle') : '';
  });

  protected readonly headerSubtitle = computed(() => {
    this.i18n();
    this.language();
    const d = this.draft();
    const parts: string[] = [];
    if (d.leadProfileType === 'CORPORATE') {
      const primary = d.contacts.find((c) => c.isPrimary) ?? d.contacts[0];
      const contactName = primary
        ? [primary.firstName.trim(), primary.lastName.trim()].filter(Boolean).join(' ')
        : (this.detail()?.primaryContact?.displayName ?? '');
      if (contactName) parts.push(contactName);
    }
    const branchId = d.branchId ?? this.detail()?.branchId ?? null;
    const branchName = branchId ? (this.lookups()?.branches().find((item) => item.id === branchId)?.name ?? null) : null;
    if (branchName) parts.push(branchName);
    if (this.mode() === 'edit' && this.detail()?.createdAt) {
      parts.push(this.transloco.translate('recordPage.createdOn', { date: this.formatDateTime(this.detail()!.createdAt) }));
    }
    return parts.join(' · ');
  });

  protected readonly edgeClass = computed(() => {
    const color = this.draft().cardColor ?? this.detail()?.cardColor ?? null;
    return color ? CARD_COLORS[color] : null;
  });

  protected readonly headerStage = computed(() => {
    if (this.mode() !== 'edit') return null;
    const stageId = this.draft().stageId ?? this.detail()?.stageId;
    if (!stageId) return null;
    const stage = this.lookups()?.allStages().find((item) => item.id === stageId);
    if (!stage) return null;
    const toneClass =
      stage.flag === 'DISQUALIFIED'
        ? 'bg-danger-soft text-on-danger-soft'
        : stage.flag === 'CONVERTED'
          ? 'bg-success-soft text-on-success-soft'
          : 'bg-brand-soft text-on-brand-soft';
    return { name: nameIn(stage, this.language()), toneClass };
  });

  protected readonly headerOwner = computed<RecordHeaderOwner | null>(() => {
    if (this.mode() !== 'edit') return null;
    const ownerId = this.draft().ownerUserId ?? this.detail()?.ownerUserId;
    if (!ownerId) return null;
    const found = this.lookups()?.owners().find((item) => item.id === ownerId);
    if (found) return { name: found.displayName, avatarUrl: found.avatarUrl };
    const detailOwner = this.detail()?.owner;
    if (detailOwner && detailOwner.userId === ownerId) {
      const name = [detailOwner.firstName, detailOwner.lastName].filter(Boolean).join(' ');
      if (name) return { name, avatarUrl: null };
    }
    return null;
  });

  protected readonly navPos = computed(() => (this.mode() === 'edit' ? navPosition(this.nav(), this.leadId()) : null));

  protected readonly actionItems = computed<ActionItem[]>(() => {
    this.i18n();
    const current = this.detail();
    if (this.mode() !== 'edit' || !current) return [];
    const row: LeadRow = {
      ...current,
      cardColor: this.draft().cardColor ?? current.cardColor,
      stageId: this.draft().stageId ?? current.stageId,
      address: null,
    };
    return leadActions(row, this.headerStages(), this.language(), (key, params) =>
      this.transloco.translate(key, params), this.canUpdateRecord(), this.canDelete(),
    ).filter((item) => {
      if (item.id === 'open' || item.id === 'edit') return false;
      if (item.id === 'delete') return this.canDelete();
      return this.canUpdateRecord();
    });
  });

  protected readonly uploaderNameFn = computed(() => {
    const map = new Map(this.branchOwners().map((owner) => [owner.id, owner.displayName]));
    return (userId: string) => map.get(userId) ?? null;
  });

  protected readonly historyValueLabel = computed(() => {
    this.i18n();
    const lang = this.language();
    const l = this.lookups();
    const stageById = new Map((l?.allStages() ?? []).map((stage) => [stage.id, stage]));
    const sourceById = new Map((l?.sources() ?? []).map((source) => [source.id, source]));
    const ownerById = new Map(this.branchOwners().map((owner) => [owner.id, owner.displayName]));
    const none = this.transloco.translate('recordHistory.none');

    return (field: string, value: unknown): string | null => {
      if (field === 'stageId') {
        const stage = stageById.get(String(value));
        return stage ? nameIn(stage, lang) : none;
      }
      if (field === 'ownerUserId') {
        return ownerById.get(String(value)) ?? none;
      }
      if (field === 'acquisitionSourceId') {
        const source = sourceById.get(String(value));
        return source ? nameIn(source, lang) : none;
      }
      if (field === 'status') {
        const raw = String(value);
        const key = `leadPage.history.status.${raw}`;
        const translated = this.transloco.translate(key);
        if (translated && translated !== key) return translated;
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
      label: this.transloco.translate('recordPage.tabs.overview'),
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
        label: this.transloco.translate('recordPage.tabs.activities'),
        count: this.activityCount(),
      },
      {
        id: 'calls',
        icon: 'tablerPhoneCall',
        label: this.transloco.translate('recordPage.tabs.calls'),
        count: this.callsTotal(),
        alert: missed > 0 ? this.transloco.translate('recordPage.tabs.missed', { n: missed }) : null,
      },
      {
        id: 'attachments',
        icon: 'tablerPaperclip',
        label: this.transloco.translate('recordPage.tabs.attachments'),
        count: this.attachmentCount(),
      },
      {
        id: 'history',
        icon: 'tablerHistory',
        label: this.transloco.translate('recordPage.tabs.history'),
      },
    ];
  });

  protected readonly historyPartyIds = computed<string[]>(() => {
    const current = this.detail();
    if (!current || current.id !== this.leadId()) return [];
    const ids = [current.partyId, ...current.contacts.map((c) => c.partyId)].filter(Boolean);
    return Array.from(new Set(ids)).slice(0, 21);
  });

  private cameFromList = false;
  private navigatedWithinLeadPage = false;
  private initializedRoute = false;
  private backQueryParams: Params = {};
  private loadSeq = 0;
  private capSeq = 0;
  private createIdempotencyKey: string | null = null;
  private lastCreateFingerprint: string | null = null;
  private confirmingLeave = false;
  private bypassGuard = false;
  private conflictResolver: ((choice: ConflictChoice) => void) | null = null;
  private activityCountFromTab = false;
  private attachmentCountFromTab = false;
  private callsCountFromTab = false;

  constructor() {
    let previousBranch: string | null | undefined;
    effect(() => {
      const scope = sessionBranch();
      const key = scope ? `${scope.companyId}/${scope.branchId}` : null;
      const id = this.leadId();
      untracked(() => {
        if (this.mode() === 'create') {
          this.chooseBranch.set(!scope);
          this.draft.update((draft) => ({ ...draft, branchId: scope?.branchId ?? null }));
        }
        if (previousBranch !== undefined && previousBranch !== key && id) {
          this.detail.set(null);
          this.capabilities.set(null);
          void this.loadLead(id, null);
        }
        previousBranch = key;
      });
    });
    const destroyRef = inject(DestroyRef);
    const onDeleteKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      this.dismissDeleteDialog(event);
    };
    const onDeleteCancel = (event: Event) => {
      this.dismissDeleteDialog(event);
    };
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
    document.addEventListener('keydown', onDeleteKeydown, { capture: true });
    document.addEventListener('cancel', onDeleteCancel, { capture: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    destroyRef.onDestroy(() => {
      document.removeEventListener('keydown', onDeleteKeydown, { capture: true });
      document.removeEventListener('cancel', onDeleteCancel, { capture: true });
      document.removeEventListener('visibilitychange', onVisibilityChange);
      this.settleConflict('dismiss');
    });

    const nav = this.router.currentNavigation() ?? this.router.lastSuccessfulNavigation();
    const initialState = nav?.extras?.state as LeadRouteState | undefined;
    if (initialState?.cameFromList) {
      this.cameFromList = true;
      this.backQueryParams = { ...(initialState.backQueryParams ?? {}) };
    } else {
      const prevUrl = nav?.previousNavigation?.extractedUrl;
      if (prevUrl) {
        const path = '/' + prevUrl.root.children['primary']?.segments.map((s) => s.path).join('/');
        if (path === '/crm/leads') {
          this.cameFromList = true;
          this.backQueryParams = { ...prevUrl.queryParams };
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
      if (this.initializedRoute && nextId === this.leadId() && !draftKey) {
        return;
      }
      if (this.initializedRoute && nextId !== this.leadId()) {
        this.navigatedWithinLeadPage = true;
      }
      this.initializedRoute = true;
      this.leadId.set(nextId);

      const navState = this.router.currentNavigation()?.extras.state as LeadRouteState | undefined;
      if (navState?.cameFromList) {
        this.cameFromList = true;
        this.backQueryParams = { ...(navState.backQueryParams ?? {}) };
      }

      const carried = draftKey ? this.draftStore.take<LeadDraft>(draftKey, 'lead') : null;
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
      this.scopeDenied.set(false);
      this.notFound.set(false);
      this.chooseBranch.set(!sessionBranch());
      this.activityCountFromTab = false;
      this.attachmentCountFromTab = false;
      this.callsCountFromTab = false;
      this.activityCount.set(0);
      this.attachmentCount.set(0);
      this.callsTotal.set(0);
      this.callsMissed.set(0);
      this.newActivityRequest.set(0);
      this.historyRefresh.set(0);

      if (nextId && !this.chooseBranch()) {
        const matchedCarried = carried && carried.recordId === nextId ? carried : null;
        this.hasCarriedDraft.set(!!matchedCarried);
        if (matchedCarried) {
          this.nav.set(matchedCarried.nav ? { ...matchedCarried.nav, ids: [...matchedCarried.nav.ids] } : null);
        } else if (navState?.createdLead?.id === nextId || (this.nav() && !this.nav()!.ids.includes(nextId))) {
          this.nav.set(null);
        }

        if (!matchedCarried && navState?.createdLead?.id === nextId) {
          const created = navState.createdLead;
          const seq = ++this.loadSeq;
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
          void this.loadLead(nextId, matchedCarried);
        }
      } else {
        this.nav.set(null);
        this.activeTab.set('overview');
        this.detail.set(null);
        this.scopeDenied.set(false);
        this.updatedAt.set(null);
        this.loadFailed.set(false);
        this.loading.set(false);
        this.hasCarriedDraft.set(!!carried);
        const fresh = emptyDraft();
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
      if (this.mode() !== 'create' || this.hasCarriedDraft()) return;
      const d = this.draft();
      const b = this.base();
      if ((b.branchId === null && d.branchId !== null) || (b.stageId === null && d.stageId !== null)) {
        this.base.set({
          ...b,
          branchId: b.branchId ?? d.branchId,
          stageId: b.stageId ?? d.stageId,
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
        this.leadForm()?.discardContactEdit();
        this.draft.set(structuredClone(this.base()));
        this.submitted.set(false);
        this.serverErrors.set({});
        return true;
      }
      if (contactDirty) {
        const contactSaved = await (this.leadForm()?.saveEditingContact() ?? Promise.resolve(true));
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
    if (this.cameFromList && !this.navigatedWithinLeadPage) {
      this.location.back();
    } else {
      try {
        await this.router.navigate(['/crm/leads'], { queryParams: this.backQueryParams });
      } finally {
        this.bypassGuard = false;
      }
    }
  }

  protected selectTab(tab: string): void {
    const candidate = (LEAD_PAGE_TABS as readonly string[]).includes(tab) ? (tab as LeadPageTab) : 'overview';
    const resolved: LeadPageTab = this.mode() === 'create' ? 'overview' : candidate;
    const alreadyVisited = this.visited().has(resolved);
    const wasActive = this.activeTab() === resolved;
    if (resolved === 'calls' && alreadyVisited && !wasActive) {
      this.callsReload.update((v) => v + 1);
    }
    this.activeTab.set(resolved);
  }

  protected logActivity(): void {
    if (this.mode() !== 'edit' || !this.canCreateActivity()) return;
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
      case 'move':
        if (selection.value) void this.onMoveStage(selection.value);
        break;
      case 'delete':
        void this.confirmDelete();
        break;
    }
  }

  protected async stepNav(dir: -1 | 1): Promise<void> {
    const currentNav = this.nav();
    const currentId = this.leadId();
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

    let target: { id: string; nav: LeadNavContext } | null = null;
    try {
      target = await nextNavTarget(currentNav, currentId, dir);
    } catch {
      this.notify.error(this.transloco.translate('leadPage.loadFailed'));
      return;
    }
    if (!target) return;

    this.nav.set(target.nav);
    this.bypassGuard = true;
    const tabParam = this.activeTab() === 'overview' ? null : this.activeTab();
    try {
      await this.router.navigate(['/crm/leads', target.id], {
        queryParams: tabParam ? { tab: tabParam } : {},
        replaceUrl: false,
      });
    } finally {
      this.bypassGuard = false;
    }
  }

  protected onDraftChange(next: LeadDraft): void {
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

  protected onConverted(lead: LeadDetail): void {
    if (lead.id !== this.leadId()) return;
    invalidateRelatedCounts('LEAD', lead.id);
    this.retryLoad();
  }

  protected retryLoad(): void {
    const id = this.leadId();
    if (!id) return;
    this.scopeDenied.set(false);
    void this.loadLead(id, null);
  }

  protected onOpenDuplicateLead(leadId: string): void {
    if (!leadId || leadId === this.leadId()) return;
    void this.router.navigate(['/crm/leads', leadId]);
  }

  protected async save(options?: { navigateAfterCreate?: boolean }): Promise<boolean> {
    if (this.saving() || !this.canEdit() || this.loading() || this.loadFailed() || this.scopeDenied()) return false;
    if (this.lookups()?.saveBlocked()) {
      this.notify.error(this.transloco.translate('leadForm.write.catalogueDenied'));
      return false;
    }
    if (this.mode() === 'edit' && this.hasUnsavedContact()) {
      const contactSaved = await (this.leadForm()?.saveEditingContact() ?? Promise.resolve(true));
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
    if (!current || !this.canUpdateRecord() || this.instantBusy()) return;

    const prevDetail = current;
    const prevBase = this.base();
    const prevDraft = this.draft();

    this.detail.set({ ...current, rating });
    this.base.set({ ...prevBase, rating });
    this.draft.set({ ...prevDraft, rating });
    this.instantBusy.set(true);

    try {
      const saved = await updateLead(current.id, { rating }, this.updatedAt() ?? undefined);
      this.detail.set({ ...current, rating: saved.rating, cardColor: saved.cardColor, updatedAt: saved.updatedAt });
      this.updatedAt.set(saved.updatedAt);
      this.historyRefresh.update((v) => v + 1);
    } catch (error) {
      this.detail.set(prevDetail);
      this.base.set(prevBase);
      this.draft.set(prevDraft);
      await this.writes.failure(error, 'recordPage.instant.failed', { lead: current, changes: { rating } });
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
    if (!current || !this.canUpdateRecord() || this.instantBusy()) return;

    const prevDetail = current;
    const prevBase = this.base();
    const prevDraft = this.draft();

    this.detail.set({ ...current, cardColor });
    this.base.set({ ...prevBase, cardColor });
    this.draft.set({ ...prevDraft, cardColor });
    this.instantBusy.set(true);

    try {
      const saved = await updateLead(current.id, { cardColor }, this.updatedAt() ?? undefined);
      this.detail.set({ ...current, rating: saved.rating, cardColor: saved.cardColor, updatedAt: saved.updatedAt });
      this.updatedAt.set(saved.updatedAt);
      this.historyRefresh.update((v) => v + 1);
    } catch (error) {
      this.detail.set(prevDetail);
      this.base.set(prevBase);
      this.draft.set(prevDraft);
      await this.writes.failure(error, 'recordPage.instant.failed', { lead: current, changes: { cardColor } });
    } finally {
      this.instantBusy.set(false);
    }
  }

  protected async onMoveStage(stageId: string): Promise<void> {
    if (this.mode() !== 'edit') {
      this.onDraftChange({ ...this.draft(), stageId });
      return;
    }
    const current = this.detail();
    if (!current || !this.canUpdateRecord() || this.instantBusy() || current.stageId === stageId) return;

    const target = this.lookups()?.allStages().find((item) => item.id === stageId);
    const prevDetail = current;
    const prevBase = this.base();
    const prevDraft = this.draft();

    this.detail.set({
      ...current,
      stageId,
      stageFlag: target?.flag ?? current.stageFlag,
    });
    this.base.set({ ...prevBase, stageId });
    this.draft.set({ ...prevDraft, stageId });
    this.instantBusy.set(true);

    try {
      const saved = target?.flag === 'DISQUALIFIED'
        ? await this.disqualify()?.open(current, target) : await moveLead(current.id, stageId);
      if (!saved) { this.detail.set(prevDetail); this.base.set(prevBase); this.draft.set(prevDraft); return; }
      this.detail.set({
        ...current,
        stageId: saved.stageId,
        stageFlag: saved.stageFlag,
        status: saved.status,
        updatedAt: saved.updatedAt,
      });
      this.base.update((b) => ({ ...b, stageId: saved.stageId }));
      this.draft.update((d) => ({ ...d, stageId: saved.stageId }));
      this.updatedAt.set(saved.updatedAt);
      if (saved.status === 'CONVERTED') {
        invalidateRelatedCounts('LEAD', current.id);
      }
      this.historyRefresh.update((v) => v + 1);
      const stageName = target ? nameIn(target, this.language()) : '';
      this.notify.success(this.transloco.translate('leadPage.stage.done', { stage: stageName }));
    } catch (error) {
      this.detail.set(prevDetail);
      this.base.set(prevBase);
      this.draft.set(prevDraft);
      await this.writes.failure(error, 'recordPage.instant.failed');
    } finally {
      this.instantBusy.set(false);
    }
  }

  protected async confirmDelete(): Promise<void> {
    const current = this.detail();
    if (!current || !this.canDelete() || this.deleting() || this.saving()) return;
    if (!(await this.deleteDialog().open())) return;

    this.deleting.set(true);
    try {
      await deleteLead(current.id);
      this.notify.success(this.transloco.translate('leadPage.delete.done'));
      this.bypassGuard = true;
      await this.router.navigate(['/crm/leads'], { queryParams: this.backQueryParams });
    } catch (error) {
      await this.writes.failure(error, 'leads.delete.failed');
    } finally {
      this.deleting.set(false);
      this.bypassGuard = false;
    }
  }

  protected onDeleteDialogEscape(event: Event): void {
    this.dismissDeleteDialog(event);
  }

  protected onConflictChoice(choice: 'reload' | 'keep'): void {
    if (this.writes.conflictOpen()) {
      if (choice === 'reload') this.writes.reloadConflict();
      else void this.writes.keepConflict();
      return;
    }
    this.conflictOpen.set(false);
    this.settleConflict(choice);
  }

  protected onConflictOpenChange(open: boolean): void {
    if (!open) this.writes.conflictOpen.set(false);
    this.conflictOpen.set(open);
    if (!open) {
      this.settleConflict('dismiss');
    }
  }

  private dismissDeleteDialog(event: Event): void {
    const dialog = this.deleteDialogWrap()?.nativeElement.querySelector<HTMLDialogElement>('dialog');
    if (!dialog?.open) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    dialog.close();
  }

  private async refreshBranchOwners(branchId: string): Promise<void> {
    const seq = ++this.ownersSeq;
    try {
      const owners = await listBranchOwners(branchId);
      if (seq !== this.ownersSeq || this.currentBranchId() !== branchId) return;
      this.branchOwners.set(owners);
      this.loadedOwnersBranchId = branchId;
    } catch {
      // Unknown owners fall back to "—"
    }
  }

  private async loadLead(
    id: string,
    carried: { draft: LeadDraft; recordId: string | null; baseUpdatedAt: string | null } | null,
  ): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.scopeDenied.set(false);
    this.notFound.set(false);
    this.chooseBranch.set(!sessionBranch());
    this.loadReference.set('');
    try {
      const fresh = await getLead(id);
      if (seq !== this.loadSeq) return;
      const lookups = this.lookups();
      if (lookups) {
        lookups.setMode('edit');
        lookups.setBranch(fresh.branchId);
      }
      let caps: LeadsCapabilities | null = null;
      try {
        caps = await getLeadCapabilities(fresh.branchId);
        if (seq !== this.loadSeq) return;
      } catch {
        if (seq !== this.loadSeq) return;
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
      if (error instanceof ApiError && error.status === 404) { this.notFound.set(true); return; }
      if (error instanceof ApiError && error.code === 'BRANCH_REQUIRED') { this.chooseBranch.set(true); return; }
      this.loadReference.set(error instanceof ApiError ? error.correlationId ?? '' : '');
      if (error instanceof ApiError && (error.status === 403 || error.code === 'CRM_SCOPED_PERMISSION_DENIED')) {
        this.scopeDenied.set(true);
        return;
      }
      this.loadFailed.set(true);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private async loadInitialTabCounts(lead: LeadDetail, seq: number): Promise<void> {
    const [openResult, attachmentResult, callsResult] = await Promise.allSettled([
      this.activitiesApi.listActivities({
        targetApp: 'CRM',
        targetType: 'LEAD',
        targetId: lead.id,
        statuses: ['PLANNED', 'IN_PROGRESS'],
        page: 1,
        limit: 1,
      }),
      countRecordAttachments('LEAD', lead.branchId, lead.id),
      getPartyCallsSummary({ partyType: 'LEAD', partyId: lead.id }),
    ]);
    if (seq !== this.loadSeq || this.leadId() !== lead.id) return;
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
    if (!branchId) {
      this.capabilities.set(null);
      return;
    }
    try {
      const caps = await getLeadCapabilities(branchId);
      if (seq === this.capSeq) {
        this.capabilities.set(caps);
      }
    } catch {
      if (seq === this.capSeq) {
        this.capabilities.set(null);
      }
    }
  }

  private async saveCreate(navigateAfterCreate = true): Promise<boolean> {
    this.submitted.set(true);
    this.serverErrors.set({});
    const validation = validateDraft(this.draft(), 'create', this.lookups()?.customFields() ?? []);
    if (Object.keys(validation).length > 0) {
      this.selectTab('overview');
      afterNextRender(() => this.leadForm()?.scrollToFirstError(), { injector: this.injector });
      return false;
    }

    const body: CreateLeadBody = toCreateBody(this.draft());
    const fingerprint = JSON.stringify(body);
    if (fingerprint !== this.lastCreateFingerprint || !this.createIdempotencyKey) {
      this.createIdempotencyKey = newIdempotencyKey();
      this.lastCreateFingerprint = fingerprint;
    }

    this.saving.set(true);
    try {
      const created = await createLead(body, this.createIdempotencyKey);
      this.createIdempotencyKey = null;
      this.lastCreateFingerprint = null;
      const mapped = draftFromDetail(created);
      this.detail.set(created);
      this.base.set(mapped);
      this.draft.set(structuredClone(mapped));
      this.updatedAt.set(created.updatedAt);
      this.submitted.set(false);
      this.formRevision.update((v) => v + 1);
      this.notify.success(this.transloco.translate('leadPage.created', { name: created.displayName }));
      if (navigateAfterCreate) {
        this.bypassGuard = true;
        await this.router.navigate(['/crm/leads', created.id], {
          replaceUrl: true,
          state: {
            createdLead: created,
            cameFromList: this.cameFromList,
            backQueryParams: this.backQueryParams,
          } satisfies LeadRouteState,
        });
      }
      return true;
    } catch (error) {
      if (!(error instanceof ApiError && (error.status === 401 || error.status === 0 || error.status >= 500 || error.code === 'GW.IDEM.IN_FLIGHT'))) {
        this.createIdempotencyKey = null;
        this.lastCreateFingerprint = null;
      }
      this.handleSaveError(error);
      return false;
    } finally {
      this.saving.set(false);
      this.bypassGuard = false;
    }
  }

  private async saveEdit(): Promise<boolean> {
    const current = this.detail();
    const expectedUpdatedAt = this.updatedAt();
    if (!current || !expectedUpdatedAt) return false;

    this.submitted.set(true);
    this.serverErrors.set({});
    const validation = validateDraft(this.draft(), 'edit', this.lookups()?.customFields() ?? []);
    if (Object.keys(validation).length > 0) {
      this.selectTab('overview');
      afterNextRender(() => this.leadForm()?.scrollToFirstError(), { injector: this.injector });
      return false;
    }

    const prevPartyId = current.partyId;
    const prevStatus = current.status;
    const pendingTagIds = [...this.draft().tagIds];
    this.saving.set(true);
    try {
      const result = await saveLeadChanges({ ...current, updatedAt: expectedUpdatedAt }, this.base(), this.draft());
      const updated = result.lead;
      const mapped = draftFromDetail(updated);
      this.detail.set(updated);
      this.base.set(mapped);
      this.draft.set(structuredClone(mapped));
      this.updatedAt.set(updated.updatedAt);
      this.submitted.set(false);
      if (updated.partyId !== prevPartyId || updated.status !== prevStatus) {
        invalidateRelatedCounts('LEAD', updated.id);
      }
      this.historyRefresh.update((v) => v + 1);
      if (result.tagError) {
        this.draft.update((draft) => ({ ...draft, tagIds: pendingTagIds }));
        this.handleTagSaveError(result.tagError);
      } else this.notify.success(this.transloco.translate('recordPage.saved'));
      return true;
    } catch (error) {
      if (error instanceof LeadContactSaveError) {
        await this.handlePartialContacts(error);
        return false;
      }
      if (error instanceof ApiError && error.code === 'CRM.LEAD.CONCURRENT_UPDATE') {
        this.saving.set(false);
        return await this.handleConflict(current.id);
      }
      this.handleSaveError(error);
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  private async handleConflict(leadId: string): Promise<boolean> {
    const choice = await this.openConflictDialog();
    if (choice === 'dismiss') return false;
    try {
      const fresh = await getLead(leadId);
      const freshDraft = draftFromDetail(fresh);
      if (choice === 'reload') {
        this.detail.set(fresh);
        this.base.set(freshDraft);
        this.draft.set(structuredClone(freshDraft));
        this.updatedAt.set(fresh.updatedAt);
        this.serverErrors.set({});
        this.formRevision.update((value) => value + 1);
      } else {
        this.detail.set(fresh);
        this.updatedAt.set(fresh.updatedAt);
      }
      if (fresh.status === 'CONVERTED') this.writes.readOnly.set(true);
    } catch (error) { this.handleSaveError(error); }
    return false;
  }

  protected async onSaveContacts(nextContacts: ContactDraft[], editIndex?: number): Promise<DraftErrors | null> {
    const current = this.detail();
    const expectedUpdatedAt = this.updatedAt();
    if (!current || !expectedUpdatedAt || !this.canEdit() || this.saving() || this.deleting()) {
      return {};
    }

    const contactDraft = { ...this.base(), contacts: nextContacts };
    this.instantBusy.set(true);
    try {
      const { lead: updated } = await saveLeadChanges({ ...current, updatedAt: expectedUpdatedAt }, this.base(), contactDraft);
      if (this.detail()?.id !== current.id) return {};
      const oldBase = this.base();
      const userDraft = this.draft();
      const freshBase = draftFromDetail(updated);
      const rebased = rebaseDraft(oldBase, freshBase, userDraft);
      rebased.contacts = freshBase.contacts.map((c) => ({ ...c, phones: [...c.phones] }));
      this.detail.set(updated);
      this.base.set(freshBase);
      this.draft.set(rebased);
      this.updatedAt.set(updated.updatedAt);
      if (updated.contacts.map((c) => c.partyId).join(',') !== current.contacts.map((c) => c.partyId).join(',')) {
        invalidateRelatedCounts('LEAD', updated.id);
      }
      this.historyRefresh.update((v) => v + 1);
      return null;
    } catch (error) {
      if (error instanceof LeadContactSaveError) {
        await this.handlePartialContacts(error, contactDraft);
        return leadServerError(this.transloco, error.error, contactDraft,
          this.lookups()?.customFields() ?? [], editIndex).errors;
      }
      this.handleSaveError(error);
      return leadServerError(this.transloco, error, contactDraft,
        this.lookups()?.customFields() ?? [], editIndex).errors;
    } finally {
      this.instantBusy.set(false);
    }
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

  private handleSaveError(error: unknown): void {
    const mapped = leadServerError(this.transloco, error, this.draft(), this.lookups()?.customFields() ?? []);
    this.serverErrors.set(mapped.errors);
    if (mapped.readOnly) this.writes.readOnly.set(true);
    if (mapped.notFound) this.notFound.set(true);
    if (Object.keys(mapped.errors).length) {
      this.selectTab('overview');
      afterNextRender(() => this.leadForm()?.focusFirstError(), { injector: this.injector });
    }
    this.notify.error(mapped.message);
  }

  private showServerErrorToast(error: unknown): void { this.handleSaveError(error); }

  private handleTagSaveError(error: unknown): void {
    const mapped = leadServerError(this.transloco, error, this.draft());
    if (mapped.readOnly) this.writes.readOnly.set(true);
    this.notify.error(this.transloco.translate('leadForm.write.tagsFailed'), mapped.message);
  }

  private async handlePartialContacts(error: LeadContactSaveError, contactDraft?: LeadDraft): Promise<void> {
    const pending = contactDraft ? { ...this.draft(), contacts: error.remaining.contacts } : error.remaining;
    if (error.fresh) {
      this.detail.set(error.fresh);
      this.updatedAt.set(error.fresh.updatedAt);
      this.base.set(draftFromDetail(error.fresh));
    } else {
      // No safe token is available; a reload is required before another save.
      this.writes.readOnly.set(true);
    }
    this.draft.set(pending);
    this.formRevision.update((value) => value + 1);
    const mapped = leadServerError(this.transloco, error.error, pending, this.lookups()?.customFields() ?? []);
    this.serverErrors.set(mapped.errors);
    if (mapped.readOnly) this.writes.readOnly.set(true);
    const saved = error.saved.map((item) => this.transloco.translate(`leadForm.write.contactOperation.${item.op}`, { name: item.name })).join('; ');
    this.notify.error(this.transloco.translate('leadForm.write.contactsStopped'),
      this.transloco.translate('leadForm.write.contactsSaved', { saved: saved || this.transloco.translate('leadForm.write.noneSaved') }) + ' ' + mapped.message);
    if (mapped.conflict) {
      this.saving.set(false);
      this.instantBusy.set(false);
      await this.handleConflict(error.fresh?.id ?? this.leadId()!);
    }
  }

  private formatDateTime(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const locale = `${this.language()}-u-nu-latn`;
    const dateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    const timeFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    return `${dateFmt.format(date)} · ${timeFmt.format(date)}`;
  }
}
