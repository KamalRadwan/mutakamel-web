import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlarm,
  tablerAlertTriangle,
  tablerCalendarPlus,
  tablerCheck,
  tablerCircleDot,
  tablerMail,
  tablerMap2,
  tablerPhone,
  tablerSquareCheck,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { CurrentUser } from '../../../../../core/auth/current-user';
import { LanguageState } from '../../../../../core/i18n/language';
import { PluralKeyPipe } from '../../../../../core/i18n/plural';
import { Notify } from '../../../../../core/notify/notify';
import { sessionBranch } from '../../../shared/lookups/session-branch';
import { BulkJobsTracker } from '../../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { BulkJobSelection, BulkJobSubmit } from '../../../../../shared/bulk-jobs/bulk-jobs.model';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { DateField } from '../../../../../shared/ui/date-time/date-field';
import { TimeField } from '../../../../../shared/ui/date-time/time-field';
import { Dropdown, DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { Field } from '../../../../../shared/ui/field/field';
import { Segmented, SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { Switch } from '../../../../../shared/ui/switch/switch';
import {
  ACTIVITY_TYPES,
  ActivityDirection,
  ActivityPriority,
  ActivityType,
  LIMITS,
  TYPE_FIELDS,
  TYPE_LOOK,
} from '../../../../../shared/widgets/activities/activities.model';
import {
  codePointLength,
  fromLocalDateTime,
  isValidMeetingLink,
  toLocalDateTime,
} from '../../../../../shared/widgets/activities/activity-form/activity-form.model';
import { BulkRunModal } from '../../../shared/record/bulk/bulk-run-modal/bulk-run-modal';
import { ApiError, errorCodeOf } from '../../../settings/shared/settings-api';
import { listCustomerBulkOwners } from '../customer-bulk.api';
import { CustomerCapabilities, OwnerOption } from '../../customers.model';
import {
  CUSTOMERS_BULK_APP,
  CUSTOMERS_BULK_MODULE_ID,
  CustomerBulkActivityParams,
  SelectedCustomerRow,
  extractBulkErrorParams,
  translateCustomerBulkError,
  customerBulkReadOnly,
  customerBulkLoadFailure,
} from '../customer-bulk.model';
import { CustomerBulkSubmitKey } from '../customer-bulk-submit-key';
import { CustomerSelection } from '../customer-selection';
import {
  BatchAssigneeMode,
  BatchOrder,
  GapPreset,
  roundUpTo15Minutes,
  toWireCustomerActivitySchedule,
  computeCustomerBatchActivitySchedule,
} from './customer-bulk-schedule';

interface InitialSnapshot {
  type: ActivityType;
  priority: ActivityPriority;
  direction: ActivityDirection | '';
  duration: string;
  reminder: string;
  startDate: string;
  startTime: string;
  gapPreset: GapPreset;
  customGap: string;
  order: BatchOrder;
  assigneeMode: BatchAssigneeMode;
  spacePerAssignee: boolean;
}

const MIN_GAP_MINUTES = 1;
const MAX_GAP_MINUTES = 1440;
const PREVIEW_LIMIT = 5;
const DEFAULT_TYPE: ActivityType = 'CALL';
const DEFAULT_REMINDER = '15';
const DEFAULT_GAP: GapPreset = '15';
const PRIORITIES: readonly ActivityPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const DIRECTIONS: ReadonlyArray<ActivityDirection | ''> = ['', 'INBOUND', 'OUTBOUND', 'INTERNAL'];
const REMINDERS = ['', '5', '15', '30', '60', '1440'] as const;
const GAP_PRESETS: readonly GapPreset[] = ['5', '10', '15', '30', '60', 'custom'];

function durationsForType(type: ActivityType): readonly number[] {
  return type === 'CALL' ? [15, 30, 60, 90, 120] : [30, 60, 90, 120];
}

function defaultDurationValue(type: ActivityType): string {
  const def = TYPE_FIELDS[type].defaultMinutes;
  return def !== null ? String(def) : '';
}

function parseCustomGapMinutes(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < MIN_GAP_MINUTES || parsed > MAX_GAP_MINUTES) return null;
  return parsed;
}

@Component({
  selector: 'app-customer-bulk-activity-modal',
  imports: [
    NgIcon,
    TranslocoPipe,
    PluralKeyPipe,
    BulkRunModal,
    ConfirmDialog,
    DateField,
    TimeField,
    Dropdown,
    FullState,
    Field,
    Segmented,
    Switch,
  ],
  providers: [
    provideIcons({
      tablerCalendarPlus,
      tablerSquareCheck,
      tablerPhone,
      tablerUsers,
      tablerMail,
      tablerMap2,
      tablerAlarm,
      tablerCircleDot,
      tablerCheck,
      tablerAlertTriangle,
    }),
  ],
  templateUrl: './customer-bulk-activity-modal.html',
})
export class CustomerBulkActivityModal {
  private static nextId = 0;
  protected readonly uid = `customer-bulk-activity-${++CustomerBulkActivityModal.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly currentUser = inject(CurrentUser);
  private readonly notify = inject(Notify);
  private readonly selection = inject(CustomerSelection, { optional: true });
  private readonly tracker = inject(BulkJobsTracker);

  private readonly modal = viewChild.required<BulkRunModal>('formModal');
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');
  private readonly typeButtons = viewChildren<ElementRef<HTMLButtonElement>>('typeBtn');

  readonly branchId = input('');
  readonly capabilities = input<CustomerCapabilities | null>(null);
  readonly submitted = output<string>();

  protected readonly activityTypes = ACTIVITY_TYPES;
  protected readonly typeLook = TYPE_LOOK;
  protected readonly limits = LIMITS;

  protected readonly rows = signal<SelectedCustomerRow[]>([]);
  protected readonly owners = signal<OwnerOption[]>([]);
  protected readonly ownersDenied = signal(false);
  protected readonly resolving = signal(false);
  protected readonly submitting = signal(false);
  protected readonly readOnly = signal(false);
  protected readonly loadFailure = signal<string | null>(null);
  protected readonly nowMs = signal(Date.now());

  protected readonly type = signal<ActivityType>(DEFAULT_TYPE);
  protected readonly subject = signal('');
  protected readonly priority = signal<ActivityPriority>('NORMAL');
  protected readonly direction = signal<ActivityDirection | ''>('');
  protected readonly duration = signal(defaultDurationValue(DEFAULT_TYPE));
  protected readonly reminder = signal<string>(DEFAULT_REMINDER);
  protected readonly location = signal('');
  protected readonly meetingUrl = signal('');
  protected readonly description = signal('');

  protected readonly startDate = signal('');
  protected readonly startTime = signal('');
  protected readonly gapPreset = signal<GapPreset>(DEFAULT_GAP);
  protected readonly customGap = signal('20');
  protected readonly lastValidGap = signal(15);
  protected readonly order = signal<BatchOrder>('table');
  protected readonly assigneeMode = signal<BatchAssigneeMode>('owner');
  protected readonly chosenAssigneeId = signal('');
  protected readonly chosenAssigneeTouched = signal(false);
  protected readonly spacePerAssignee = signal(true);

  protected readonly requestError = signal<string | null>(null);
  private readonly serverStartError = signal<string | null>(null);
  private readonly touched = signal<Partial<Record<'subject' | 'location' | 'meetingUrl' | 'description' | 'gap', boolean>>>({});
  private readonly revealAllErrors = signal(false);
  private initialSnapshot: InitialSnapshot | null = null;
  private allowClose = false;
  private confirmingDiscard = false;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private openSeq = 0;
  private readonly submitKey = new CustomerBulkSubmitKey();

  private readonly effectiveBranchId = computed(() => {
    const branchId = sessionBranch()?.branchId ?? '';
    return !this.branchId() || this.branchId() === branchId ? branchId : '';
  });

  protected readonly displayCount = computed(() =>
    this.resolving() && this.rows().length === 0 ? (this.selection?.count() ?? 0) : this.rows().length,
  );

  // Backend rule: direction for CALL/EMAIL only; location + meetingUrl for MEETING/VISIT only.
  protected readonly typeFields = computed(() => {
    const currentType = this.type();
    return {
      direction: currentType === 'CALL' || currentType === 'EMAIL',
      location: currentType === 'MEETING' || currentType === 'VISIT',
      meetingUrl: currentType === 'MEETING' || currentType === 'VISIT',
      defaultMinutes: TYPE_FIELDS[currentType].defaultMinutes,
    };
  });

  protected readonly subjectCount = computed(() => codePointLength(this.subject()));
  protected readonly locationCount = computed(() => codePointLength(this.location()));
  protected readonly descriptionCount = computed(() => codePointLength(this.description()));
  protected readonly meetingLinkValid = computed(() => isValidMeetingLink(this.meetingUrl()));

  protected readonly todayIso = computed(() => {
    this.nowMs();
    return toLocalDateTime(new Date()).date;
  });

  protected readonly todayLabel = computed(() => {
    this.i18n();
    return this.transloco.translate('customerBulk.activity.today');
  });

  protected readonly priorityOptions = computed<DropdownOption<ActivityPriority>[]>(() => {
    this.i18n();
    return PRIORITIES.map((value) => ({
      value,
      label: this.transloco.translate(`customerBulk.activity.priorities.${value}`),
    }));
  });

  protected readonly directionOptions = computed<DropdownOption<ActivityDirection | ''>[]>(() => {
    this.i18n();
    return DIRECTIONS.map((value) => ({
      value,
      label: this.transloco.translate(`customerBulk.activity.directions.${value || 'NONE'}`),
    }));
  });

  protected readonly durationOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const list: DropdownOption<string>[] = [
      { value: '', label: this.transloco.translate('customerBulk.activity.noEnd') },
    ];
    for (const mins of durationsForType(this.type())) {
      list.push({
        value: String(mins),
        label: this.transloco.translate('customerBulk.activity.gapMinutes', { n: mins }),
      });
    }
    return list;
  });

  protected readonly reminderOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return REMINDERS.map((value) => ({
      value,
      label:
        value === ''
          ? this.transloco.translate('customerBulk.activity.reminderNone')
          : value === '1440'
            ? this.transloco.translate('customerBulk.activity.reminderDay')
            : this.transloco.translate('customerBulk.activity.reminderMin', { n: Number(value) }),
    }));
  });

  protected readonly gapOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return GAP_PRESETS.map((value) => ({
      value,
      label:
        value === 'custom'
          ? this.transloco.translate('customerBulk.activity.gapCustom')
          : this.transloco.translate('customerBulk.activity.gapMinutes', { n: Number(value) }),
    }));
  });

  protected readonly orderOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'table', label: this.transloco.translate('customerBulk.activity.orderTable') },
      { value: 'owner', label: this.transloco.translate('customerBulk.activity.orderOwner') },
    ];
  });

  protected readonly assigneeModeOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'owner', label: this.transloco.translate('customerBulk.activity.assignee.owner') },
      { value: 'me', label: this.transloco.translate('customerBulk.activity.assignee.me') },
      { value: 'other', label: this.transloco.translate('customerBulk.activity.assignee.other') },
    ];
  });

  protected readonly assigneeDropdownOptions = computed<DropdownOption<string>[]>(() =>
    this.owners().map((owner) => ({ value: owner.userId, label: owner.name })),
  );

  protected readonly startDateTime = computed(() => fromLocalDateTime(this.startDate(), this.startTime()));

  protected readonly gapError = computed<string | null>(() => {
    this.i18n();
    if (this.gapPreset() !== 'custom') return null;
    if (parseCustomGapMinutes(this.customGap()) !== null) return null;
    if (!this.touched().gap && !this.revealAllErrors()) return null;
    return this.transloco.translate('customerBulk.activity.gapInvalid');
  });

  protected readonly resolvedGapMinutes = computed(() => {
    const preset = this.gapPreset();
    if (preset === 'custom') {
      return parseCustomGapMinutes(this.customGap()) ?? this.lastValidGap();
    }
    return Number(preset);
  });

  protected readonly resolvedDurationMinutes = computed<number | null>(() => {
    const raw = this.duration();
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  });

  protected readonly subjectError = computed<string | null>(() => {
    this.i18n();
    if (!this.touched().subject && !this.revealAllErrors()) return null;
    const trimmed = this.subject().trim();
    if (!trimmed) return this.transloco.translate('customerBulk.activity.validation.required');
    if (this.subjectCount() > LIMITS.subject) {
      return this.transloco.translate('customerBulk.activity.validation.maxLength', { max: LIMITS.subject });
    }
    return null;
  });

  protected readonly locationError = computed<string | null>(() => {
    this.i18n();
    if (!this.typeFields().location) return null;
    if (!this.touched().location && !this.revealAllErrors()) return null;
    if (this.locationCount() > LIMITS.location) {
      return this.transloco.translate('customerBulk.activity.validation.maxLength', { max: LIMITS.location });
    }
    return null;
  });

  protected readonly meetingUrlError = computed<string | null>(() => {
    this.i18n();
    if (!this.typeFields().meetingUrl) return null;
    if (!this.touched().meetingUrl && !this.revealAllErrors()) return null;
    const raw = this.meetingUrl().trim();
    if (!raw) return null;
    if (raw.length > LIMITS.meetingUrl) {
      return this.transloco.translate('customerBulk.activity.validation.maxLength', { max: LIMITS.meetingUrl });
    }
    if (!isValidMeetingLink(raw)) {
      return this.transloco.translate('customerBulk.activity.validation.invalidUrl');
    }
    return null;
  });

  protected readonly descriptionError = computed<string | null>(() => {
    this.i18n();
    if (!this.touched().description && !this.revealAllErrors()) return null;
    if (this.descriptionCount() > LIMITS.description) {
      return this.transloco.translate('customerBulk.activity.validation.maxLength', { max: LIMITS.description });
    }
    return null;
  });

  protected readonly startError = computed<string | null>(() => {
    this.i18n();
    const serverErr = this.serverStartError();
    if (serverErr) return serverErr;
    const dt = this.startDateTime();
    if (!dt || dt.getTime() <= this.nowMs()) {
      return this.transloco.translate('customerBulk.activity.startPast');
    }
    return null;
  });

  protected readonly startDescribedBy = computed(() =>
    this.startError() ? `${this.uid}-start-date-hint ${this.uid}-start-date-error` : `${this.uid}-start-date-hint`,
  );

  private readonly gapFieldId = computed(() =>
    this.gapPreset() === 'custom' ? `${this.uid}-custom-gap` : `${this.uid}-gap`,
  );

  protected readonly gapDescribedBy = computed(() =>
    this.gapError() ? `${this.gapFieldId()}-hint ${this.gapFieldId()}-error` : `${this.gapFieldId()}-hint`,
  );

  private readonly hasValidationIssue = computed(() => {
    const trimmedSubject = this.subject().trim();
    if (!trimmedSubject || this.subjectCount() > LIMITS.subject) return true;
    if (this.typeFields().location && this.locationCount() > LIMITS.location) return true;
    const url = this.meetingUrl().trim();
    if (this.typeFields().meetingUrl && url && (url.length > LIMITS.meetingUrl || !isValidMeetingLink(url))) {
      return true;
    }
    if (this.descriptionCount() > LIMITS.description) return true;
    if (this.gapPreset() === 'custom' && parseCustomGapMinutes(this.customGap()) === null) return true;
    const dt = this.startDateTime();
    if (!dt || dt.getTime() <= this.nowMs()) return true;
    if (this.assigneeMode() === 'other' && !this.chosenAssigneeId()) return true;
    return false;
  });

  protected readonly submitBlocked = computed(
    () =>
      this.resolving() ||
      this.readOnly() ||
      this.loadFailure() !== null ||
      this.submitting() ||
      this.rows().length === 0 ||
      this.hasValidationIssue(),
  );

  private readonly ownerNameMap = computed<ReadonlyMap<string, string>>(() => {
    const map = new Map<string, string>();
    for (const owner of this.owners()) {
      map.set(owner.userId, owner.name);
    }
    const me = this.currentUser.user();
    if (me?.id && !map.has(me.id)) {
      map.set(me.id, me.displayName);
    }
    return map;
  });

  protected readonly computedSchedule = computed(() => {
    const start = this.startDateTime() ?? roundUpTo15Minutes(new Date(this.nowMs()));
    const me = this.currentUser.user();
    return computeCustomerBatchActivitySchedule({
      rows: this.rows(),
      start,
      gapMinutes: this.resolvedGapMinutes(),
      durationMinutes: this.resolvedDurationMinutes(),
      order: this.order(),
      assigneeMode: this.assigneeMode(),
      chosenAssigneeId: this.chosenAssigneeId(),
      spacePerAssignee: this.spacePerAssignee(),
      currentUserId: this.currentUser.userId(),
      currentUserName: me?.displayName ?? this.currentUser.userId(),
      ownerNames: this.ownerNameMap(),
    });
  });

  protected readonly previewRows = computed(() => this.computedSchedule().items.slice(0, PREVIEW_LIMIT));
  protected readonly moreCount = computed(() =>
    Math.max(0, this.computedSchedule().items.length - this.previewRows().length),
  );
  protected readonly noOwnerCount = computed(() =>
    this.assigneeMode() === 'owner' ? this.computedSchedule().noOwnerCount : 0,
  );

  protected readonly summaryFirst = computed(() => this.formatTime(this.computedSchedule().firstStart));
  protected readonly summaryLast = computed(() => this.formatTime(this.computedSchedule().lastStart));

  protected readonly dirty = computed(() => {
    const init = this.initialSnapshot;
    if (!init) return false;
    return (
      this.type() !== init.type ||
      this.subject() !== '' ||
      this.priority() !== init.priority ||
      this.direction() !== init.direction ||
      this.duration() !== init.duration ||
      this.reminder() !== init.reminder ||
      this.location() !== '' ||
      this.meetingUrl() !== '' ||
      this.description() !== '' ||
      this.startDate() !== init.startDate ||
      this.startTime() !== init.startTime ||
      this.gapPreset() !== init.gapPreset ||
      (this.gapPreset() === 'custom' && this.customGap() !== init.customGap) ||
      this.order() !== init.order ||
      this.assigneeMode() !== init.assigneeMode ||
      this.spacePerAssignee() !== init.spacePerAssignee ||
      (this.assigneeMode() === 'other' && this.chosenAssigneeTouched())
    );
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.stopClock());
  }

  open(rows?: readonly SelectedCustomerRow[]): void {
    void this.initOpen(rows);
  }

  protected setType(nextType: ActivityType): void {
    this.type.set(nextType);
    this.duration.set(defaultDurationValue(nextType));
    if (nextType !== 'CALL' && nextType !== 'EMAIL') {
      this.direction.set('');
    }
    if (nextType !== 'MEETING' && nextType !== 'VISIT') {
      this.location.set('');
      this.meetingUrl.set('');
    }
    this.requestError.set(null);
  }

  protected onTypeKeydown(event: KeyboardEvent, index: number): void {
    const list = this.activityTypes;
    const rtl = this.isRtl();
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    let targetIndex = -1;
    if (event.key === nextKey || event.key === 'ArrowDown') {
      targetIndex = (index + 1) % list.length;
    } else if (event.key === prevKey || event.key === 'ArrowUp') {
      targetIndex = (index - 1 + list.length) % list.length;
    } else if (event.key === 'Home') {
      targetIndex = 0;
    } else if (event.key === 'End') {
      targetIndex = list.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    this.setType(list[targetIndex]);
    this.typeButtons()[targetIndex]?.nativeElement.focus();
  }

  protected onTextInput(field: 'subject' | 'location' | 'meetingUrl' | 'description', event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.requestError.set(null);
    switch (field) {
      case 'subject':
        this.subject.set(value);
        break;
      case 'location':
        this.location.set(value);
        break;
      case 'meetingUrl':
        this.meetingUrl.set(value);
        break;
      case 'description':
        this.description.set(value);
        break;
    }
  }

  protected markTouched(field: 'subject' | 'location' | 'meetingUrl' | 'description' | 'gap'): void {
    this.touched.update((prev) => ({ ...prev, [field]: true }));
  }

  protected onStartDateChange(value: string | null): void {
    this.startDate.set(value ?? '');
    this.serverStartError.set(null);
    this.requestError.set(null);
  }

  protected onStartTimeChange(value: string | null): void {
    this.startTime.set(value ?? '');
    this.serverStartError.set(null);
    this.requestError.set(null);
  }

  protected onGapPresetChange(value: string | null): void {
    const next = (value as GapPreset | null) ?? '15';
    this.gapPreset.set(next);
    if (next !== 'custom') {
      this.lastValidGap.set(Number(next));
    }
    this.requestError.set(null);
  }

  protected onCustomGapInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.customGap.set(raw);
    const parsed = parseCustomGapMinutes(raw);
    if (parsed !== null) {
      this.lastValidGap.set(parsed);
    }
    this.touched.update((prev) => ({ ...prev, gap: true }));
    this.requestError.set(null);
  }

  protected onOrderChange(value: string | null): void {
    this.order.set(value === 'owner' ? 'owner' : 'table');
    this.requestError.set(null);
  }

  protected onAssigneeModeChange(value: string | null): void {
    const mode: BatchAssigneeMode = value === 'me' || value === 'other' ? value : 'owner';
    this.assigneeMode.set(mode);
    if (mode === 'other' && !this.chosenAssigneeId()) {
      this.chosenAssigneeId.set(this.owners()[0]?.userId ?? '');
    }
    this.requestError.set(null);
  }

  protected onChosenAssigneeChange(userId: string): void {
    this.chosenAssigneeId.set(userId);
    this.chosenAssigneeTouched.set(true);
    this.requestError.set(null);
  }

  protected requestClose(): void {
    if (this.submitting()) return;
    if (!this.dirty()) {
      this.allowClose = true;
      this.modal().close();
      return;
    }
    if (this.confirmingDiscard) return;
    this.confirmingDiscard = true;
    void this.discardDialog()
      .open()
      .then((discard) => {
        this.confirmingDiscard = false;
        if (discard) {
          this.allowClose = true;
          this.modal().close();
        }
      });
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.dirty() && !this.submitting()) {
      this.modal().open();
      this.requestClose();
      return;
    }
    this.allowClose = false;
    this.openSeq++;
    this.stopClock();
    this.resolving.set(false);
    this.submitting.set(false);
    this.initialSnapshot = null;
    this.requestError.set(null);
    this.serverStartError.set(null);
  }

  protected formatTime(date: Date | null): string {
    if (!date) return '—';
    const lang = this.language() === 'ar' ? 'ar' : 'en';
    return new Intl.DateTimeFormat(`${lang}-u-nu-latn`, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  protected formatRowWindow(due: Date, end: Date | null): string {
    const startText = this.formatTime(due);
    if (!end) return startText;
    return `${startText}–${this.formatTime(end)}`;
  }

  protected retryLoad(): void {
    this.loadFailure.set(null);
    void Promise.all([this.loadOwners(this.openSeq), this.resolveRows(this.openSeq, this.rows())]);
  }

  protected async submit(): Promise<void> {
    this.revealAllErrors.set(true);
    if (this.submitBlocked()) return;

    const startDt = this.startDateTime();
    if (!startDt || startDt.getTime() <= Date.now()) {
      this.focusStartControl();
      return;
    }

    const fields = this.typeFields();
    const cleanDescription = this.description().trim();
    const cleanLocation = this.location().trim();
    const cleanMeetingUrl = this.meetingUrl().trim();
    const currentDirection = this.direction();
    const reminderRaw = this.reminder();
    const reminderOffsetMinutes = reminderRaw !== '' ? Number(reminderRaw) : null;

    const params: CustomerBulkActivityParams = {
      activity: {
        type: this.type(),
        subject: this.subject().trim(),
        ...(cleanDescription ? { description: cleanDescription } : {}),
        ...(fields.direction && currentDirection ? { direction: currentDirection } : {}),
        priority: this.priority(),
        ...(reminderOffsetMinutes !== null ? { reminderOffsetMinutes } : {}),
        ...(fields.location && cleanLocation ? { location: cleanLocation } : {}),
        ...(fields.meetingUrl && cleanMeetingUrl ? { meetingUrl: cleanMeetingUrl } : {}),
        durationMinutes: this.resolvedDurationMinutes(),
      },
      schedule: toWireCustomerActivitySchedule({
        startAt: startDt.toISOString(),
        gapMinutes: this.resolvedGapMinutes(),
        order: this.order(),
        assigneeMode: this.assigneeMode(),
        chosenAssigneeId: this.chosenAssigneeId(),
        spacePerAssignee: this.spacePerAssignee(),
      }),
    };

    const previewFirst = this.computedSchedule().firstStart?.toISOString() ?? null;
    const previewLast = this.computedSchedule().lastStart?.toISOString() ?? null;

    const selection: BulkJobSelection =
      this.selection && this.selection.count() > 0
        ? this.selection.snapshot()
        : { kind: 'IDS', ids: this.rows().map((row) => row.id) };

    this.submitting.set(true);
    this.requestError.set(null);
    this.serverStartError.set(null);

    try {
      const body: BulkJobSubmit = {
        module: CUSTOMERS_BULK_MODULE_ID,
        action: 'CREATE_ACTIVITY',
        scope: { branchId: this.effectiveBranchId() },
        selection,
        params,
      };
      const res = await this.tracker.submit(CUSTOMERS_BULK_APP, body, { idempotencyKey: this.submitKey.for(body) });
      this.submitKey.reset();
      const serverFirst = typeof res.summary?.['firstDueAt'] === 'string' ? res.summary['firstDueAt'] : null;
      const serverLast = typeof res.summary?.['lastDueAt'] === 'string' ? res.summary['lastDueAt'] : null;
      if (
        (serverFirst && previewFirst && serverFirst !== previewFirst) ||
        (serverLast && previewLast && serverLast !== previewLast)
      ) {
        this.notify.info(this.transloco.translate('customerBulk.activity.adjusted'));
      }
      this.allowClose = true;
      this.modal().close();
      this.submitted.emit(res.jobId);
    } catch (error) {
      this.submitKey.failed(error);
      this.readOnly.update((value) => value || customerBulkReadOnly(error));
      const code = errorCodeOf(error);
      if (code === 'BULK_JOB_ACTIVE') {
        this.allowClose = true;
        this.modal().close();
        return;
      }
      const mapped = translateCustomerBulkError(this.transloco, code, extractBulkErrorParams(error));
      this.requestError.set(mapped);
      this.notify.error(mapped);
      if (code === 'CUSTOMER_BULK_START_IN_PAST') {
        this.serverStartError.set(mapped);
        this.focusStartControl();
      }
    } finally {
      this.submitting.set(false);
    }
  }

  private async initOpen(rows?: readonly SelectedCustomerRow[]): Promise<void> {
    const seq = ++this.openSeq;
    this.submitKey.reset();
    this.loadFailure.set(null);
    this.allowClose = false;
    this.resetForm();

    const mapped = rows ? [...rows] : [];
    this.rows.set(mapped);
    this.startClock();
    this.modal().open();

    await Promise.all([this.loadOwners(seq), this.resolveRows(seq, mapped)]);
  }

  private async loadOwners(seq: number): Promise<void> {
    const branchId = this.effectiveBranchId();
    this.ownersDenied.set(false);
    try {
      const allowed = await listCustomerBulkOwners(branchId);
      if (seq !== this.openSeq) return;
      this.owners.set(allowed);
      if (this.assigneeMode() === 'other' && !this.chosenAssigneeId()) {
        this.chosenAssigneeId.set(allowed[0]?.userId ?? '');
      }
    } catch (error) {
      if (seq !== this.openSeq) return;
      const failure = customerBulkLoadFailure(error);
      if (failure !== null) {
        this.loadFailure.set(failure);
        return;
      }
      this.owners.set([]);
      this.ownersDenied.set(error instanceof ApiError && error.status === 403);
      const code = errorCodeOf(error);
      const message = translateCustomerBulkError(this.transloco, code, extractBulkErrorParams(error));
      this.requestError.set(message);
      this.notify.error(message);
    }
  }

  private async resolveRows(seq: number, initial: SelectedCustomerRow[]): Promise<void> {
    if (initial.length > 0) {
      this.resolving.set(false);
      return;
    }
    if (!this.selection || this.selection.count() === 0) {
      this.rows.set([]);
      this.resolving.set(false);
      return;
    }

    this.resolving.set(true);
    try {
      const resolved = await this.selection.resolve();
      if (seq !== this.openSeq) return;
      this.rows.set(resolved);
    } catch (error) {
      if (seq !== this.openSeq) return;
      const failure = customerBulkLoadFailure(error);
      if (failure !== null) {
        this.loadFailure.set(failure);
        return;
      }
      const code = errorCodeOf(error);
      this.notify.error(translateCustomerBulkError(this.transloco, code, extractBulkErrorParams(error)));
      this.allowClose = true;
      this.modal().close();
    } finally {
      if (seq === this.openSeq) {
        this.resolving.set(false);
      }
    }
  }

  private resetForm(): void {
    const now = Date.now();
    this.nowMs.set(now);
    const roundedStart = toLocalDateTime(roundUpTo15Minutes(new Date(now)));
    const defaultDur = defaultDurationValue(DEFAULT_TYPE);

    this.type.set(DEFAULT_TYPE);
    this.subject.set('');
    this.priority.set('NORMAL');
    this.direction.set('');
    this.duration.set(defaultDur);
    this.reminder.set(DEFAULT_REMINDER);
    this.location.set('');
    this.meetingUrl.set('');
    this.description.set('');
    this.startDate.set(roundedStart.date);
    this.startTime.set(roundedStart.time);
    this.gapPreset.set(DEFAULT_GAP);
    this.customGap.set('20');
    this.lastValidGap.set(15);
    this.order.set('table');
    this.assigneeMode.set('owner');
    this.chosenAssigneeId.set('');
    this.chosenAssigneeTouched.set(false);
    this.spacePerAssignee.set(true);
    this.requestError.set(null);
    this.serverStartError.set(null);
    this.touched.set({});
    this.revealAllErrors.set(false);

    this.initialSnapshot = {
      type: DEFAULT_TYPE,
      priority: 'NORMAL',
      direction: '',
      duration: defaultDur,
      reminder: DEFAULT_REMINDER,
      startDate: roundedStart.date,
      startTime: roundedStart.time,
      gapPreset: DEFAULT_GAP,
      customGap: '20',
      order: 'table',
      assigneeMode: 'owner',
      spacePerAssignee: true,
    };
  }

  private startClock(): void {
    this.stopClock();
    this.nowMs.set(Date.now());
    this.clockTimer = setInterval(() => this.nowMs.set(Date.now()), 30_000);
  }

  private stopClock(): void {
    if (this.clockTimer !== null) {
      clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
  }

  private focusStartControl(): void {
    const trigger = this.host.nativeElement.querySelector('ui-date-field button') as HTMLElement | null;
    trigger?.focus();
  }

  private isRtl(): boolean {
    const element = this.host.nativeElement;
    const dirAttr = element.closest('[dir]')?.getAttribute('dir')?.toLowerCase();
    if (dirAttr === 'rtl' || dirAttr === 'ltr') {
      return dirAttr === 'rtl';
    }
    return getComputedStyle(element).direction === 'rtl';
  }
}
