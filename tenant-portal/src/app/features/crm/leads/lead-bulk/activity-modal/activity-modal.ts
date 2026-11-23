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
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
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
import { Notify } from '../../../../../core/notify/notify';
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
  nextHalfHour,
  toLocalDateTime,
} from '../../../../../shared/widgets/activities/activity-form/activity-form.model';
import { BulkRunModal } from '../../../shared/record/bulk/bulk-run-modal/bulk-run-modal';
import { ApiError, errorCodeOf } from '../../../settings/shared/settings-api';
import { LeadBulkSubmitKey, leadBulkErrorMessage, leadBulkLoadError, leadBulkPrecheck, leadBulkValidationFields } from '../lead-bulk-submit';
import { listAssignableOwners } from '../lead-bulk.api';
import { SelectedRow } from '../lead-bulk.model';
import { LeadSelection } from '../lead-selection';
import {
  AssignableOwner,
  BatchAssigneeMode,
  BatchOrder,
  ComputedBatchSchedule,
  GapPreset,
  ScheduleInput,
  ScheduledActivityRow,
  buildBulkActivitySchedule,
  computeBatchActivitySchedule,
} from './bulk-schedule';

export { computeBatchActivitySchedule } from './bulk-schedule';
export type {
  AssignableOwner,
  BatchAssigneeMode,
  BatchOrder,
  ComputedBatchSchedule,
  GapPreset,
  ScheduleInput,
  ScheduledActivityRow,
};

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

interface BulkActivityCommonParams {
  type: ActivityType;
  subject: string;
  description?: string | null;
  direction?: ActivityDirection | null;
  priority?: ActivityPriority;
  reminderOffsetMinutes?: number | null;
  location?: string | null;
  meetingUrl?: string | null;
}

const MIN_GAP_MINUTES = 1;
const MAX_GAP_MINUTES = 1440;
const PREVIEW_LIMIT = 6;
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
  selector: 'app-bulk-activity-modal',
  imports: [FullState,
    NgIcon,
    TranslocoPipe,
    BulkRunModal,
    ConfirmDialog,
    DateField,
    TimeField,
    Dropdown,
    Field,
    Segmented,
    Switch,
  ],
  providers: [
    provideTranslocoScope(
      'leads',
      { scope: 'record-related', alias: 'recordRelated' },
      { scope: 'lead-bulk-activity', alias: 'bulkAct' },
      { scope: 'lead-bulk-actions', alias: 'leadBulk' },
    ),
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
  templateUrl: './activity-modal.html',
})
export class BulkActivityModal {
  private static nextId = 0;
  protected readonly uid = `bulk-activity-modal-${++BulkActivityModal.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly currentUser = inject(CurrentUser);
  private readonly notify = inject(Notify);
  private readonly selection = inject(LeadSelection, { optional: true });
  private readonly tracker = inject(BulkJobsTracker);

  private readonly modal = viewChild.required<BulkRunModal>('formModal');
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');
  private readonly typeButtons = viewChildren<ElementRef<HTMLButtonElement>>('typeBtn');

  readonly branchId = input<string>('');
  readonly submitted = output<string>();

  protected readonly activityTypes = ACTIVITY_TYPES;
  protected readonly typeLook = TYPE_LOOK;
  protected readonly limits = LIMITS;

  protected readonly rows = signal<SelectedRow[]>([]);
  protected readonly owners = signal<AssignableOwner[]>([]);
  protected readonly ownersForbidden = signal(false);
  protected readonly serverFields = signal<Record<string, { value: unknown; message: string }>>({});
  protected readonly resolving = signal(false);
  protected readonly submitting = signal(false);
  protected readonly loadError = signal<ReturnType<typeof leadBulkLoadError> | null>(null);
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

  private readonly serverStartError = signal<string | null>(null);
  private readonly touched = signal<Partial<Record<'subject' | 'location' | 'meetingUrl' | 'description' | 'gap', boolean>>>({});
  private readonly revealAllErrors = signal(false);
  private initialSnapshot: InitialSnapshot | null = null;
  private allowClose = false;
  private confirmingDiscard = false;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private openSeq = 0;
  protected readonly submitKey = new LeadBulkSubmitKey();

  protected readonly typeFields = computed(() => TYPE_FIELDS[this.type()]);
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
    return this.transloco.translate('bulkAct.today');
  });

  protected readonly priorityOptions = computed<DropdownOption<ActivityPriority>[]>(() => {
    this.i18n();
    return PRIORITIES.map((value) => ({
      value,
      label: this.transloco.translate(`bulkAct.priorities.${value}`),
    }));
  });

  protected readonly directionOptions = computed<DropdownOption<ActivityDirection | ''>[]>(() => {
    this.i18n();
    return DIRECTIONS.map((value) => ({
      value,
      label: this.transloco.translate(`bulkAct.directions.${value === '' ? 'NONE' : value}`),
    }));
  });

  protected readonly durationOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const list = durationsForType(this.type());
    return [
      { value: '', label: this.transloco.translate('bulkAct.noEnd') },
      ...list.map((minutes) => ({
        value: String(minutes),
        label: this.transloco.translate('bulkAct.gapMinutes', { n: minutes }),
      })),
    ];
  });

  protected readonly reminderOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return REMINDERS.map((value) => {
      if (value === '') return { value, label: this.transloco.translate('bulkAct.reminderNone') };
      if (value === '1440') return { value, label: this.transloco.translate('bulkAct.reminderDay') };
      return { value, label: this.transloco.translate('bulkAct.reminderMin', { n: Number(value) }) };
    });
  });

  protected readonly gapOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return GAP_PRESETS.map((preset) => ({
      value: preset,
      label:
        preset === 'custom'
          ? this.transloco.translate('bulkAct.gapCustom')
          : this.transloco.translate('bulkAct.gapMinutes', { n: Number(preset) }),
    }));
  });

  protected readonly orderOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'table', label: this.transloco.translate('bulkAct.orderTable') },
      { value: 'owner', label: this.transloco.translate('bulkAct.orderOwner') },
    ];
  });

  protected readonly assigneeModeOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'owner', label: this.transloco.translate('bulkAct.assigneeOwner') },
      { value: 'me', label: this.transloco.translate('bulkAct.assigneeMe') },
      { value: 'other', label: this.transloco.translate('bulkAct.assigneeOther') },
    ];
  });

  protected readonly assigneeDropdownOptions = computed<DropdownOption<string>[]>(() =>
    this.owners().map((owner) => ({ value: owner.id, label: owner.displayName })),
  );

  protected readonly parsedGapMinutes = computed<number | null>(() => {
    const preset = this.gapPreset();
    if (preset !== 'custom') return Number(preset);
    return parseCustomGapMinutes(this.customGap());
  });

  protected readonly startDateTime = computed(() => fromLocalDateTime(this.startDate(), this.startTime()));

  protected readonly isStartInPast = computed(() => {
    const dt = this.startDateTime();
    if (!dt) return true;
    return dt.getTime() <= this.nowMs();
  });

  protected readonly subjectError = computed<string | null>(() => {
    this.i18n();
    const server = this.serverFieldError('subject', this.subject());
    if (server) return server;
    if (!this.revealAllErrors() && !this.touched().subject) return null;
    const trimmed = this.subject().trim();
    if (!trimmed) return this.transloco.translate('bulkAct.validation.required');
    if (codePointLength(trimmed) > LIMITS.subject) {
      return this.transloco.translate('bulkAct.validation.maxLength', { max: LIMITS.subject });
    }
    return null;
  });

  protected readonly locationError = computed<string | null>(() => {
    this.i18n();
    const server = this.serverFieldError('location', this.location());
    if (server) return server;
    if (!this.typeFields().location) return null;
    if (!this.revealAllErrors() && !this.touched().location) return null;
    if (codePointLength(this.location().trim()) > LIMITS.location) {
      return this.transloco.translate('bulkAct.validation.maxLength', { max: LIMITS.location });
    }
    return null;
  });

  protected readonly meetingUrlError = computed<string | null>(() => {
    this.i18n();
    const server = this.serverFieldError('meetingUrl', this.meetingUrl());
    if (server) return server;
    if (!this.typeFields().meetingUrl) return null;
    if (!this.revealAllErrors() && !this.touched().meetingUrl) return null;
    const trimmed = this.meetingUrl().trim();
    if (!trimmed) return null;
    if (codePointLength(trimmed) > LIMITS.meetingUrl) {
      return this.transloco.translate('bulkAct.validation.maxLength', { max: LIMITS.meetingUrl });
    }
    if (!isValidMeetingLink(trimmed)) {
      return this.transloco.translate('bulkAct.validation.invalidUrl');
    }
    return null;
  });

  protected readonly descriptionError = computed<string | null>(() => {
    this.i18n();
    const server = this.serverFieldError('description', this.description());
    if (server) return server;
    if (!this.revealAllErrors() && !this.touched().description) return null;
    if (codePointLength(this.description().trim()) > LIMITS.description) {
      return this.transloco.translate('bulkAct.validation.maxLength', { max: LIMITS.description });
    }
    return null;
  });

  protected readonly startError = computed<string | null>(() => {
    this.i18n();
    const serverErr = this.serverStartError();
    if (serverErr) return serverErr;
    if (!this.startDateTime()) return this.transloco.translate('bulkAct.validation.required');
    if (this.isStartInPast()) return this.transloco.translate('bulkAct.startPast');
    return null;
  });

  protected readonly gapError = computed<string | null>(() => {
    this.i18n();
    const server = this.serverFieldError('gapMinutes', this.parsedGapMinutes());
    if (server) return server;
    if (this.gapPreset() !== 'custom') return null;
    if (this.parsedGapMinutes() === null) {
      return this.transloco.translate('bulkAct.gapInvalid');
    }
    return null;
  });

  protected readonly ownerNameMap = computed(() => {
    const map = new Map<string, string>();
    map.set(this.currentUser.userId(), this.currentUser.user().displayName);
    for (const owner of this.owners()) {
      map.set(owner.id, owner.displayName);
    }
    return map;
  });

  protected readonly computedSchedule = computed<ComputedBatchSchedule>(() => {
    const start = this.startDateTime() ?? nextHalfHour(new Date(this.nowMs()));
    const gapMinutes = this.parsedGapMinutes() ?? this.lastValidGap();
    const durationRaw = this.duration();
    const durationMinutes = durationRaw ? Number(durationRaw) : null;

    return computeBatchActivitySchedule({
      rows: this.rows(),
      start,
      gapMinutes,
      durationMinutes,
      order: this.order(),
      assigneeMode: this.assigneeMode(),
      chosenAssigneeId: this.chosenAssigneeId(),
      spacePerAssignee: this.spacePerAssignee(),
      currentUserId: this.currentUser.userId(),
      currentUserName: this.currentUser.user().displayName,
      ownerNames: this.ownerNameMap(),
    });
  });

  protected readonly previewRows = computed(() => this.computedSchedule().items.slice(0, PREVIEW_LIMIT));
  protected readonly moreCount = computed(() => Math.max(0, this.computedSchedule().items.length - PREVIEW_LIMIT));
  protected readonly noOwnerCount = computed(() =>
    this.assigneeMode() === 'owner' ? this.computedSchedule().noOwnerCount : 0,
  );

  protected readonly summaryFirst = computed(() => {
    const first = this.computedSchedule().firstStart;
    return first ? this.formatDateTime(first) : '';
  });

  protected readonly summaryLast = computed(() => {
    const last = this.computedSchedule().lastStart;
    return last ? this.formatDateTime(last) : '';
  });

  protected readonly isDirty = computed(() => {
    const snap = this.initialSnapshot;
    if (!snap) return false;
    return (
      this.type() !== snap.type ||
      this.subject() !== '' ||
      this.priority() !== snap.priority ||
      this.direction() !== snap.direction ||
      this.duration() !== snap.duration ||
      this.reminder() !== snap.reminder ||
      this.location() !== '' ||
      this.meetingUrl() !== '' ||
      this.description() !== '' ||
      this.startDate() !== snap.startDate ||
      this.startTime() !== snap.startTime ||
      this.gapPreset() !== snap.gapPreset ||
      (this.gapPreset() === 'custom' && this.customGap() !== snap.customGap) ||
      this.order() !== snap.order ||
      this.assigneeMode() !== snap.assigneeMode ||
      this.chosenAssigneeTouched() ||
      this.spacePerAssignee() !== snap.spacePerAssignee
    );
  });

  protected readonly submitBlocked = computed(() => {
    if (this.loadError() || this.submitKey.blocked() || this.submitting() || this.resolving() || this.rows().length === 0) return true;
    if (this.isStartInPast()) return true;
    if (this.gapPreset() === 'custom' && this.parsedGapMinutes() === null) return true;
    if (this.assigneeMode() === 'other' && (!this.chosenAssigneeId() || !this.owners().some((owner) => owner.id === this.chosenAssigneeId()))) return true;
    return false;
  });

  protected readonly isFormValid = computed(() => {
    if (this.submitBlocked()) return false;
    const trimmedSubject = this.subject().trim();
    if (!trimmedSubject || codePointLength(trimmedSubject) > LIMITS.subject) return false;
    const fields = this.typeFields();
    if (fields.location && codePointLength(this.location().trim()) > LIMITS.location) return false;
    if (fields.meetingUrl) {
      const url = this.meetingUrl().trim();
      if (url && (codePointLength(url) > LIMITS.meetingUrl || !isValidMeetingLink(url))) return false;
    }
    if (codePointLength(this.description().trim()) > LIMITS.description) return false;
    return true;
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.stopClock());
  }

  open(rows?: SelectedRow[]): void {
    const seq = ++this.openSeq;
    this.loadError.set(null);
    this.submitKey.reset();
    this.serverFields.set({});
    this.owners.set([]);
    this.ownersForbidden.set(false);
    this.resetForm();
    this.allowClose = false;
    this.confirmingDiscard = false;
    this.startClock();

    if (rows !== undefined) {
      this.rows.set(rows);
      this.resolving.set(false);
    } else if (this.selection) {
      this.rows.set([]);
      this.resolving.set(true);
      void this.selection
        .resolve()
        .then((resolved) => {
          if (seq !== this.openSeq) return;
          this.rows.set(resolved);
          this.resolving.set(false);
        })
        .catch((error) => {
          if (seq !== this.openSeq) return;
          this.resolving.set(false);
          this.loadError.set(leadBulkLoadError(this.transloco, error));
        });
    }

    void this.loadOwners(seq);

    this.modal().open();
  }

  protected setType(nextType: ActivityType): void {
    const prevType = this.type();
    if (prevType === nextType) return;
    const prevDefault = defaultDurationValue(prevType);
    const currentDur = this.duration();
    const allowedNext = durationsForType(nextType).map(String);

    this.type.set(nextType);
    if (currentDur === prevDefault || (currentDur !== '' && !allowedNext.includes(currentDur))) {
      this.duration.set(defaultDurationValue(nextType));
    }
  }

  protected onTypeKeydown(event: KeyboardEvent, index: number): void {
    const rtl = this.isRtl();
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    const length = this.activityTypes.length;
    let targetIndex = -1;

    if (event.key === nextKey || event.key === 'ArrowDown') {
      targetIndex = (index + 1) % length;
    } else if (event.key === prevKey || event.key === 'ArrowUp') {
      targetIndex = (index - 1 + length) % length;
    } else if (event.key === 'Home') {
      targetIndex = 0;
    } else if (event.key === 'End') {
      targetIndex = length - 1;
    } else {
      return;
    }

    event.preventDefault();
    this.setType(this.activityTypes[targetIndex]);
    this.typeButtons()[targetIndex]?.nativeElement.focus();
  }

  protected onTextInput(field: 'subject' | 'location' | 'meetingUrl' | 'description', event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
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
    this.touched.update((current) => (current[field] ? current : { ...current, [field]: true }));
  }

  protected onStartDateChange(value: string | null): void {
    if (!value) return;
    this.nowMs.set(Date.now());
    this.startDate.set(value);
    this.serverStartError.set(null);
  }

  protected onStartTimeChange(value: string | null): void {
    if (!value) return;
    this.nowMs.set(Date.now());
    this.startTime.set(value);
    this.serverStartError.set(null);
  }

  protected onGapPresetChange(value: string | null): void {
    if (value !== '5' && value !== '10' && value !== '15' && value !== '30' && value !== '60' && value !== 'custom') {
      return;
    }
    this.gapPreset.set(value);
    if (value !== 'custom') {
      this.lastValidGap.set(Number(value));
    }
  }

  protected onCustomGapInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.customGap.set(raw);
    const parsed = parseCustomGapMinutes(raw);
    if (parsed !== null) {
      this.lastValidGap.set(parsed);
    }
  }

  protected onOrderChange(value: string | null): void {
    if (value === 'table' || value === 'owner') {
      this.order.set(value);
    }
  }

  protected onAssigneeModeChange(value: string | null): void {
    if (value === 'owner' || value === 'me' || value === 'other') {
      this.assigneeMode.set(value);
    }
  }

  protected onChosenAssigneeChange(value: string): void {
    this.chosenAssigneeId.set(value);
    this.chosenAssigneeTouched.set(true);
  }

  protected formatRowWindow(dueDate: Date, endDate: Date | null): string {
    const locale = `${this.language()}-u-nu-latn`;
    const dayFmt = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' });
    const timeFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false });

    if (!endDate) {
      return `${dayFmt.format(dueDate)}, ${timeFmt.format(dueDate)}`;
    }
    const sameDay =
      dueDate.getFullYear() === endDate.getFullYear() &&
      dueDate.getMonth() === endDate.getMonth() &&
      dueDate.getDate() === endDate.getDate();
    if (sameDay) {
      return `${dayFmt.format(dueDate)}, ${timeFmt.format(dueDate)}–${timeFmt.format(endDate)}`;
    }
    return `${dayFmt.format(dueDate)}, ${timeFmt.format(dueDate)} – ${dayFmt.format(endDate)}, ${timeFmt.format(endDate)}`;
  }

  protected requestClose(): void {
    if (this.submitting()) return;
    if (this.isDirty()) {
      void this.confirmDiscard();
      return;
    }
    this.allowClose = true;
    this.modal().close();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.submitting()) {
      this.modal().open();
      return;
    }
    if (!this.allowClose && this.isDirty()) {
      this.modal().open();
      void this.confirmDiscard();
      return;
    }
    this.allowClose = false;
    this.submitting.set(false);
    this.stopClock();
  }

  private async loadOwners(seq: number): Promise<void> {
    this.ownersForbidden.set(false);
    try {
      const list = await listAssignableOwners(this.branchId());
      if (seq !== this.openSeq) return;
      this.owners.set(list);
      if (!this.chosenAssigneeTouched()) this.chosenAssigneeId.set(list[0]?.id ?? '');
    } catch (error) {
      if (seq !== this.openSeq) return;
      if (error instanceof ApiError && error.status === 403) this.ownersForbidden.set(true);
      else this.loadError.set(leadBulkLoadError(this.transloco, error));
      this.owners.set([]);
      this.chosenAssigneeId.set('');
    }
  }

  protected async retryLoad(): Promise<void> {
    const seq = ++this.openSeq;
    this.loadError.set(null);
    this.resolving.set(true);
    try {
      const [rows] = await Promise.all([
        this.selection?.count() ? this.selection.resolve() : Promise.resolve(this.rows()), this.loadOwners(seq),
      ]);
      if (seq === this.openSeq) this.rows.set(rows);
    } catch (error) {
      if (seq === this.openSeq) this.loadError.set(leadBulkLoadError(this.transloco, error));
    }
    if (seq === this.openSeq) this.resolving.set(false);
  }

  protected async submit(): Promise<void> {
    if (this.submitting()) return;
    this.nowMs.set(Date.now());
    this.revealAllErrors.set(true);
    this.serverStartError.set(null);
    this.serverFields.set({});
    if (!this.isFormValid()) {
      this.focusFirstInvalidField();
      return;
    }

    const startDt = this.startDateTime();
    const gapMinutes = this.parsedGapMinutes();
    if (!startDt || gapMinutes === null) return;

    const preview = this.computedSchedule();
    const common = this.buildCommonPayload();
    const durationRaw = this.duration();
    const durationMinutes = durationRaw ? Number(durationRaw) : null;
    const selection: BulkJobSelection =
      this.selection && this.selection.count() > 0
        ? this.selection.snapshot()
        : { kind: 'IDS', ids: this.rows().map((row) => row.id) };
    const branchId = this.branchId();
    const precheck = leadBulkPrecheck(selection, this.branchId());
    if (precheck) {
      this.notify.error(this.transloco.translate(`leadBulk.codes.${precheck}`));
      return;
    }
    const body: BulkJobSubmit = {
      module: 'crm.leads',
      action: 'CREATE_ACTIVITY',
      scope: { branchId },
      selection,
      params: {
        activity: {
          ...common,
          durationMinutes,
        },
        schedule: buildBulkActivitySchedule({
          start: startDt,
          gapMinutes,
          order: this.order(),
          assigneeMode: this.assigneeMode(),
          chosenAssigneeId: this.chosenAssigneeId(),
          spacePerAssignee: this.spacePerAssignee(),
        }),
      },
    };

    this.submitting.set(true);
    try {
      const res = await this.tracker.submit('crm', body, { idempotencyKey: this.submitKey.for(body) });
      this.submitKey.reset();

      const serverFirst = typeof res.summary?.['firstDueAt'] === 'string' ? res.summary['firstDueAt'] : null;
      const serverLast = typeof res.summary?.['lastDueAt'] === 'string' ? res.summary['lastDueAt'] : null;
      const previewFirst = preview.firstStart?.toISOString() ?? null;
      const previewLast = preview.lastStart?.toISOString() ?? null;
      if ((serverFirst && serverFirst !== previewFirst) || (serverLast && serverLast !== previewLast)) {
        this.notify.info(this.transloco.translate('bulkAct.adjusted'));
      }

      this.allowClose = true;
      this.modal().close();
      this.submitted.emit(res.jobId);
    } catch (error) {
      this.submitKey.failed(error);
      this.handleSubmitError(error);
    } finally {
      this.submitting.set(false);
    }
  }

  private handleSubmitError(error: unknown): void {
    const code = errorCodeOf(error);
    if (code === 'BULK_JOB_ACTIVE') return;
    const fields = leadBulkValidationFields(error);
    if (fields.length > 0) {
      const values: Record<string, unknown> = {
        subject: this.subject(), location: this.location(), meetingUrl: this.meetingUrl(), description: this.description(),
        priority: this.priority(), direction: this.direction(), durationMinutes: this.duration(), reminderOffsetMinutes: this.reminder(),
        gapMinutes: this.parsedGapMinutes(), order: this.order(), 'assignee.userId': this.chosenAssigneeId(),
      };
      const message = this.transloco.translate('leadBulk.invalidValue');
      this.serverFields.set(Object.fromEntries(fields.filter((field) => field in values).map((field) => [field, { value: values[field], message }])));
      if (fields.includes('startAt')) this.serverStartError.set(message);
      if (Object.keys(this.serverFields()).length || fields.includes('startAt')) return;
    }
    if (code === 'LEAD_BULK_START_IN_PAST') {
      const msg = this.translateCode(code);
      this.serverStartError.set(msg);
      this.host.nativeElement.querySelector<HTMLElement>(`#${this.uid}-start-date`)?.focus();
      return;
    }
    this.notify.error(this.translateCode(code, error));
  }

  protected serverFieldError(field: string, value: unknown): string | null {
    const error = this.serverFields()[field];
    return error?.value === value ? error.message : null;
  }

  private translateCode(code: string | null, error?: unknown): string {
    return leadBulkErrorMessage(this.transloco, error ?? (code ? new ApiError(422, code) : null));
  }

  private buildCommonPayload(): BulkActivityCommonParams {
    const fields = this.typeFields();
    const common: BulkActivityCommonParams = {
      type: this.type(),
      subject: this.subject().trim(),
      priority: this.priority(),
    };
    const description = this.description().trim();
    if (description) common.description = description;
    if (fields.direction && this.direction()) common.direction = this.direction() as ActivityDirection;
    if (this.reminder() !== '') common.reminderOffsetMinutes = Number(this.reminder());
    if (fields.location) {
      const location = this.location().trim();
      if (location) common.location = location;
    }
    if (fields.meetingUrl) {
      const meetingUrl = this.meetingUrl().trim();
      if (meetingUrl) common.meetingUrl = meetingUrl;
    }
    return common;
  }

  private focusFirstInvalidField(): void {
    const root = this.host.nativeElement;
    if (this.subjectError()) {
      root.querySelector<HTMLElement>(`#${this.uid}-subject`)?.focus();
      return;
    }
    if (this.locationError()) {
      root.querySelector<HTMLElement>(`#${this.uid}-location`)?.focus();
      return;
    }
    if (this.meetingUrlError()) {
      root.querySelector<HTMLElement>(`#${this.uid}-meeting-url`)?.focus();
      return;
    }
    if (this.descriptionError()) {
      root.querySelector<HTMLElement>(`#${this.uid}-description`)?.focus();
    }
  }

  private formatDateTime(date: Date): string {
    const locale = `${this.language()}-u-nu-latn`;
    const dayFmt = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' });
    const timeFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${dayFmt.format(date)}, ${timeFmt.format(date)}`;
  }

  private async confirmDiscard(): Promise<void> {
    if (this.confirmingDiscard) return;
    this.confirmingDiscard = true;
    try {
      const confirmed = await this.discardDialog().open();
      if (confirmed) {
        this.allowClose = true;
        this.modal().close();
      }
    } finally {
      this.confirmingDiscard = false;
    }
  }

  private resetForm(): void {
    const now = new Date();
    this.nowMs.set(now.getTime());
    const start = toLocalDateTime(nextHalfHour(now));
    const initialDuration = defaultDurationValue(DEFAULT_TYPE);

    this.type.set(DEFAULT_TYPE);
    this.subject.set('');
    this.priority.set('NORMAL');
    this.direction.set('');
    this.duration.set(initialDuration);
    this.reminder.set(DEFAULT_REMINDER);
    this.location.set('');
    this.meetingUrl.set('');
    this.description.set('');
    this.startDate.set(start.date);
    this.startTime.set(start.time);
    this.gapPreset.set(DEFAULT_GAP);
    this.customGap.set('20');
    this.lastValidGap.set(Number(DEFAULT_GAP));
    this.order.set('table');
    this.assigneeMode.set('owner');
    this.chosenAssigneeId.set(this.owners()[0]?.id ?? '');
    this.chosenAssigneeTouched.set(false);
    this.spacePerAssignee.set(true);
    this.submitting.set(false);
    this.serverStartError.set(null);
    this.touched.set({});
    this.revealAllErrors.set(false);

    this.initialSnapshot = {
      type: DEFAULT_TYPE,
      priority: 'NORMAL',
      direction: '',
      duration: initialDuration,
      reminder: DEFAULT_REMINDER,
      startDate: start.date,
      startTime: start.time,
      gapPreset: DEFAULT_GAP,
      customGap: '20',
      order: 'table',
      assigneeMode: 'owner',
      spacePerAssignee: true,
    };
  }

  private startClock(): void {
    this.stopClock();
    this.clockTimer = setInterval(() => {
      this.nowMs.set(Date.now());
    }, 15_000);
  }

  private stopClock(): void {
    if (this.clockTimer !== null) {
      clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
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
