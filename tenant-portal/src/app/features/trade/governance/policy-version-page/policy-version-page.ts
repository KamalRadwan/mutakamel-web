import {
  Component,
  type ElementRef,
  Injector,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerArrowBackUp,
  tablerArrowLeft,
  tablerArrowRight,
  tablerCheck,
  tablerCircleCheck,
  tablerCircleOff,
  tablerDeviceFloppy,
  tablerFlask,
  tablerHistory,
  tablerInfoCircle,
  tablerLock,
  tablerSend,
  tablerShieldCheck,
  tablerTrash,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { type ActionItem, type ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { DateField } from '../../../../shared/ui/date-time/date-field';
import { TimeField } from '../../../../shared/ui/date-time/time-field';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Modal } from '../../../../shared/ui/modal/modal';
import { UnsavedDialog } from '../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { ApiError, errorCodeOf, newIdempotencyKey } from '../../shared/trade-api';
import { ConflictDialog } from '../governance-shared/conflict-dialog/conflict-dialog';
import { LifecycleStepper } from '../governance-shared/lifecycle-stepper/lifecycle-stepper';
import {
  ReasonDialog,
  type ReasonDialogResult,
} from '../governance-shared/reason-dialog/reason-dialog';
import { VersionStatusBadge } from '../governance-shared/version-status-badge/version-status-badge';
import { GovernedReview } from '../governed-review/governed-review';
import { PolicyTests } from '../policy-tests/policy-tests';
import { deleteVersion, getDefinition, getMetadata, getVersion, runAction, updateVersion } from '../policy.api';
import { isPolicyVersionDetail } from '../policy.model';
import type {
  GovernedDefinition,
  GovernedValidateResult,
  GovernedVersionDetail,
  GovernedVersionRecord,
  PolicyContent,
  PolicyMetadata,
  PolicyTestCase,
  PolicyTestResult,
} from '../policy.model';
import { POLICY_PERMISSIONS, hasPolicyGrant, operatingTradeContext } from '../policy.registry';
import { formatDateTime, isForbiddenError, rangeText } from '../pricing.service';
import { RuleBuilder, validatePolicyContentClient } from '../rule-builder/rule-builder';

type TabKey = 'rules' | 'tests' | 'review';
const TABS: readonly TabKey[] = ['rules', 'tests', 'review'];

const EMPTY_CONTENT: PolicyContent = {
  rules: [],
  defaultOutcome: 'ALLOW',
};

function isoToLocalParts(iso: string | null | undefined): { date: string | null; time: string | null } {
  if (!iso) return { date: null, time: null };
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return { date: null, time: null };
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
    time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
  };
}

function localPartsToIso(date: string | null, time: string | null): string | null {
  if (!date) return null;
  const dateParts = date.split('-').map(Number);
  if (dateParts.length !== 3 || dateParts.some((n) => !Number.isInteger(n))) return null;
  const [y, m, d] = dateParts;
  const timeParts = (time ?? '00:00').split(':').map(Number);
  const hh = Number.isInteger(timeParts[0]) ? timeParts[0] : 0;
  const mm = Number.isInteger(timeParts[1]) ? timeParts[1] : 0;
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

@Component({
  selector: 'app-policy-version-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Button,
    ConflictDialog,
    ConfirmDialog,
    DateField,
    Dropdown,
    Field,
    FullState,
    GovernedReview,
    LifecycleStepper,
    Modal,
    PolicyTests,
    ReasonDialog,
    RuleBuilder,
    TimeField,
    UnsavedDialog,
    VersionStatusBadge,
  ],
  providers: [
    provideIcons({
      tablerAlertTriangle,
      tablerArrowBackUp,
      tablerArrowLeft,
      tablerArrowRight,
      tablerCheck,
      tablerCircleCheck,
      tablerCircleOff,
      tablerDeviceFloppy,
      tablerFlask,
      tablerHistory,
      tablerInfoCircle,
      tablerLock,
      tablerSend,
      tablerShieldCheck,
      tablerTrash,
      tablerX,
    }),
    provideTranslocoScope({ scope: 'trade-governance', alias: 'governance' }, { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-gov-policy', alias: 'policy' }),
  ],
  templateUrl: './policy-version-page.html',
  host: {
    class: 'flex min-h-full flex-col gap-12 p-12',
    '(window:beforeunload)': 'onBeforeUnload($event)',
  },
})
export class PolicyVersionPage {
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly lang = inject(LanguageState).current;
  private readonly notify = inject(Notify);
  private readonly scopeState = inject(ScopeState);
  private readonly tenantScope = inject(TenantScopeState);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly unsavedDialog = viewChild.required(UnsavedDialog);
  private readonly conflictDialog = viewChild.required(ConflictDialog);
  private readonly deleteConfirmDialog = viewChild<ConfirmDialog>('deleteConfirmDialog');
  private readonly rejectDialog = viewChild<ReasonDialog>('rejectDialog');
  private readonly retireDialog = viewChild<ReasonDialog>('retireDialog');
  private readonly rollbackDialog = viewChild<ReasonDialog>('rollbackDialog');
  private readonly publishModal = viewChild<Modal>('publishModal');
  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabBtn');

  protected readonly canRead = computed(() =>
    hasPolicyGrant(this.injector, this.scopeState, POLICY_PERMISSIONS.read),
  );
  protected readonly canManage = computed(() =>
    hasPolicyGrant(this.injector, this.scopeState, POLICY_PERMISSIONS.manage),
  );
  protected readonly canTest = computed(() =>
    hasPolicyGrant(this.injector, this.scopeState, POLICY_PERMISSIONS.test),
  );
  protected readonly canApprove = computed(() =>
    hasPolicyGrant(this.injector, this.scopeState, POLICY_PERMISSIONS.approve),
  );
  protected readonly canPublish = computed(() =>
    hasPolicyGrant(this.injector, this.scopeState, POLICY_PERMISSIONS.publish),
  );
  protected readonly tradeCtx = computed(() => operatingTradeContext(this.tenantScope));

  private readonly paramMap = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  protected readonly definitionId = computed(() => this.paramMap().get('id') ?? '');
  protected readonly versionId = computed(() => this.paramMap().get('versionId') ?? '');

  protected readonly actor = computed(() => this.tenantScope.me()?.id ?? '');
  protected readonly detail = signal<GovernedVersionDetail<PolicyContent, PolicyTestCase> | null>(null);
  protected readonly definition = signal<GovernedDefinition | null>(null);
  protected readonly metadata = signal<PolicyMetadata | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly forbidden = signal(false);

  protected readonly draftContent = signal<PolicyContent>(structuredClone(EMPTY_CONTENT));
  protected readonly draftTests = signal<PolicyTestCase[]>([]);
  protected readonly effFromDate = signal<string | null>(null);
  protected readonly effFromTime = signal<string | null>(null);
  protected readonly effToDate = signal<string | null>(null);
  protected readonly effToTime = signal<string | null>(null);
  private readonly savedSnapshot = signal('');

  protected readonly saving = signal(false);
  protected readonly busyAction = signal<string | null>(null);
  protected readonly showClientErrors = signal(false);
  protected readonly diagnostics = signal<Readonly<Record<string, string>>>({});
  protected readonly lastTestResult = signal<PolicyTestResult | null>(null);
  protected readonly testError = signal<string | null>(null);
  protected readonly expandRuleRequest = signal<{ index: number; seq: number } | null>(null);
  private expandSeq = 0;

  protected readonly activeTab = signal<TabKey>('rules');
  protected readonly visitedTabs = signal<ReadonlySet<TabKey>>(new Set(['rules']));
  protected readonly replacesVersionId = signal<string>('');
  private skipDirtyGuard = false;

  protected readonly editable = computed(() => {
    const status = this.detail()?.status;
    return this.canManage() && (status === 'DRAFT' || status === 'REJECTED');
  });

  protected readonly isDraftLike = computed(() => {
    const status = this.detail()?.status;
    return status === 'DRAFT' || status === 'REJECTED';
  });

  protected readonly dirty = computed(() => {
    if (!this.detail() || !this.editable()) return false;
    return this.currentSnapshot() !== this.savedSnapshot();
  });

  protected readonly validatedCurrent = computed(() => {
    const d = this.detail();
    if (!d || this.dirty()) return false;
    return Boolean(d.evidence?.validation?.passed && d.evidence.validation.contentHash === d.contentHash);
  });

  protected readonly factsList = computed(() => this.metadata()?.facts ?? []);
  protected readonly factsByKindMap = computed(() => this.metadata()?.factsByKind ?? {});

  protected readonly subtitleText = computed(() => {
    this.i18n();
    const d = this.detail();
    if (!d) return '';
    const kind = this.transloco.translate(`policy.kinds.${d.definition.kind}.name`);
    const scope = this.transloco.translate(`governance.scope.${d.definition.scopeTarget}`);
    return this.transloco.translate('policy.version.subtitle', { kind, scope });
  });

  protected readonly readonlyNotice = computed<string | null>(() => {
    this.i18n();
    const d = this.detail();
    if (!d || this.editable()) return null;
    const statusLabel = this.transloco.translate(`governance.status.policy.${d.status}`);
    return this.transloco.translate('policy.rules.readonlyNotice', { status: statusLabel });
  });

  protected readonly effFromError = computed<string | null>(() => {
    this.i18n();
    if (!this.editable() || !this.showClientErrors()) return null;
    if (!localPartsToIso(this.effFromDate(), this.effFromTime())) {
      return this.transloco.translate('policy.version.effectiveFromInvalid');
    }
    return null;
  });

  protected readonly effToError = computed<string | null>(() => {
    this.i18n();
    if (!this.editable() || !this.showClientErrors()) return null;
    const toDate = this.effToDate();
    if (!toDate) return null;
    const toIso = localPartsToIso(toDate, this.effToTime());
    if (!toIso) {
      return this.transloco.translate('policy.version.effectiveToInvalid');
    }
    const fromIso = localPartsToIso(this.effFromDate(), this.effFromTime());
    if (fromIso && new Date(toIso).getTime() <= new Date(fromIso).getTime()) {
      return this.transloco.translate('policy.version.effectiveToBeforeFrom');
    }
    return null;
  });

  protected readonly rulesHaveErrors = computed(() => {
    if (Object.keys(this.diagnostics()).length > 0) return true;
    if (
      this.showClientErrors() &&
      Object.keys(validatePolicyContentClient(this.draftContent(), this.factsList())).length > 0
    ) {
      return true;
    }
    return false;
  });

  protected readonly lifecycleSteps = computed(() => {
    this.i18n();
    const keys = ['DRAFT', 'VALIDATED', 'TESTED', 'IN_REVIEW', 'APPROVED', 'PUBLISHED'] as const;
    return keys.map((key) => ({
      key,
      label: this.transloco.translate(`policy.version.steps.${key}`),
    }));
  });

  protected readonly stepperState = computed<{ current: string; failedKey: string | null }>(() => {
    const d = this.detail();
    if (!d) return { current: 'DRAFT', failedKey: null };
    switch (d.status) {
      case 'REJECTED':
        return { current: 'IN_REVIEW', failedKey: 'IN_REVIEW' };
      case 'PUBLISHED':
      case 'RETIRED':
      case 'SUPERSEDED':
        return { current: 'PUBLISHED', failedKey: null };
      case 'APPROVED':
      case 'SCHEDULED':
        return { current: 'APPROVED', failedKey: null };
      case 'APPROVAL_PENDING':
        return { current: 'IN_REVIEW', failedKey: null };
      case 'TESTED':
        return { current: 'TESTED', failedKey: null };
      default:
        return {
          current: this.validatedCurrent() ? 'VALIDATED' : 'DRAFT',
          failedKey: null,
        };
    }
  });

  protected readonly approveDisabledByMakerChecker = computed(() => {
    const d = this.detail();
    const me = this.actor();
    return !!d && Boolean(me) && (d.createdBy === me || d.submittedBy === me);
  });

  protected readonly publishDisabledByMakerChecker = computed(() => {
    const d = this.detail();
    const me = this.actor();
    return !!d && Boolean(me) && d.createdBy === me;
  });

  protected readonly moreActions = computed<ActionItem[]>(() => {
    this.i18n();
    const d = this.detail();
    if (!d) return [];
    const items: ActionItem[] = [];
    const busy = this.busyAction() !== null || this.saving();

    const neverPublished =
      d.status !== 'PUBLISHED' &&
      !d.actions.some((a) => a.action === 'PUBLISH');

    if (this.canManage() && (d.status === 'DRAFT' || d.status === 'REJECTED') && neverPublished) {
      items.push({
        id: 'delete',
        title: this.transloco.translate('policy.version.deleteDraft'),
        icon: 'tablerTrash',
        tile: 'bg-icon-red',
        danger: true,
        disabled: busy,
      });
    }

    if (this.canPublish() && (d.status === 'PUBLISHED' || d.status === 'SCHEDULED')) {
      items.push({
        id: 'retire',
        title: this.transloco.translate('policy.version.retire'),
        icon: 'tablerCircleOff',
        tile: 'bg-icon-red',
        danger: true,
        disabled: busy,
      });
    }

    if (
      this.canPublish() &&
      (d.status === 'PUBLISHED' || d.status === 'RETIRED' || d.status === 'SUPERSEDED')
    ) {
      items.push({
        id: 'rollback',
        title: this.transloco.translate('policy.version.rollback'),
        icon: 'tablerArrowBackUp',
        tile: 'bg-icon-teal',
        disabled: busy,
      });
    }

    return items;
  });

  protected readonly effectiveFromDisplay = computed(() => {
    const d = this.detail();
    return d ? formatDateTime(d.effectiveFrom, this.lang()) : '—';
  });

  protected readonly effectiveToDisplay = computed(() => {
    this.i18n();
    const d = this.detail();
    if (!d) return '—';
    return d.effectiveTo
      ? formatDateTime(d.effectiveTo, this.lang())
      : this.transloco.translate('policy.version.noEnd');
  });

  protected readonly isPublishScheduled = computed(() => {
    const d = this.detail();
    if (!d) return false;
    return new Date(d.effectiveFrom).getTime() > Date.now();
  });

  protected readonly publishConfirmText = computed(() => {
    this.i18n();
    const d = this.detail();
    if (!d) return '';
    if (this.isPublishScheduled()) {
      return this.transloco.translate('policy.version.publishDialog.scheduleText', {
        date: formatDateTime(d.effectiveFrom, this.lang()),
      });
    }
    return this.transloco.translate('policy.version.publishDialog.nowText');
  });

  /** Live or scheduled versions that start before this one and are not already replaced. */
  private readonly supersedeCandidates = computed(() => {
    const def = this.definition();
    const d = this.detail();
    if (!def || !d) return [];
    const startMs = Date.parse(d.effectiveFrom);
    // supersedeGovernedVersion: an immediate publish cuts at now, a scheduled one at its start.
    const immediate = startMs <= Date.now();
    const cutoffMs = immediate ? Date.now() : startMs;
    return def.versions
      .filter(
        (v) =>
          v.id !== d.id &&
          (v.status === 'PUBLISHED' || v.status === 'SCHEDULED') &&
          !v.supersededAt &&
          !Number.isNaN(startMs) &&
          Date.parse(v.effectiveFrom) < startMs &&
          Date.parse(v.effectiveFrom) < cutoffMs &&
          (immediate || !v.effectiveTo || Date.parse(v.effectiveTo) >= cutoffMs),
      )
      .sort((a, b) => b.versionNumber - a.versionNumber);
  });

  protected readonly replacesOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const def = this.definition();
    const d = this.detail();
    const currentLang = this.lang();
    const opts: DropdownOption<string>[] = [
      { value: '', label: this.transloco.translate('policy.version.publishDialog.replacesNone') },
    ];
    if (!def || !d) return opts;

    const candidates = this.supersedeCandidates();

    for (const v of candidates) {
      opts.push({
        value: v.id,
        label: this.transloco.translate('policy.version.publishDialog.replacesOption', {
          n: v.versionNumber,
          range: rangeText(v.effectiveFrom, v.supersededAt ?? v.effectiveTo, currentLang),
        }),
      });
    }
    return opts;
  });

  constructor() {
    effect(() => {
      const defId = this.definitionId();
      const verId = this.versionId();
      if (defId && verId) {
        this.lastTestResult.set(null);
        this.testError.set(null);
        this.diagnostics.set({});
        this.showClientErrors.set(false);
        this.activeTab.set('rules');
        this.visitedTabs.set(new Set(['rules']));
        void this.reload();
      }
    });
  }

  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.skipDirtyGuard && this.dirty()) {
      event.preventDefault();
    }
  }

  async canDeactivate(): Promise<boolean> {
    if (this.skipDirtyGuard || !this.dirty()) return true;
    const choice = await this.unsavedDialog().open();
    if (choice === 'cancel') return false;
    if (choice === 'discard') return true;
    return this.saveDraft();
  }

  protected async reload(): Promise<void> {
    const defId = this.definitionId();
    const verId = this.versionId();
    if (!defId || !verId) return;
    if (!this.canRead()) {
      this.forbidden.set(true);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.loadFailed.set(false);
    this.forbidden.set(false);
    const ctx = this.tradeCtx();
    try {
      const [verAny, def, meta] = await Promise.all([
        getVersion('policy', verId, ctx),
        getDefinition('policy', defId, ctx),
        this.metadata() ? Promise.resolve(this.metadata()!) : getMetadata(ctx),
      ]);
      if (!isPolicyVersionDetail(verAny)) throw new Error('Not a policy version');
      const ver = verAny;
      this.detail.set(ver);
      this.definition.set(def);
      this.metadata.set(meta);
      this.seedDraftFromDetail(ver);
    } catch (err) {
      if (isForbiddenError(err)) {
        this.forbidden.set(true);
        return;
      }
      this.loadFailed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  protected async goBack(): Promise<void> {
    const ok = await this.canDeactivate();
    if (!ok) return;
    this.skipDirtyGuard = true;
    void this.router.navigate(['/trade/governance/policy-studio', this.definitionId()]);
  }

  protected selectTab(tab: TabKey): void {
    this.activeTab.set(tab);
    if (!this.visitedTabs().has(tab)) {
      this.visitedTabs.update((set) => new Set([...set, tab]));
    }
  }

  protected onTabKeydown(idx: number, event: KeyboardEvent): void {
    const isRtl = this.lang() === 'ar';
    let nextIdx: number | null = null;
    if (event.key === 'ArrowRight') {
      nextIdx = isRtl ? (idx - 1 + TABS.length) % TABS.length : (idx + 1) % TABS.length;
    } else if (event.key === 'ArrowLeft') {
      nextIdx = isRtl ? (idx + 1) % TABS.length : (idx - 1 + TABS.length) % TABS.length;
    } else if (event.key === 'Home') {
      nextIdx = 0;
    } else if (event.key === 'End') {
      nextIdx = TABS.length - 1;
    }
    if (nextIdx === null) return;
    event.preventDefault();
    this.selectTab(TABS[nextIdx]);
    queueMicrotask(() => {
      this.tabButtons()[nextIdx]?.nativeElement.focus();
    });
  }

  protected onDraftContentChange(next: PolicyContent): void {
    this.draftContent.set(next);
    if (Object.keys(this.diagnostics()).length > 0) {
      this.diagnostics.set({});
    }
    this.testError.set(null);
  }

  protected onDraftTestsChange(next: PolicyTestCase[]): void {
    this.draftTests.set(next);
    this.testError.set(null);
  }

  protected onEffFromDateChange(date: string | null): void {
    this.effFromDate.set(date);
    if (date && !this.effFromTime()) {
      this.effFromTime.set('00:00');
    } else if (!date) {
      this.effFromTime.set(null);
    }
  }

  protected onEffFromTimeChange(time: string | null): void {
    this.effFromTime.set(time);
  }

  protected onEffToDateChange(date: string | null): void {
    this.effToDate.set(date);
    if (date && !this.effToTime()) {
      this.effToTime.set('00:00');
    } else if (!date) {
      this.effToTime.set(null);
    }
  }

  protected onEffToTimeChange(time: string | null): void {
    this.effToTime.set(time);
  }

  protected clearEffectiveTo(): void {
    this.effToDate.set(null);
    this.effToTime.set(null);
  }

  protected undoChanges(): void {
    const d = this.detail();
    if (!d) return;
    this.seedDraftFromDetail(d);
    this.showClientErrors.set(false);
    this.diagnostics.set({});
  }

  protected async saveDraft(): Promise<boolean> {
    const d = this.detail();
    if (!d || !this.editable() || this.saving()) return false;

    this.showClientErrors.set(true);
    const contentErrors = validatePolicyContentClient(this.draftContent(), this.factsList());
    const fromIso = localPartsToIso(this.effFromDate(), this.effFromTime());
    const toDate = this.effToDate();
    const toIso = toDate ? localPartsToIso(toDate, this.effToTime()) : null;

    const dateInvalid =
      !fromIso ||
      (toDate !== null && !toIso) ||
      (toIso !== null && new Date(toIso).getTime() <= new Date(fromIso).getTime());

    if (Object.keys(contentErrors).length > 0 || dateInvalid) {
      this.notify.warning(this.transloco.translate('policy.version.toasts.saveInvalid'));
      const firstRuleErr = Object.keys(contentErrors).find((k) => k.startsWith('rules['));
      if (firstRuleErr) {
        const match = /^rules\[(\d+)\]/.exec(firstRuleErr);
        if (match) this.focusRuleError(Number(match[1]));
      }
      return false;
    }

    this.saving.set(true);
    const ctx = this.tradeCtx();
    try {
      const saved = (await updateVersion(
        'policy',
        d.id,
        {
          content: this.draftContent(),
          testCases: this.draftTests(),
          effectiveFrom: fromIso,
          effectiveTo: toIso,
        },
        d.version,
        newIdempotencyKey(),
        ctx,
      )) as GovernedVersionRecord;
      const updated = (await getVersion('policy', saved.id, ctx)) as GovernedVersionDetail<PolicyContent, PolicyTestCase>;
      this.detail.set(updated);
      this.seedDraftFromDetail(updated);
      this.showClientErrors.set(false);
      this.diagnostics.set({});
      this.testError.set(null);
      this.notify.success(this.transloco.translate('policy.version.toasts.saved'));
      await this.refreshDefinitionQuietly();
      return true;
    } catch (err) {
      this.handleMutationError(err);
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  protected async runValidate(): Promise<void> {
    const d = this.detail();
    if (!d || !this.canTest() || this.busyAction()) return;
    if (this.dirty()) {
      this.notify.warning(this.transloco.translate('policy.version.toasts.saveFirst'));
      return;
    }

    this.busyAction.set('validate');
    try {
      const res = (await runAction(
        'policy',
        d.id,
        'validate',
        undefined,
        d.version,
        newIdempotencyKey(),
        this.tradeCtx(),
      )) as GovernedValidateResult;

      if (res.passed) {
        this.diagnostics.set({});
        this.showClientErrors.set(false);
        this.notify.success(this.transloco.translate('policy.version.toasts.validPassed'));
        await this.reloadAfterAction();
      } else {
        const mapped: Record<string, string> = {};
        let firstRuleIdx: number | null = null;
        for (const diag of res.diagnostics) {
          mapped[diag.path] = this.translateDiagnostic(diag.code, diag.reason);
          if (firstRuleIdx === null) {
            const match = /^rules\[(\d+)\]/.exec(diag.path);
            if (match) firstRuleIdx = Number(match[1]);
          }
        }
        this.diagnostics.set(mapped);
        if (firstRuleIdx !== null) {
          this.focusRuleError(firstRuleIdx);
        } else if (res.diagnostics.length > 0) {
          this.selectTab('rules');
        }
        const count = res.diagnostics.length;
        this.notify.error(
          count === 1
            ? this.transloco.translate('policy.version.toasts.validFailedOne')
            : this.transloco.translate('policy.version.toasts.validFailed', { count }),
        );
        await this.reloadAfterAction();
      }
    } catch (err) {
      this.handleMutationError(err);
    } finally {
      this.busyAction.set(null);
    }
  }

  protected async runTestsAction(): Promise<void> {
    const d = this.detail();
    if (!d || !this.canTest() || this.busyAction()) return;
    if (this.dirty()) {
      this.notify.warning(this.transloco.translate('policy.version.toasts.saveFirst'));
      return;
    }

    this.busyAction.set('test');
    this.testError.set(null);
    try {
      const res = (await runAction(
        'policy',
        d.id,
        'test',
        undefined,
        d.version,
        newIdempotencyKey(),
        this.tradeCtx(),
      )) as PolicyTestResult;
      this.lastTestResult.set(res);
      this.selectTab('tests');
      if (res.passed) {
        this.notify.success(this.transloco.translate('policy.version.toasts.testsPassed'));
      } else {
        this.notify.error(this.transloco.translate('policy.version.toasts.testsFailed'));
      }
      await this.reloadAfterAction();
    } catch (err) {
      if (err instanceof ApiError && errorCodeOf(err) === 'TRADE.POLICY.TEST_FAILED') {
        const key = 'governance.errors.TRADE_POLICY_TEST_FAILED';
        const translated = this.transloco.translate(key);
        this.testError.set(
          translated !== key ? translated : this.transloco.translate('policy.version.toasts.testsFailed'),
        );
        this.selectTab('tests');
        return;
      }
      this.handleMutationError(err);
    } finally {
      this.busyAction.set(null);
    }
  }

  protected async runSubmit(): Promise<void> {
    const d = this.detail();
    if (!d || !this.canManage() || this.busyAction()) return;
    this.busyAction.set('submit');
    const ctx = this.tradeCtx();
    try {
      const saved = (await runAction(
        'policy',
        d.id,
        'submit',
        undefined,
        d.version,
        newIdempotencyKey(),
        ctx,
      )) as GovernedVersionRecord;
      const updated = (await getVersion('policy', saved.id, ctx)) as GovernedVersionDetail<PolicyContent, PolicyTestCase>;
      this.detail.set(updated);
      this.seedDraftFromDetail(updated);
      this.notify.success(this.transloco.translate('policy.version.toasts.submitted'));
      await this.refreshDefinitionQuietly();
    } catch (err) {
      this.handleMutationError(err);
    } finally {
      this.busyAction.set(null);
    }
  }

  protected async runApprove(): Promise<void> {
    const d = this.detail();
    if (!d || !this.canApprove() || this.approveDisabledByMakerChecker() || this.busyAction()) return;
    this.busyAction.set('approve');
    const ctx = this.tradeCtx();
    try {
      const saved = (await runAction(
        'policy',
        d.id,
        'approve',
        undefined,
        d.version,
        newIdempotencyKey(),
        ctx,
      )) as GovernedVersionRecord;
      const updated = (await getVersion('policy', saved.id, ctx)) as GovernedVersionDetail<PolicyContent, PolicyTestCase>;
      this.detail.set(updated);
      this.seedDraftFromDetail(updated);
      this.notify.success(this.transloco.translate('policy.version.toasts.approved'));
      await this.refreshDefinitionQuietly();
    } catch (err) {
      this.handleMutationError(err);
    } finally {
      this.busyAction.set(null);
    }
  }

  protected openRejectDialog(): void {
    if (!this.canApprove() || this.approveDisabledByMakerChecker() || this.busyAction()) return;
    void this.rejectDialog()?.open();
  }

  protected async confirmReject(result: ReasonDialogResult): Promise<void> {
    const d = this.detail();
    if (!d || !this.canApprove() || this.busyAction()) return;
    this.busyAction.set('reject');
    const ctx = this.tradeCtx();
    try {
      const saved = (await runAction(
        'policy',
        d.id,
        'reject',
        { reasonCode: result.reasonCode, reasonNote: result.reasonNote || undefined },
        d.version,
        newIdempotencyKey(),
        ctx,
      )) as GovernedVersionRecord;
      const updated = (await getVersion('policy', saved.id, ctx)) as GovernedVersionDetail<PolicyContent, PolicyTestCase>;
      this.rejectDialog()?.close();
      this.detail.set(updated);
      this.seedDraftFromDetail(updated);
      this.notify.success(this.transloco.translate('policy.version.toasts.rejected'));
      await this.refreshDefinitionQuietly();
    } catch (err) {
      this.handleMutationError(err);
    } finally {
      this.busyAction.set(null);
    }
  }

  protected openPublishDialog(): void {
    const d = this.detail();
    if (!d || !this.canPublish() || this.publishDisabledByMakerChecker() || this.busyAction()) return;
    const live = this.supersedeCandidates().find((v) => v.status === 'PUBLISHED');
    this.replacesVersionId.set(live?.id ?? '');
    this.publishModal()?.open();
  }

  protected async confirmPublish(): Promise<void> {
    const d = this.detail();
    if (!d || !this.canPublish() || this.busyAction()) return;
    this.busyAction.set('publish');
    const ctx = this.tradeCtx();
    try {
      const saved = (await runAction(
        'policy',
        d.id,
        'publish',
        { supersedesVersionId: this.replacesVersionId() || undefined },
        d.version,
        newIdempotencyKey(),
        ctx,
      )) as GovernedVersionRecord;
      const updated = (await getVersion('policy', saved.id, ctx)) as GovernedVersionDetail<PolicyContent, PolicyTestCase>;
      this.publishModal()?.close();
      this.detail.set(updated);
      this.seedDraftFromDetail(updated);
      this.notify.success(
        this.transloco.translate(
          updated.status === 'SCHEDULED'
            ? 'policy.version.toasts.scheduled'
            : 'policy.version.toasts.published',
        ),
      );
      await this.refreshDefinitionQuietly();
    } catch (err) {
      this.handleMutationError(err);
    } finally {
      this.busyAction.set(null);
    }
  }

  protected onMoreAction(selection: ActionSelection): void {
    if (selection.id === 'delete') {
      void this.handleDeleteDraft();
    } else if (selection.id === 'retire') {
      void this.retireDialog()?.open();
    } else if (selection.id === 'rollback') {
      void this.rollbackDialog()?.open();
    }
  }

  private async handleDeleteDraft(): Promise<void> {
    const d = this.detail();
    if (!d || !this.canManage() || this.busyAction()) return;
    const ok = await this.deleteConfirmDialog()?.open();
    if (!ok) return;

    this.busyAction.set('delete');
    try {
      await deleteVersion('policy', d.id, d.version, newIdempotencyKey(), this.tradeCtx());
      this.notify.success(this.transloco.translate('policy.version.toasts.deleted'));
      this.skipDirtyGuard = true;
      void this.router.navigate(['/trade/governance/policy-studio', d.definition.id]);
    } catch (err) {
      this.handleMutationError(err);
    } finally {
      this.busyAction.set(null);
    }
  }

  protected async confirmRetire(result: ReasonDialogResult): Promise<void> {
    const d = this.detail();
    if (!d || !this.canPublish() || this.busyAction()) return;
    this.busyAction.set('retire');
    const ctx = this.tradeCtx();
    try {
      const saved = (await runAction(
        'policy',
        d.id,
        'retire',
        { reasonCode: result.reasonCode, reasonNote: result.reasonNote || undefined },
        d.version,
        newIdempotencyKey(),
        ctx,
      )) as GovernedVersionRecord;
      const updated = (await getVersion('policy', saved.id, ctx)) as GovernedVersionDetail<PolicyContent, PolicyTestCase>;
      this.retireDialog()?.close();
      this.detail.set(updated);
      this.seedDraftFromDetail(updated);
      this.notify.success(this.transloco.translate('policy.version.toasts.retired'));
      await this.refreshDefinitionQuietly();
    } catch (err) {
      this.handleMutationError(err);
    } finally {
      this.busyAction.set(null);
    }
  }

  protected async confirmRollback(result: ReasonDialogResult): Promise<void> {
    const d = this.detail();
    if (!d || !this.canPublish() || this.busyAction()) return;
    this.busyAction.set('rollback');
    try {
      const created = (await runAction(
        'policy',
        d.id,
        'rollback',
        { reasonCode: result.reasonCode, reasonNote: result.reasonNote || undefined },
        d.version,
        newIdempotencyKey(),
        this.tradeCtx(),
      )) as GovernedVersionRecord;
      this.rollbackDialog()?.close();
      this.notify.success(
        this.transloco.translate('policy.version.toasts.rolledBack', { n: created.versionNumber }),
      );
      this.skipDirtyGuard = true;
      void this.router.navigate([
        '/trade/governance/policy-studio',
        d.definition.id,
        'versions',
        created.id,
      ]);
    } catch (err) {
      this.handleMutationError(err);
    } finally {
      this.busyAction.set(null);
    }
  }

  protected onConflictReload(): void {
    this.conflictDialog().close();
    this.rejectDialog()?.close();
    this.retireDialog()?.close();
    this.rollbackDialog()?.close();
    this.publishModal()?.close();
    void this.reload();
  }

  protected onConflictKeep(): void {
    this.conflictDialog().close();
  }

  private focusRuleError(index: number): void {
    this.selectTab('rules');
    this.expandRuleRequest.set({ index, seq: ++this.expandSeq });
  }

  private translateDiagnostic(code: string, reason?: string): string {
    if (reason === 'AMBIGUOUS_PRECEDENCE') {
      return this.transloco.translate('policy.rules.validation.ambiguousPrecedence');
    }
    const key = `governance.errors.${(code ?? '').replaceAll('.', '_')}`;
    const translated = this.transloco.translate(key);
    if (translated !== key) return translated;
    return this.transloco.translate('policy.rules.validation.genericInvalid');
  }

  private async reloadAfterAction(): Promise<void> {
    const defId = this.definitionId();
    const verId = this.versionId();
    if (!defId || !verId) return;
    const ctx = this.tradeCtx();
    try {
      const [verAny, def] = await Promise.all([
        getVersion('policy', verId, ctx),
        getDefinition('policy', defId, ctx),
      ]);
      if (!isPolicyVersionDetail(verAny)) throw new Error('Not a policy version');
      const ver = verAny;
      this.detail.set(ver);
      this.definition.set(def);
      if (!this.dirty()) {
        this.seedDraftFromDetail(ver);
      }
    } catch {
      // ignore background refresh failures
    }
  }

  private async refreshDefinitionQuietly(): Promise<void> {
    const defId = this.definitionId();
    if (!defId) return;
    try {
      this.definition.set(await getDefinition('policy', defId, this.tradeCtx()));
    } catch {
      // ignore background refresh failures
    }
  }

  private seedDraftFromDetail(ver: GovernedVersionDetail<PolicyContent, PolicyTestCase>): void {
    const contentCopy: PolicyContent = structuredClone(ver.content ?? EMPTY_CONTENT);
    const testsCopy: PolicyTestCase[] = structuredClone(ver.testCases ?? []);
    const fromParts = isoToLocalParts(ver.effectiveFrom);
    const toParts = isoToLocalParts(ver.effectiveTo);

    this.draftContent.set(contentCopy);
    this.draftTests.set(testsCopy);
    this.testError.set(null);
    this.effFromDate.set(fromParts.date);
    this.effFromTime.set(fromParts.time);
    this.effToDate.set(toParts.date);
    this.effToTime.set(toParts.time);
    this.savedSnapshot.set(
      this.buildSnapshot(contentCopy, testsCopy, fromParts.date, fromParts.time, toParts.date, toParts.time),
    );
  }

  private currentSnapshot(): string {
    return this.buildSnapshot(
      this.draftContent(),
      this.draftTests(),
      this.effFromDate(),
      this.effFromTime(),
      this.effToDate(),
      this.effToTime(),
    );
  }

  private buildSnapshot(
    content: PolicyContent,
    tests: readonly PolicyTestCase[],
    fromDate: string | null,
    fromTime: string | null,
    toDate: string | null,
    toTime: string | null,
  ): string {
    return JSON.stringify({ content, tests, fromDate, fromTime, toDate, toTime });
  }

  private handleMutationError(err: unknown): void {
    if (isForbiddenError(err)) {
      this.rejectDialog()?.close();
      this.retireDialog()?.close();
      this.rollbackDialog()?.close();
      this.publishModal()?.close();
      this.forbidden.set(true);
      return;
    }
    if (err instanceof ApiError) {
      const code = errorCodeOf(err);
      if (code === 'TRADE.CONCURRENCY.STALE_VERSION' || (err.status === 409 && (code ?? '').includes('STALE'))) {
        this.conflictDialog().open();
        return;
      }
      const key = `governance.errors.${(code ?? '').replaceAll('.', '_')}`;
      const translated = this.transloco.translate(key);
      this.notify.error(
        translated !== key ? translated : this.transloco.translate('tradeShared.errors.generic'),
      );
      return;
    }
    this.notify.error(this.transloco.translate('tradeShared.errors.network'));
  }
}
