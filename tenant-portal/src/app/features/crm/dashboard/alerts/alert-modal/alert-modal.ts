import { Router } from '@angular/router';
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
import {
  tablerBellRinging,
  tablerCheck,
  tablerChevronDown,
  tablerSearch,
  tablerX,
} from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { ScopeState } from '../../../../../core/scope/scope';
import { Notify } from '../../../../../core/notify/notify';
import { Badge } from '../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../shared/ui/checkbox/checkbox';
import { ConflictDialog } from '../../../../../shared/ui/conflict-dialog/conflict-dialog';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { ApiError, fieldErrorsOf } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { alertErrorText, alertWriteLocked, alertReadKind } from '../alerts-error';
import { TimeField } from '../../../../../shared/ui/date-time/time-field';
import { Dropdown, type DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { Segmented, type SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { Switch } from '../../../../../shared/ui/switch/switch';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { errorCodeOf } from '../../../../../shared/widgets/dashboard/analytics-api';
import type { CatalogMetric } from '../../../../../shared/widgets/dashboard/analytics.model';
import { can, scopeLevels } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { errorKey, reasonKey } from '../../../../../shared/widgets/dashboard/panel-state';
import {
  createAlert,
  getAlert,
  listPublishedWidgetOptions,
  listAlertWidgetVersions,
  resetAlertWriteConflicts,
  testAlert,
  updateAlert,
} from '../alerts.api';
import {
  ALERT_CURRENCIES,
  ALERT_TIME_ZONES,
  DEFAULT_COOLDOWN_MINUTES,
  DEFAULT_TIME_ZONE,
  MAX_ALERT_NAME_LENGTH,
  MAX_COOLDOWN_MINUTES,
  MAX_RECIPIENTS_COUNT,
  MAX_THRESHOLD_ABS,
  minutesToTime24,
  formatAlertAmount,
  time24ToMinutes,
  type AlertChannel,
  type AlertComparator,
  type AlertConditionKind,
  type AlertOwnerMode,
  type AlertQuietBehavior,
  type AlertRecipientMode,
  type AlertRule,
  type AlertScheduleKind,
  type AlertSourceKind,
  type AlertValueUnit,
  type AlertWidgetVersionPolicy,
  type CreateAlertRule,
  type UpdateAlertRule,
  type PublishedWidgetOption,
  type TestAlertResult,
} from '../alerts.model';
import { OrgApi, type OrgBranch, type OrgUser } from '../../../../../shared/widgets/dashboard/org.api';

interface AlertFormDraft {
  name: string;
  sourceKind: AlertSourceKind;
  metricKey: string;
  widgetId: string;
  widgetVersionPolicy: AlertWidgetVersionPolicy;
  widgetVersionNumber: number;
  conditionKind: AlertConditionKind;
  comparator: AlertComparator;
  thresholdText: string;
  currencyCode: string;
  minimumCohortText: string;
  ownerMode: AlertOwnerMode;
  branchIds: string[];
  scheduleKind: AlertScheduleKind;
  scheduleMinuteHourlyText: string;
  scheduleTime: string;
  scheduleWeekday: number;
  timeZone: string;
  cooldownText: string;
  quietEnabled: boolean;
  quietStartTime: string;
  quietEndTime: string;
  quietBehavior: AlertQuietBehavior;
  recipientMode: AlertRecipientMode;
  recipientUserIds: string[];
  inAppEnabled: boolean;
  emailEnabled: boolean;
}

type AlertErrorField =
  | 'name'
  | 'metricKey'
  | 'widgetId'
  | 'widgetVersionNumber'
  | 'threshold'
  | 'valueUnit'
  | 'currencyCode'
  | 'minimumCohortSize'
  | 'cooldownMinutes'
  | 'scheduleMinute'
  | 'scheduleWeekday'
  | 'quietStartMinute'
  | 'recipientUserIds'
  | 'channels';

interface PopoverPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

type OpenMenu = 'metric' | 'branches' | 'people' | null;

function mapScopeLevelToOwnerMode(level: 'own' | 'team' | 'all'): AlertOwnerMode {
  if (level === 'all') return 'ALL';
  if (level === 'team') return 'TEAM';
  return 'OWN';
}

function defaultOwnerMode(): AlertOwnerMode {
  const levels = scopeLevels();
  if (levels.includes('all')) return 'ALL';
  if (levels.includes('team')) return 'TEAM';
  return 'OWN';
}

/** `companyCurrency` is the active company's base currency; empty when unknown (amounts then show without one). */
function createEmptyDraft(defaultMetricKey: string, companyCurrency = ''): AlertFormDraft {
  return {
    name: '',
    sourceKind: 'METRIC',
    metricKey: defaultMetricKey,
    widgetId: '',
    widgetVersionPolicy: 'FOLLOW_ACTIVE',
    widgetVersionNumber: 1,
    conditionKind: 'THRESHOLD',
    comparator: 'LT',
    thresholdText: '',
    currencyCode: companyCurrency,
    minimumCohortText: '',
    ownerMode: defaultOwnerMode(),
    branchIds: [],
    scheduleKind: 'DAILY',
    scheduleMinuteHourlyText: '0',
    scheduleTime: '09:00',
    scheduleWeekday: 0,
    timeZone: DEFAULT_TIME_ZONE,
    cooldownText: String(DEFAULT_COOLDOWN_MINUTES),
    quietEnabled: false,
    quietStartTime: '22:00',
    quietEndTime: '08:00',
    quietBehavior: 'DEFER',
    recipientMode: 'OWNER_ONLY',
    recipientUserIds: [],
    inAppEnabled: true,
    emailEnabled: false,
  };
}

function draftFromRule(rule: AlertRule, companyCurrency = ''): AlertFormDraft {
  const quietEnabled = rule.quietStartMinute !== null && rule.quietStartMinute !== undefined && rule.quietEndMinute !== null && rule.quietEndMinute !== undefined;

  return {
    name: rule.name ?? '',
    sourceKind: rule.sourceKind ?? 'METRIC',
    metricKey: rule.metricKey ?? '',
    widgetId: rule.widgetId ?? '',
    widgetVersionPolicy: rule.widgetVersionPolicy ?? 'FOLLOW_ACTIVE',
    widgetVersionNumber: rule.widgetVersionNumber ?? 1,
    conditionKind: rule.conditionKind ?? 'THRESHOLD',
    comparator: rule.comparator ?? 'LT',
    thresholdText: rule.threshold ?? '',
    currencyCode: rule.currencyCode ?? companyCurrency,
    minimumCohortText: rule.minimumCohortSize !== null && rule.minimumCohortSize !== undefined ? String(rule.minimumCohortSize) : '',
    ownerMode: rule.scope?.ownerMode ?? defaultOwnerMode(),
    branchIds: [...(rule.scope?.branchIds ?? [])],
    scheduleKind: rule.scheduleKind ?? 'DAILY',
    scheduleMinuteHourlyText: rule.scheduleKind === 'HOURLY' ? String(rule.scheduleMinute ?? 0) : '0',
    scheduleTime: rule.scheduleKind !== 'HOURLY' ? minutesToTime24(rule.scheduleMinute ?? 540) : '09:00',
    scheduleWeekday: rule.scheduleWeekday ?? 0,
    timeZone: rule.timeZone ?? DEFAULT_TIME_ZONE,
    cooldownText: String(rule.cooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES),
    quietEnabled,
    quietStartTime: quietEnabled ? minutesToTime24(rule.quietStartMinute) : '22:00',
    quietEndTime: quietEnabled ? minutesToTime24(rule.quietEndMinute) : '08:00',
    quietBehavior: rule.quietBehavior ?? 'DEFER',
    recipientMode: rule.recipientMode ?? 'OWNER_ONLY',
    recipientUserIds: [...(rule.recipientUserIds ?? [])],
    inAppEnabled: rule.channels ? rule.channels.includes('IN_APP') : true,
    emailEnabled: Boolean(rule.channels?.includes('EMAIL')),
  };
}

@Component({
  selector: 'app-alert-modal',
  imports: [
    NgIcon,
    TranslocoPipe,
    Badge,
    Button,
    Checkbox,
    ConflictDialog,
    FullState,
    Dropdown,
    Field,
    Modal,
    Segmented,
    Switch,
    TimeField,
    UnsavedDialog,
  ],
  providers: [
    provideIcons({
      tablerBellRinging,
      tablerCheck,
      tablerChevronDown,
      tablerSearch,
      tablerX,
    }),
  ],
  templateUrl: './alert-modal.html',
  host: {
    '(document:click)': 'closePopoverIfOutside($event)',
    '(window:resize)': 'closePopover()',
  },
})
export class AlertModal {
  private readonly router = inject(Router);
  protected readonly canReadiness = can('crm.analytics.readiness.view');
  protected openReadiness(): void { void this.router.navigateByUrl('/crm/settings/data-readiness'); }
  private readonly org = inject(OrgApi);
  private static nextId = 0;
  protected readonly uid = `alert-modal-${++AlertModal.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly notify = inject(Notify);
  private readonly scope = inject(ScopeState);
  private readonly companyCurrency = (): string => this.scope.company()?.currencyCode ?? '';

  private readonly modal = viewChild.required<Modal>('modal');
  private readonly unsavedDialog = viewChild.required<UnsavedDialog>('unsavedDialog');
  protected readonly conflictOpen = signal(false);
  protected readonly writeLocked = signal(false);
  readonly readOnly = input(false);
  protected readonly locked = computed(() => this.readOnly() || this.writeLocked());
  protected readonly recordFailure = signal<unknown>(null);
  protected readonly failureKind = computed(() => alertReadKind(this.recordFailure()));
  protected readonly failureText = computed(() => alertErrorText(this.transloco, this.recordFailure()));
  protected readonly testing = signal(false);
  protected readonly testResult = signal<TestAlertResult | null>(null);
  protected readonly widgetChoices = signal<PublishedWidgetOption[]>([]);
  private widgetLoadSeq = 0;
  private createBodyJson = '';
  readonly lockedChanged = output<boolean>();
  private readonly metricTrigger = viewChild<ElementRef<HTMLButtonElement>>('metricTrigger');
  private readonly branchesTrigger = viewChild<ElementRef<HTMLElement>>('branchesTrigger');
  private readonly peopleTrigger = viewChild<ElementRef<HTMLElement>>('peopleTrigger');
  private readonly popoverPanel = viewChild<ElementRef<HTMLElement>>('popoverPanel');
  private readonly metricSearchInput = viewChild<ElementRef<HTMLInputElement>>('metricSearchInput');
  private readonly peopleSearchInput = viewChild<ElementRef<HTMLInputElement>>('peopleSearchInput');

  readonly metrics = input<readonly CatalogMetric[]>([]);
  readonly saved = output<AlertRule>();
  readonly reloaded = output<AlertRule>();
  readonly deleteRequested = output<AlertRule>();

  protected readonly maxNameLength = MAX_ALERT_NAME_LENGTH;
  protected readonly branches = computed(() => this.org.branches);
  protected readonly people = computed(() => this.org.users);

  protected readonly editingRule = signal<AlertRule | null>(null);
  protected readonly baselineDraft = signal<AlertFormDraft>(createEmptyDraft('crm.leads.conversion.rate'));
  protected readonly draft = signal<AlertFormDraft>(createEmptyDraft('crm.leads.conversion.rate'));
  protected readonly submitAttempted = signal(false);
  protected readonly serverErrors = signal<Partial<Record<AlertErrorField, string>>>({});
  protected readonly saving = signal(false);
  protected readonly openPopover = signal<OpenMenu>(null);
  protected readonly popoverPlaced = signal(false);
  protected readonly popoverPlace = signal<PopoverPlace>({ top: 0, start: 0, width: 240, maxHeight: null });
  protected readonly metricQuery = signal('');
  protected readonly peopleQuery = signal('');

  private createIdemKey = newIdempotencyKey();
  private popoverSeq = 0;
  private allowClose = false;
  private resolvingClose = false;

  protected readonly isEdit = computed(() => this.editingRule() !== null);
  protected readonly nameCount = computed(() => [...this.draft().name].length);
  protected readonly dirty = computed(() => JSON.stringify(this.draft()) !== JSON.stringify(this.baselineDraft()));

  protected readonly availableMetrics = computed(() =>
    this.metrics().filter((m) => m.availability === 'AVAILABLE'),
  );

  protected readonly filteredMetrics = computed(() => {
    const q = this.metricQuery().trim().toLowerCase();
    const list = this.availableMetrics();
    if (!q) return list;
    return list.filter(
      (m) =>
        m.labelEn.toLowerCase().includes(q) ||
        m.labelAr.toLowerCase().includes(q) ||
        m.key.toLowerCase().includes(q),
    );
  });

  protected readonly filteredPeople = computed(() => {
    const q = this.peopleQuery().trim().toLowerCase();
    if (!q) return this.people();
    return this.people().filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.nameAr.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q),
    );
  });

  protected readonly selectedWidget = computed(
    () => this.widgetChoices().find((w) => w.id === this.draft().widgetId) ?? null,
  );

  protected readonly effectiveMetricKey = computed(() => {
    const current = this.draft();
    if (current.sourceKind === 'WIDGET') {
      return this.selectedWidget()?.metricKey ?? current.metricKey;
    }
    return current.metricKey;
  });

  protected readonly selectedMetric = computed(() => {
    const key = this.effectiveMetricKey();
    return this.metrics().find((m) => m.key === key) ?? null;
  });

  protected readonly resolvedValueUnit = computed<AlertValueUnit>(() => {
    const metricUnit = this.selectedMetric()?.unit;
    if (
      metricUnit === 'PERCENT' ||
      metricUnit === 'COUNT' ||
      metricUnit === 'MONEY' ||
      metricUnit === 'DURATION' ||
      metricUnit === 'RATIO'
    ) {
      return metricUnit;
    }
    return this.editingRule()?.valueUnit ?? 'COUNT';
  });

  protected readonly unitLabel = computed(() => {
    this.i18n();
    this.language();
    return this.transloco.translate(`analytics.unit.${this.resolvedValueUnit()}`);
  });

  protected readonly showCurrencyPrefix = computed(
    () =>
      this.resolvedValueUnit() === 'MONEY' &&
      this.draft().conditionKind !== 'CHANGE_PCT' &&
      this.draft().currencyCode.trim() !== '',
  );

  protected readonly showPercentSuffix = computed(
    () => this.resolvedValueUnit() === 'PERCENT' || this.draft().conditionKind === 'CHANGE_PCT',
  );

  protected readonly sourceOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    this.language();
    return [
      { value: 'METRIC', label: this.transloco.translate('alerts.form.sourceMetric') },
      { value: 'WIDGET', label: this.transloco.translate('alerts.form.sourceWidget') },
    ];
  });

  protected readonly widgetOptions = computed<DropdownOption<string>[]>(() => {
    const lang = this.language();
    return this.widgetChoices().map((w) => ({
      value: w.id,
      label: lang === 'ar' ? w.name.ar : w.name.en,
    }));
  });

  protected readonly versionPolicyOptions = computed<DropdownOption<AlertWidgetVersionPolicy>[]>(() => {
    this.i18n();
    this.language();
    return [
      { value: 'FOLLOW_ACTIVE', label: this.transloco.translate('alerts.form.followActive') },
      { value: 'PINNED', label: this.transloco.translate('alerts.form.pinned') },
    ];
  });

  protected readonly widgetVersionOptions = computed<DropdownOption<number>[]>(() => {
    this.i18n();
    this.language();
    const versions = this.selectedWidget()?.versions ?? [1];
    return versions.map((n) => ({
      value: n,
      label: this.transloco.translate('alerts.form.versionLabel', { n }),
    }));
  });

  protected readonly conditionOptions = computed<DropdownOption<AlertConditionKind>[]>(() => {
    this.i18n();
    this.language();
    return [
      { value: 'THRESHOLD', label: this.transloco.translate('alerts.form.condThreshold') },
      { value: 'CHANGE_ABS', label: this.transloco.translate('alerts.form.condChangeAbs') },
      { value: 'CHANGE_PCT', label: this.transloco.translate('alerts.form.condChangePct') },
    ];
  });

  protected readonly comparatorOptions = computed<DropdownOption<AlertComparator>[]>(() => {
    this.i18n();
    this.language();
    return [
      { value: 'LT', label: this.transloco.translate('alerts.form.compLt') },
      { value: 'LTE', label: this.transloco.translate('alerts.form.compLte') },
      { value: 'GT', label: this.transloco.translate('alerts.form.compGt') },
      { value: 'GTE', label: this.transloco.translate('alerts.form.compGte') },
    ];
  });

  protected readonly currencyOptions = computed<DropdownOption<string>[]>(() =>
    ALERT_CURRENCIES.map((code) => ({ value: code, label: code })),
  );

  protected readonly scopeOptions = computed<DropdownOption<AlertOwnerMode>[]>(() => {
    this.i18n();
    this.language();
    const levels = scopeLevels();
    const effective = levels.length > 0 ? levels : (['own'] as const);
    return effective.map((level) => ({
      value: mapScopeLevelToOwnerMode(level),
      label: this.transloco.translate(`analytics.scope.${level}`),
    }));
  });

  protected readonly scheduleOptions = computed<DropdownOption<AlertScheduleKind>[]>(() => {
    this.i18n();
    this.language();
    return [
      { value: 'HOURLY', label: this.transloco.translate('alerts.form.schedHourly') },
      { value: 'DAILY', label: this.transloco.translate('alerts.form.schedDaily') },
      { value: 'WEEKLY', label: this.transloco.translate('alerts.form.schedWeekly') },
    ];
  });

  protected readonly weekdayOptions = computed<DropdownOption<number>[]>(() => {
    this.i18n();
    this.language();
    return [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      value: day,
      label: this.transloco.translate(`chart.days.${day}`),
    }));
  });

  protected readonly timeZoneOptions = computed<DropdownOption<string>[]>(() =>
    ALERT_TIME_ZONES.map((tz) => ({ value: tz, label: tz })),
  );

  protected readonly quietBehaviorOptions = computed<DropdownOption<AlertQuietBehavior>[]>(() => {
    this.i18n();
    this.language();
    return [
      { value: 'DEFER', label: this.transloco.translate('alerts.form.quietDefer') },
      { value: 'DROP', label: this.transloco.translate('alerts.form.quietDrop') },
    ];
  });

  protected readonly recipientModeOptions = computed<DropdownOption<AlertRecipientMode>[]>(() => {
    this.i18n();
    this.language();
    return [
      { value: 'OWNER_ONLY', label: this.transloco.translate('alerts.form.recipientOwnerOnly') },
      { value: 'USERS', label: this.transloco.translate('alerts.form.recipientUsers') },
    ];
  });

  protected readonly selectedBranches = computed(() => {
    const ids = new Set(this.draft().branchIds);
    return this.branches().filter((b) => ids.has(b.id));
  });

  protected readonly selectedPeople = computed(() => {
    const ids = new Set(this.draft().recipientUserIds);
    return this.people().filter((p) => ids.has(p.id));
  });

  protected readonly validationErrors = computed<Partial<Record<AlertErrorField, string>>>(() => {
    this.i18n();
    this.language();
    const server = this.serverErrors();
    const out: Partial<Record<AlertErrorField, string>> = { ...server };
    if (!this.submitAttempted()) return out;

    const d = this.draft();
    const trimmedName = d.name.trim();
    const nameLen = [...trimmedName].length;
    if (!out.name) {
      if (nameLen === 0) {
        out.name = this.transloco.translate('alerts.validation.nameRequired');
      } else if (nameLen > MAX_ALERT_NAME_LENGTH) {
        out.name = this.transloco.translate('alerts.validation.nameMaxLength', { max: MAX_ALERT_NAME_LENGTH });
      }
    }

    if (d.sourceKind === 'METRIC' && !out.metricKey && !d.metricKey) {
      out.metricKey = this.transloco.translate('alerts.validation.metricRequired');
    }
    if (d.sourceKind === 'WIDGET' && !out.widgetId && !d.widgetId) {
      out.widgetId = this.transloco.translate('alerts.validation.widgetRequired');
    }

    const threshNum = Number(d.thresholdText.trim());
    if (!out.threshold) {
      if (d.thresholdText.trim() === '' || !Number.isFinite(threshNum)) {
        out.threshold = this.transloco.translate('alerts.validation.thresholdRequired');
      } else if (Math.abs(threshNum) > MAX_THRESHOLD_ABS) {
        out.threshold = this.transloco.translate('alerts.validation.thresholdRange');
      }
    }

    if (this.resolvedValueUnit() === 'MONEY' && !out.currencyCode && !d.currencyCode.trim()) {
      out.currencyCode = this.transloco.translate('alerts.validation.currencyRequired');
    }

    const minCohortStr = d.minimumCohortText.trim();
    if (!out.minimumCohortSize && minCohortStr !== '') {
      const n = Number(minCohortStr);
      if (!Number.isInteger(n) || n < 1) {
        out.minimumCohortSize = this.transloco.translate('alerts.validation.minCohortInvalid');
      }
    }

    const cooldownNum = Number(d.cooldownText.trim());
    if (
      !out.cooldownMinutes &&
      (d.cooldownText.trim() === '' || !Number.isInteger(cooldownNum) || cooldownNum < 0 || cooldownNum > MAX_COOLDOWN_MINUTES)
    ) {
      out.cooldownMinutes = this.transloco.translate('alerts.validation.cooldownRange');
    }

    if (!out.scheduleMinute) {
      if (d.scheduleKind === 'HOURLY') {
        const m = Number(d.scheduleMinuteHourlyText.trim());
        if (d.scheduleMinuteHourlyText.trim() === '' || !Number.isInteger(m) || m < 0 || m > 59) {
          out.scheduleMinute = this.transloco.translate('alerts.validation.minuteHourlyRange');
        }
      } else if (time24ToMinutes(d.scheduleTime) === null) {
        out.scheduleMinute = this.transloco.translate('alerts.validation.minuteRange');
      }
    }

    if (d.quietEnabled && !out.quietStartMinute) {
      const qs = time24ToMinutes(d.quietStartTime);
      const qe = time24ToMinutes(d.quietEndTime);
      if (qs === null || qe === null || qs === qe) {
        out.quietStartMinute = this.transloco.translate('alerts.validation.quietTimeInvalid');
      }
    }

    if (
      d.recipientMode === 'USERS' &&
      !out.recipientUserIds &&
      (d.recipientUserIds.length < 1 || d.recipientUserIds.length > MAX_RECIPIENTS_COUNT)
    ) {
      out.recipientUserIds = this.transloco.translate('alerts.validation.recipientsRequired');
    }

    if (!d.inAppEnabled && !d.emailEnabled && !out.channels) {
      out.channels = this.transloco.translate('alerts.validation.channelsRequired');
    }

    return out;
  });

  constructor() {
    const onScroll = (event: Event) => {
      if (!this.openPopover()) return;
      const target = event.target;
      const panel = this.popoverPanel()?.nativeElement;
      if (panel && target instanceof Node && panel.contains(target)) return;
      this.closePopover();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', onScroll, { capture: true }));
  }

  openCreate(): void {
    const defaultMetric = this.availableMetrics()[0]?.key ?? 'crm.leads.conversion.rate';
    const initial = createEmptyDraft(defaultMetric, this.companyCurrency());
    this.editingRule.set(null);
    this.baselineDraft.set(structuredClone(initial));
    this.draft.set(structuredClone(initial));
    this.createIdemKey = newIdempotencyKey();
    this.createBodyJson = '';
    this.resetTransientState();
    this.modal().open();
    void this.loadWidgetOptions();
  }

  openEdit(rule: AlertRule): void {
    const initial = draftFromRule(rule, this.companyCurrency());
    this.editingRule.set(rule);
    this.baselineDraft.set(structuredClone(initial));
    this.draft.set(structuredClone(initial));
    this.resetTransientState();
    this.modal().open();
    void this.loadWidgetOptions();
  }

  close(): void {
    this.closePopover();
    this.allowClose = true;
    this.modal().close();
  }

  editingId(): string | null {
    return this.editingRule()?.id ?? null;
  }

  protected fieldError(field: AlertErrorField): string | null {
    return this.validationErrors()[field] ?? null;
  }

  protected describedBy(baseId: string, error: string | null): string {
    return `${baseId}-hint${error ? ` ${baseId}-error` : ''}`;
  }

  protected metricLabel(metric: CatalogMetric): string {
    return this.language() === 'ar' ? metric.labelAr : metric.labelEn;
  }

  protected branchName(branch: OrgBranch): string {
    return this.language() === 'ar' ? branch.name.ar : branch.name.en;
  }

  protected personName(person: OrgUser): string {
    return this.language() === 'ar' ? person.nameAr : person.name;
  }

  protected patchDraft(patch: Partial<AlertFormDraft>, clearField?: AlertErrorField): void {
    if (this.locked()) return;
    this.testResult.set(null);
    this.draft.update((d) => ({ ...d, ...patch }));
    if (clearField) {
      this.clearServerError(clearField);
    }
  }

  protected onSourceChange(source: string | null): void {
    if (source !== 'METRIC' && source !== 'WIDGET') return;
    this.closePopover();
    this.patchDraft({ sourceKind: source }, 'metricKey');
    this.clearServerError('widgetId');
    this.clearServerError('valueUnit');
  }

  protected onWidgetChange(widgetId: string): void {
    void this.loadWidgetVersions(widgetId);
    const widget = this.widgetChoices().find((w) => w.id === widgetId);
    this.patchDraft(
      {
        widgetId,
        widgetVersionNumber: widget?.activeVersionNumber ?? 1,
      },
      'widgetId',
    );
    this.clearServerError('valueUnit');
  }

  protected selectMetric(metricKey: string): void {
    this.patchDraft({ metricKey }, 'metricKey');
    this.clearServerError('valueUnit');
    this.closePopover();
    this.metricTrigger()?.nativeElement.focus();
  }

  protected toggleBranch(branchId: string): void {
    const current = this.draft().branchIds;
    const next = current.includes(branchId)
      ? current.filter((id) => id !== branchId)
      : [...current, branchId];
    this.patchDraft({ branchIds: next });
  }

  protected removeBranch(branchId: string, event: Event): void {
    event.stopPropagation();
    this.patchDraft({ branchIds: this.draft().branchIds.filter((id) => id !== branchId) });
  }

  protected togglePerson(userId: string): void {
    const current = this.draft().recipientUserIds;
    if (current.includes(userId)) {
      this.patchDraft({ recipientUserIds: current.filter((id) => id !== userId) }, 'recipientUserIds');
      return;
    }
    if (current.length >= MAX_RECIPIENTS_COUNT) return;
    this.patchDraft({ recipientUserIds: [...current, userId] }, 'recipientUserIds');
  }

  protected removePerson(userId: string, event: Event): void {
    event.stopPropagation();
    this.patchDraft(
      { recipientUserIds: this.draft().recipientUserIds.filter((id) => id !== userId) },
      'recipientUserIds',
    );
  }

  protected onInAppToggle(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.patchDraft({ inAppEnabled: checked }, 'channels');
  }

  protected onEmailToggle(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.patchDraft({ emailEnabled: checked }, 'channels');
  }

  protected togglePopover(menu: Exclude<OpenMenu, null>): void {
    if (this.openPopover() === menu) {
      this.closePopover();
      return;
    }
    const triggerEl = this.triggerFor(menu);
    if (!triggerEl) return;

    const seq = ++this.popoverSeq;
    if (menu === 'metric') this.metricQuery.set('');
    if (menu === 'people') this.peopleQuery.set('');

    this.popoverPlaced.set(false);
    this.popoverPlace.set(this.initialPopoverPlace(triggerEl));
    this.openPopover.set(menu);
    queueMicrotask(() => this.placePopover(seq, menu));
    afterNextRender(() => this.placePopover(seq, menu), { injector: this.injector });
  }

  protected closePopover(): void {
    this.popoverSeq++;
    this.openPopover.set(null);
    this.popoverPlaced.set(false);
  }

  protected closePopoverIfOutside(event: Event): void {
    const open = this.openPopover();
    if (!open) return;
    const target = event.target as Node | null;
    if (!target) {
      this.closePopover();
      return;
    }
    const triggerEl = this.triggerFor(open);
    const panelEl = this.popoverPanel()?.nativeElement;
    if (triggerEl?.contains(target) || panelEl?.contains(target)) return;
    this.closePopover();
  }

  protected onInputDraft(
    field: 'name' | 'thresholdText' | 'minimumCohortText' | 'scheduleMinuteHourlyText' | 'cooldownText',
    event: Event,
    clearError?: AlertErrorField,
  ): void {
    const value = (event.target as HTMLInputElement).value;
    this.patchDraft({ [field]: value } as Partial<AlertFormDraft>, clearError);
  }

  protected onMetricSearchInput(event: Event): void {
    this.metricQuery.set((event.target as HTMLInputElement).value);
  }

  protected onPeopleSearchInput(event: Event): void {
    this.peopleQuery.set((event.target as HTMLInputElement).value);
  }

  protected onInnerEscape(event: Event): void {
    const open = this.openPopover();
    if (!open) return;
    event.preventDefault();
    event.stopPropagation();
    const triggerEl = this.triggerFor(open);
    this.closePopover();
    triggerEl?.focus();
  }

  protected undo(): void {
    if (!this.isEdit() || this.saving()) return;
    this.draft.set(structuredClone(this.baselineDraft()));
    this.submitAttempted.set(false);
    this.serverErrors.set({});
    this.closePopover();
  }

  protected requestDelete(): void {
    const current = this.editingRule();
    if (!current || this.saving()) return;
    this.deleteRequested.emit(current);
  }

  protected requestClose(): void {
    if (this.saving()) return;
    if (!this.dirty()) {
      this.close();
      return;
    }
    void this.promptUnsavedAndClose();
  }

  protected onModalClosed(): void {
    this.closePopover();
    if (!this.allowClose && (this.resolvingClose || this.dirty())) {
      this.modal().open();
      void this.promptUnsavedAndClose();
      return;
    }
    this.allowClose = false;
    this.editingRule.set(null);
    this.resetTransientState();
  }

  protected async save(): Promise<boolean> {
    if (this.saving() || this.locked() || this.recordFailure()) return false;
    this.closePopover();
    this.submitAttempted.set(true);
    this.serverErrors.set({});

    const errors = this.validationErrors();
    if (Object.keys(errors).length > 0) {
      return false;
    }

    const d = this.draft();
    const unit = this.resolvedValueUnit();
    const threshold = Number(d.thresholdText.trim());
    const minCohort = d.minimumCohortText.trim() === '' ? null : Number(d.minimumCohortText.trim());
    const cooldownMinutes = Number(d.cooldownText.trim());
    const scheduleMinute =
      d.scheduleKind === 'HOURLY'
        ? Number(d.scheduleMinuteHourlyText.trim())
        : (time24ToMinutes(d.scheduleTime) ?? 540);
    const channels: AlertChannel[] = [
      ...(d.inAppEnabled ? (['IN_APP'] as const) : []),
      ...(d.emailEnabled ? (['EMAIL'] as const) : []),
    ];

    const payload: CreateAlertRule = {
      name: d.name.trim(),
      sourceKind: d.sourceKind,
      widgetId: d.sourceKind === 'WIDGET' ? d.widgetId : null,
      widgetVersionPolicy: d.sourceKind === 'WIDGET' ? d.widgetVersionPolicy : null,
      widgetVersionNumber:
        d.sourceKind === 'WIDGET' && d.widgetVersionPolicy === 'PINNED' ? d.widgetVersionNumber : null,
      metricKey: this.effectiveMetricKey(),
      scope: {
        branchIds: [...d.branchIds],
        ownerMode: d.ownerMode,
      },
      conditionKind: d.conditionKind,
      comparator: d.comparator,
      threshold,
      valueUnit: unit,
      currencyCode: unit === 'MONEY' ? d.currencyCode : null,
      minimumCohortSize: minCohort,
      cooldownMinutes,
      timeZone: d.timeZone,
      scheduleKind: d.scheduleKind,
      scheduleMinute,
      scheduleWeekday: d.scheduleKind === 'WEEKLY' ? d.scheduleWeekday : null,
      quietStartMinute: d.quietEnabled ? time24ToMinutes(d.quietStartTime) : null,
      quietEndMinute: d.quietEnabled ? time24ToMinutes(d.quietEndTime) : null,
      quietBehavior: d.quietBehavior,
      recipientMode: d.recipientMode,
      recipientUserIds: d.recipientMode === 'USERS' ? [...d.recipientUserIds] : [],
      channels,
    };

    this.saving.set(true);
    try {
      const existing = this.editingRule();
      if (!existing) {
        const bodyJson = JSON.stringify(payload);
        if (bodyJson !== this.createBodyJson) {
          this.createBodyJson = bodyJson;
          this.createIdemKey = newIdempotencyKey();
        }
        const created = await createAlert(payload, this.createIdemKey);
        this.notify.success(this.transloco.translate('alerts.toasts.created'));
        this.saved.emit(created);
        this.close();
        return true;
      }

      const patch: UpdateAlertRule = {
        ...payload,
        revision: existing.revision,
      };
      const updated = await updateAlert(existing.id, patch);
      this.notify.success(this.transloco.translate('alerts.toasts.saved'));
      this.saved.emit(updated);
      this.close();
      return true;
    } catch (error) {
      await this.handleSaveError(error);
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  private async handleSaveError(error: unknown): Promise<void> {
    const code = errorCodeOf(error);
    if (!(error instanceof ApiError) || ![0, 401].includes(error.status) && error.status < 500 && code !== 'GW.IDEM.IN_FLIGHT') this.createBodyJson = '';
    if (code?.endsWith('_STALE') || code?.endsWith('_CONFLICT')) {
      this.conflictOpen.set(true);
      return;
    }
    if (alertWriteLocked(error)) {
      this.writeLocked.set(true);
      this.lockedChanged.emit(true);
    }
    if (code === 'CRM_ALERT_NOT_FOUND') this.recordFailure.set(error);
    const fields = fieldErrorsOf(error);
    const detailField = Object.keys(fields)[0] as AlertErrorField | undefined;

    if (code === 'CRM_ALERT_UNIT_MISMATCH') {
      this.serverErrors.set({ valueUnit: this.transloco.translate(errorKey(code)) });
      return;
    }
    if (code === 'CRM_ALERT_SCHEDULE_INVALID') {
      const targetField: AlertErrorField = detailField ?? 'scheduleMinute';
      this.serverErrors.set({ [targetField]: this.transloco.translate(errorKey(code)) });
      return;
    }
    if (code === 'CRM_ALERT_RECIPIENTS_INVALID') {
      const targetField: AlertErrorField = detailField ?? 'recipientUserIds';
      this.serverErrors.set({ [targetField]: this.transloco.translate(errorKey(code)) });
      return;
    }
    if (code === 'CRM_VALIDATION_FAILED' && detailField) {
      this.serverErrors.set(Object.fromEntries(Object.keys(fields).map((field) => [field, this.transloco.translate(errorKey(code))])));
      return;
    }

    this.notify.error(alertErrorText(this.transloco, error));
  }

  private async promptUnsavedAndClose(): Promise<void> {
    if (this.resolvingClose) return;
    this.resolvingClose = true;
    try {
      const choice = await this.unsavedDialog().open();
      if (choice === 'discard') {
        this.close();
      } else if (choice === 'save') {
        await this.save();
      }
    } finally {
      this.resolvingClose = false;
    }
  }

  protected async resolveConflict(reload: boolean): Promise<void> {
    const current = this.editingRule();
    if (!current || this.saving()) return;
    this.saving.set(true);
    try {
      const fresh = await getAlert(current.id);
      this.editingRule.set(reload ? fresh : { ...current, revision: fresh.revision });
      if (reload) {
        const next = draftFromRule(fresh, this.companyCurrency());
        this.baselineDraft.set(structuredClone(next));
        this.draft.set(structuredClone(next));
        this.submitAttempted.set(false);
        this.serverErrors.set({});
      }
      this.reloaded.emit(fresh);
    } catch (error) {
      this.recordFailure.set(error);
      this.notify.error(alertErrorText(this.transloco, error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async reloadRecord(): Promise<void> {
    resetAlertWriteConflicts();
    this.writeLocked.set(false);
    this.lockedChanged.emit(false);
    this.recordFailure.set(null);
    if (this.editingRule()) await this.resolveConflict(true);
    else await this.loadWidgetOptions();
  }

  protected async runTest(): Promise<void> {
    const rule = this.editingRule();
    if (!rule || this.testing() || this.saving() || this.dirty()) return;
    this.testing.set(true);
    this.testResult.set(null);
    try {
      const result = await testAlert(rule.id);
      if (this.editingId() === rule.id) this.testResult.set(result);
    } catch (error) {
      this.notify.error(alertErrorText(this.transloco, error));
    } finally {
      this.testing.set(false);
    }
  }

  protected readonly testResultText = computed(() => {
    this.i18n();
    const result = this.testResult();
    if (!result) return '';
    if (result.value === null) return this.transloco.translate('alerts.toasts.testUnavailable', { reason: this.transloco.translate(reasonKey(result.reasonCode ?? null)) });
    const key = result.met ? result.wouldNotify ? 'testMetNotify' : 'testMetSuppressed' : 'testNotMet';
    const rule = this.editingRule();
    const value = formatAlertAmount(result.value, rule?.valueUnit, rule?.currencyCode, this.language(), rule?.conditionKind);
    return this.transloco.translate(`alerts.toasts.${key}`, { value });
  });

  private async loadWidgetOptions(): Promise<void> {
    const seq = ++this.widgetLoadSeq;
    void Promise.all([this.org.listGrantedBranches(), this.org.listUsers()]).catch((error: unknown) => this.notify.error(alertErrorText(this.transloco, error)));
    try {
      const choices = await listPublishedWidgetOptions();
      if (seq !== this.widgetLoadSeq) return;
      this.widgetChoices.set(choices);
      if (choices.some((choice) => choice.id === this.draft().widgetId)) void this.loadWidgetVersions(this.draft().widgetId);
    } catch (error) {
      if (seq === this.widgetLoadSeq) {
        if (alertReadKind(error) === 'provisioning') this.recordFailure.set(error);
        else this.notify.error(alertErrorText(this.transloco, error));
      }
    }
  }

  private async loadWidgetVersions(id: string): Promise<void> {
    try {
      const versions = await listAlertWidgetVersions(id);
      this.widgetChoices.update((choices) => choices.map((choice) => choice.id === id ? { ...choice, versions } : choice));
    } catch (error) {
      this.notify.error(alertErrorText(this.transloco, error));
    }
  }

  private resetTransientState(): void {
    this.conflictOpen.set(false);
    this.recordFailure.set(null);
    this.testResult.set(null);
    this.widgetLoadSeq++;

    this.submitAttempted.set(false);
    this.serverErrors.set({});
    this.saving.set(false);
    this.closePopover();
    this.allowClose = false;
  }

  private clearServerError(field: AlertErrorField): void {
    if (!this.serverErrors()[field]) return;
    this.serverErrors.update((curr) => {
      const copy = { ...curr };
      delete copy[field];
      return copy;
    });
  }

  private triggerFor(menu: Exclude<OpenMenu, null>): HTMLElement | undefined {
    if (menu === 'metric') return this.metricTrigger()?.nativeElement;
    if (menu === 'branches') return this.branchesTrigger()?.nativeElement;
    return this.peopleTrigger()?.nativeElement;
  }

  private initialPopoverPlace(triggerEl: HTMLElement): PopoverPlace {
    const rect = rectInPage(triggerEl);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    return {
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
      width: rect.width,
      maxHeight: null,
    };
  }

  private placePopover(seq: number, menu: Exclude<OpenMenu, null>): void {
    if (seq !== this.popoverSeq || this.openPopover() !== menu || this.popoverPlaced()) return;
    const triggerEl = this.triggerFor(menu);
    const panelEl = this.popoverPanel()?.nativeElement;
    if (!triggerEl || !panelEl) return;

    const rect = rectInPage(triggerEl);
    const panelRect = rectInPage(panelEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const spaceBelow = Math.max(8, height - 8 - belowTop);
    const spaceAbove = Math.max(8, rect.top - 12);
    const flipUp = panelRect.height > spaceBelow && spaceAbove > spaceBelow;
    const avail = flipUp ? spaceAbove : spaceBelow;
    const maxHeight = panelRect.height > avail ? avail : null;
    const finalHeight = maxHeight ?? panelRect.height;
    const top = flipUp ? Math.max(8, rect.top - 4 - finalHeight) : belowTop;

    const triggerStart = rtl ? width - rect.right : rect.left;
    const triggerEnd = rtl ? width - rect.left : rect.right;
    const alignEnd = triggerStart + panelRect.width > width - 8;
    const rawStart = alignEnd ? triggerEnd - panelRect.width : triggerStart;
    const start = Math.min(Math.max(8, rawStart), Math.max(8, width - 8 - panelRect.width));

    this.popoverPlace.set({ top, start, width: rect.width, maxHeight });
    this.popoverPlaced.set(true);

    panelEl.style.top = `${top}px`;
    panelEl.style.insetInlineStart = `${start}px`;
    panelEl.style.minWidth = `${rect.width}px`;
    panelEl.style.maxHeight = maxHeight !== null ? `${maxHeight}px` : '';
    panelEl.classList.remove('invisible');

    if (menu === 'metric') {
      this.metricSearchInput()?.nativeElement.focus();
    } else if (menu === 'people') {
      this.peopleSearchInput()?.nativeElement.focus();
    }
  }
}
