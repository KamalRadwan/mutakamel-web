import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCheck, tablerChevronDown, tablerTarget, tablerX } from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Badge, BadgeTone } from '../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../shared/ui/button/button';
import { formatNumber } from '../../../../../shared/ui/chart/chart-format';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { errorCodeOf } from '../../../../../core/api/api-errors';
import {
  createTarget,
  beginTargetAction,
  getTarget,
  isTargetGone,
  targetErrorMessage,
  targetFieldErrors,
  updateTarget,
  targetCurrencies,
  targetSubjectOptions,
} from '../targets.api';
import {
  SalesTarget,
  TARGET_MAX_TEAMS,
  TARGET_MAX_VALUE,
  TARGET_MIN_TEAMS,
  TargetApprovalState,
  TargetMeasureKind,
  TargetPeriodGrain,
  TargetSubjectType,
  TargetableMetric,
  formatTargetPeriod,
  isValidPeriodStart,
  resolveTargetSubjectName,
  validateTargetValue,
  isPeriodClosed,
  targetBranchAllowed,
  TargetSubjectOptions,
  TargetCurrency,
} from '../targets.model';
import { CoreHttp } from '../../../../../core/api/core-http';
import { ConflictDialog } from '../../../../../shared/ui/conflict-dialog/conflict-dialog';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { branchGrants } from '../../shared/settings-access';
import { crmSettingsError } from '../../shared/settings-api';
import type { WorkspaceBranch } from '../../../../../shared/widgets/workspace-lookups/workspace-lookups.model';

const MONTH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const QUARTER_START_MONTHS = [1, 4, 7, 10] as const;

interface TeamsPopoverPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

function formatInitialValue(target: SalesTarget): string {
  switch (target.measureKind) {
    case 'MONEY':
      return formatNumber(Number(target.targetValue), 'en', 2);
    case 'RATE':
      return formatNumber(Number(target.targetValue), 'en', 2);
    case 'COUNT':
    default:
      return formatNumber(Number(target.targetValue), 'en', 0);
  }
}

function parseNumericInput(raw: string): number | null {
  const clean = raw.replace(/,/g, '').trim();
  if (!clean) return null;
  const num = Number(clean);
  return Number.isFinite(num) ? num : NaN;
}

@Component({
  selector: 'app-target-modal',
  imports: [
    NgIcon,
    TranslocoPipe,
    Badge,
    Button,
    ConfirmDialog,
    ConflictDialog,
    FullState,
    Dropdown,
    Field,
    Modal,
    UnsavedDialog,
  ],
  providers: [provideIcons({ tablerTarget, tablerCheck, tablerChevronDown, tablerX })],
  templateUrl: './target-modal.html',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(window:resize)': 'closeTeamsMenu()',
    '(keydown.escape)': 'onHostEscape($event)',
  },
})
export class TargetModal {
  private readonly core = inject(CoreHttp);
  private readonly manageGrants = branchGrants('crm.targets.manage');
  readonly branches = input<readonly WorkspaceBranch[]>([]);
  readonly metricsError = input(false);
  readonly metricsFailure = input<ReturnType<typeof crmSettingsError> | null>(null);
  readonly timeZone = input<string | null>(null);
  readonly reloadMetrics = output<void>();
  readonly readOnly = output<void>();
  protected readonly writeReadOnly = signal(false);
  protected readonly currencies = signal<TargetCurrency[]>([]);
  protected readonly currenciesError = signal(false);
  protected readonly subjectSearch = signal('');
  protected readonly subjectsLoading = signal(false);
  protected readonly subjectsFailed = signal(false);
  protected readonly subjects = signal<TargetSubjectOptions>({ users: [], teams: [] });
  protected readonly teams = signal<
    { id: string; name: string; branchId: string; branchName: string }[]
  >([]);
  private subjectsSeq = 0;
  protected readonly conflictOpen = signal(false);
  private conflictResolve: ((reload: boolean) => void) | null = null;
  private readonly approvedConfirm = viewChild.required<ConfirmDialog>('approvedConfirm');
  private static nextId = 0;
  protected readonly uid = `target-modal-${++TargetModal.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required<Modal>('modal');
  private readonly unsavedDialog = viewChild.required<UnsavedDialog>('unsavedDialog');
  private readonly teamsBox = viewChild<ElementRef<HTMLElement>>('teamsBox');
  private readonly teamsTrigger = viewChild<ElementRef<HTMLButtonElement>>('teamsTrigger');
  private readonly teamsPanel = viewChild<ElementRef<HTMLElement>>('teamsPanel');

  readonly canManage = input(false);
  readonly metrics = input<readonly TargetableMetric[]>([]);

  readonly saved = output<SalesTarget>();
  readonly deleteRequested = output<SalesTarget>();
  readonly reloaded = output<void>();

  protected readonly editingTarget = signal<SalesTarget | null>(null);
  protected readonly subjectType = signal<TargetSubjectType>('USER');
  protected readonly branchId = signal<string>('');
  protected readonly subjectId = signal<string>('');
  protected readonly selectedTeamIds = signal<string[]>([]);
  protected readonly metricKey = signal<string>('');
  protected readonly periodGrain = signal<TargetPeriodGrain>('MONTH');
  protected readonly periodYear = signal<number>(new Date().getUTCFullYear());
  protected readonly periodMonth = signal<number>(new Date().getUTCMonth() + 1);
  protected readonly currencyCode = signal<string>('');
  protected readonly valueInput = signal<string>('');

  protected readonly touched = signal<Record<string, boolean>>({});
  protected readonly submitAttempted = signal(false);
  protected readonly serverErrors = signal<Record<string, string | null>>({});
  protected readonly saving = signal(false);

  protected readonly teamsOpen = signal(false);
  protected readonly teamsPlaced = signal(false);
  protected readonly teamsPlace = signal<TeamsPopoverPlace>({
    top: 0,
    start: 0,
    width: 0,
    maxHeight: null,
  });

  private teamsSeq = 0;
  private allowClose = false;
  private confirmingDiscard = false;

  protected readonly formReadOnly = computed(() => !this.canManage() || this.writeReadOnly());
  protected readonly isEdit = computed(() => this.editingTarget() !== null);
  protected readonly canEditValue = computed(() => {
    if (!this.canManage() || this.writeReadOnly()) return false;
    const base = this.editingTarget();
    return base
      ? base.approvalState !== 'SUBMITTED' && targetBranchAllowed(base, this.manageGrants)
      : !!this.branchId() &&
          (this.manageGrants === 'ALL' || this.manageGrants.has(this.branchId()));
  });

  protected readonly activeMetric = computed<TargetableMetric | undefined>(() =>
    this.metrics().find((m) => m.key === this.metricKey()),
  );

  protected readonly activeMeasureKind = computed<TargetMeasureKind>(() => {
    const base = this.editingTarget();
    if (base) return base.measureKind;
    return this.activeMetric()?.measureKind ?? 'MONEY';
  });

  protected readonly computedPeriodStart = computed(() => {
    const year = this.periodYear();
    const grain = this.periodGrain();
    const month = grain === 'YEAR' ? 1 : this.periodMonth();
    return `${year}-${String(month).padStart(2, '0')}-01`;
  });

  protected readonly parsedValue = computed(() => parseNumericInput(this.valueInput()));

  protected readonly dirty = computed(() => {
    const base = this.editingTarget();
    if (!base) {
      return (
        this.valueInput().trim().length > 0 ||
        this.subjectType() !== 'USER' ||
        this.selectedTeamIds().length > 0 ||
        this.periodGrain() !== 'MONTH'
      );
    }
    if (!this.canEditValue()) return false;
    const parsed = this.parsedValue();
    if (parsed === null || Number.isNaN(parsed)) return true;
    return parsed !== Number(base.targetValue);
  });

  protected readonly subjectTypeOptions = computed<DropdownOption<TargetSubjectType>[]>(() => {
    this.i18n();
    const types: TargetSubjectType[] = ['USER', 'TEAM', 'BRANCH', 'TEAM_SET'];
    return types.map((value) => ({
      value,
      label: this.transloco.translate(`targets.subjectTypes.${value}`),
    }));
  });

  protected readonly branchOptions = computed<DropdownOption<string>[]>(() => {
    return this.branches()
      .filter((b) => this.manageGrants === 'ALL' || this.manageGrants.has(b.id))
      .map((branch) => ({
        value: branch.id,
        label: branch.name,
      }));
  });

  protected readonly subjectOptions = computed<DropdownOption<string>[]>(() => {
    if (this.subjectType() === 'USER')
      return this.subjects().users.map((u) => ({ value: u.id, label: u.displayName }));
    if (this.subjectType() === 'TEAM')
      return this.subjects().teams.map((t) => ({ value: t.id, label: t.name }));
    return [];
  });
  protected readonly teamChoices = computed(() =>
    this.teams().map((t) => ({ id: t.id, label: t.name, branchLabel: t.branchName })),
  );
  protected readonly selectedTeamChips = computed(() => {
    const base = this.editingTarget();
    if (base?.subjectType === 'TEAM_SET')
      return base.subjects.map((t) => ({ id: t.teamId, label: t.teamName }));
    return this.selectedTeamIds().map((id) => ({
      id,
      label: this.teams().find((t) => t.id === id)?.name ?? id,
    }));
  });
  protected readonly metricOptions = computed<DropdownOption<string>[]>(() => {
    const lang = this.language();
    return this.metrics().map((metric) => ({
      value: metric.key,
      label: lang === 'ar' ? metric.labelAr : metric.labelEn,
    }));
  });

  protected readonly grainOptions = computed<DropdownOption<TargetPeriodGrain>[]>(() => {
    this.i18n();
    const grains: TargetPeriodGrain[] = ['MONTH', 'QUARTER', 'YEAR'];
    return grains.map((value) => ({
      value,
      label: this.transloco.translate(`targets.grains.${value}`),
    }));
  });

  protected readonly monthOptions = computed<DropdownOption<number>[]>(() => {
    this.i18n();
    const grain = this.periodGrain();
    if (grain === 'QUARTER') {
      return QUARTER_START_MONTHS.filter((m) =>
        this.periodAvailable(this.periodYear(), m, 'QUARTER'),
      ).map((m) => ({
        value: m,
        label: this.transloco.translate(`targets.quarters.${m}`),
      }));
    }
    return MONTH_NUMBERS.filter((m) => this.periodAvailable(this.periodYear(), m, 'MONTH')).map(
      (m) => ({
        value: m,
        label: this.transloco.translate(`targets.months.${m}`),
      }),
    );
  });

  protected readonly yearOptions = computed<DropdownOption<number>[]>(() =>
    Array.from({ length: 2101 - this.currentYear() }, (_, i) => this.currentYear() + i).map(
      (y) => ({
        value: y,
        label: String(y),
      }),
    ),
  );

  protected readonly currencyOptions = computed<DropdownOption<string>[]>(() =>
    this.currencies().map(({ code }) => ({
      value: code,
      label: code,
    })),
  );

  protected readonly editSubjectTypeLabel = computed(() => {
    this.i18n();
    const base = this.editingTarget();
    return this.transloco.translate(
      `targets.subjectTypes.${base?.subjectType ?? this.subjectType()}`,
    );
  });

  protected readonly editBranchLabel = computed(() => {
    const base = this.editingTarget();
    if (base) return base.branchName ?? base.branchId ?? '';
    return (
      this.branches().find((b) => b.id === this.branchId())?.name ??
      this.transloco.translate('targets.yourBranch')
    );
  });

  protected readonly editSubjectLabel = computed(() => {
    const base = this.editingTarget();
    return base
      ? resolveTargetSubjectName(base, this.language())
      : (this.subjectOptions().find((o) => o.value === this.subjectId())?.label ?? '');
  });

  protected readonly editMetricLabel = computed(() => {
    const base = this.editingTarget();
    if (base) return this.language() === 'ar' ? base.metricLabelAr : base.metricLabel;
    return this.metricOptions().find((o) => o.value === this.metricKey())?.label ?? '';
  });

  protected readonly measureLabel = computed(() => {
    this.i18n();
    return this.transloco.translate(`targets.measures.${this.activeMeasureKind()}`);
  });

  protected readonly editGrainLabel = computed(() => {
    this.i18n();
    const base = this.editingTarget();
    return this.transloco.translate(`targets.grains.${base?.periodGrain ?? this.periodGrain()}`);
  });

  protected readonly editPeriodLabel = computed(() => {
    this.i18n();
    const base = this.editingTarget();
    return formatTargetPeriod(
      base?.periodGrain ?? this.periodGrain(),
      base?.periodStart ?? this.computedPeriodStart(),
      this.language(),
      (n, year) => this.transloco.translate('targets.quarter', { n, year }),
    );
  });

  protected readonly targetValueHint = computed(() => {
    this.i18n();
    const base = this.editingTarget();
    if (base?.approvalState === 'APPROVED') {
      return this.transloco.translate('targets.form.targetValueApprovedHint');
    }
    if (base?.approvalState === 'SUBMITTED') {
      return this.transloco.translate('targets.form.targetValueLockedHint');
    }
    return this.transloco.translate('targets.form.targetValueHint');
  });

  constructor() {
    const onScroll = (event: Event) => {
      if (!this.teamsOpen()) return;
      const target = event.target;
      if (target instanceof Node && this.teamsPanel()?.nativeElement.contains(target)) return;
      this.closeTeamsMenu();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() =>
      document.removeEventListener('scroll', onScroll, { capture: true }),
    );
  }

  openCreate(branchId?: string): void {
    beginTargetAction('create');
    this.editingTarget.set(null);
    this.subjectSearch.set('');
    this.teams.set([]);
    const defaultBranch = branchId ?? this.branchOptions()[0]?.value ?? '';
    const defaultPerson = '';
    const defaultMetric = this.metrics()[0]?.key ?? '';
    this.subjectType.set('USER');
    this.branchId.set(defaultBranch);
    this.subjectId.set(defaultPerson);
    this.selectedTeamIds.set([]);
    this.metricKey.set(defaultMetric);
    this.periodGrain.set('MONTH');
    this.periodYear.set(this.currentYear());
    this.periodMonth.set(this.currentMonth());
    this.currencyCode.set(
      this.currencies().find((c) => c.isDefault)?.code ?? this.currencies()[0]?.code ?? '',
    );
    this.valueInput.set('');
    this.resetValidation();
    this.closeTeamsMenu();
    this.allowClose = false;
    this.modal().open();
    void this.loadCurrencies();
    void this.loadSubjects();
  }

  openEdit(target: SalesTarget): void {
    beginTargetAction('update', target.id);
    this.subjectsSeq++;
    this.editingTarget.set(target);
    this.applyTargetToForm(target);
    this.resetValidation();
    this.closeTeamsMenu();
    this.allowClose = false;
    this.modal().open();
  }

  close(): void {
    this.subjectsSeq++;
    this.conflictResolve?.(false);
    this.conflictResolve = null;
    this.conflictOpen.set(false);
    this.closeTeamsMenu();
    this.allowClose = true;
    this.modal().close();
  }

  editingId(): string | null {
    return this.editingTarget()?.id ?? null;
  }

  protected stateTone(state: TargetApprovalState): BadgeTone {
    switch (state) {
      case 'APPROVED':
        return 'success';
      case 'SUBMITTED':
        return 'warning';
      case 'DRAFT':
      default:
        return 'tag';
    }
  }

  protected undo(): void {
    const base = this.editingTarget();
    if (!base) return;
    this.applyTargetToForm(base);
    this.resetValidation();
  }

  protected requestClose(): void {
    if (!this.canEditValue() || !this.dirty()) {
      this.close();
      return;
    }
    void this.confirmUnsavedAndClose();
  }

  protected onModalClosed(): void {
    this.closeTeamsMenu();
    if (!this.allowClose && this.canEditValue() && this.dirty()) {
      this.modal().open();
      void this.confirmUnsavedAndClose();
      return;
    }
    this.allowClose = false;
    this.editingTarget.set(null);
    this.resetValidation();
  }

  protected onSubjectTypeChange(next: TargetSubjectType): void {
    if (this.isEdit()) return;
    this.subjectType.set(next);
    this.subjectsFailed.set(false);
    if (next === 'TEAM_SET') void this.loadTeamSetOptions();
    this.clearServerError('subject');
    this.clearServerError('teams');
    if (next === 'BRANCH') {
      this.subjectId.set(this.branchId());
      return;
    }
    if (next === 'USER' || next === 'TEAM') {
      this.syncSubjectToBranch(next);
    }
  }

  protected onBranchChange(nextBranch: string): void {
    if (this.isEdit()) return;
    this.branchId.set(nextBranch);
    this.clearServerError('subject');
    this.subjectId.set('');
    void this.loadSubjects();
    const type = this.subjectType();
    if (type === 'BRANCH') {
      this.subjectId.set(nextBranch);
    } else if (type === 'USER' || type === 'TEAM') {
      this.syncSubjectToBranch(type);
    }
  }

  protected onSubjectChange(nextSubject: string): void {
    if (this.isEdit()) return;
    this.subjectId.set(nextSubject);
    this.markTouched('subject');
    this.clearServerError('subject');
  }

  protected onMetricChange(nextMetric: string): void {
    if (this.isEdit()) return;
    this.metricKey.set(nextMetric);
    this.clearServerError('metric');
    this.clearServerError('currency');
    if (this.activeMeasureKind() === 'MONEY' && !this.currencyCode()) {
      this.currencyCode.set(
        this.currencies().find((c) => c.isDefault)?.code ?? this.currencies()[0]?.code ?? '',
      );
    }
  }

  protected onGrainChange(nextGrain: TargetPeriodGrain): void {
    if (this.isEdit()) return;
    this.periodGrain.set(nextGrain);
    this.clearServerError('period');
    if (nextGrain === 'YEAR') {
      this.periodMonth.set(1);
    } else if (nextGrain === 'QUARTER') {
      const m = this.periodMonth();
      const qMonth = m <= 3 ? 1 : m <= 6 ? 4 : m <= 9 ? 7 : 10;
      this.periodMonth.set(qMonth);
    }
  }

  protected onMonthChange(nextMonth: number): void {
    if (this.isEdit()) return;
    this.periodMonth.set(nextMonth);
    this.clearServerError('period');
  }

  protected onYearChange(nextYear: number): void {
    if (this.isEdit()) return;
    this.periodYear.set(nextYear);
    const first = this.monthOptions()[0]?.value;
    if (first && !this.monthOptions().some((o) => o.value === this.periodMonth()))
      this.periodMonth.set(first);
    this.clearServerError('period');
  }

  protected onCurrencyChange(nextCurrency: string): void {
    if (this.isEdit()) return;
    this.currencyCode.set(nextCurrency);
    this.clearServerError('currency');
  }

  protected onValueInput(event: Event): void {
    if (!this.canEditValue()) return;
    this.valueInput.set((event.target as HTMLInputElement).value);
    this.clearServerError('value');
  }

  protected onValueBlur(): void {
    this.markTouched('value');
    const parsed = this.parsedValue();
    if (parsed !== null && Number.isFinite(parsed) && parsed > 0) {
      if (this.activeMeasureKind() === 'MONEY') {
        this.valueInput.set(formatNumber(parsed, 'en', 2));
      } else if (this.activeMeasureKind() === 'COUNT' && Number.isInteger(parsed)) {
        this.valueInput.set(formatNumber(parsed, 'en', 0));
      }
    }
  }

  protected toggleTeamsMenu(): void {
    if (this.isEdit() || !this.canEditValue()) return;
    if (this.teamsOpen()) {
      this.closeTeamsMenu();
      return;
    }
    const seq = ++this.teamsSeq;
    this.teamsPlaced.set(false);
    const anchorEl = this.teamsBox()?.nativeElement ?? this.teamsTrigger()?.nativeElement;
    if (anchorEl) {
      const rect = rectInPage(anchorEl);
      const { width } = viewport();
      const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
      this.teamsPlace.set({
        top: rect.bottom + 4,
        start: rtl ? width - rect.right : rect.left,
        width: rect.width,
        maxHeight: null,
      });
    }
    this.teamsOpen.set(true);
    queueMicrotask(() => this.placeTeamsPanel(seq));
    afterNextRender(() => this.placeTeamsPanel(seq), { injector: this.injector });
  }

  protected onTeamsBoxClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-remove-team]')) return;
    if (target?.closest('button') === this.teamsTrigger()?.nativeElement) return;
    this.toggleTeamsMenu();
  }

  protected closeTeamsMenu(): void {
    this.teamsSeq++;
    this.teamsOpen.set(false);
    this.teamsPlaced.set(false);
  }

  protected isTeamSelected(teamId: string): boolean {
    return this.selectedTeamIds().includes(teamId);
  }

  protected toggleTeam(teamId: string): void {
    if (this.isEdit() || !this.canEditValue()) return;
    this.markTouched('teams');
    this.clearServerError('teams');
    this.selectedTeamIds.update((list) =>
      list.includes(teamId) ? list.filter((id) => id !== teamId) : [...list, teamId],
    );
  }

  protected removeTeam(teamId: string, event: Event): void {
    event.stopPropagation();
    if (this.isEdit() || !this.canEditValue()) return;
    this.markTouched('teams');
    this.clearServerError('teams');
    this.selectedTeamIds.update((list) => list.filter((id) => id !== teamId));
  }

  protected onDocumentClick(event: Event): void {
    if (!this.teamsOpen()) return;
    const target = event.target as Node | null;
    if (!target) return;
    if (this.teamsBox()?.nativeElement.contains(target)) return;
    if (this.teamsTrigger()?.nativeElement.contains(target)) return;
    if (this.teamsPanel()?.nativeElement.contains(target)) return;
    this.closeTeamsMenu();
  }

  protected onHostEscape(event: Event): void {
    if (!this.teamsOpen()) return;
    event.preventDefault();
    event.stopPropagation();
    this.closeTeamsMenu();
    this.teamsTrigger()?.nativeElement.focus();
  }

  protected markTouched(field: string): void {
    this.touched.update((current) => (current[field] ? current : { ...current, [field]: true }));
  }

  protected subjectError(): string | null {
    this.i18n();
    const serverCode = this.serverErrors()['subject'];
    if (serverCode) return this.transloco.translate(`targets.errors.${serverCode}`);
    if (this.isEdit()) return null;
    const type = this.subjectType();
    if (type !== 'USER' && type !== 'TEAM') return null;
    if (!this.submitAttempted() && !this.touched()['subject']) return null;
    if (!this.subjectId()) {
      return this.transloco.translate('targets.validation.subjectRequired');
    }
    return null;
  }

  protected teamsError(): string | null {
    this.i18n();
    const serverCode = this.serverErrors()['teams'];
    if (serverCode) return this.transloco.translate(`targets.errors.${serverCode}`);
    if (this.isEdit() || this.subjectType() !== 'TEAM_SET') return null;
    if (!this.submitAttempted() && !this.touched()['teams']) return null;
    const count = this.selectedTeamIds().length;
    if (count < TARGET_MIN_TEAMS || count > TARGET_MAX_TEAMS) {
      return this.transloco.translate('targets.validation.teamsRange');
    }
    return null;
  }

  protected metricError(): string | null {
    this.i18n();
    const serverCode = this.serverErrors()['metric'];
    if (serverCode) return this.transloco.translate(`targets.errors.${serverCode}`);
    if (this.isEdit()) return null;
    if (!this.submitAttempted() && !this.touched()['metric']) return null;
    if (!this.metricKey()) {
      return this.transloco.translate('targets.validation.metricRequired');
    }
    return null;
  }

  protected periodError(): string | null {
    this.i18n();
    const serverCode = this.serverErrors()['period'];
    if (serverCode) return this.transloco.translate(`targets.errors.${serverCode}`);
    if (this.isEdit()) return null;
    if (!this.submitAttempted() && !this.touched()['period']) return null;
    if (
      !isValidPeriodStart(this.periodGrain(), this.computedPeriodStart()) ||
      !this.periodAvailable(this.periodYear(), this.periodMonth(), this.periodGrain())
    ) {
      return this.transloco.translate('targets.validation.periodRequired');
    }
    return null;
  }

  protected currencyError(): string | null {
    this.i18n();
    const serverCode = this.serverErrors()['currency'];
    if (serverCode) return this.transloco.translate(`targets.errors.${serverCode}`);
    if (this.isEdit() || this.activeMeasureKind() !== 'MONEY') return null;
    if (!this.submitAttempted() && !this.touched()['currency']) return null;
    if (!this.currencyCode()) {
      return this.transloco.translate('targets.validation.currencyRequired');
    }
    return null;
  }

  protected valueError(): string | null {
    this.i18n();
    const serverCode = this.serverErrors()['value'];
    if (serverCode) return this.transloco.translate(`targets.errors.${serverCode}`);
    if (!this.canEditValue()) return null;
    if (!this.submitAttempted() && !this.touched()['value']) return null;
    const parsed = this.parsedValue();
    if (parsed === null) {
      return this.transloco.translate('targets.validation.valueRequired');
    }
    if (Number.isNaN(parsed) || parsed <= 0) {
      return this.transloco.translate('targets.validation.valuePositive');
    }
    if (parsed > TARGET_MAX_VALUE) {
      return this.transloco.translate('targets.validation.valueMax');
    }
    if (Math.round(parsed * 100) / 100 !== parsed)
      return this.transloco.translate('targets.validation.valuePrecision');
    const kind = this.activeMeasureKind();
    if (kind === 'COUNT' && !Number.isInteger(parsed)) {
      return this.transloco.translate('targets.validation.valueInteger');
    }
    if (kind === 'RATE' && parsed > 100) {
      return this.transloco.translate('targets.validation.valueRateMax');
    }
    return null;
  }

  protected async save(): Promise<boolean> {
    if (this.saving() || !this.canEditValue()) return false;
    this.submitAttempted.set(true);
    this.serverErrors.set({});

    const parsed = this.parsedValue();
    const kind = this.activeMeasureKind();
    if (parsed === null || Number.isNaN(parsed) || !validateTargetValue(parsed, kind)) {
      return false;
    }

    const base = this.editingTarget();
    if (!base) {
      const type = this.subjectType();
      if ((type === 'USER' || type === 'TEAM') && !this.subjectId()) return false;
      if (type === 'BRANCH' && !this.branchId()) return false;
      if (type === 'TEAM_SET') {
        const count = this.selectedTeamIds().length;
        if (count < TARGET_MIN_TEAMS || count > TARGET_MAX_TEAMS) return false;
      }
      if (
        type === 'TEAM_SET' &&
        this.selectedTeamIds().some(
          (id) =>
            !this.teams().some(
              (t) =>
                t.id === id && (this.manageGrants === 'ALL' || this.manageGrants.has(t.branchId)),
            ),
        )
      )
        return false;
      if (
        !this.activeMetric() ||
        this.metricsError() ||
        this.subjectsLoading() ||
        this.subjectsFailed()
      )
        return false;
      if (
        !isValidPeriodStart(this.periodGrain(), this.computedPeriodStart()) ||
        !this.periodAvailable(this.periodYear(), this.periodMonth(), this.periodGrain())
      )
        return false;
      if (
        kind === 'MONEY' &&
        (this.currenciesError() || !this.currencies().some((c) => c.code === this.currencyCode()))
      )
        return false;
    }

    if (base?.approvalState === 'APPROVED' && !(await this.approvedConfirm().open())) return false;
    this.saving.set(true);
    try {
      let result: SalesTarget;
      if (!base) {
        const type = this.subjectType();
        result = await createTarget({
          subjectType: type,
          ...(type === 'TEAM_SET'
            ? { teamIds: this.selectedTeamIds() }
            : type === 'BRANCH'
              ? { branchId: this.branchId(), subjectId: this.branchId() }
              : { branchId: this.branchId(), subjectId: this.subjectId() }),
          metricKey: this.metricKey(),
          measureKind: kind,
          periodGrain: this.periodGrain(),
          periodStart: this.computedPeriodStart(),
          ...(kind === 'MONEY' ? { currencyCode: this.currencyCode() } : {}),
          targetValue: parsed,
        });
        this.notify.success(this.transloco.translate('targets.toasts.created'));
      } else {
        if (parsed === Number(base.targetValue)) {
          this.saving.set(false);
          return true;
        }
        result = await updateTarget(base.id, {
          revision: base.revision,
          targetValue: parsed,
        });
        this.notify.success(this.transloco.translate('targets.toasts.saved'));
      }

      this.saved.emit(result);
      this.close();
      return true;
    } catch (error) {
      const code = errorCodeOf(error);
      if (crmSettingsError(this.transloco, error, 'targets').readOnly) {
        this.writeReadOnly.set(true);
        this.readOnly.emit();
      }
      if (code === 'CRM_TARGET_REVISION_CONFLICT' && base) {
        this.saving.set(false);
        await this.handleRevisionConflict(base.id);
        return false;
      }
      if (code && this.mapServerFieldError(code)) {
        return false;
      }
      if (this.mapValidationPaths(error)) {
        return false;
      }
      this.notify.error(targetErrorMessage(this.transloco, error));
      if (isTargetGone(error)) {
        this.reloaded.emit();
        this.close();
      }
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  private async handleRevisionConflict(targetId: string): Promise<void> {
    this.conflictOpen.set(true);
    const reload = await new Promise<boolean>((resolve) => {
      this.conflictResolve = resolve;
    });
    try {
      const fresh = await getTarget(targetId);
      if (reload) {
        this.editingTarget.set(fresh);
        this.applyTargetToForm(fresh);
        this.resetValidation();
        this.reloaded.emit();
      } else {
        this.editingTarget.set({
          ...this.editingTarget()!,
          revision: fresh.revision,
          approvalState: fresh.approvalState,
        });
        this.reloaded.emit();
        if (fresh.approvalState === 'SUBMITTED') {
          this.notify.error(this.transloco.translate('targets.errors.CRM_TARGET_LOCKED_SUBMITTED'));
        }
      }
    } catch (error) {
      this.notify.error(targetErrorMessage(this.transloco, error));
      if (isTargetGone(error)) {
        this.reloaded.emit();
        this.close();
      }
    }
  }

  /** 400 CRM_VALIDATION_FAILED: shows the error on the field its DTO path belongs to. */
  private mapValidationPaths(error: unknown): boolean {
    const paths = Object.keys(targetFieldErrors(error));
    if (!paths.length) return false;
    const code = 'CRM_VALIDATION_FAILED';
    const fieldOf: Record<
      string,
      'value' | 'currency' | 'period' | 'subject' | 'teams' | 'metric'
    > = {
      targetValue: 'value',
      currencyCode: 'currency',
      periodStart: 'period',
      periodGrain: 'period',
      branchId: 'subject',
      subjectId: 'subject',
      subjectType: 'subject',
      teamIds: 'teams',
      metricKey: 'metric',
      measureKind: 'metric',
    };
    const next: Record<string, string> = {};
    for (const path of paths) {
      const field = fieldOf[path.split('.')[0]];
      if (field) next[field] = code;
    }
    if (!Object.keys(next).length) return false;
    this.serverErrors.set(next);
    return true;
  }

  private mapServerFieldError(code: string): boolean {
    switch (code) {
      case 'CRM_TARGET_VALUE_INVALID':
        this.serverErrors.set({ value: code });
        return true;
      case 'CRM_TARGET_DUPLICATE':
        this.serverErrors.set({ metric: code });
        return true;
      case 'CRM_TARGET_SECOND_CURRENCY_AFTER_R2':
      case 'CRM_TARGET_CURRENCY_INVALID':
        this.serverErrors.set({ currency: code });
        return true;
      case 'CRM_TARGET_PERIOD_INVALID':
        this.serverErrors.set({ period: code });
        return true;
      case 'CRM_TARGET_SUBJECT_INVALID':
        this.serverErrors.set({ subject: code });
        return true;
      case 'CRM_TARGET_TEAM_SET_INVALID':
        this.serverErrors.set({ teams: code });
        return true;
      case 'CRM_TARGET_METRIC_NOT_TARGETABLE':
      case 'CRM_TARGET_MEASURE_INVALID':
        this.serverErrors.set({ metric: code });
        return true;
      default:
        return false;
    }
  }

  private applyTargetToForm(target: SalesTarget): void {
    this.subjectType.set(target.subjectType);
    this.branchId.set(target.branchId ?? '');
    this.subjectId.set(target.subjectId ?? '');
    this.selectedTeamIds.set((target.subjects ?? []).map((s) => s.teamId));
    this.metricKey.set(target.metricKey);
    this.periodGrain.set(target.periodGrain);
    this.currencyCode.set(target.currencyCode ?? '');
    this.valueInput.set(formatInitialValue(target));
  }

  private syncSubjectToBranch(type: 'USER' | 'TEAM'): void {
    const items = type === 'USER' ? this.subjects().users : this.subjects().teams;
    this.subjectId.set(
      items.some((item) => item.id === this.subjectId()) ? this.subjectId() : (items[0]?.id ?? ''),
    );
  }
  protected conflictClosed(open: boolean): void {
    if (!open) this.resolveConflict(false);
  }
  protected resolveConflict(reload: boolean): void {
    this.conflictOpen.set(false);
    this.conflictResolve?.(reload);
    this.conflictResolve = null;
  }
  private currentParts(): { year: number; month: number } {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: this.timeZone() ?? 'UTC',
      year: 'numeric',
      month: 'numeric',
    }).formatToParts(new Date());
    return {
      year: Number(parts.find((p) => p.type === 'year')!.value),
      month: Number(parts.find((p) => p.type === 'month')!.value),
    };
  }
  private currentYear(): number {
    return this.currentParts().year;
  }
  private currentMonth(): number {
    return this.currentParts().month;
  }
  private periodAvailable(year: number, month: number, grain: TargetPeriodGrain): boolean {
    return !isPeriodClosed(
      grain,
      `${year}-${String(grain === 'YEAR' ? 1 : month).padStart(2, '0')}-01`,
      new Date().toISOString(),
      this.timeZone() ?? 'UTC',
    );
  }
  protected searchSubjects(event: Event): void {
    this.subjectSearch.set((event.target as HTMLInputElement).value);
    void this.loadSubjects();
  }
  protected async loadCurrencies(): Promise<void> {
    this.currenciesError.set(false);
    try {
      const currencies = await targetCurrencies(this.core);
      this.currencies.set(currencies);
      if (!currencies.some((c) => c.code === this.currencyCode()))
        this.currencyCode.set(
          currencies.find((c) => c.isDefault)?.code ?? currencies[0]?.code ?? '',
        );
      if (!currencies.length) this.currenciesError.set(true);
    } catch {
      this.currenciesError.set(true);
    }
  }
  protected async loadSubjects(): Promise<void> {
    if (this.subjectType() === 'TEAM_SET') {
      await this.loadTeamSetOptions();
      return;
    }
    if (!this.branchId()) return;
    const seq = ++this.subjectsSeq;
    this.subjectsLoading.set(true);
    this.subjectsFailed.set(false);
    this.subjects.set({ users: [], teams: [] });
    try {
      const data = await targetSubjectOptions(
        this.branchId(),
        this.subjectSearch().trim() || undefined,
      );
      if (seq !== this.subjectsSeq) return;
      this.subjects.set(data);
      const branchId = this.branchId();
      const branchName = this.branches().find((b) => b.id === branchId)?.name ?? '';
      this.teams.update((teams) => [
        ...teams.filter((t) => t.branchId !== branchId),
        ...data.teams.map((t) => ({ ...t, branchId, branchName })),
      ]);
      const type = this.subjectType();
      if (type === 'USER' || type === 'TEAM') this.syncSubjectToBranch(type);
    } catch (error) {
      if (seq !== this.subjectsSeq) return;
      this.subjectsFailed.set(true);
      this.serverErrors.set({
        subject: errorCodeOf(error) ?? 'SUBJECT_OPTIONS_FAILED',
        teams: errorCodeOf(error) ?? 'SUBJECT_OPTIONS_FAILED',
      });
    } finally {
      if (seq === this.subjectsSeq) this.subjectsLoading.set(false);
    }
  }
  private async loadTeamSetOptions(): Promise<void> {
    const seq = ++this.subjectsSeq;
    this.subjectsFailed.set(false);
    const branches = this.branchOptions().length
      ? this.branchOptions()
      : [{ value: this.branchId(), label: '' }];
    this.subjectsLoading.set(true);
    try {
      const results = await Promise.all(
        branches.map(async (b) => ({
          branch: b,
          data: await targetSubjectOptions(b.value, this.subjectSearch().trim() || undefined),
        })),
      );
      if (seq !== this.subjectsSeq) return;
      const selected = this.teams().filter((t) => this.selectedTeamIds().includes(t.id));
      const found = results.flatMap(({ branch, data }) =>
        data.teams.map((t) => ({ ...t, branchId: branch.value, branchName: branch.label })),
      );
      this.teams.set([...selected.filter((t) => !found.some((row) => row.id === t.id)), ...found]);
    } catch (error) {
      if (seq !== this.subjectsSeq) return;
      this.subjectsFailed.set(true);
      this.serverErrors.set({ teams: errorCodeOf(error) ?? 'SUBJECT_OPTIONS_FAILED' });
    } finally {
      if (seq === this.subjectsSeq) this.subjectsLoading.set(false);
    }
  }
  private placeTeamsPanel(seq: number): void {
    if (seq !== this.teamsSeq || !this.teamsOpen() || this.teamsPlaced()) return;
    const anchorEl = this.teamsBox()?.nativeElement ?? this.teamsTrigger()?.nativeElement;
    const panelEl = this.teamsPanel()?.nativeElement;
    if (!anchorEl || !panelEl) return;

    const rect = rectInPage(anchorEl);
    const listRect = rectInPage(panelEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const spaceBelow = Math.max(8, height - 8 - belowTop);
    const spaceAbove = Math.max(8, rect.top - 12);
    const flipUp = listRect.height > spaceBelow && spaceAbove > spaceBelow;
    const avail = flipUp ? spaceAbove : spaceBelow;
    const maxHeight = listRect.height > avail ? avail : null;
    const finalHeight = maxHeight ?? listRect.height;
    const top = flipUp ? Math.max(8, rect.top - 4 - finalHeight) : belowTop;

    const triggerStart = rtl ? width - rect.right : rect.left;
    const start = Math.min(Math.max(8, triggerStart), Math.max(8, width - 8 - listRect.width));

    this.teamsPlace.set({ top, start, width: rect.width, maxHeight });
    this.teamsPlaced.set(true);
    panelEl.style.top = `${top}px`;
    panelEl.style.insetInlineStart = `${start}px`;
    panelEl.style.minWidth = `${rect.width}px`;
    panelEl.style.maxHeight = maxHeight !== null ? `${maxHeight}px` : '';
    panelEl.classList.remove('invisible');
  }

  private clearServerError(field: string): void {
    if (!this.serverErrors()[field]) return;
    this.serverErrors.update((curr) => ({ ...curr, [field]: null }));
  }

  private resetValidation(): void {
    this.touched.set({});
    this.submitAttempted.set(false);
    this.serverErrors.set({});
  }

  private async confirmUnsavedAndClose(): Promise<void> {
    if (this.confirmingDiscard) return;
    this.confirmingDiscard = true;
    try {
      const choice = await this.unsavedDialog().open();
      if (choice === 'discard') {
        this.close();
      } else if (choice === 'save') {
        await this.save();
      }
    } finally {
      this.confirmingDiscard = false;
    }
  }
}
