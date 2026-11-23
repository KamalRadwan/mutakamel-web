import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { provideIcons } from '@ng-icons/core';
import { tablerClock } from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Badge } from '../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../shared/ui/button/button';
import { DASH, formatDateTime } from '../../../../../shared/ui/chart/chart-format';
import { ConflictDialog } from '../../../../../shared/ui/conflict-dialog/conflict-dialog';
import { RouterLink } from '@angular/router';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { WorkspaceBranch } from '../../../../../shared/widgets/workspace-lookups/workspace-lookups.model';
import { anyGrant, branchGrants, tenantWide } from '../../shared/settings-access';
import { slaError } from '../sla-error';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { DateField } from '../../../../../shared/ui/date-time/date-field';
import { TimeField } from '../../../../../shared/ui/date-time/time-field';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import {
  ApiError,
  errorCodeOf,
  fieldErrorsOf,
  isRetryableWriteError,
  isValidationError,
} from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { listPolicies, previewClock, publishPolicy } from '../sla.api';
import {
  PublishSlaPolicy,
  SLA_APPLIES_TO_RECORDS,
  SLA_CLOCK_KINDS,
  SLA_DIRECTIONS,
  SLA_LIMITS,
  SLA_POLICY_KINDS,
  SLA_STATES,
  SLA_TARGET_UNITS,
  SLA_TOUCH_BY_OPTIONS,
  SLA_TOUCH_SOURCES,
  SlaActivityDirection,
  SlaAppliesToRecord,
  SlaClockKind,
  SlaClockMissingReason,
  SlaPolicy,
  SlaPolicyKind,
  SlaPolicyState,
  SlaQualifyingTouchBy,
  SlaTargetUnit,
  SlaTouchSource,
  activityTypesFor,
  composeTargetMinutes,
  decomposeTargetMinutes,
  filtersTouchesOnly,
  isoDateOnly,
  maxMinutesForClock,
  slaPolicyShape,
  toPublishBody,
} from '../sla.model';

interface PolicySnapshot {
  nameEn: string;
  nameAr: string;
  policyKind: SlaPolicyKind;
  appliesToRecord: SlaAppliesToRecord;
  branchKey: string;
  clockKind: SlaClockKind;
  targetMinutes: number | null;
  requiredTouchCount: number | null;
  compliancePct: number | null;
  qualifyingTouchBy: SlaQualifyingTouchBy;
  activityTypes: string[];
  directions: SlaActivityDirection[];
  touchSources: SlaTouchSource[];
  effectiveFrom: string;
  state: SlaPolicyState;
}

const TENANT_BRANCH_KEY = '__TENANT__';

function sortedUnique<T extends string>(items: readonly T[] | null | undefined): T[] {
  if (!items || items.length === 0) return [];
  return [...new Set(items)].sort();
}

function sameStringArray(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

@Component({
  selector: 'app-sla-modal',
  imports: [
    TranslocoPipe,
    Badge,
    Button,
    ConfirmDialog,
    ConflictDialog,
    RouterLink,
    DateField,
    Dropdown,
    Field,
    Modal,
    TimeField,
  ],
  providers: [provideIcons({ tablerClock })],
  templateUrl: './sla-modal.html',
})
export class SlaModal {
  private readonly scope = inject(TenantScopeState);
  protected readonly canChooseBranch = anyGrant('org.branch.read');
  protected readonly tenantManage = tenantWide('crm.sla.manage');
  private readonly grants = branchGrants('crm.sla.manage');
  private readonly manageGranted = anyGrant('crm.sla.manage');
  private readonly planReadOnly = signal(false);
  readonly readOnlyRequested = output<void>();
  readonly branches = input<readonly WorkspaceBranch[]>([]);
  protected readonly conflictOpen = signal(false);
  protected readonly resolvingConflict = signal(false);
  protected readonly serverFields = signal<Record<string, string[]>>({});
  protected readonly clockServerError = signal<string | null>(null);
  private staleAttempt: PublishSlaPolicy | null = null;
  private static nextId = 0;
  protected readonly uid = `sla-modal-${++SlaModal.nextId}`;

  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required<Modal>('modal');
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');

  readonly canManage = input(false);
  readonly allPolicies = input<readonly SlaPolicy[]>([]);

  readonly published = output<SlaPolicy>();
  readonly reloadRequested = output<void>();

  protected readonly todayIso = new Date().toISOString().slice(0, 10);
  protected readonly maxNameLength = SLA_LIMITS.maxNameLength;
  protected readonly directionOptions = SLA_DIRECTIONS;
  protected readonly touchSourceOptions = SLA_TOUCH_SOURCES;

  protected readonly editingPolicy = signal<SlaPolicy | null>(null);
  private readonly expectedSupersedesId = signal<string | null>(null);
  private readonly baselineSnapshot = signal<PolicySnapshot | null>(null);

  protected readonly nameEn = signal('');
  protected readonly nameAr = signal('');
  protected readonly policyKind = signal<SlaPolicyKind>('FIRST_RESPONSE');
  protected readonly appliesToRecord = signal<SlaAppliesToRecord>('LEAD');
  protected readonly branchKey = signal<string>(TENANT_BRANCH_KEY);
  protected readonly clockKind = signal<SlaClockKind>('WORKING_MINUTES');
  protected readonly targetValueInput = signal('30');
  protected readonly targetUnit = signal<SlaTargetUnit>('minutes');
  protected readonly requiredTouchCountInput = signal('3');
  protected readonly compliancePctInput = signal('80');
  protected readonly qualifyingTouchBy = signal<SlaQualifyingTouchBy>('OWNER');
  protected readonly activityTypes = signal<string[]>([]);
  protected readonly directions = signal<SlaActivityDirection[]>([]);
  protected readonly touchSources = signal<SlaTouchSource[]>([]);
  protected readonly effectiveFrom = signal(this.todayIso);
  protected readonly policyState = signal<SlaPolicyState>('ACTIVE');

  protected readonly touched = signal<Record<string, boolean>>({});
  protected readonly submitAttempted = signal(false);
  protected readonly effectiveFromServerError = signal<string | null>(null);
  protected readonly saving = signal(false);

  // Clock preview fields
  protected readonly clockBranchId = signal('');
  protected readonly clockFromDate = signal(this.todayIso);
  protected readonly clockFromTime = signal('09:00');
  protected readonly clockMinutesInput = signal('30');
  protected readonly clockDeadlineIso = signal<string | null>(null);
  protected readonly clockMissingReason = signal<SlaClockMissingReason | null>(null);
  protected readonly clockBusy = signal(false);
  protected readonly clockSubmitted = signal(false);

  private allowClose = false;
  private confirmingDiscard = false;

  protected readonly isEdit = computed(() => this.editingPolicy() !== null);

  /** Activity types the backend registry admits for this kind and record. */
  protected readonly activityTypeOptions = computed(() =>
    activityTypesFor(this.policyKind(), this.appliesToRecord()),
  );

  /** Planned-activity policies (OPPORTUNITY NEXT_STEP) filter by activity type only. */
  protected readonly showTouchFilters = computed(() =>
    filtersTouchesOnly(this.policyKind(), this.appliesToRecord()),
  );

  /** A RETIRED version carries no target, touch count or compliance target. */
  protected readonly retiring = computed(() => this.policyState() === 'RETIRED');

  /** One idempotency key per publish action: reused while the same body is retried, replaced when it changes. */
  private pendingPublish: { key: string; bodyJson: string } | null = null;

  protected readonly readOnly = computed(() => {
    if (!this.canManage() || !this.manageGranted || this.planReadOnly()) return true;
    const current = this.editingPolicy();
    if (current && (current.nextPolicyId !== null || current.state === 'RETIRED')) return true;
    return current !== null && !this.canManageBranch(current.branchId);
  });

  protected readonly lineageLocked = computed(
    () => this.readOnly() || this.editingPolicy() !== null,
  );

  protected readonly nameEnCount = computed(() => [...this.nameEn()].length);
  protected readonly nameArCount = computed(() => [...this.nameAr()].length);

  protected readonly kindOptions = computed<DropdownOption<SlaPolicyKind>[]>(() => {
    this.i18n();
    return SLA_POLICY_KINDS.map((value) => ({
      value,
      label: this.transloco.translate(`sla.kind.${value}`),
    }));
  });

  protected readonly recordOptions = computed<DropdownOption<SlaAppliesToRecord>[]>(() => {
    this.i18n();
    const allowOpportunity = this.policyKind() === 'NEXT_STEP';
    return SLA_APPLIES_TO_RECORDS.map((value) => ({
      value,
      label: this.transloco.translate(`sla.record.${value}`),
      disabled: value === 'OPPORTUNITY' && !allowOpportunity,
    }));
  });

  protected readonly manageableBranches = computed(() =>
    this.branches().filter(
      (branch) => branch.status === 'ACTIVE' && this.canManageBranch(branch.id),
    ),
  );

  protected readonly branchOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return [
      ...(this.tenantManage
        ? [
            {
              value: TENANT_BRANCH_KEY,
              label: this.transloco.translate('sla.filters.tenantDefault'),
            },
          ]
        : []),
      ...this.manageableBranches().map((branch) => ({ value: branch.id, label: branch.name })),
    ];
  });

  protected readonly previewBranchOptions = computed<DropdownOption<string>[]>(() =>
    this.manageableBranches().map((branch) => ({ value: branch.id, label: branch.name })),
  );

  protected readonly branchDisplay = computed(() => {
    this.i18n();
    return this.branchKey() === TENANT_BRANCH_KEY
      ? this.transloco.translate('sla.filters.tenantDefault')
      : (this.branches().find((branch) => branch.id === this.branchKey())?.name ??
          this.transloco.translate('sla.filters.branch'));
  });

  protected readonly effectiveDateDisplay = computed(() =>
    this.effectiveFrom().split('-').reverse().join('/'),
  );

  protected serverFieldError(field: string): string | null {
    const messages = Object.entries(this.serverFields())
      .filter(([key]) => key === field || key.startsWith(`${field}.`))
      .flatMap(([, values]) => values);
    return messages.length ? messages.join(' ') : null;
  }

  protected optionLabel(
    options: readonly { value: unknown; label: string }[],
    value: unknown,
  ): string {
    return options.find((option) => option.value === value)?.label ?? '';
  }

  protected readonly branchError = computed(() => {
    const server = this.serverFields()['branchId'];
    if (server) return server.join(' ');
    if (!this.submitAttempted() || this.readOnly()) return null;
    const id = this.branchKey();
    return id && this.canManageBranch(id === TENANT_BRANCH_KEY ? null : id)
      ? null
      : this.transloco.translate('sla.errors.BRANCH_PERMISSION_DENIED');
  });

  protected readonly previewAllowed = computed(
    () => this.canManage() && this.manageGranted && !this.planReadOnly(),
  );

  private canManageBranch(branchId: string | null): boolean {
    if (!branchId) return this.tenantManage;
    return (
      this.grants === 'ALL' ||
      this.grants.has(branchId) ||
      !!this.scope.me()?.accessScope.branchesTruncated
    );
  }

  protected readonly clockKindOptions = computed<DropdownOption<SlaClockKind>[]>(() => {
    this.i18n();
    return SLA_CLOCK_KINDS.map((value) => ({
      value,
      label: this.transloco.translate(`sla.clockKind.${value}`),
    }));
  });

  protected readonly targetUnitOptions = computed<DropdownOption<SlaTargetUnit>[]>(() => {
    this.i18n();
    return SLA_TARGET_UNITS.map((value) => ({
      value,
      label: this.transloco.translate(`sla.unit.${value}`),
    }));
  });

  protected readonly touchByOptions = computed<DropdownOption<SlaQualifyingTouchBy>[]>(() => {
    this.i18n();
    return SLA_TOUCH_BY_OPTIONS.map((value) => ({
      value,
      label: this.transloco.translate(`sla.touchBy.${value}`),
    }));
  });

  protected readonly stateOptions = computed<DropdownOption<SlaPolicyState>[]>(() => {
    this.i18n();
    return SLA_STATES.map((value) => ({
      value,
      label: this.transloco.translate(`sla.state.${value}`),
    }));
  });

  protected readonly resolvedTargetMinutes = computed<number | null>(() => {
    const raw = this.targetValueInput().trim();
    if (!raw) return null;
    const numeric = Number(raw);
    if (!Number.isFinite(numeric) || numeric <= 0) return NaN;
    return composeTargetMinutes(numeric, this.targetUnit(), this.clockKind());
  });

  protected readonly resolvedTouchCount = computed<number | null>(() => {
    if (this.policyKind() !== 'FOLLOW_UP_CADENCE') return null;
    const raw = this.requiredTouchCountInput().trim();
    if (!raw) return null;
    const numeric = Number(raw);
    return Number.isInteger(numeric) ? numeric : NaN;
  });

  protected readonly resolvedCompliancePct = computed<number | null>(() => {
    if (this.policyKind() !== 'FOLLOW_UP_CADENCE') return null;
    const raw = this.compliancePctInput().trim();
    if (!raw) return null;
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : NaN;
  });

  protected readonly currentSnapshot = computed<PolicySnapshot>(() => {
    const target = this.resolvedTargetMinutes();
    const touches = this.resolvedTouchCount();
    const compliance = this.resolvedCompliancePct();
    return {
      nameEn: this.nameEn().trim(),
      nameAr: this.nameAr().trim(),
      policyKind: this.policyKind(),
      appliesToRecord: this.appliesToRecord(),
      branchKey: this.branchKey(),
      clockKind: this.clockKind(),
      targetMinutes: target === null || Number.isNaN(target) ? null : target,
      requiredTouchCount: touches === null || Number.isNaN(touches) ? null : touches,
      compliancePct: compliance === null || Number.isNaN(compliance) ? null : compliance,
      qualifyingTouchBy: this.qualifyingTouchBy(),
      activityTypes: sortedUnique(this.activityTypes()),
      directions: sortedUnique(this.directions()),
      touchSources: sortedUnique(this.touchSources()),
      effectiveFrom: this.effectiveFrom(),
      state: this.policyState(),
    };
  });

  protected readonly dirty = computed(() => {
    const base = this.baselineSnapshot();
    const cur = this.currentSnapshot();
    if (!base) {
      return cur.nameEn.length > 0 || cur.nameAr.length > 0;
    }
    return (
      cur.nameEn !== base.nameEn ||
      cur.nameAr !== base.nameAr ||
      cur.policyKind !== base.policyKind ||
      cur.appliesToRecord !== base.appliesToRecord ||
      cur.branchKey !== base.branchKey ||
      cur.clockKind !== base.clockKind ||
      cur.targetMinutes !== base.targetMinutes ||
      cur.requiredTouchCount !== base.requiredTouchCount ||
      cur.compliancePct !== base.compliancePct ||
      cur.qualifyingTouchBy !== base.qualifyingTouchBy ||
      !sameStringArray(cur.activityTypes, base.activityTypes) ||
      !sameStringArray(cur.directions, base.directions) ||
      !sameStringArray(cur.touchSources, base.touchSources) ||
      cur.effectiveFrom !== base.effectiveFrom ||
      cur.state !== base.state
    );
  });

  protected readonly startEventKey = computed(
    () =>
      `sla.startEvent.${slaPolicyShape(this.policyKind(), this.appliesToRecord())?.startEvent ?? 'ASSIGNMENT'}`,
  );

  protected readonly qualifyingFactKey = computed(
    () =>
      `sla.qualifyingFact.${slaPolicyShape(this.policyKind(), this.appliesToRecord())?.qualifyingFact ?? 'TOUCH'}`,
  );

  protected readonly displayVersionNumber = computed(() => {
    const policy = this.editingPolicy();
    return policy ? policy.versionNumber : 1;
  });

  protected readonly supersedesDisplay = computed(() => {
    this.i18n();
    const policy = this.editingPolicy();
    if (!policy) {
      return this.transloco.translate('sla.meta.firstVersion');
    }
    if (!this.readOnly()) {
      return `v${policy.versionNumber}`;
    }
    if (!policy.supersedesPolicyId) {
      return this.transloco.translate('sla.meta.firstVersion');
    }
    const prev = this.allPolicies().find((item) => item.id === policy.supersedesPolicyId);
    return prev ? `v${prev.versionNumber}` : `v${Math.max(1, policy.versionNumber - 1)}`;
  });

  protected readonly nameEnError = computed(() => this.nameError('nameEn', this.nameEn()));
  protected readonly nameArError = computed(() => this.nameError('nameAr', this.nameAr()));

  protected readonly targetError = computed(() => {
    this.i18n();
    if (this.retiring()) return null;
    if (this.serverFields()['targetMinutes']) return this.serverFields()['targetMinutes'].join(' ');
    if (!this.submitAttempted() && !this.touched()['target']) return null;
    const raw = this.targetValueInput().trim();
    if (!raw) return this.transloco.translate('sla.validation.required');
    const minutes = this.resolvedTargetMinutes();
    const max = maxMinutesForClock(this.clockKind());
    if (
      minutes == null ||
      Number.isNaN(minutes) ||
      !Number.isInteger(minutes) ||
      minutes < 1 ||
      minutes > max
    ) {
      return this.transloco.translate('sla.validation.targetRange', { max });
    }
    return null;
  });

  protected readonly touchesError = computed(() => {
    this.i18n();
    if (this.policyKind() !== 'FOLLOW_UP_CADENCE' || this.retiring()) return null;
    if (this.serverFields()['requiredTouchCount'])
      return this.serverFields()['requiredTouchCount'].join(' ');
    if (!this.submitAttempted() && !this.touched()['touches']) return null;
    const raw = this.requiredTouchCountInput().trim();
    if (!raw) return this.transloco.translate('sla.validation.required');
    const count = this.resolvedTouchCount();
    if (
      count == null ||
      Number.isNaN(count) ||
      !Number.isInteger(count) ||
      count < SLA_LIMITS.minTouchCount ||
      count > SLA_LIMITS.maxTouchCount
    ) {
      return this.transloco.translate('sla.validation.touchesRange');
    }
    return null;
  });

  protected readonly complianceError = computed(() => {
    this.i18n();
    if (this.policyKind() !== 'FOLLOW_UP_CADENCE' || this.retiring()) return null;
    if (this.serverFields()['compliancePct']) return this.serverFields()['compliancePct'].join(' ');
    if (!this.submitAttempted() && !this.touched()['compliance']) return null;
    const raw = this.compliancePctInput().trim();
    if (!raw) return this.transloco.translate('sla.validation.required');
    const pct = this.resolvedCompliancePct();
    if (pct == null || Number.isNaN(pct) || pct <= 0 || pct > SLA_LIMITS.maxCompliancePct) {
      return this.transloco.translate('sla.validation.complianceRange');
    }
    return null;
  });

  protected readonly effectiveFromError = computed(() => {
    this.i18n();
    const serverErr = this.effectiveFromServerError();
    if (serverErr) return serverErr;
    if (this.serverFields()['effectiveFrom']) return this.serverFields()['effectiveFrom'].join(' ');
    if (this.readOnly()) return null;
    if (!this.submitAttempted() && !this.touched()['effectiveFrom']) return null;
    const date = this.effectiveFrom().trim();
    if (!date) return this.transloco.translate('sla.validation.required');
    if (date < this.todayIso) return this.transloco.translate('sla.validation.backdated');
    return null;
  });

  protected readonly clockFromError = computed(() => {
    this.i18n();
    if (!this.clockSubmitted()) return null;
    if (!this.clockFromDate().trim() || !this.clockFromTime().trim()) {
      return this.transloco.translate('sla.validation.fromInvalid');
    }
    return null;
  });

  protected readonly clockMinutesError = computed(() => {
    this.i18n();
    if (this.clockServerError()) return this.clockServerError();
    if (!this.clockSubmitted()) return null;
    const raw = this.clockMinutesInput().trim();
    const parsed = Number(raw);
    if (!raw || !Number.isInteger(parsed) || parsed < 1) {
      return this.transloco.translate('sla.validation.minutesInvalid');
    }
    if (parsed > SLA_LIMITS.maxPreviewMinutes) {
      return this.transloco.translate('sla.validation.minutesRange', {
        max: SLA_LIMITS.maxPreviewMinutes,
      });
    }
    return null;
  });

  protected readonly clockDeadlineError = computed(() => {
    this.i18n();
    const reason = this.clockMissingReason();
    return reason ? this.transloco.translate(`sla.missing.${reason}`) : null;
  });

  protected readonly clockDeadlineDisplay = computed(() => {
    this.language();
    this.i18n();
    const iso = this.clockDeadlineIso();
    if (!iso) return DASH;
    return formatDateTime(iso, this.language(), (key, params) =>
      this.transloco.translate(`chart.${key}`, params),
    );
  });

  openCreate(): void {
    this.pendingPublish = null;
    this.editingPolicy.set(null);
    this.expectedSupersedesId.set(null);
    this.applyDefaults();
    this.baselineSnapshot.set(null);
    this.resetValidation();
    this.resetClockPreview(this.manageableBranches()[0]?.id ?? '', 30);
    this.allowClose = false;
    this.modal().open();
  }

  openPolicy(policy: SlaPolicy): void {
    this.pendingPublish = null;
    this.editingPolicy.set(policy);
    this.expectedSupersedesId.set(policy.id);
    const snapshot = this.applyPolicyToForm(policy);
    this.baselineSnapshot.set(snapshot);
    this.resetValidation();
    this.resetClockPreview(
      policy.branchId ?? this.manageableBranches()[0]?.id ?? '',
      policy.targetMinutes ?? 30,
    );
    this.allowClose = false;
    this.modal().open();
  }

  close(): void {
    this.allowClose = true;
    this.modal().close();
  }

  protected onKindChange(next: SlaPolicyKind): void {
    if (this.lineageLocked()) return;
    this.policyKind.set(next);
    if (next === 'FOLLOW_UP_CADENCE') {
      this.clockKind.set('CALENDAR_MINUTES');
      this.appliesToRecord.set('LEAD');
    } else if (next !== 'NEXT_STEP' && this.appliesToRecord() === 'OPPORTUNITY') {
      this.appliesToRecord.set('LEAD');
    }
    this.dropUnsupportedActivityTypes();
  }

  protected onRecordChange(next: SlaAppliesToRecord): void {
    if (this.lineageLocked()) return;
    if (next === 'OPPORTUNITY' && this.policyKind() !== 'NEXT_STEP') return;
    this.appliesToRecord.set(next);
    this.dropUnsupportedActivityTypes();
  }

  private dropUnsupportedActivityTypes(): void {
    const allowed = new Set(this.activityTypeOptions());
    this.activityTypes.update((list) => list.filter((type) => allowed.has(type)));
  }

  protected onBranchChange(next: string): void {
    if (this.lineageLocked()) return;
    this.branchKey.set(next);
    this.serverFields.set({});
  }

  protected onClockKindChange(next: SlaClockKind): void {
    if (this.readOnly() || this.policyKind() === 'FOLLOW_UP_CADENCE') return;
    this.clockKind.set(next);
  }

  protected onTargetInput(event: Event): void {
    if (this.readOnly()) return;
    this.targetValueInput.set((event.target as HTMLInputElement).value);
  }

  protected onTouchesInput(event: Event): void {
    if (this.readOnly()) return;
    this.requiredTouchCountInput.set((event.target as HTMLInputElement).value);
  }

  protected onComplianceInput(event: Event): void {
    if (this.readOnly()) return;
    this.compliancePctInput.set((event.target as HTMLInputElement).value);
  }

  protected onNameInput(field: 'nameEn' | 'nameAr', event: Event): void {
    if (this.readOnly()) return;
    const value = (event.target as HTMLInputElement).value;
    if (field === 'nameEn') this.nameEn.set(value);
    else this.nameAr.set(value);
  }

  protected onEffectiveFromChange(next: string | null): void {
    if (this.readOnly() || !next) return;
    this.effectiveFrom.set(next);
    this.effectiveFromServerError.set(null);
  }

  protected toggleActivityType(type: string): void {
    if (this.readOnly()) return;
    this.activityTypes.update((list) =>
      list.includes(type) ? list.filter((item) => item !== type) : [...list, type],
    );
  }

  protected toggleDirection(dir: SlaActivityDirection): void {
    if (this.readOnly()) return;
    this.directions.update((list) =>
      list.includes(dir) ? list.filter((item) => item !== dir) : [...list, dir],
    );
  }

  protected toggleTouchSource(source: SlaTouchSource): void {
    if (this.readOnly()) return;
    this.touchSources.update((list) =>
      list.includes(source) ? list.filter((item) => item !== source) : [...list, source],
    );
  }

  protected markTouched(field: string): void {
    this.touched.update((state) => (state[field] ? state : { ...state, [field]: true }));
  }

  protected undo(): void {
    if (this.readOnly()) return;
    const current = this.editingPolicy();
    if (current) {
      this.applyPolicyToForm(current);
    } else {
      this.applyDefaults();
    }
    this.resetValidation();
  }

  protected requestClose(): void {
    if (this.readOnly() || !this.dirty()) {
      this.close();
      return;
    }
    void this.confirmDiscardAndClose();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && !this.readOnly() && this.dirty()) {
      this.modal().open();
      void this.confirmDiscardAndClose();
      return;
    }
    this.allowClose = false;
    this.editingPolicy.set(null);
    this.baselineSnapshot.set(null);
    this.resetValidation();
  }

  protected async publish(): Promise<void> {
    if (this.saving() || this.readOnly() || this.conflictOpen() || this.resolvingConflict()) return;

    this.submitAttempted.set(true);
    this.effectiveFromServerError.set(null);
    this.serverFields.set({});

    if (
      this.branchError() ||
      this.nameEnError() ||
      this.nameArError() ||
      this.targetError() ||
      this.touchesError() ||
      this.complianceError() ||
      this.effectiveFromError()
    ) {
      return;
    }

    const snap = this.currentSnapshot();
    const payload: PublishSlaPolicy = toPublishBody(
      {
        policyKind: snap.policyKind,
        appliesToRecord: snap.appliesToRecord,
        branchId: snap.branchKey === TENANT_BRANCH_KEY ? null : snap.branchKey,
        clockKind: snap.clockKind,
        targetMinutes: snap.targetMinutes,
        requiredTouchCount: snap.requiredTouchCount,
        compliancePct: snap.compliancePct,
        qualifyingTouchBy: snap.qualifyingTouchBy,
        activityTypes: snap.activityTypes,
        directions: snap.directions,
        touchSources: snap.touchSources,
        nameEn: snap.nameEn,
        nameAr: snap.nameAr,
        effectiveFrom: snap.effectiveFrom,
        state: snap.state,
        expectedSupersedesPolicyId: this.expectedSupersedesId(),
      },
      this.todayIso,
    );
    const bodyJson = JSON.stringify(payload);
    if (this.pendingPublish?.bodyJson !== bodyJson) {
      this.pendingPublish = { key: newIdempotencyKey(), bodyJson };
    }
    const key = this.pendingPublish.key;

    this.saving.set(true);
    try {
      const result = await publishPolicy(payload, key);
      this.pendingPublish = null;
      this.notify.success(this.transloco.translate('sla.modal.publishedToast'));
      this.published.emit(result);
      this.close();
    } catch (error) {
      const code = errorCodeOf(error);
      if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) {
        this.pendingPublish = null;
      }
      const failure = this.writeFailure(error);
      if (code === 'CRM_SLA_BACKDATED') {
        this.effectiveFromServerError.set(this.transloco.translate('sla.validation.backdated'));
        return;
      }
      if (code === 'CRM_SLA_POLICY_STALE') {
        this.staleAttempt = payload;
        this.conflictOpen.set(true);
        return;
      }
      if (code === 'BRANCH_PERMISSION_DENIED') {
        this.serverFields.set({ branchId: [failure.message] });
        return;
      }
      if (isValidationError(error)) {
        const fields = fieldErrorsOf(error);
        this.serverFields.set(fields);
        const inline = [
          'nameEn',
          'nameAr',
          'targetMinutes',
          'requiredTouchCount',
          'compliancePct',
          'effectiveFrom',
          'branchId',
          'policyKind',
          'appliesToRecord',
          'clockKind',
          'qualifyingTouchBy',
          'state',
          'qualifying.activityTypes',
          'qualifying.directions',
          'qualifying.touchSources',
        ];
        if (
          Object.keys(fields).length &&
          Object.keys(fields).every((key) =>
            inline.some((field) => key === field || key.startsWith(`${field}.`)),
          )
        )
          return;
      }
      this.notify.error(failure.message);
    } finally {
      this.saving.set(false);
    }
  }

  protected async calculateClock(): Promise<void> {
    if (!this.previewAllowed() || !this.canChooseBranch || this.clockBusy()) return;
    if (!this.clockBranchId() || !this.canManageBranch(this.clockBranchId())) return;
    this.clockSubmitted.set(true);
    this.clockMissingReason.set(null);
    this.clockServerError.set(null);

    if (this.clockFromError() || this.clockMinutesError()) {
      return;
    }

    // The backend reads an ISO-8601 instant: the picked wall time in the viewer's zone, sent as UTC.
    const from = new Date(`${this.clockFromDate()}T${this.clockFromTime()}`).toISOString();
    const minutes = Number(this.clockMinutesInput().trim());

    this.clockBusy.set(true);
    try {
      const response = await previewClock({
        branchId: this.clockBranchId(),
        from,
        minutes,
      });
      this.clockDeadlineIso.set(response.deadline);
      this.clockMissingReason.set(response.missingReason);
    } catch (error) {
      this.clockDeadlineIso.set(null);
      this.clockMissingReason.set(null);
      const failure = this.writeFailure(error);
      if (errorCodeOf(error) === 'CRM_SLA_CLOCK_RANGE_EXCEEDED') {
        this.clockServerError.set(failure.message);
      } else {
        this.notify.error(failure.message);
      }
    } finally {
      this.clockBusy.set(false);
    }
  }

  private writeFailure(error: unknown) {
    const failure = slaError(this.transloco, error);
    if (failure.readOnly) {
      this.planReadOnly.set(true);
      this.readOnlyRequested.emit();
    }
    if (error instanceof ApiError && error.status === 401) {
      failure.message = this.transloco.translate('settings.errors.notSaved');
    }
    if (error instanceof ApiError && error.status === 429) {
      const retryAfter = error.details?.['retryAfterSeconds'];
      const seconds = Array.isArray(retryAfter) ? retryAfter[0] : retryAfter;
      if (seconds !== undefined) {
        failure.message = this.transloco.translate('settings.errors.rateLimitedIn', { seconds });
      }
    }
    return failure;
  }

  protected onClockMinutesInput(event: Event): void {
    this.clockMinutesInput.set((event.target as HTMLInputElement).value);
  }

  protected async resolveConflict(reload: boolean): Promise<void> {
    const attempted = this.staleAttempt;
    if (!attempted || this.resolvingConflict()) return;
    this.resolvingConflict.set(true);
    try {
      let cursor: string | undefined;
      let latestHead: SlaPolicy | undefined;
      do {
        const page = await listPolicies({
          kind: attempted.policyKind,
          record: attempted.appliesToRecord,
          branchId: attempted.branchId ?? 'tenant',
          limit: 100,
          ...(cursor ? { cursor } : {}),
        });
        latestHead = page.items.find((item) => item.nextPolicyId === null);
        cursor = page.pageInfo.nextCursor ?? undefined;
      } while (!latestHead && cursor);
      this.reloadRequested.emit();
      this.expectedSupersedesId.set(latestHead?.id ?? null);
      this.pendingPublish = null;
      if (reload) {
        if (latestHead) {
          this.editingPolicy.set(latestHead);
          this.baselineSnapshot.set(this.applyPolicyToForm(latestHead));
        } else {
          this.editingPolicy.set(null);
          this.applyDefaults();
          this.baselineSnapshot.set(null);
        }
        this.resetValidation();
      }
      this.staleAttempt = null;
      this.conflictOpen.set(false);
    } catch (error) {
      this.notify.error(slaError(this.transloco, error).message);
      this.conflictOpen.set(true);
    } finally {
      this.resolvingConflict.set(false);
    }
  }

  private nameError(field: 'nameEn' | 'nameAr', value: string): string | null {
    this.i18n();
    if (this.serverFields()[field]) return this.serverFields()[field].join(' ');
    if (!this.submitAttempted() && !this.touched()[field]) return null;
    const len = [...value.trim()].length;
    if (len === 0) return this.transloco.translate('sla.validation.required');
    if (len > SLA_LIMITS.maxNameLength) {
      return this.transloco.translate('sla.validation.nameMax', { max: SLA_LIMITS.maxNameLength });
    }
    return null;
  }

  private applyDefaults(): void {
    this.nameEn.set('');
    this.nameAr.set('');
    this.policyKind.set('FIRST_RESPONSE');
    this.appliesToRecord.set('LEAD');
    this.branchKey.set(
      this.tenantManage ? TENANT_BRANCH_KEY : (this.manageableBranches()[0]?.id ?? ''),
    );
    this.clockKind.set('WORKING_MINUTES');
    this.targetValueInput.set('30');
    this.targetUnit.set('minutes');
    this.requiredTouchCountInput.set('3');
    this.compliancePctInput.set('80');
    this.qualifyingTouchBy.set('OWNER');
    this.activityTypes.set(['CALL', 'EMAIL']);
    this.directions.set(['OUTBOUND']);
    this.touchSources.set(['CRM_ACTIVITY']);
    this.effectiveFrom.set(this.todayIso);
    this.policyState.set('ACTIVE');
  }

  private applyPolicyToForm(policy: SlaPolicy): PolicySnapshot {
    const isHistorical = this.readOnly();
    const rawEffective = isoDateOnly(policy.effectiveFrom) || this.todayIso;
    const resolvedEffective =
      !isHistorical && rawEffective < this.todayIso ? this.todayIso : rawEffective;
    const decomposed = decomposeTargetMinutes(policy.targetMinutes, policy.clockKind);

    this.nameEn.set(policy.nameEn);
    this.nameAr.set(policy.nameAr);
    this.policyKind.set(policy.policyKind);
    this.appliesToRecord.set(policy.appliesToRecord);
    this.branchKey.set(policy.branchId ?? TENANT_BRANCH_KEY);
    this.clockKind.set(policy.clockKind);
    this.targetValueInput.set(String(decomposed.value));
    this.targetUnit.set(decomposed.unit);
    this.requiredTouchCountInput.set(String(policy.requiredTouchCount ?? 3));
    this.compliancePctInput.set(String(policy.compliancePct ?? 80));
    this.qualifyingTouchBy.set(policy.qualifyingTouchBy ?? 'OWNER');
    this.activityTypes.set(sortedUnique(policy.qualifying?.activityTypes));
    this.directions.set(sortedUnique(policy.qualifying?.directions));
    this.touchSources.set(sortedUnique(policy.qualifying?.touchSources));
    this.effectiveFrom.set(resolvedEffective);
    this.policyState.set(policy.state);

    return {
      nameEn: policy.nameEn.trim(),
      nameAr: policy.nameAr.trim(),
      policyKind: policy.policyKind,
      appliesToRecord: policy.appliesToRecord,
      branchKey: policy.branchId ?? TENANT_BRANCH_KEY,
      clockKind: policy.clockKind,
      targetMinutes: policy.targetMinutes ?? null,
      requiredTouchCount:
        policy.policyKind === 'FOLLOW_UP_CADENCE' ? (policy.requiredTouchCount ?? 3) : null,
      compliancePct:
        policy.policyKind === 'FOLLOW_UP_CADENCE' ? (policy.compliancePct ?? 80) : null,
      qualifyingTouchBy: policy.qualifyingTouchBy ?? 'OWNER',
      activityTypes: sortedUnique(policy.qualifying?.activityTypes),
      directions: sortedUnique(policy.qualifying?.directions),
      touchSources: sortedUnique(policy.qualifying?.touchSources),
      effectiveFrom: resolvedEffective,
      state: policy.state,
    };
  }

  private resetValidation(): void {
    this.touched.set({});
    this.serverFields.set({});
    this.submitAttempted.set(false);
    this.effectiveFromServerError.set(null);
  }

  private resetClockPreview(branchId: string, minutes: number): void {
    this.clockBranchId.set(branchId || this.manageableBranches()[0]?.id || '');
    this.clockFromDate.set(this.todayIso);
    this.clockFromTime.set('09:00');
    this.clockMinutesInput.set(String(minutes > 0 ? minutes : 30));
    this.clockDeadlineIso.set(null);
    this.clockMissingReason.set(null);
    this.clockSubmitted.set(false);
    this.clockServerError.set(null);
  }

  private async confirmDiscardAndClose(): Promise<void> {
    if (this.confirmingDiscard) return;
    this.confirmingDiscard = true;
    try {
      if (await this.discardDialog().open()) {
        this.close();
      }
    } finally {
      this.confirmingDiscard = false;
    }
  }
}
