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
import { errorCodeOf } from '../../../../../shared/widgets/dashboard/analytics-api';
import {
  createTarget,
  getTarget,
  isTargetGone,
  targetErrorMessage,
  targetFieldErrors,
  updateTarget,
} from '../targets.api';
import {
  SalesTarget,
  TARGETABLE_METRICS,
  TARGET_CURRENCIES,
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
  resolveBranchName,
  resolveMetricLabel,
  resolveTargetSubjectName,
  validateTargetValue,
} from '../targets.model';
import { OrgApi } from '../../../../../shared/widgets/dashboard/org.api';

const PICKER_YEARS = Array.from({ length: 16 }, (_, idx) => 2020 + idx);
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
      return formatNumber(Number(target.targetValue), 'en', 3);
    case 'RATE':
      return formatNumber(Number(target.targetValue), 'en', 1);
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
  imports: [NgIcon, TranslocoPipe, Badge, Button, ConfirmDialog, Dropdown, Field, Modal, UnsavedDialog],
  providers: [provideIcons({ tablerTarget, tablerCheck, tablerChevronDown, tablerX })],
  templateUrl: './target-modal.html',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(window:resize)': 'closeTeamsMenu()',
    '(keydown.escape)': 'onHostEscape($event)',
  },
})
export class TargetModal {
  private readonly org = inject(OrgApi);
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
  private readonly conflictDialog = viewChild.required<ConfirmDialog>('conflictDialog');
  private readonly teamsBox = viewChild<ElementRef<HTMLElement>>('teamsBox');
  private readonly teamsTrigger = viewChild<ElementRef<HTMLButtonElement>>('teamsTrigger');
  private readonly teamsPanel = viewChild<ElementRef<HTMLElement>>('teamsPanel');

  readonly canManage = input(true);
  readonly metrics = input<readonly TargetableMetric[]>([]);

  readonly saved = output<SalesTarget>();
  readonly deleteRequested = output<SalesTarget>();
  readonly reloaded = output<void>();

  protected readonly editingTarget = signal<SalesTarget | null>(null);
  protected readonly subjectType = signal<TargetSubjectType>('USER');
  protected readonly branchId = signal<string>(this.org.branches[0]?.id ?? '');
  protected readonly subjectId = signal<string>(this.org.users[0]?.id ?? '');
  protected readonly selectedTeamIds = signal<string[]>([]);
  protected readonly metricKey = signal<string>(TARGETABLE_METRICS[0].key);
  protected readonly periodGrain = signal<TargetPeriodGrain>('MONTH');
  protected readonly periodYear = signal<number>(2026);
  protected readonly periodMonth = signal<number>(11);
  protected readonly currencyCode = signal<string>('EGP');
  protected readonly valueInput = signal<string>('');

  protected readonly touched = signal<Record<string, boolean>>({});
  protected readonly submitAttempted = signal(false);
  protected readonly serverErrors = signal<Record<string, string | null>>({});
  protected readonly saving = signal(false);

  protected readonly teamsOpen = signal(false);
  protected readonly teamsPlaced = signal(false);
  protected readonly teamsPlace = signal<TeamsPopoverPlace>({ top: 0, start: 0, width: 0, maxHeight: null });

  private teamsSeq = 0;
  private allowClose = false;
  private confirmingDiscard = false;

  protected readonly isEdit = computed(() => this.editingTarget() !== null);
  protected readonly canEditValue = computed(() => {
    if (!this.canManage()) return false;
    const base = this.editingTarget();
    return !base || base.approvalState !== 'SUBMITTED';
  });

  protected readonly availableMetrics = computed<readonly TargetableMetric[]>(() => {
    const list = this.metrics();
    return list.length ? list : TARGETABLE_METRICS;
  });

  protected readonly activeMetric = computed<TargetableMetric | undefined>(() =>
    this.availableMetrics().find((m) => m.key === this.metricKey()) ??
    TARGETABLE_METRICS.find((m) => m.key === this.metricKey()),
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
    const lang = this.language();
    return this.org.branches.map((branch) => ({
      value: branch.id,
      label: branch.name[lang],
    }));
  });

  protected readonly subjectOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const type = this.subjectType();
    const branch = this.branchId();
    const lang = this.language();
    if (type === 'USER') {
      const items = this.org.users.filter((p) => !branch || p.branchId === branch).map((person) => ({
        value: person.id,
        label: lang === 'ar' ? person.nameAr : person.name,
      }));
      return items.length
        ? items
        : [{ value: '', label: this.transloco.translate('targets.form.selectSubject'), disabled: true }];
    }
    if (type === 'TEAM') {
      const items = this.org.teams.filter((t) => !branch || t.branchId === branch).map((team) => ({
        value: team.id,
        label: team.name[lang],
      }));
      return items.length
        ? items
        : [{ value: '', label: this.transloco.translate('targets.form.selectSubject'), disabled: true }];
    }
    return [];
  });

  protected readonly teamChoices = computed(() => {
    const lang = this.language();
    return this.org.teams.map((team) => {
      const branch = this.org.branches.find((b) => b.id === team.branchId);
      return {
        id: team.id,
        label: team.name[lang],
        branchLabel: branch ? branch.name[lang] : '',
      };
    });
  });

  protected readonly selectedTeamChips = computed(() => {
    const lang = this.language();
    const base = this.editingTarget();
    if (base?.subjectType === 'TEAM_SET') {
      return (base.subjects ?? []).map((item) => {
        const team = this.org.teams.find((t) => t.id === item.teamId);
        return {
          id: item.teamId,
          label: team ? team.name[lang] : item.teamName,
        };
      });
    }
    return this.selectedTeamIds().map((id) => {
      const team = this.org.teams.find((t) => t.id === id);
      return {
        id,
        label: team ? team.name[lang] : id,
      };
    });
  });

  protected readonly metricOptions = computed<DropdownOption<string>[]>(() => {
    const lang = this.language();
    return this.availableMetrics().map((metric) => ({
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
      return QUARTER_START_MONTHS.map((m) => ({
        value: m,
        label: this.transloco.translate(`targets.quarters.${m}`),
      }));
    }
    return MONTH_NUMBERS.map((m) => ({
      value: m,
      label: this.transloco.translate(`targets.months.${m}`),
    }));
  });

  protected readonly yearOptions = computed<DropdownOption<number>[]>(() =>
    PICKER_YEARS.map((y) => ({
      value: y,
      label: String(y),
    })),
  );

  protected readonly currencyOptions = computed<DropdownOption<string>[]>(() =>
    TARGET_CURRENCIES.map((code) => ({
      value: code,
      label: code,
    })),
  );

  protected readonly editSubjectTypeLabel = computed(() => {
    this.i18n();
    const base = this.editingTarget();
    return base ? this.transloco.translate(`targets.subjectTypes.${base.subjectType}`) : '';
  });

  protected readonly editBranchLabel = computed(() => {
    const base = this.editingTarget();
    if (!base) return '';
    return resolveBranchName(base.branchId, this.language());
  });

  protected readonly editSubjectLabel = computed(() => {
    const base = this.editingTarget();
    if (!base) return '';
    return resolveTargetSubjectName(base, this.language());
  });

  protected readonly editMetricLabel = computed(() => {
    const base = this.editingTarget();
    if (!base) return '';
    return resolveMetricLabel(base.metricKey, this.language(), this.availableMetrics());
  });

  protected readonly measureLabel = computed(() => {
    this.i18n();
    return this.transloco.translate(`targets.measures.${this.activeMeasureKind()}`);
  });

  protected readonly editGrainLabel = computed(() => {
    this.i18n();
    const base = this.editingTarget();
    return base ? this.transloco.translate(`targets.grains.${base.periodGrain}`) : '';
  });

  protected readonly editPeriodLabel = computed(() => {
    this.i18n();
    const base = this.editingTarget();
    if (!base) return '';
    return formatTargetPeriod(base.periodGrain, base.periodStart, this.language(), (n, year) =>
      this.transloco.translate('targets.quarter', { n, year }),
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
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', onScroll, { capture: true }));
  }

  openCreate(): void {
    this.editingTarget.set(null);
    const defaultBranch = this.org.branches[0]?.id ?? '';
    const defaultPerson = this.org.users.find((p) => p.branchId === defaultBranch)?.id ?? this.org.users[0]?.id ?? '';
    const defaultMetric = this.availableMetrics()[0]?.key ?? TARGETABLE_METRICS[0].key;
    this.subjectType.set('USER');
    this.branchId.set(defaultBranch);
    this.subjectId.set(defaultPerson);
    this.selectedTeamIds.set([]);
    this.metricKey.set(defaultMetric);
    this.periodGrain.set('MONTH');
    this.periodYear.set(2026);
    this.periodMonth.set(11);
    this.currencyCode.set('EGP');
    this.valueInput.set('');
    this.resetValidation();
    this.closeTeamsMenu();
    this.allowClose = false;
    this.modal().open();
  }

  openEdit(target: SalesTarget): void {
    this.editingTarget.set(target);
    this.applyTargetToForm(target);
    this.resetValidation();
    this.closeTeamsMenu();
    this.allowClose = false;
    this.modal().open();
  }

  close(): void {
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
    this.clearServerError('subject');
    this.clearServerError('teams');
    if (next === 'BRANCH') {
      this.subjectId.set(this.branchId());
      return;
    }
    if (next === 'USER' || next === 'TEAM') {
      this.syncSubjectToBranch(next, this.branchId());
    }
  }

  protected onBranchChange(nextBranch: string): void {
    if (this.isEdit()) return;
    this.branchId.set(nextBranch);
    this.clearServerError('subject');
    const type = this.subjectType();
    if (type === 'BRANCH') {
      this.subjectId.set(nextBranch);
    } else if (type === 'USER' || type === 'TEAM') {
      this.syncSubjectToBranch(type, nextBranch);
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
      this.currencyCode.set('EGP');
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
        this.valueInput.set(formatNumber(parsed, 'en', 3));
      } else if (this.activeMeasureKind() === 'COUNT' && Number.isInteger(parsed)) {
        this.valueInput.set(formatNumber(parsed, 'en', 0));
      }
    }
  }

  protected toggleTeamsMenu(): void {
    if (this.isEdit() || !this.canManage()) return;
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
    if (this.isEdit() || !this.canManage()) return;
    this.markTouched('teams');
    this.clearServerError('teams');
    this.selectedTeamIds.update((list) =>
      list.includes(teamId) ? list.filter((id) => id !== teamId) : [...list, teamId],
    );
  }

  protected removeTeam(teamId: string, event: Event): void {
    event.stopPropagation();
    if (this.isEdit() || !this.canManage()) return;
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
    if (serverCode) return this.transloco.translate(`analytics.error.${serverCode}`);
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
    if (serverCode) return this.transloco.translate(`analytics.error.${serverCode}`);
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
    if (serverCode) return this.transloco.translate(`analytics.error.${serverCode}`);
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
    if (serverCode) return this.transloco.translate(`analytics.error.${serverCode}`);
    if (this.isEdit()) return null;
    if (!this.submitAttempted() && !this.touched()['period']) return null;
    if (!isValidPeriodStart(this.periodGrain(), this.computedPeriodStart())) {
      return this.transloco.translate('targets.validation.periodRequired');
    }
    return null;
  }

  protected currencyError(): string | null {
    this.i18n();
    const serverCode = this.serverErrors()['currency'];
    if (serverCode) return this.transloco.translate(`analytics.error.${serverCode}`);
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
    if (serverCode) return this.transloco.translate(`analytics.error.${serverCode}`);
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
      if (!this.metricKey()) return false;
      if (!isValidPeriodStart(this.periodGrain(), this.computedPeriodStart())) return false;
      if (kind === 'MONEY' && !this.currencyCode()) return false;
    }

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
    const reload = await this.conflictDialog().open();
    try {
      const fresh = await getTarget(targetId);
      if (reload) {
        this.editingTarget.set(fresh);
        this.applyTargetToForm(fresh);
        this.resetValidation();
        this.reloaded.emit();
      } else {
        this.editingTarget.set(fresh);
        this.reloaded.emit();
        if (fresh.approvalState === 'SUBMITTED') {
          this.notify.error(this.transloco.translate('analytics.error.CRM_TARGET_LOCKED_SUBMITTED'));
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
    const fieldOf: Record<string, 'value' | 'currency' | 'period' | 'subject' | 'teams' | 'metric'> = {
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
    this.currencyCode.set(target.currencyCode ?? 'EGP');
    this.valueInput.set(formatInitialValue(target));
  }

  private syncSubjectToBranch(type: 'USER' | 'TEAM', branchId: string): void {
    if (type === 'USER') {
      const first = this.org.users.find((p) => !branchId || p.branchId === branchId);
      this.subjectId.set(first?.id ?? '');
    } else {
      const first = this.org.teams.find((t) => !branchId || t.branchId === branchId);
      this.subjectId.set(first?.id ?? '');
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
