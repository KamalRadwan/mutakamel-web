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
import { tablerCalendarTime, tablerCheck, tablerX } from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { Checkbox } from '../../../../../shared/ui/checkbox/checkbox';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { DateField } from '../../../../../shared/ui/date-time/date-field';
import { TimeField } from '../../../../../shared/ui/date-time/time-field';
import { Dropdown, type DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { Segmented, type SegmentedOption } from '../../../../../shared/ui/segmented/segmented';
import { UnsavedDialog } from '../../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { ApiError, errorCodeOf, newIdempotencyKey } from '../../../../../shared/widgets/dashboard/analytics-api';
import { FAKE_ME, FAKE_PEOPLE, type FakePerson } from '../../../../../shared/widgets/dashboard/fake/fake-org';
import { errorKey, reasonKey } from '../../../../../shared/widgets/dashboard/panel-state';
import {
  createSubscription,
  getSubscription,
  listScheduleTargets,
  updateSubscription,
} from '../schedules.api';
import { format } from 'date-fns';
import {
  EMPTY_SCHEDULE_TARGETS,
  SUBSCRIPTION_PERIOD_TOKENS,
  subscriptionTargetType,
  type CreateSubscription,
  type Subscription,
  type ScheduleTargets,
  type SubscriptionAttachmentFormat,
  type SubscriptionPeriodToken,
  type SubscriptionRecurrence,
  type SubscriptionTargetType,
  type UpdateSubscription,
} from '../schedules.model';

const MAX_NAME_LENGTH = 120;
const MAX_RECIPIENTS = 50;
const DEFAULT_TTL_HOURS = 168;
const DEFAULT_TIME = '09:00';
const DEFAULT_TIME_ZONE = 'Africa/Cairo';
const TIME_ZONES = [
  'Africa/Cairo',
  'Asia/Riyadh',
  'Asia/Dubai',
  'UTC',
  'Europe/London',
  'America/New_York',
] as const;
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
const MONTH_DAYS = [...Array.from({ length: 28 }, (_, i) => i + 1), -1] as const;

export type FormFieldKey =
  | 'name'
  | 'target'
  | 'scheduleWeekday'
  | 'scheduleMonthDay'
  | 'scheduleMinute'
  | 'timeZone'
  | 'startsOn'
  | 'endsOn'
  | 'recipientUserIds'
  | 'attachmentFormats'
  | 'linkTtlHours';

type FieldErrors = Partial<Record<FormFieldKey, string>>;

/** 400 `CRM_VALIDATION_FAILED` details keys (DTO field names) → the form field that shows the message. */
const DETAIL_FIELDS: Readonly<Record<string, FormFieldKey>> = {
  name: 'name',
  dashboardId: 'target',
  reportKey: 'target',
  scheduleWeekday: 'scheduleWeekday',
  scheduleMonthDay: 'scheduleMonthDay',
  scheduleMinute: 'scheduleMinute',
  timeZone: 'timeZone',
  startsOn: 'startsOn',
  endsOn: 'endsOn',
  recipients: 'recipientUserIds',
  attachmentFormats: 'attachmentFormats',
  linkTtlHours: 'linkTtlHours',
};

/** 422 CRM_SUBSCRIPTION_SCHEDULE_INVALID `details.problems` tokens (lowercase) → the form field they concern. */
const SCHEDULE_PROBLEM_FIELDS: Readonly<Record<string, FormFieldKey>> = {
  minute_range: 'scheduleMinute',
  weekday_required: 'scheduleWeekday',
  weekday_forbidden: 'scheduleWeekday',
  weekday_range: 'scheduleWeekday',
  month_day_required: 'scheduleMonthDay',
  month_day_forbidden: 'scheduleMonthDay',
  month_day_range: 'scheduleMonthDay',
  time_zone_invalid: 'timeZone',
  date_invalid: 'startsOn',
  ends_before_starts: 'endsOn',
};

/**
 * Reads `details.problems` of 422 CRM_SUBSCRIPTION_SCHEDULE_INVALID: the fields to mark, and whether a problem
 * (required_field_missing, filters_too_large, no_next_run, or none at all) has no field and needs a toast.
 */
export function scheduleProblemFields(error: unknown): { fields: FormFieldKey[]; unmapped: boolean } {
  const raw = error instanceof ApiError ? error.details?.['problems'] : undefined;
  const problems = Array.isArray(raw) ? raw.map(String) : [];
  const fields = [...new Set(problems.map((problem) => SCHEDULE_PROBLEM_FIELDS[problem]).filter(Boolean))];
  return { fields, unmapped: problems.length === 0 || problems.some((problem) => !SCHEDULE_PROBLEM_FIELDS[problem]) };
}

/** 422 CRM_EXPORT_FORMAT_INVALID with `details.reason: ['pdf_renderer_unavailable']`. */
export function isPdfRendererUnavailable(error: unknown): boolean {
  const reason = error instanceof ApiError ? error.details?.['reason'] : undefined;
  return Array.isArray(reason) && reason.includes('pdf_renderer_unavailable');
}

/** 422 codes that belong to one field (CRM_EXPORT_FORMAT_INVALID may add a reason, see isPdfRendererUnavailable). */
const CODE_FIELDS: Readonly<Record<string, FormFieldKey>> = {
  CRM_SUBSCRIPTION_TARGET_INVALID: 'target',
  CRM_REPORT_NOT_FOUND: 'target',
  CRM_SUBSCRIPTION_RECIPIENTS_INVALID: 'recipientUserIds',
  CRM_SUBSCRIPTION_ATTACHMENT_TTL_INVALID: 'linkTtlHours',
  CRM_EXPORT_FORMAT_INVALID: 'attachmentFormats',
};

interface ScheduleDraft {
  name: string;
  targetType: SubscriptionTargetType;
  targetId: string;
  periodToken: SubscriptionPeriodToken;
  recurrence: SubscriptionRecurrence;
  scheduleWeekday: number;
  scheduleMonthDay: number;
  time: string;
  timeZone: string;
  startsOn: string | null;
  endsOn: string | null;
  recipientUserIds: string[];
  attachmentFormats: SubscriptionAttachmentFormat[];
  linkTtlHoursText: string;
  locale: 'ar' | 'en';
}

function minutesToTime(minutes: number): string {
  const safe = Math.max(0, Math.min(1439, Math.trunc(minutes)));
  const hh = String(Math.floor(safe / 60)).padStart(2, '0');
  const mm = String(safe % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function timeToMinutes(value: string | null): number {
  if (!value) return 540;
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return 540;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return 540;
  return hh * 60 + mm;
}

function draftsEqual(a: ScheduleDraft, b: ScheduleDraft): boolean {
  if (
    a.name.trim() !== b.name.trim() ||
    a.targetType !== b.targetType ||
    a.targetId !== b.targetId ||
    a.periodToken !== b.periodToken ||
    a.recurrence !== b.recurrence ||
    a.time !== b.time ||
    a.timeZone !== b.timeZone ||
    a.startsOn !== b.startsOn ||
    a.endsOn !== b.endsOn ||
    a.linkTtlHoursText.trim() !== b.linkTtlHoursText.trim() ||
    a.locale !== b.locale
  ) {
    return false;
  }
  if (a.recurrence === 'WEEKLY' && a.scheduleWeekday !== b.scheduleWeekday) return false;
  if (a.recurrence === 'MONTHLY' && a.scheduleMonthDay !== b.scheduleMonthDay) return false;
  if (a.recipientUserIds.length !== b.recipientUserIds.length) return false;
  for (let i = 0; i < a.recipientUserIds.length; i++) {
    if (a.recipientUserIds[i] !== b.recipientUserIds[i]) return false;
  }
  if (a.attachmentFormats.length !== b.attachmentFormats.length) return false;
  const aFormats = [...a.attachmentFormats].sort();
  const bFormats = [...b.attachmentFormats].sort();
  for (let i = 0; i < aFormats.length; i++) {
    if (aFormats[i] !== bFormats[i]) return false;
  }
  return true;
}

@Component({
  selector: 'app-schedule-modal',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    Checkbox,
    ConfirmDialog,
    DateField,
    Dropdown,
    Field,
    Modal,
    Segmented,
    TimeField,
    UnsavedDialog,
  ],
  providers: [provideIcons({ tablerCalendarTime, tablerCheck, tablerX })],
  templateUrl: './schedule-modal.html',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(window:resize)': 'closeRecipientMenu()',
  },
})
export class ScheduleModal {
  private static nextId = 0;
  protected readonly uid = `schedule-modal-${++ScheduleModal.nextId}`;

  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly notify = inject(Notify);
  protected readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required<Modal>('modal');
  private readonly unsavedDialog = viewChild.required<UnsavedDialog>('unsavedDialog');
  private readonly conflictDialog = viewChild.required<ConfirmDialog>('conflictDialog');
  private readonly recipientsAnchor = viewChild<ElementRef<HTMLElement>>('recipientsAnchor');
  private readonly recipientInput = viewChild<ElementRef<HTMLInputElement>>('recipientInput');
  private readonly recipientListRef = viewChild<ElementRef<HTMLElement>>('recipientList');

  readonly canManage = input(true);
  readonly saved = output<Subscription>();
  readonly reloaded = output<Subscription>();
  readonly deletedRemotely = output<void>();
  readonly deleteRequested = output<Subscription>();

  protected readonly maxNameLength = MAX_NAME_LENGTH;
  protected readonly maxRecipients = MAX_RECIPIENTS;
  protected readonly pdfEnabled = false;
  protected readonly attachmentFormatOptions: readonly SubscriptionAttachmentFormat[] = ['CSV', 'XLSX', 'PDF'];
  protected readonly people = FAKE_PEOPLE;
  /** Dashboards and reports of the target picker, read again each time the modal opens. */
  protected readonly targets = signal<ScheduleTargets>(EMPTY_SCHEDULE_TARGETS);
  private targetsSeq = 0;

  protected readonly editingSubscription = signal<Subscription | null>(null);
  protected readonly baseline = signal<ScheduleDraft>(this.createDefaultDraft());
  protected readonly name = signal('');
  protected readonly targetType = signal<SubscriptionTargetType>('DASHBOARD');
  protected readonly targetId = signal('');
  protected readonly periodToken = signal<SubscriptionPeriodToken>('LAST_COMPLETED_WEEK');
  protected readonly recurrence = signal<SubscriptionRecurrence>('WEEKLY');
  protected readonly scheduleWeekday = signal<number>(0);
  protected readonly scheduleMonthDay = signal<number>(1);
  protected readonly time = signal<string>(DEFAULT_TIME);
  protected readonly timeZone = signal<string>(DEFAULT_TIME_ZONE);
  protected readonly startsOn = signal<string | null>(null);
  protected readonly endsOn = signal<string | null>(null);
  protected readonly recipientUserIds = signal<string[]>([FAKE_ME.id]);
  protected readonly attachmentFormats = signal<SubscriptionAttachmentFormat[]>([]);
  protected readonly linkTtlHoursText = signal(String(DEFAULT_TTL_HOURS));
  protected readonly locale = signal<'ar' | 'en'>('en');

  protected readonly currentRevision = signal(1);
  protected readonly saving = signal(false);
  protected readonly submitAttempted = signal(false);
  protected readonly serverErrors = signal<FieldErrors>({});

  protected readonly recipientQuery = signal('');
  protected readonly recipientOpen = signal(false);
  protected readonly recipientPlaced = signal(false);
  protected readonly recipientActiveIndex = signal(0);
  protected readonly recipientPlace = signal({ top: 0, start: 0, width: 0, maxHeight: null as number | null });

  private allowClose = false;
  private confirmingDiscard = false;
  private recipientSeq = 0;

  protected readonly isEdit = computed(() => this.editingSubscription() !== null);
  protected readonly nameCount = computed(() => [...this.name()].length);

  protected readonly currentDraft = computed<ScheduleDraft>(() => ({
    name: this.name(),
    targetType: this.targetType(),
    targetId: this.targetId(),
    periodToken: this.periodToken(),
    recurrence: this.recurrence(),
    scheduleWeekday: this.scheduleWeekday(),
    scheduleMonthDay: this.scheduleMonthDay(),
    time: this.time(),
    timeZone: this.timeZone(),
    startsOn: this.startsOn(),
    endsOn: this.endsOn(),
    recipientUserIds: this.recipientUserIds(),
    attachmentFormats: this.attachmentFormats(),
    linkTtlHoursText: this.linkTtlHoursText(),
    locale: this.locale(),
  }));

  protected readonly dirty = computed(() => !draftsEqual(this.currentDraft(), this.baseline()));

  protected readonly targetTypeOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'DASHBOARD', label: this.transloco.translate('repSchedules.targetType.DASHBOARD') },
      { value: 'REPORT', label: this.transloco.translate('repSchedules.targetType.REPORT') },
    ];
  });

  protected readonly targetOptions = computed<DropdownOption<string>[]>(() => {
    const lang = this.language();
    const targets = this.targets();
    const list = this.targetType() === 'DASHBOARD' ? targets.dashboards : targets.reports;
    return list.map((item) => ({ value: item.id, label: item.label[lang], disabled: item.disabled }));
  });

  protected readonly selectedTargetLabel = computed(() => {
    const id = this.targetId();
    return this.targetOptions().find((opt) => opt.value === id)?.label ?? id;
  });

  protected readonly periodOptions = computed<DropdownOption<SubscriptionPeriodToken>[]>(() => {
    this.i18n();
    return SUBSCRIPTION_PERIOD_TOKENS.map((token) => ({
      value: token,
      label: this.transloco.translate(`repSchedules.period.${token}`),
    }));
  });

  protected readonly recurrenceOptions = computed<DropdownOption<SubscriptionRecurrence>[]>(() => {
    this.i18n();
    return (['DAILY', 'WEEKLY', 'MONTHLY'] as const).map((rec) => ({
      value: rec,
      label: this.transloco.translate(`repSchedules.recurrence.${rec}`),
    }));
  });

  protected readonly weekdayOptions = computed<DropdownOption<number>[]>(() => {
    this.i18n();
    return WEEKDAYS.map((day) => ({
      value: day,
      label: this.transloco.translate(`repSchedules.weekdays.${day}`),
    }));
  });

  protected readonly monthDayOptions = computed<DropdownOption<number>[]>(() => {
    this.i18n();
    return MONTH_DAYS.map((day) => ({
      value: day,
      label: day === -1 ? this.transloco.translate('repSchedules.lastDayOption') : String(day),
    }));
  });

  protected readonly timeZoneOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return TIME_ZONES.map((tz) => ({
      value: tz,
      label: this.transloco.translate(`repSchedules.timeZones.${tz}`),
    }));
  });

  protected readonly localeOptions = computed<DropdownOption<'ar' | 'en'>[]>(() => {
    this.i18n();
    return [
      { value: 'en', label: this.transloco.translate('repSchedules.locale.en') },
      { value: 'ar', label: this.transloco.translate('repSchedules.locale.ar') },
    ];
  });

  protected readonly peopleById = new Map<string, FakePerson>(FAKE_PEOPLE.map((p) => [p.id, p]));

  protected readonly selectedRecipients = computed<FakePerson[]>(() =>
    this.recipientUserIds()
      .map((id) => this.peopleById.get(id))
      .filter((person): person is FakePerson => person !== undefined),
  );

  protected readonly selectedRecipientSet = computed(() => new Set(this.recipientUserIds()));
  protected readonly atMaxRecipients = computed(() => this.recipientUserIds().length >= MAX_RECIPIENTS);

  protected readonly filteredPeople = computed(() => {
    const q = this.recipientQuery().trim().toLowerCase();
    if (!q) return FAKE_PEOPLE;
    return FAKE_PEOPLE.filter(
      (person) =>
        person.name.toLowerCase().includes(q) ||
        person.nameAr.toLowerCase().includes(q) ||
        person.email.toLowerCase().includes(q),
    );
  });

  protected readonly safeRecipientIndex = computed(() => {
    const count = this.filteredPeople().length;
    if (count === 0) return -1;
    const idx = this.recipientActiveIndex();
    return idx >= 0 && idx < count ? idx : 0;
  });

  protected readonly activeRecipientOptionId = computed(() => {
    if (!this.recipientOpen() || !this.canManage()) return null;
    const idx = this.safeRecipientIndex();
    return idx >= 0 ? this.recipientOptionId(idx) : null;
  });

  protected readonly clientErrors = computed<FieldErrors>(() => {
    this.i18n();
    if (!this.submitAttempted()) return {};
    const errors: FieldErrors = {};

    const nameLen = [...this.name().trim()].length;
    if (nameLen === 0) {
      errors.name = this.transloco.translate('repSchedules.validation.NAME_REQUIRED');
    } else if (nameLen > MAX_NAME_LENGTH) {
      errors.name = this.transloco.translate('repSchedules.validation.NAME_TOO_LONG');
    }

    if (!this.targetId().trim()) {
      errors.target = this.transloco.translate('repSchedules.validation.TARGET_REQUIRED');
    }

    if (!this.startsOn()) {
      errors.startsOn = this.transloco.translate('repSchedules.validation.STARTS_ON_REQUIRED');
    } else if (this.endsOn() && this.endsOn()! < this.startsOn()!) {
      errors.endsOn = this.transloco.translate('repSchedules.validation.ENDS_BEFORE_STARTS');
    }

    if (this.recipientUserIds().length === 0) {
      errors.recipientUserIds = this.transloco.translate('repSchedules.validation.RECIPIENTS_REQUIRED');
    } else if (this.recipientUserIds().length > MAX_RECIPIENTS) {
      errors.recipientUserIds = this.transloco.translate('repSchedules.validation.RECIPIENTS_TOO_MANY');
    }

    const ttl = Number(this.linkTtlHoursText().trim());
    if (!Number.isInteger(ttl) || ttl < 1 || ttl > 720) {
      errors.linkTtlHours = this.transloco.translate('repSchedules.validation.TTL_OUT_OF_RANGE');
    } else if (this.attachmentFormats().length > 0 && ttl > 168) {
      errors.linkTtlHours = this.transloco.translate('repSchedules.validation.TTL_ATTACHMENT_LIMIT');
    }

    return errors;
  });

  protected readonly fieldErrors = computed<FieldErrors>(() => ({
    ...this.clientErrors(),
    ...this.serverErrors(),
  }));

  constructor() {
    const onScroll = (event: Event) => {
      if (!this.recipientOpen()) return;
      const target = event.target;
      const listEl = this.recipientListRef()?.nativeElement;
      if (target instanceof Node && listEl && listEl.contains(target)) return;
      this.closeRecipientMenu();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    this.destroyRef.onDestroy(() => document.removeEventListener('scroll', onScroll, { capture: true }));
  }

  openCreate(prefill?: { dashboardId?: string | null; reportKey?: string | null }): void {
    void this.refreshTargets();
    this.editingSubscription.set(null);
    const defaults = this.createDefaultDraft(prefill);
    this.baseline.set(defaults);
    this.applyDraft(defaults);
    this.currentRevision.set(1);
    this.resetValidation();
    this.closeRecipientMenu();
    this.allowClose = false;
    this.modal().open();
  }

  openEdit(sub: Subscription): void {
    void this.refreshTargets();
    this.editingSubscription.set(sub);
    const draft = this.draftFromSubscription(sub);
    this.baseline.set(draft);
    this.applyDraft(draft);
    this.currentRevision.set(sub.revision);
    this.resetValidation();
    this.closeRecipientMenu();
    this.allowClose = false;
    this.modal().open();
  }

  close(): void {
    this.closeRecipientMenu();
    this.allowClose = true;
    this.modal().close();
  }

  editingId(): string | null {
    return this.editingSubscription()?.id ?? null;
  }

  protected undo(): void {
    this.applyDraft(this.baseline());
    this.resetValidation();
    this.closeRecipientMenu();
  }

  protected requestClose(): void {
    if (!this.canManage() || !this.dirty()) {
      this.close();
      return;
    }
    void this.confirmDiscardAndClose();
  }

  protected onModalClosed(): void {
    this.closeRecipientMenu();
    if (!this.allowClose && this.saving()) {
      this.modal().open();
      return;
    }
    if (!this.allowClose && this.canManage() && this.dirty()) {
      this.modal().open();
      void this.confirmDiscardAndClose();
      return;
    }
    this.allowClose = false;
    this.editingSubscription.set(null);
    this.resetValidation();
  }

  protected personName(person: FakePerson): string {
    return this.language() === 'ar' ? person.nameAr : person.name;
  }

  protected personNamesSummary(): string {
    const names = this.selectedRecipients().map((person) => this.personName(person));
    return names.length > 0 ? names.join(', ') : '—';
  }

  protected fieldError(field: FormFieldKey): string | null {
    return this.fieldErrors()[field] ?? null;
  }

  protected describedBy(id: string, field?: FormFieldKey): string {
    const hintId = `${id}-hint`;
    if (field && this.fieldError(field)) {
      return `${hintId} ${id}-error`;
    }
    return hintId;
  }

  protected onNameInput(event: Event): void {
    if (!this.canManage()) return;
    this.name.set((event.target as HTMLInputElement).value);
    this.clearServerFieldError('name');
  }

  protected onTargetTypeChange(value: string | null): void {
    if (!this.canManage() || (value !== 'DASHBOARD' && value !== 'REPORT')) return;
    if (value === this.targetType()) return;
    this.targetType.set(value);
    this.targetId.set(this.firstPickableTarget(value));
    this.clearServerFieldError('target');
  }

  protected onTargetChange(id: string): void {
    this.targetId.set(id);
    this.clearServerFieldError('target');
  }

  protected onRecurrenceChange(rec: SubscriptionRecurrence): void {
    this.recurrence.set(rec);
    this.clearServerFieldError('scheduleWeekday');
    this.clearServerFieldError('scheduleMonthDay');
  }

  protected onStartsOnChange(date: string | null): void {
    this.startsOn.set(date);
    this.clearServerFieldError('startsOn');
    this.clearServerFieldError('endsOn');
  }

  protected onEndsOnChange(date: string | null): void {
    this.endsOn.set(date);
    this.clearServerFieldError('endsOn');
  }

  protected onTimeChange(nextTime: string | null): void {
    if (!this.canManage() || !nextTime) return;
    this.time.set(nextTime);
    this.clearServerFieldError('scheduleMinute');
  }

  protected clearEndsOn(): void {
    if (!this.canManage()) return;
    this.endsOn.set(null);
    this.clearServerFieldError('endsOn');
  }

  protected onTtlInput(event: Event): void {
    if (!this.canManage()) return;
    this.linkTtlHoursText.set((event.target as HTMLInputElement).value);
    this.clearServerFieldError('linkTtlHours');
  }

  protected hasFormat(format: SubscriptionAttachmentFormat): boolean {
    return this.attachmentFormats().includes(format);
  }

  protected onAttachmentChange(format: SubscriptionAttachmentFormat, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.toggleFormat(format, checked);
  }

  protected toggleFormat(format: SubscriptionAttachmentFormat, checked: boolean): void {
    if (!this.canManage()) return;
    if (format === 'PDF' && !this.pdfEnabled) return;
    this.attachmentFormats.update((current) => {
      const next = checked ? [...current.filter((item) => item !== format), format] : current.filter((item) => item !== format);
      return next;
    });
    this.clearServerFieldError('attachmentFormats');
    this.clearServerFieldError('linkTtlHours');
  }

  protected recipientOptionId(index: number): string {
    return `${this.uid}-rec-opt-${index}`;
  }

  protected isRecipientSelected(id: string): boolean {
    return this.selectedRecipientSet().has(id);
  }

  protected onRecipientFieldClick(): void {
    if (!this.canManage()) return;
    this.recipientInput()?.nativeElement.focus();
    this.openRecipientMenu();
  }

  protected onRecipientInput(event: Event): void {
    if (!this.canManage() || this.atMaxRecipients()) return;
    this.recipientQuery.set((event.target as HTMLInputElement).value);
    this.recipientActiveIndex.set(0);
    if (!this.recipientOpen()) {
      this.openRecipientMenu();
    } else {
      this.scheduleRecipientPlace();
    }
  }

  protected onRecipientKeydown(event: KeyboardEvent): void {
    if (!this.canManage()) return;
    const list = this.filteredPeople();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.recipientOpen()) {
          this.recipientActiveIndex.set(0);
          this.openRecipientMenu();
          return;
        }
        if (list.length > 0) {
          this.recipientActiveIndex.set((this.safeRecipientIndex() + 1) % list.length);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!this.recipientOpen()) {
          this.recipientActiveIndex.set(0);
          this.openRecipientMenu();
          return;
        }
        if (list.length > 0) {
          this.recipientActiveIndex.set((this.safeRecipientIndex() - 1 + list.length) % list.length);
        }
        break;
      case 'Enter':
        if (!this.recipientOpen()) return;
        event.preventDefault();
        event.stopPropagation();
        if (list.length > 0) {
          const person = list[this.safeRecipientIndex()];
          if (person) this.toggleRecipient(person.id);
        }
        break;
      case 'Escape':
        if (!this.recipientOpen()) return;
        event.preventDefault();
        event.stopPropagation();
        this.closeRecipientMenu();
        break;
      case 'Backspace':
        if (this.recipientQuery() === '' && this.recipientUserIds().length > 0) {
          this.recipientUserIds.update((ids) => ids.slice(0, -1));
          this.clearServerFieldError('recipientUserIds');
          if (this.recipientOpen()) this.scheduleRecipientPlace();
        }
        break;
      case 'Tab':
        this.closeRecipientMenu();
        break;
    }
  }

  protected toggleRecipient(id: string): void {
    if (!this.canManage()) return;
    if (this.isRecipientSelected(id)) {
      this.recipientUserIds.update((ids) => ids.filter((item) => item !== id));
    } else if (!this.atMaxRecipients()) {
      this.recipientUserIds.update((ids) => [...ids, id]);
    } else {
      return;
    }
    this.recipientQuery.set('');
    const inputEl = this.recipientInput()?.nativeElement;
    if (inputEl) inputEl.value = '';
    this.recipientActiveIndex.set(0);
    this.clearServerFieldError('recipientUserIds');
    this.scheduleRecipientPlace();
    inputEl?.focus();
  }

  protected removeRecipient(id: string): void {
    if (!this.canManage()) return;
    this.recipientUserIds.update((ids) => ids.filter((item) => item !== id));
    this.clearServerFieldError('recipientUserIds');
    if (this.recipientOpen()) this.scheduleRecipientPlace();
  }

  protected onDocumentClick(event: Event): void {
    if (!this.recipientOpen()) return;
    const target = event.target as Node | null;
    const anchor = this.recipientsAnchor()?.nativeElement;
    const list = this.recipientListRef()?.nativeElement;
    if (target && (anchor?.contains(target) || list?.contains(target))) return;
    this.closeRecipientMenu();
  }

  protected closeRecipientMenu(): void {
    this.recipientSeq++;
    this.recipientOpen.set(false);
    this.recipientPlaced.set(false);
  }

  protected async save(): Promise<boolean> {
    if (this.saving() || !this.canManage()) return false;
    this.closeRecipientMenu();
    this.submitAttempted.set(true);
    this.serverErrors.set({});

    if (Object.keys(this.clientErrors()).length > 0) {
      return false;
    }

    const base = this.editingSubscription();
    if (base && !this.dirty()) {
      return false;
    }

    // Delivery is EMAIL only in this release (no channel field to send). Day fields are sent only for their recurrence: the backend
    // refuses a weekday on a non-weekly schedule, and the target cannot change after creation.
    const fields: Omit<UpdateSubscription, 'revision'> = {
      name: this.name().trim(),
      periodToken: this.periodToken(),
      recurrence: this.recurrence(),
      ...(this.recurrence() === 'WEEKLY' ? { scheduleWeekday: this.scheduleWeekday() } : {}),
      ...(this.recurrence() === 'MONTHLY' ? { scheduleMonthDay: this.scheduleMonthDay() } : {}),
      scheduleMinute: timeToMinutes(this.time()),
      timeZone: this.timeZone(),
      startsOn: this.startsOn()!,
      endsOn: this.endsOn(),
      recipients: [...this.recipientUserIds()],
      attachmentFormats: [...this.attachmentFormats()],
      linkTtlHours: Number(this.linkTtlHoursText().trim()),
      locale: this.locale(),
    };

    this.saving.set(true);
    try {
      let result: Subscription;
      if (!base) {
        const target = this.targetType() === 'DASHBOARD' ? { dashboardId: this.targetId() } : { reportKey: this.targetId() };
        result = await createSubscription({ ...fields, ...target } as CreateSubscription, newIdempotencyKey());
        this.notify.success(this.transloco.translate('repSchedules.toasts.created'));
      } else {
        result = await updateSubscription(base.id, { ...fields, revision: this.currentRevision() });
        this.notify.success(this.transloco.translate('repSchedules.toasts.saved'));
      }
      this.saved.emit(result);
      this.close();
      return true;
    } catch (error) {
      await this.handleSaveError(error, base);
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  private async handleSaveError(error: unknown, base: Subscription | null): Promise<void> {
    const code = errorCodeOf(error);
    if (error instanceof ApiError && error.status === 409 && code === 'CRM_SUBSCRIPTION_REVISION_STALE' && base) {
      const reload = await this.conflictDialog().open();
      try {
        const latest = await getSubscription(base.id);
        this.editingSubscription.set(latest);
        this.currentRevision.set(latest.revision);
        if (reload) {
          const freshDraft = this.draftFromSubscription(latest);
          this.baseline.set(freshDraft);
          this.applyDraft(freshDraft);
          this.resetValidation();
        }
        this.reloaded.emit(latest);
      } catch (fetchErr) {
        if (errorCodeOf(fetchErr) === 'CRM_SUBSCRIPTION_NOT_FOUND') {
          this.notify.error(this.transloco.translate(errorKey('CRM_SUBSCRIPTION_NOT_FOUND')));
          this.deletedRemotely.emit();
          this.close();
          return;
        }
        this.notify.error(this.transloco.translate(errorKey(errorCodeOf(fetchErr))));
      }
      return;
    }

    if (code === 'CRM_SUBSCRIPTION_NOT_FOUND') {
      this.notify.error(this.transloco.translate(errorKey(code)));
      this.deletedRemotely.emit();
      this.close();
      return;
    }

    // 400 CRM_VALIDATION_FAILED carries `details: { [dtoField]: [constraint] }`; 422 schedule problems carry
    // `details.problems`; the other field codes of 422 carry none (or the PDF renderer reason).
    const message =
      code === 'CRM_EXPORT_FORMAT_INVALID' && isPdfRendererUnavailable(error)
        ? this.transloco.translate(reasonKey('PDF_RENDERER_UNAVAILABLE'))
        : this.transloco.translate(errorKey(code));
    const mapped: FieldErrors = {};
    let unmapped = false;
    if (error instanceof ApiError && code === 'CRM_VALIDATION_FAILED') {
      for (const dtoField of Object.keys(error.details ?? {})) {
        const field = DETAIL_FIELDS[dtoField];
        if (field) mapped[field] = message;
        else unmapped = true;
      }
    } else if (code === 'CRM_SUBSCRIPTION_SCHEDULE_INVALID') {
      const problems = scheduleProblemFields(error);
      for (const field of problems.fields) mapped[field] = message;
      unmapped = problems.unmapped;
    } else if (code && CODE_FIELDS[code]) {
      mapped[CODE_FIELDS[code]] = message;
    } else {
      unmapped = true;
    }

    if (Object.keys(mapped).length > 0) {
      this.serverErrors.set(mapped);
    }
    if (unmapped) {
      this.notify.error(message);
    }
  }

  private async confirmDiscardAndClose(): Promise<void> {
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

  private createDefaultDraft(prefill?: { dashboardId?: string | null; reportKey?: string | null }): ScheduleDraft {
    const hasReport = Boolean(prefill?.reportKey?.trim());
    const targetType: SubscriptionTargetType = hasReport ? 'REPORT' : 'DASHBOARD';
    const defaultDashboard = this.firstPickableTarget('DASHBOARD');
    const defaultReport = this.firstPickableTarget('REPORT');
    const targetId = hasReport
      ? (prefill!.reportKey!.trim() || defaultReport)
      : (prefill?.dashboardId?.trim() || defaultDashboard);

    return {
      name: '',
      targetType,
      targetId,
      periodToken: 'LAST_COMPLETED_WEEK',
      recurrence: 'WEEKLY',
      scheduleWeekday: 0,
      scheduleMonthDay: 1,
      time: DEFAULT_TIME,
      timeZone: DEFAULT_TIME_ZONE,
      startsOn: format(new Date(), 'yyyy-MM-dd'),
      endsOn: null,
      recipientUserIds: [FAKE_ME.id],
      attachmentFormats: [],
      linkTtlHoursText: String(DEFAULT_TTL_HOURS),
      locale: this.language(),
    };
  }

  private draftFromSubscription(sub: Subscription): ScheduleDraft {
    return {
      name: sub.name,
      targetType: subscriptionTargetType(sub),
      targetId: sub.reportKey ?? sub.dashboardId,
      periodToken: sub.periodToken,
      recurrence: sub.recurrence,
      scheduleWeekday: sub.scheduleWeekday ?? 0,
      scheduleMonthDay: sub.scheduleMonthDay ?? 1,
      time: minutesToTime(sub.scheduleMinute),
      timeZone: sub.timeZone,
      startsOn: sub.startsOn,
      endsOn: sub.endsOn,
      recipientUserIds: [...sub.recipients],
      attachmentFormats: [...sub.attachmentFormats],
      linkTtlHoursText: String(sub.linkTtlHours),
      locale: sub.locale,
    };
  }

  private applyDraft(draft: ScheduleDraft): void {
    this.name.set(draft.name);
    this.targetType.set(draft.targetType);
    this.targetId.set(draft.targetId);
    this.periodToken.set(draft.periodToken);
    this.recurrence.set(draft.recurrence);
    this.scheduleWeekday.set(draft.scheduleWeekday);
    this.scheduleMonthDay.set(draft.scheduleMonthDay);
    this.time.set(draft.time);
    this.timeZone.set(draft.timeZone);
    this.startsOn.set(draft.startsOn);
    this.endsOn.set(draft.endsOn);
    this.recipientUserIds.set([...draft.recipientUserIds]);
    this.attachmentFormats.set([...draft.attachmentFormats]);
    this.linkTtlHoursText.set(draft.linkTtlHoursText);
    this.locale.set(draft.locale);
    this.recipientQuery.set('');
  }

  private firstPickableTarget(type: SubscriptionTargetType): string {
    const targets = this.targets();
    const list = type === 'DASHBOARD' ? targets.dashboards : targets.reports;
    return list.find((item) => !item.disabled)?.id ?? '';
  }

  /** Loads the picker lists; a new schedule without a target then takes the first one it may pick. */
  private async refreshTargets(): Promise<void> {
    const seq = ++this.targetsSeq;
    try {
      const targets = await listScheduleTargets();
      if (seq !== this.targetsSeq) return;
      this.targets.set(targets);
      if (this.isEdit() || this.targetId()) return;
      const id = this.firstPickableTarget(this.targetType());
      if (!id) return;
      this.targetId.set(id);
      if (!this.baseline().targetId) {
        this.baseline.update((draft) => ({ ...draft, targetId: id }));
      }
    } catch (error) {
      if (seq === this.targetsSeq) {
        this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
      }
    }
  }

  private resetValidation(): void {
    this.submitAttempted.set(false);
    this.serverErrors.set({});
  }

  private clearServerFieldError(field: FormFieldKey): void {
    if (!this.serverErrors()[field]) return;
    this.serverErrors.update((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  private openRecipientMenu(): void {
    if (this.recipientOpen() || !this.canManage() || this.atMaxRecipients()) return;
    const anchor = this.recipientsAnchor()?.nativeElement;
    if (!anchor) return;
    const rect = rectInPage(anchor);
    const { width } = viewport();
    const rtl = getComputedStyle(anchor).direction === 'rtl';
    this.recipientPlaced.set(false);
    this.recipientPlace.set({
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
      width: rect.width,
      maxHeight: null,
    });
    this.recipientOpen.set(true);
    this.scheduleRecipientPlace();
  }

  private scheduleRecipientPlace(): void {
    const seq = ++this.recipientSeq;
    queueMicrotask(() => this.placeRecipientList(seq));
    afterNextRender(() => this.placeRecipientList(seq), { injector: this.injector });
  }

  private placeRecipientList(seq: number): void {
    if (seq !== this.recipientSeq || !this.recipientOpen()) return;
    const anchor = this.recipientsAnchor()?.nativeElement;
    const listEl = this.recipientListRef()?.nativeElement;
    if (!anchor || !listEl) return;

    listEl.style.maxHeight = '';
    const rect = rectInPage(anchor);
    const listRect = rectInPage(listEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(anchor).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const spaceBelow = Math.max(8, height - 8 - belowTop);
    const spaceAbove = Math.max(8, rect.top - 12);
    const flipUp = listRect.height > spaceBelow && spaceAbove > spaceBelow;
    const avail = flipUp ? spaceAbove : spaceBelow;
    const maxHeight = listRect.height > avail ? avail : null;
    const finalHeight = maxHeight ?? listRect.height;
    const top = flipUp ? Math.max(8, rect.top - 4 - finalHeight) : belowTop;

    const triggerStart = rtl ? width - rect.right : rect.left;
    const triggerEnd = rtl ? width - rect.left : rect.right;
    const alignEnd = triggerStart + listRect.width > width - 8;
    const rawStart = alignEnd ? triggerEnd - listRect.width : triggerStart;
    const start = Math.min(Math.max(8, rawStart), Math.max(8, width - 8 - listRect.width));

    this.recipientPlace.set({ top, start, width: rect.width, maxHeight });
    this.recipientPlaced.set(true);

    listEl.style.top = `${top}px`;
    listEl.style.insetInlineStart = `${start}px`;
    listEl.style.minWidth = `${rect.width}px`;
    listEl.style.maxHeight = maxHeight !== null ? `${maxHeight}px` : '';
    listEl.classList.remove('invisible');
  }
}
