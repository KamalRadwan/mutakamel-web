import { Component, DestroyRef, Injector, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAdjustmentsHorizontal,
  tablerArrowLeft,
  tablerCheck,
  tablerChecklist,
  tablerCloudOff,
  tablerFileSettings,
  tablerLayoutList,
  tablerLayoutRows,
  tablerPlus,
  tablerRefresh,
  tablerSend,
  tablerShieldCheck,
  tablerUser,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { DateField } from '../../../../shared/ui/date-time/date-field';
import { TimeField } from '../../../../shared/ui/date-time/time-field';
import { Field } from '../../../../shared/ui/field/field';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Modal } from '../../../../shared/ui/modal/modal';
import { type TabItem, Tabs, tabButtonId, tabPanelId } from '../../../../shared/ui/tabs/tabs';
import { type TradeContext, errorCodeOf, newIdempotencyKey, tradeContext } from '../../shared/trade-api';
import {
  PROFILE_PERMISSIONS,
  hasProfileReadGrant,
  hasProfileScopeGrant,
  isActivePointerStaleError,
  isEffectiveOverlapError,
  isForbiddenError,
  isPublicationUnavailableError,
  profileActorDisplayName,
  resolveProfileErrorMessage,
} from '../document-profiles-page/profile-access';
import { ConflictDialog } from '../governance-shared/conflict-dialog/conflict-dialog';
import { type LifecycleStep, LifecycleStepper } from '../governance-shared/lifecycle-stepper/lifecycle-stepper';
import { VersionStatusBadge } from '../governance-shared/version-status-badge/version-status-badge';
import type { ScopeTarget } from '../policy.model';
import { formatDateOnly, rangeText } from '../pricing.service';
import { ProfileCases } from '../profile-cases/profile-cases';
import { type ProfileContentTab, ProfileContentEditor } from '../profile-content-editor/profile-content-editor';
import {
  createVersion,
  getProfile,
  getRegistry,
  getVersion,
  publishVersion,
  validateVersion,
} from '../profiles.api';
import type {
  DocumentProfile,
  ProfileContent,
  ProfileEvidenceConfig,
  ProfileRequiredCase,
  ProfileRequiredCaseInput,
  ProfileValidationRun,
  ProfileVersionDetail,
  ProfileVersionStatus,
} from '../profiles.model';
import {
  type ProfileFamilyRegistry,
  type ProfileRegistry,
  defaultProfileContent,
} from '../profiles.registry';

export type ProfileVersionTab = ProfileContentTab | 'cases';
const VALID_TABS: readonly ProfileVersionTab[] = ['fields', 'layout', 'behaviour', 'evidence', 'cases'];

const PARAM_TO_SCOPE: Readonly<Record<string, ScopeTarget>> = {
  tenant: 'TENANT',
  company: 'COMPANY',
  branch: 'BRANCH',
};

function parseScopeParam(raw: string | null): ScopeTarget {
  if (!raw) return 'COMPANY';
  return PARAM_TO_SCOPE[raw.trim().toLowerCase()] ?? 'COMPANY';
}

function parseTabParam(raw: string | null): ProfileVersionTab {
  if (raw && (VALID_TABS as readonly string[]).includes(raw)) {
    return raw as ProfileVersionTab;
  }
  return 'fields';
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function localTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function isoToLocalParts(iso: string | null | undefined): { date: string; time: string } | null {
  if (!iso || !iso.trim()) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    date: `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`,
    time: `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`,
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

function normalizeContentForFamily(raw: ProfileContent, family: ProfileFamilyRegistry): ProfileContent {
  const fieldByCode = new Map(raw.fields.map((f) => [f.code, f]));
  const compByCode = new Map(raw.components.map((c) => [c.code, c]));
  const evByCode = new Map(raw.evidence.map((e) => [e.code, e]));

  const fields = family.fields.map((def) => {
    const existing = fieldByCode.get(def.code);
    const visible = def.familyRequired ? true : (existing?.visible ?? def.defaultVisible);
    const required = def.familyRequired
      ? true
      : def.serverOwned
        ? false
        : visible && (existing?.required ?? def.defaultRequired);
    return { code: def.code, visible, required };
  });

  const components = family.components
    .map((def) => {
      const existing = compByCode.get(def.code);
      return {
        code: def.code,
        order: existing?.order ?? def.defaultOrder,
        visible: def.mandatory ? true : (existing?.visible ?? def.defaultVisible),
      };
    })
    .sort((a, b) => a.order - b.order)
    .map((item, idx) => ({ ...item, order: (idx + 1) * 10 }));

  const modes: Record<string, string | boolean> = {};
  for (const modeDef of family.modes) {
    const existingVal = raw.modes?.[modeDef.key];
    if (modeDef.locked || existingVal === undefined) {
      modes[modeDef.key] = modeDef.defaultValue;
    } else if (modeDef.kind === 'boolean') {
      modes[modeDef.key] = Boolean(existingVal);
    } else {
      modes[modeDef.key] = modeDef.allowedValues.includes(String(existingVal))
        ? String(existingVal)
        : modeDef.defaultValue;
    }
  }

  // G-9: only included evidence items are sent, and only with { code, required }.
  const evidence: ProfileEvidenceConfig[] = [];
  for (const def of family.evidence) {
    const existing = evByCode.get(def.code);
    const include = existing ? existing.include !== false : false;
    if (!include) continue;
    evidence.push({
      code: def.code,
      required: Boolean(existing?.required),
    });
  }

  return { fields, components, modes, evidence };
}

/**
 * The author's cases of a stored version, in the shape a new version takes. Server cases are left out (the
 * backend adds them again). The expected outcome is read by comparing the stored expected hash with the
 * hashes of the server cases whose outcome is known (MINIMAL_VALID valid, MISSING_REQUIRED_REJECTED invalid).
 */
function authorCases(
  stored: readonly ProfileRequiredCase[],
  family: ProfileFamilyRegistry | null,
): ProfileRequiredCaseInput[] {
  const serverCodes = new Set(family?.systemCases.map((c) => c.code) ?? []);
  const validHash = stored.find((c) => c.code === 'MINIMAL_VALID')?.expectedHash;
  return stored
    .filter((c) => !serverCodes.has(c.code))
    .map((c) => ({ code: c.code, input: { ...c.input }, expectedValid: c.expectedHash === validHash }));
}

@Component({
  selector: 'app-profile-version-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    ConfirmDialog,
    DateField,
    Field,
    FullState,
    Modal,
    Tabs,
    TimeField,
    ConflictDialog,
    LifecycleStepper,
    ProfileCases,
    ProfileContentEditor,
    VersionStatusBadge,
  ],
  providers: [
    provideTranslocoScope({ scope: 'trade-governance', alias: 'governance' }, { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-gov-profiles', alias: 'profiles' }),
    provideIcons({
      tablerArrowLeft,
      tablerFileSettings,
      tablerCheck,
      tablerSend,
      tablerPlus,
      tablerCloudOff,
      tablerRefresh,
      tablerLayoutList,
      tablerLayoutRows,
      tablerAdjustmentsHorizontal,
      tablerShieldCheck,
      tablerChecklist,
      tablerUser,
      tablerX,
    }),
  ],
  templateUrl: './profile-version-page.html',
  host: {
    class: 'flex flex-1 shrink-0 flex-col gap-8 p-12',
    '(window:beforeunload)': 'onBeforeUnload($event)',
  },
})
export class ProfileVersionPage {
  private static nextId = 0;
  protected readonly uid = `gov-profile-ver-${++ProfileVersionPage.nextId}`;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly scopeState = inject(ScopeState);
  private readonly tenantScope = inject(TenantScopeState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly lang = inject(LanguageState).current;

  private readonly publishModal = viewChild.required<Modal>('publishModal');
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');
  private readonly conflictDialog = viewChild.required(ConflictDialog);

  protected readonly tabButtonId = tabButtonId;
  protected readonly tabPanelId = tabPanelId;

  protected readonly profileId = signal('');
  protected readonly versionId = signal('');
  protected readonly scopeParam = signal<ScopeTarget>('COMPANY');
  protected readonly activeTab = signal<ProfileVersionTab>('fields');

  protected readonly registry = signal<ProfileRegistry | null>(null);
  protected readonly profile = signal<DocumentProfile | null>(null);
  protected readonly versionDetail = signal<ProfileVersionDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly forbidden = signal(false);
  protected readonly publicationUnavailable = signal(false);
  protected readonly conflictMode = signal<'versionStale' | 'pointerStale'>('versionStale');

  protected readonly serverEffectiveFromError = signal<string | null>(null);
  protected readonly serverModeErrors = signal<Readonly<Record<string, string>>>({});

  protected readonly effectiveScopeTarget = computed<ScopeTarget>(
    () => this.versionDetail()?.profile.scopeTarget ?? this.profile()?.scopeTarget ?? this.scopeParam(),
  );
  protected readonly ctx = computed<TradeContext>(() =>
    tradeContext(this.scopeState, this.effectiveScopeTarget()),
  );
  protected readonly canRead = computed(() => hasProfileReadGrant(this.injector));
  protected readonly isForbidden = computed(() => !this.canRead() || this.forbidden());
  protected readonly canManage = computed(
    () =>
      !this.isForbidden() &&
      hasProfileScopeGrant(
        this.injector,
        this.scopeState,
        PROFILE_PERMISSIONS.manage,
        this.effectiveScopeTarget(),
      ),
  );
  protected readonly canValidate = computed(
    () =>
      !this.isForbidden() &&
      hasProfileScopeGrant(
        this.injector,
        this.scopeState,
        PROFILE_PERMISSIONS.validate,
        this.effectiveScopeTarget(),
      ),
  );
  protected readonly canPublish = computed(
    () =>
      !this.isForbidden() &&
      hasProfileScopeGrant(
        this.injector,
        this.scopeState,
        PROFILE_PERMISSIONS.publish,
        this.effectiveScopeTarget(),
      ),
  );
  protected readonly currentUserId = computed(() => this.tenantScope.me()?.id ?? '');

  // New-version create state (`versionId === 'new'`)
  protected readonly draftContent = signal<ProfileContent | null>(null);
  protected readonly draftCases = signal<ProfileRequiredCaseInput[]>([]);
  protected readonly fromDate = signal<string | null>(null);
  protected readonly fromTime = signal<string | null>(null);
  protected readonly toDate = signal<string | null>(null);
  protected readonly toTime = signal<string | null>(null);
  protected readonly createSubmitted = signal(false);
  protected readonly saving = signal(false);

  // Action state on created versions
  protected readonly validating = signal(false);
  protected readonly publishing = signal(false);

  private initialNewFingerprint = '';
  private loadSeq = 0;
  private lastCreateFingerprint = '';
  private lastCreateIdempotencyKey = '';
  private lastPublishFingerprint = '';
  private lastPublishIdempotencyKey = '';
  private pendingRefetch: Promise<boolean> | null = null;

  protected readonly isNewMode = computed(() => this.versionId() === 'new');
  protected readonly isReadonly = computed(() => !this.isNewMode() || !this.canManage());

  protected readonly documentType = computed(
    () => this.versionDetail()?.profile.documentType ?? this.profile()?.documentType ?? null,
  );

  protected readonly family = computed<ProfileFamilyRegistry | null>(() => {
    const reg = this.registry();
    const type = this.documentType();
    return reg && type ? reg.families[type] : null;
  });

  protected readonly currentStatus = computed<ProfileVersionStatus>(() =>
    this.isNewMode() ? 'DRAFT' : (this.versionDetail()?.status ?? 'DRAFT'),
  );

  protected readonly stepperCurrent = computed<string>(() => {
    const status = this.currentStatus();
    if (status === 'TESTED') return 'tested';
    if (status === 'SCHEDULED' || status === 'PUBLISHED') return 'live';
    if (status === 'SUPERSEDED') return 'replaced';
    return 'draft';
  });

  protected readonly lifecycleSteps = computed<LifecycleStep[]>(() => {
    this.i18n();
    return [
      { key: 'draft', label: this.transloco.translate('profiles.stepper.draft') },
      { key: 'tested', label: this.transloco.translate('profiles.stepper.tested') },
      { key: 'live', label: this.transloco.translate('profiles.stepper.publishedOrScheduled') },
      { key: 'replaced', label: this.transloco.translate('profiles.stepper.replaced') },
    ];
  });

  protected readonly activeContent = computed<ProfileContent | null>(() =>
    this.isNewMode() ? this.draftContent() : (this.versionDetail()?.content ?? null),
  );

  protected readonly activeCases = computed<ProfileRequiredCaseInput[]>(() =>
    this.isNewMode()
      ? this.draftCases()
      : authorCases(this.versionDetail()?.requiredCases ?? [], this.family()),
  );

  protected readonly latestValidationRun = computed<ProfileValidationRun | null>(() =>
    this.isNewMode() ? null : (this.versionDetail()?.latestValidationRun ?? null),
  );

  protected readonly contentTab = computed<ProfileContentTab>(() => {
    const t = this.activeTab();
    return t === 'cases' ? 'fields' : t;
  });

  protected readonly tabs = computed<TabItem[]>(() => {
    this.i18n();
    const fam = this.family();
    const casesCount = fam ? fam.systemCases.length + this.activeCases().length : null;
    return [
      {
        id: 'fields',
        label: this.transloco.translate('profiles.tabs.fields'),
        icon: 'tablerLayoutList',
        count: fam ? fam.fields.length : null,
      },
      {
        id: 'layout',
        label: this.transloco.translate('profiles.tabs.layout'),
        icon: 'tablerLayoutRows',
        count: fam ? fam.components.length : null,
      },
      {
        id: 'behaviour',
        label: this.transloco.translate('profiles.tabs.behaviour'),
        icon: 'tablerAdjustmentsHorizontal',
      },
      {
        id: 'evidence',
        label: this.transloco.translate('profiles.tabs.evidence'),
        icon: 'tablerShieldCheck',
      },
      {
        id: 'cases',
        label: this.transloco.translate('profiles.tabs.cases'),
        icon: 'tablerChecklist',
        count: casesCount,
      },
    ];
  });

  protected readonly headerCode = computed(
    () => this.versionDetail()?.profile.code ?? this.profile()?.code ?? '',
  );

  protected readonly headerScope = computed(
    () => this.effectiveScopeTarget(),
  );

  protected readonly headerSubtitle = computed(() => {
    this.i18n();
    const language = this.lang();
    const scopeText = this.transloco.translate(`governance.scope.${this.headerScope()}`);

    if (this.isNewMode()) {
      const fromIso = localPartsToUtcIso(this.fromDate(), this.fromTime());
      if (!fromIso) return scopeText;
      const dateLabel = formatDateOnly(fromIso, language);
      const goLive = this.transloco.translate('profiles.version.goesLive', { date: dateLabel });
      return `${scopeText} · ${goLive}`;
    }

    const ver = this.versionDetail();
    if (!ver) return scopeText;
    const fromLabel = formatDateOnly(ver.effectiveFrom, language);
    if (ver.status === 'PUBLISHED') {
      const liveText = this.transloco.translate('profiles.version.liveSince', { date: fromLabel });
      return `${scopeText} · ${liveText}`;
    }
    if (ver.status === 'SUPERSEDED') {
      const range = rangeText(ver.effectiveFrom, ver.supersededAt ?? ver.effectiveTo, language);
      const replacedText = this.transloco.translate('profiles.version.replacedRange', { range });
      return `${scopeText} · ${replacedText}`;
    }
    const goLive = this.transloco.translate('profiles.version.goesLive', { date: fromLabel });
    return `${scopeText} · ${goLive}`;
  });

  protected readonly isSelfAuthor = computed(() => {
    const ver = this.versionDetail();
    const actor = this.currentUserId();
    if (!ver || !actor) return false;
    return ver.authorUserId === actor;
  });

  protected readonly liveVersionNumber = computed<number | null>(() => {
    const p = this.profile();
    const ver = this.versionDetail();
    const liveId = ver?.profile.currentPublishedVersionId ?? p?.currentPublishedVersionId ?? null;
    if (!p || !liveId) return null;
    return p.versions.find((item) => item.id === liveId)?.profileVersion ?? null;
  });

  protected readonly publishScheduled = computed(() => {
    const ver = this.versionDetail();
    if (!ver) return false;
    return Date.parse(ver.effectiveFrom) > Date.now();
  });

  protected readonly publishBodyText = computed(() => {
    this.i18n();
    const ver = this.versionDetail();
    if (!ver) return '';
    const liveNum = this.liveVersionNumber();
    const date = formatDateOnly(ver.effectiveFrom, this.lang());
    if (this.publishScheduled()) {
      return liveNum !== null
        ? this.transloco.translate('profiles.publishModal.scheduledWithLive', { date, live: liveNum })
        : this.transloco.translate('profiles.publishModal.scheduledNoLive', { date });
    }
    return liveNum !== null
      ? this.transloco.translate('profiles.publishModal.liveWithLive', { live: liveNum })
      : this.transloco.translate('profiles.publishModal.liveNoLive');
  });

  protected readonly publishAuthorText = computed(() => {
    this.i18n();
    const ver = this.versionDetail();
    if (!ver) return '';
    const author = profileActorDisplayName(ver.authorUserId, this.tenantScope.me());
    return this.transloco.translate('profiles.publishModal.makerCheckerAuthor', { author });
  });

  protected readonly fromError = computed<string | null>(() => {
    this.i18n();
    const server = this.serverEffectiveFromError();
    if (server) return server;
    if (!this.createSubmitted()) return null;
    if (!this.fromDate() || !this.fromTime()) {
      return this.transloco.translate('profiles.version.dateRequired');
    }
    if (!localPartsToUtcIso(this.fromDate(), this.fromTime())) {
      return this.transloco.translate('profiles.version.invalidDate');
    }
    return null;
  });

  protected readonly toError = computed<string | null>(() => {
    this.i18n();
    if (!this.createSubmitted()) return null;
    const td = this.toDate();
    const tt = this.toTime();
    if (!td && !tt) return null;
    const toIso = localPartsToUtcIso(td, tt);
    if (!toIso) {
      return this.transloco.translate('profiles.version.invalidDate');
    }
    const fromIso = localPartsToUtcIso(this.fromDate(), this.fromTime());
    if (fromIso && Date.parse(toIso) <= Date.parse(fromIso)) {
      return this.transloco.translate('profiles.version.endAfterStart');
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

  protected readonly hasEnd = computed(() => Boolean(this.toDate() || this.toTime()));

  protected readonly newDirty = computed(() => {
    if (!this.isNewMode() || !this.draftContent()) return false;
    return this.newSnapshotFingerprint() !== this.initialNewFingerprint;
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((query) => {
      const nextScope = parseScopeParam(query.get('scope'));
      if (nextScope !== this.scopeParam()) {
        this.scopeParam.set(nextScope);
      }
      const nextTab = parseTabParam(query.get('tab'));
      if (nextTab !== this.activeTab()) {
        this.activeTab.set(nextTab);
      }
    });

    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const pId = params.get('id') ?? '';
      const vId = params.get('versionId') ?? '';
      if (!pId || !vId) return;
      if (pId === this.profileId() && vId === this.versionId() && (this.profile() || this.versionDetail())) {
        return;
      }
      this.profileId.set(pId);
      this.versionId.set(vId);
      void this.load(pId, vId);
    });

    inject(DestroyRef).onDestroy(() => {
      this.loadSeq += 1;
    });
  }

  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.isNewMode() && this.newDirty() && !this.saving()) {
      event.preventDefault();
    }
  }

  protected goHome(): void {
    void this.router.navigate(['/']);
  }

  protected retryFromUnavailable(): void {
    this.publicationUnavailable.set(false);
    this.reload();
  }

  protected async goBack(): Promise<void> {
    if (this.isNewMode() && this.newDirty()) {
      const discard = await this.discardDialog().open();
      if (!discard) return;
    }
    const pId = this.profileId();
    const scope = this.effectiveScopeTarget() === 'TENANT' ? 'tenant' : undefined;
    if (pId) {
      void this.router.navigate(['/trade/governance/document-profiles', pId], {
        ...(scope ? { queryParams: { scope } } : {}),
      });
    } else {
      void this.router.navigate(['/trade/governance/document-profiles'], {
        ...(scope ? { queryParams: { scope } } : {}),
      });
    }
  }

  protected reload(): void {
    const pId = this.profileId();
    const vId = this.versionId();
    if (pId && vId && this.canRead()) {
      this.forbidden.set(false);
      this.publicationUnavailable.set(false);
      void this.load(pId, vId);
    }
  }

  protected onTabChange(next: string): void {
    const resolved = parseTabParam(next);
    if (resolved === this.activeTab()) return;
    this.activeTab.set(resolved);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: resolved === 'fields' ? null : resolved },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected onContentChange(nextContent: ProfileContent): void {
    if (this.isReadonly()) return;
    if (Object.keys(this.serverModeErrors()).length > 0) {
      this.serverModeErrors.set({});
    }
    this.draftContent.set(nextContent);
  }

  protected onCasesChange(nextCases: ProfileRequiredCaseInput[]): void {
    if (this.isReadonly()) return;
    this.draftCases.set(nextCases);
  }

  protected onFromDateChange(nextDate: string | null): void {
    this.serverEffectiveFromError.set(null);
    this.fromDate.set(nextDate);
  }

  protected onFromTimeChange(nextTime: string | null): void {
    this.serverEffectiveFromError.set(null);
    this.fromTime.set(nextTime);
  }

  protected onToDateChange(nextDate: string | null): void {
    this.serverEffectiveFromError.set(null);
    this.toDate.set(nextDate);
    if (nextDate && !this.toTime()) {
      this.toTime.set('23:59');
    } else if (!nextDate) {
      this.toTime.set(null);
    }
  }

  protected onToTimeChange(nextTime: string | null): void {
    this.serverEffectiveFromError.set(null);
    this.toTime.set(nextTime);
    if (nextTime && !this.toDate()) {
      this.toDate.set(this.fromDate() ?? localTodayStr());
    } else if (!nextTime) {
      this.toDate.set(null);
    }
  }

  protected clearEnd(): void {
    this.serverEffectiveFromError.set(null);
    this.toDate.set(null);
    this.toTime.set(null);
  }

  protected async submitCreateVersion(): Promise<void> {
    const p = this.profile();
    const fam = this.family();
    const content = this.draftContent();
    if (!this.isNewMode() || !this.canManage() || !p || !fam || !content || this.saving()) return;

    this.serverEffectiveFromError.set(null);
    this.serverModeErrors.set({});
    this.createSubmitted.set(true);
    const fromIso = localPartsToUtcIso(this.fromDate(), this.fromTime());
    if (!fromIso) return;

    let toIso: string | null = null;
    if (this.hasEnd()) {
      toIso = localPartsToUtcIso(this.toDate(), this.toTime());
      if (!toIso || Date.parse(toIso) <= Date.parse(fromIso)) return;
    }

    const normalized = normalizeContentForFamily(content, fam);
    const cases = this.draftCases();
    const body = {
      content: normalized,
      requiredCases: cases,
      effectiveFrom: fromIso,
      effectiveTo: toIso,
    };

    const fingerprint = `${p.id}:${p.version}:${JSON.stringify(body)}`;
    if (fingerprint !== this.lastCreateFingerprint || !this.lastCreateIdempotencyKey) {
      this.lastCreateFingerprint = fingerprint;
      this.lastCreateIdempotencyKey = newIdempotencyKey();
    }

    this.saving.set(true);
    try {
      const created = await createVersion(p.id, body, p.version, this.lastCreateIdempotencyKey, this.ctx());
      this.lastCreateFingerprint = '';
      this.lastCreateIdempotencyKey = '';
      this.notify.success(
        this.transloco.translate('profiles.toasts.versionCreated', { n: created.profileVersion }),
      );
      const scope = this.effectiveScopeTarget() === 'TENANT' ? 'tenant' : undefined;
      void this.router.navigate(['/trade/governance/document-profiles', p.id, 'versions', created.id], {
        ...(scope ? { queryParams: { scope } } : {}),
        replaceUrl: true,
      });
    } catch (error) {
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
        return;
      }
      if (isPublicationUnavailableError(error)) {
        this.publicationUnavailable.set(true);
        return;
      }
      const code = errorCodeOf(error);
      if (code === 'TRADE.DOCUMENT_PROFILE.CONFIRMATION_MODE_UNSUPPORTED') {
        this.serverModeErrors.set({
          confirmationMode: this.transloco.translate('profiles.errors.confirmationModeUnsupported'),
        });
        this.onTabChange('behaviour');
      } else if (isEffectiveOverlapError(error)) {
        this.serverEffectiveFromError.set(this.transloco.translate('profiles.errors.effectiveOverlap'));
      } else if (code === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.conflictMode.set('versionStale');
        this.conflictDialog().open();
      } else if (code === 'TRADE.DOCUMENT_PROFILE.COMPATIBILITY_CHANGED') {
        this.notify.error(resolveProfileErrorMessage(this.transloco, error));
        void this.reload();
      } else {
        this.notify.error(resolveProfileErrorMessage(this.transloco, error));
      }
    } finally {
      this.saving.set(false);
    }
  }

  protected async runValidate(): Promise<void> {
    const ver = this.versionDetail();
    if (this.isNewMode() || !ver || ver.status !== 'DRAFT' || !this.canValidate() || this.validating()) return;

    this.serverModeErrors.set({});
    this.validating.set(true);
    try {
      const result = await validateVersion(ver.id, ver.version, newIdempotencyKey(), this.ctx());
      if (result.passed) {
        this.notify.success(this.transloco.translate('profiles.toasts.validated'));
        await this.load(ver.profile.id, ver.id);
      } else {
        await this.load(ver.profile.id, ver.id);
        const failedCount = result.results.filter((r) => !r.passed).length;
        const msg =
          failedCount === 1
            ? this.transloco.translate('profiles.toasts.validationFailedOne')
            : this.transloco.translate('profiles.toasts.validationFailed', { count: failedCount });
        this.notify.warning(msg);
        this.onTabChange('cases');
      }
    } catch (error) {
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
        return;
      }
      if (isPublicationUnavailableError(error)) {
        this.publicationUnavailable.set(true);
        return;
      }
      const code = errorCodeOf(error);
      if (code === 'TRADE.DOCUMENT_PROFILE.CONFIRMATION_MODE_UNSUPPORTED') {
        this.serverModeErrors.set({
          confirmationMode: this.transloco.translate('profiles.errors.confirmationModeUnsupported'),
        });
        this.onTabChange('behaviour');
      } else if (code === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.conflictMode.set('versionStale');
        this.conflictDialog().open();
      } else if (code === 'TRADE.DOCUMENT_PROFILE.COMPATIBILITY_CHANGED') {
        this.notify.error(resolveProfileErrorMessage(this.transloco, error));
        void this.reload();
      } else {
        this.notify.error(resolveProfileErrorMessage(this.transloco, error));
      }
    } finally {
      this.validating.set(false);
    }
  }

  protected openPublishModal(): void {
    const ver = this.versionDetail();
    if (this.isNewMode() || !ver || ver.status !== 'TESTED' || !this.canPublish() || this.isSelfAuthor()) {
      return;
    }
    this.publishing.set(false);
    this.lastPublishFingerprint = '';
    this.lastPublishIdempotencyKey = '';
    this.publishModal().open();
  }

  protected closePublishModal(): void {
    if (this.publishing()) return;
    this.publishModal().close();
  }

  protected async confirmPublish(): Promise<void> {
    const ver = this.versionDetail();
    if (!ver || this.publishing() || !this.canPublish()) return;

    const pointerVersion = this.profile()?.pointerVersion ?? ver.profile.pointerVersion;
    const fingerprint = `${ver.id}:${ver.version}:${pointerVersion}`;
    if (fingerprint !== this.lastPublishFingerprint || !this.lastPublishIdempotencyKey) {
      this.lastPublishFingerprint = fingerprint;
      this.lastPublishIdempotencyKey = newIdempotencyKey();
    }

    this.publishing.set(true);
    try {
      const updated = await publishVersion(
        ver.id,
        pointerVersion,
        ver.version,
        this.lastPublishIdempotencyKey,
        this.ctx(),
      );
      this.lastPublishFingerprint = '';
      this.lastPublishIdempotencyKey = '';
      this.publishModal().close();
      const toastKey = updated.status === 'SCHEDULED' ? 'profiles.toasts.scheduled' : 'profiles.toasts.published';
      this.notify.success(this.transloco.translate(toastKey, { n: updated.profileVersion }));
      await this.load(ver.profile.id, ver.id);
    } catch (error) {
      this.publishModal().close();
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
        return;
      }
      if (isPublicationUnavailableError(error)) {
        this.publicationUnavailable.set(true);
        return;
      }
      if (isActivePointerStaleError(error)) {
        // Active-pointer stale: show conflict, refetch profile + version, require user confirmation before resending.
        this.lastPublishFingerprint = '';
        this.lastPublishIdempotencyKey = '';
        this.conflictMode.set('pointerStale');
        this.conflictDialog().open();
        this.pendingRefetch = this.refetchVersionQuietly(ver.profile.id, ver.id);
        return;
      }
      const code = errorCodeOf(error);
      if (code === 'TRADE.DOCUMENT_PROFILE.CONFIRMATION_MODE_UNSUPPORTED') {
        this.serverModeErrors.set({
          confirmationMode: this.transloco.translate('profiles.errors.confirmationModeUnsupported'),
        });
        this.onTabChange('behaviour');
      } else if (code === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.lastPublishFingerprint = '';
        this.lastPublishIdempotencyKey = '';
        this.conflictMode.set('versionStale');
        this.conflictDialog().open();
      } else if (code === 'TRADE.DOCUMENT_PROFILE.COMPATIBILITY_CHANGED') {
        this.notify.error(resolveProfileErrorMessage(this.transloco, error));
        void this.reload();
      } else if (isEffectiveOverlapError(error)) {
        this.notify.error(this.transloco.translate('profiles.errors.effectiveOverlap'));
      } else {
        this.notify.error(resolveProfileErrorMessage(this.transloco, error));
      }
    } finally {
      this.publishing.set(false);
    }
  }

  protected async onConflictReload(): Promise<void> {
    if (this.conflictMode() === 'pointerStale') {
      this.conflictMode.set('versionStale');
      let refreshed = false;
      if (this.pendingRefetch) {
        refreshed = await this.pendingRefetch;
        this.pendingRefetch = null;
      } else {
        const pId = this.profileId();
        const vId = this.versionId();
        if (pId && vId) {
          refreshed = await this.refetchVersionQuietly(pId, vId);
        }
      }
      if (!refreshed) return;
      const ver = this.versionDetail();
      if (!this.isNewMode() && ver && ver.status === 'TESTED' && this.canPublish() && !this.isSelfAuthor()) {
        this.openPublishModal();
      }
      return;
    }
    this.reload();
  }

  protected onConflictKeep(): void {
    this.conflictMode.set('versionStale');
  }

  private async refetchVersionQuietly(profileId: string, versionId: string): Promise<boolean> {
    const seq = ++this.loadSeq;
    const ctx = this.ctx();
    try {
      const [detail, profile] = await Promise.all([
        getVersion(versionId, ctx),
        getProfile(profileId, ctx),
      ]);
      if (seq !== this.loadSeq) return false;
      this.versionDetail.set(detail);
      this.profile.set(profile);
      return true;
    } catch (error) {
      if (seq !== this.loadSeq) return false;
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
      } else if (isPublicationUnavailableError(error)) {
        this.publicationUnavailable.set(true);
      } else {
        this.notify.error(resolveProfileErrorMessage(this.transloco, error));
      }
      return false;
    }
  }

  private async load(profileId: string, versionId: string): Promise<void> {
    if (!this.canRead()) {
      this.loading.set(false);
      return;
    }
    const seq = ++this.loadSeq;
    const ctx = this.ctx();
    this.loading.set(true);
    this.loadFailed.set(false);
    this.versionDetail.set(null);
    this.draftContent.set(null);
    this.draftCases.set([]);

    try {
      if (versionId === 'new') {
        const fromId = this.route.snapshot.queryParamMap.get('from')?.trim() || null;
        const [reg, profile, sourceVersion] = await Promise.all([
          getRegistry(ctx),
          getProfile(profileId, ctx),
          fromId ? getVersion(fromId, ctx).catch(() => null) : Promise.resolve(null),
        ]);
        if (seq !== this.loadSeq) return;

        this.registry.set(reg);
        this.profile.set(profile);
        this.versionDetail.set(null);

        const fam = reg.families[profile.documentType];
        const fromSameProfile = Boolean(sourceVersion && sourceVersion.profile.id === profile.id);
        const rawContent =
          fromSameProfile && sourceVersion?.content
            ? sourceVersion.content
            : defaultProfileContent(profile.documentType, fam);
        const normalized = normalizeContentForFamily(rawContent, fam);
        const cases = fromSameProfile && sourceVersion ? authorCases(sourceVersion.requiredCases, fam) : [];

        const qpFrom = isoToLocalParts(this.route.snapshot.queryParamMap.get('effectiveFrom'));
        const qpTo = isoToLocalParts(this.route.snapshot.queryParamMap.get('effectiveTo'));

        this.draftContent.set(normalized);
        this.draftCases.set(cases);
        this.fromDate.set(qpFrom?.date ?? localTodayStr());
        this.fromTime.set(qpFrom?.time ?? '00:00');
        this.toDate.set(qpTo?.date ?? null);
        this.toTime.set(qpTo?.time ?? null);
        this.serverEffectiveFromError.set(null);
        this.serverModeErrors.set({});
        this.createSubmitted.set(false);
        this.initialNewFingerprint = this.newSnapshotFingerprint();
      } else {
        const [reg, detail, profile] = await Promise.all([
          getRegistry(ctx),
          getVersion(versionId, ctx),
          getProfile(profileId, ctx).catch(() => null),
        ]);
        if (seq !== this.loadSeq) return;

        this.registry.set(reg);
        this.profile.set(profile);
        this.versionDetail.set(detail);
        this.draftContent.set(null);
        this.draftCases.set([]);
        this.serverModeErrors.set({});
      }
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (isForbiddenError(error)) {
        this.forbidden.set(true);
        return;
      }
      if (isPublicationUnavailableError(error)) {
        this.publicationUnavailable.set(true);
        return;
      }
      this.loadFailed.set(true);
      this.notify.error(resolveProfileErrorMessage(this.transloco, error));
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private newSnapshotFingerprint(): string {
    return JSON.stringify({
      content: this.draftContent(),
      cases: this.draftCases(),
      fromDate: this.fromDate(),
      fromTime: this.fromTime(),
      toDate: this.toDate(),
      toTime: this.toTime(),
    });
  }
}
