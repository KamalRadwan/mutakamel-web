import {
  Component,
  ElementRef,
  Injector,
  Signal,
  afterNextRender,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChildren,
} from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlarm,
  tablerCheck,
  tablerCircleDot,
  tablerCircleX,
  tablerLock,
  tablerMail,
  tablerMap2,
  tablerPhone,
  tablerPlus,
  tablerSquareCheck,
  tablerUsers,
  tablerX,
} from '@ng-icons/tabler-icons';
import { ApiError, fieldErrorsOf, isRetryableWriteError, isValidationError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { CurrentUser } from '../../../../core/auth/current-user';
import { LanguageState } from '../../../../core/i18n/language';
import { Button } from '../../../ui/button/button';
import { DateField } from '../../../ui/date-time/date-field';
import { TimeField } from '../../../ui/date-time/time-field';
import { Dropdown, DropdownOption } from '../../../ui/dropdown/dropdown';
import { Field } from '../../../ui/field/field';
import { Segmented, SegmentedOption } from '../../../ui/segmented/segmented';
import { ActivitiesApi } from '../activities.api';
import {
  ACTIVITY_TYPES,
  Activity,
  ActivityDirection,
  ActivityAssigneesParams,
  ActivityPriority,
  ActivityType,
  Assignee,
  LIMITS,
  TYPE_FIELDS,
  TYPE_LOOK,
  TargetApp,
} from '../activities.model';
import {
  ActivityFormField,
  ActivityFormValue,
  ActivityInitialStatus,
  INITIAL_STATUSES,
  REMINDER_OFFSETS,
  SchedulePreset,
  activityToFormValue,
  addMinutesToLocal,
  applyAddEnd,
  applyStartChange,
  applyStatusChange,
  applyTypeChange,
  buildCreateBody,
  buildDurationChips,
  buildSchedulePresets,
  buildUpdateBody,
  codePointLength,
  countEditChanges,
  createInitialValue,
  fromLocalDateTime,
  isCreateDirty,
  isValidMeetingLink,
  resetValueForAnother,
  toLocalDateTime,
  validateActivityForm,
} from './activity-form.model';

const PRIORITIES: readonly ActivityPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const PRIORITY_DOTS: Record<ActivityPriority, string> = {
  LOW: 'bg-status-none',
  NORMAL: 'bg-icon-blue',
  HIGH: 'bg-warning',
  URGENT: 'bg-danger',
};
const STATUS_DOTS: Record<ActivityInitialStatus, string> = {
  PLANNED: 'bg-brand',
  IN_PROGRESS: 'bg-icon-violet',
  DONE: 'bg-success',
};
const DIRECTIONS: ReadonlyArray<ActivityDirection | ''> = ['', 'INBOUND', 'OUTBOUND', 'INTERNAL'];

const API_FIELD_MAP: Record<string, ActivityFormField | undefined> = {
  type: 'type',
  assigneeUserId: 'assigneeUserId',
  status: 'status',
  priority: 'priority',
  direction: 'direction',
  reminderOffsetMinutes: 'reminder',
  subject: 'subject',
  dueAt: 'start',
  endsAt: 'end',
  location: 'location',
  meetingUrl: 'meetingUrl',
  description: 'description',
  outcome: 'outcome',
};

@Component({
  selector: 'app-activity-form',
  imports: [NgIcon, TranslocoPipe, Button, Field, Segmented, DateField, TimeField, Dropdown],
  viewProviders: [provideTranslocoScope('activities')],
  providers: [
    provideIcons({
      tablerSquareCheck,
      tablerPhone,
      tablerUsers,
      tablerMail,
      tablerMap2,
      tablerAlarm,
      tablerCircleDot,
      tablerX,
      tablerPlus,
      tablerCheck,
      tablerLock,
      tablerCircleX,
    }),
  ],
  templateUrl: './activity-form.html',
  host: { class: 'grid grid-cols-3 gap-x-10 gap-y-8' },
})
export class ActivityForm {
  private static nextId = 0;
  protected readonly uid = `activity-form-${++ActivityForm.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly currentUser = inject(CurrentUser);
  private readonly scope = inject(TenantScopeState);
  private readonly api = inject(ActivitiesApi);
  private readonly typeButtons = viewChildren<ElementRef<HTMLButtonElement>>('typeBtn');

  readonly mode = input<'create' | 'edit'>('create');
  readonly activity = input<Activity | null>(null);
  readonly target = input<{ app: TargetApp; type: string; id: string; label: string } | null>(null);
  readonly initialType = input<ActivityType>('TODO');

  protected readonly currentUserId = computed(() => this.scope.me()?.id ?? '');
  protected readonly activityTypes = ACTIVITY_TYPES;
  protected readonly typeLook = TYPE_LOOK;
  protected readonly limits = LIMITS;

  private readonly assignees = signal<Assignee[]>([
    { id: this.currentUserId(), name: this.currentUser.user().displayName },
  ]);
  protected readonly currentBaseActivity = signal<Activity | null>(null);
  protected readonly formValue = signal<ActivityFormValue>(createInitialValue('TODO', this.currentUserId()));
  private readonly touched = signal<Partial<Record<ActivityFormField, boolean>>>({});
  private readonly revealAllErrors = signal(false);
  private readonly serverErrors = signal<Partial<Record<ActivityFormField, string>>>({});
  private readonly saveTick = signal(0);
  private readonly savingState = signal(false);

  protected readonly assigneesFailed = signal(false);
  private pendingSave: { key: string; bodyJson: string } | null = null;

  private lastInitializedMode: 'create' | 'edit' | null = null;
  private lastInitializedType: ActivityType | null = null;
  private lastInitializedTarget: string | null = null;

  readonly dirty: Signal<boolean> = computed(() => {
    if (this.mode() === 'edit') {
      return this.changedCount() > 0;
    }
    return isCreateDirty(this.formValue());
  });

  readonly changedCount: Signal<number> = computed(() => {
    if (this.mode() !== 'edit') return 0;
    const base = this.currentBaseActivity();
    if (!base) return 0;
    return countEditChanges(base, this.formValue());
  });

  readonly status: Signal<'PLANNED' | 'IN_PROGRESS' | 'DONE'> = computed(() => this.formValue().status);
  readonly saving: Signal<boolean> = this.savingState.asReadonly();

  protected readonly typeFields = computed(() => TYPE_FIELDS[this.formValue().type]);

  protected readonly effectiveStatus = computed(() => {
    if (this.mode() === 'create') return this.formValue().status;
    return this.currentBaseActivity()?.status ?? 'PLANNED';
  });

  protected readonly showReminder = computed(() => this.effectiveStatus() !== 'DONE');
  protected readonly hasEnd = computed(() => Boolean(this.formValue().endDate || this.formValue().endTime));

  protected readonly subjectCount = computed(() => codePointLength(this.formValue().subject));
  protected readonly locationCount = computed(() => codePointLength(this.formValue().location));
  protected readonly descriptionCount = computed(() => codePointLength(this.formValue().description));
  protected readonly outcomeCount = computed(() => codePointLength(this.formValue().outcome));
  protected readonly meetingLinkValid = computed(() => isValidMeetingLink(this.formValue().meetingUrl));

  protected readonly todayLabel = computed(() => {
    this.i18n();
    return this.transloco.translate('notifications.days.today');
  });

  protected readonly assigneeOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const meSuffix = this.transloco.translate('activities.form.me');
    const list = this.assignees();
    const base = this.currentBaseActivity();
    const all =
      base && !list.some((user) => user.id === base.assigneeUserId)
        ? [...list, { id: base.assigneeUserId, name: base.assigneeName ?? base.assigneeUserId }]
        : list;
    return all.map((user) => ({
      value: user.id,
      label: user.id === this.currentUserId() ? `${user.name} ${meSuffix}` : user.name,
    }));
  });

  protected readonly reminderOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const noneOption: DropdownOption<string> = {
      value: '',
      label: this.transloco.translate('activities.form.reminderNone'),
    };
    const minuteOptions = REMINDER_OFFSETS.map((count) => {
      if (count === 0) {
        const atDue = this.transloco.translate('activities.form.reminderAtDue');
        const label =
          atDue !== 'activities.form.reminderAtDue'
            ? atDue
            : this.transloco.translate('activities.form.reminderMinutes', { count: 0 });
        return { value: '0', label };
      }
      return {
        value: String(count),
        label: this.transloco.translate('activities.form.reminderMinutes', { count }),
      };
    });
    return [noneOption, ...minuteOptions];
  });

  protected readonly statusOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return INITIAL_STATUSES.map((value) => ({
      value,
      label: this.transloco.translate(`activities.statuses.${value}`),
      dot: STATUS_DOTS[value],
    }));
  });

  protected readonly priorityOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return PRIORITIES.map((value) => ({
      value,
      label: this.transloco.translate(`activities.priorities.${value}`),
      dot: PRIORITY_DOTS[value],
    }));
  });

  protected readonly directionOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return DIRECTIONS.map((value) => ({
      value,
      label: this.transloco.translate(`activities.directions.${value === '' ? 'NONE' : value}`),
    }));
  });

  protected readonly schedulePresets = computed(() => {
    this.i18n();
    const current = this.formValue();
    return buildSchedulePresets(current).map((preset) => {
      let label: string;
      if (preset.id === 'today') {
        label = this.transloco.translate('activities.form.presetToday');
      } else if (preset.id === 'tomorrow') {
        label = this.transloco.translate('activities.form.presetTomorrow');
      } else if (preset.id === 'inTwoDays') {
        label = this.transloco.translate('activities.form.presetInTwoDays');
      } else if (preset.id === 'nextWeek') {
        label = this.transloco.translate('activities.form.presetNextWeek');
      } else {
        label = this.transloco.translate('activities.form.presetNextMonth');
      }
      return { ...preset, label };
    });
  });

  protected readonly durationChips = computed(() => buildDurationChips(this.formValue()));

  protected readonly primaryTargetLabel = computed(() => {
    const act = this.currentBaseActivity();
    if (!act) return '';
    const primary = act.targets.find((item) => item.role === 'PRIMARY') ?? act.targets[0];
    return primary?.label ?? '';
  });

  private readonly validationErrors = computed(() => {
    this.saveTick();
    return validateActivityForm(this.formValue(), this.mode(), this.currentBaseActivity());
  });

  private readonly assigneeTarget = computed<ActivityAssigneesParams | null>(() => {
    if (this.mode() === 'create') {
      const target = this.target();
      return target ? { targetApp: target.app, targetType: target.type, targetId: target.id } : null;
    }
    const act = this.activity();
    const primary = act?.targets.find((item) => item.role === 'PRIMARY') ?? act?.targets[0];
    return primary
      ? { targetApp: primary.targetApp, targetType: primary.targetType, targetId: primary.targetId }
      : null;
  });

  constructor() {
    // GET activities/assignees needs the target (create: the record; edit: the PRIMARY target).
    effect(() => {
      const selector = this.assigneeTarget();
      if (!selector) return;
      untracked(() => {
        void this.loadAssignees(selector);
      });
    });

    effect(() => {
      const mode = this.mode();
      const activity = this.activity();
      const initialType = this.initialType();
      const target = this.target();
      const targetKey = target ? `${target.app}:${target.type}:${target.id}` : null;

      untracked(() => {
        if (mode === 'edit') {
          if (activity) {
            const currentBase = this.currentBaseActivity();
            if (
              this.lastInitializedMode !== 'edit' ||
              currentBase?.id !== activity.id ||
              currentBase?.version !== activity.version
            ) {
              this.lastInitializedMode = 'edit';
              this.lastInitializedType = null;
              this.reload(activity);
            }
          }
          return;
        }

        if (this.lastInitializedMode !== 'create' || this.lastInitializedType !== initialType || this.lastInitializedTarget !== targetKey) {
          this.lastInitializedMode = 'create';
          this.lastInitializedTarget = targetKey;
          this.pendingSave = null;
          this.lastInitializedType = initialType;
          this.currentBaseActivity.set(null);
          this.formValue.set(createInitialValue(initialType, this.currentUserId()));
          this.resetValidationState();
        }
      });
    });

    afterRenderEffect(() => {
      this.formValue();
      this.mode();
      this.errorText('start');
      this.errorText('end');
      const root = this.host.nativeElement;
      const hosts = root.querySelectorAll<HTMLElement>(
        'ui-date-field[aria-describedby], ui-time-field[aria-describedby], [role="radiogroup"][aria-describedby]',
      );
      for (const el of hosts) {
        const desc = el.getAttribute('aria-describedby');
        if (!desc) continue;
        const buttons = el.querySelectorAll<HTMLButtonElement>('button[aria-haspopup], button[role="radio"]');
        for (const btn of buttons) {
          if (btn.getAttribute('aria-describedby') !== desc) {
            btn.setAttribute('aria-describedby', desc);
          }
        }
      }
    });
  }

  async save(): Promise<Activity | null> {
    this.revealAllErrors.set(true);
    this.saveTick.update((count) => count + 1);

    const current = this.formValue();
    const mode = this.mode();
    const base = this.currentBaseActivity();
    const errors = validateActivityForm(current, mode, base);
    if (Object.keys(errors).length > 0) {
      return null;
    }

    if (mode === 'create') {
      const targetInfo = this.target();
      if (!targetInfo) {
        throw new ApiError(422, 'ACTIVITY_INVALID');
      }
      const body = buildCreateBody(
        current,
        { app: targetInfo.app, type: targetInfo.type, id: targetInfo.id },
        this.currentUserId(),
      );
      return this.executeSave({ action: 'create', body }, (key) => this.api.createActivity(body, key));
    }

    if (!base) {
      return null;
    }
    const changes = buildUpdateBody(base, current);
    if (Object.keys(changes).length === 0) {
      return null;
    }
    const updated = await this.executeSave({ action: 'update', id: base.id, version: base.version, body: changes }, (key) => this.api.updateActivity(base.id, base.version, changes, key));
    if (updated) {
      this.reload(updated);
    }
    return updated;
  }

  resetForAnother(): void {
    this.pendingSave = null;
    this.formValue.update((current) => resetValueForAnother(current));
    this.resetValidationState();
  }

  rebase(fresh: Activity): void {
    const base = this.currentBaseActivity();
    this.currentBaseActivity.set(base ? { ...base, version: fresh.version } : fresh);
    this.pendingSave = null;
    this.serverErrors.set({});
  }

  reload(fresh: Activity): void {
    this.pendingSave = null;
    this.currentBaseActivity.set(fresh);
    this.formValue.set(activityToFormValue(fresh));
    this.resetValidationState();
  }

  protected describedBy(field: ActivityFormField, suffix: string = field): string {
    const hintId = `${this.uid}-${suffix}-hint`;
    return this.errorText(field) ? `${hintId} ${this.uid}-${suffix}-error` : hintId;
  }

  protected errorText(field: ActivityFormField): string | null {
    this.i18n();
    const serverCode = this.serverErrors()[field];
    const shouldShow = this.revealAllErrors() || Boolean(this.touched()[field]) || Boolean(serverCode);
    if (!shouldShow) return null;

    const clientError = this.validationErrors()[field];
    if (clientError) {
      return this.transloco.translate(`activities.validation.${clientError.key}`, clientError.params);
    }
    if (serverCode) {
      return this.transloco.translate(`activities.errors.${serverCode}`);
    }
    return null;
  }

  protected setType(type: ActivityType): void {
    this.formValue.update((current) => applyTypeChange(current, type, this.mode()));
    this.clearServerErrors();
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

  protected onTextInput(field: 'subject' | 'location' | 'meetingUrl' | 'description' | 'outcome', event: Event): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    this.formValue.update((current) => ({ ...current, [field]: target.value }));
    this.clearServerError(field);
  }

  protected setAssignee(assigneeUserId: string): void {
    this.formValue.update((current) => ({ ...current, assigneeUserId }));
    this.clearServerError('assigneeUserId');
  }

  protected assignToMe(): void {
    this.setAssignee(this.currentUserId());
  }

  protected onStartDateChange(nextDate: string | null): void {
    if (!nextDate) return;
    this.formValue.update((current) => applyStartChange(current, nextDate, current.startTime));
    this.markTouched('start');
    this.clearServerError('start');
  }

  protected onStartTimeChange(nextTime: string | null): void {
    if (!nextTime) return;
    this.formValue.update((current) => applyStartChange(current, current.startDate, nextTime));
    this.markTouched('start');
    this.clearServerError('start');
  }

  protected onEndDateChange(nextDate: string | null): void {
    this.formValue.update((current) => {
      if (!nextDate) {
        return { ...current, endDate: '', endTime: '' };
      }
      let endTime = current.endTime;
      if (!endTime) {
        if (nextDate === current.startDate) {
          const defaultMinutes = TYPE_FIELDS[current.type].defaultMinutes ?? 60;
          const computedEnd = addMinutesToLocal(current.startDate, current.startTime, defaultMinutes);
          if (computedEnd) {
            return { ...current, endDate: computedEnd.date, endTime: computedEnd.time };
          }
        }
        endTime = current.startTime;
      }
      return { ...current, endDate: nextDate, endTime };
    });
    this.markTouched('end');
    this.clearServerError('end');
  }

  protected onEndTimeChange(nextTime: string | null): void {
    this.formValue.update((current) => {
      if (!nextTime) {
        return { ...current, endDate: '', endTime: '' };
      }
      const endDate = current.endDate || current.startDate;
      return { ...current, endDate, endTime: nextTime };
    });
    this.markTouched('end');
    this.clearServerError('end');
  }

  protected applyPreset(preset: SchedulePreset): void {
    this.formValue.update((current) => applyStartChange(current, preset.date, preset.time));
    this.markTouched('start');
    this.clearServerError('start');
  }

  protected applyDuration(minutes: number): void {
    this.formValue.update((current) => {
      const start = fromLocalDateTime(current.startDate, current.startTime);
      if (!start) return current;
      const end = toLocalDateTime(new Date(start.getTime() + minutes * 60 * 1000));
      return { ...current, endDate: end.date, endTime: end.time };
    });
    this.markTouched('end');
    this.clearServerError('end');
  }

  protected addEnd(): void {
    this.formValue.update((current) => applyAddEnd(current));
    this.clearServerError('end');
    queueMicrotask(() => this.focusEndDate());
    afterNextRender(() => this.focusEndDate(), { injector: this.injector });
  }

  protected removeEnd(): void {
    this.formValue.update((current) => ({ ...current, endDate: '', endTime: '' }));
    this.markTouched('end');
    this.clearServerError('end');
  }

  private focusEndDate(): void {
    this.host.nativeElement.querySelector<HTMLElement>(`#${this.uid}-end-date`)?.focus();
  }

  protected setStatus(value: string | null): void {
    if (value !== 'PLANNED' && value !== 'IN_PROGRESS' && value !== 'DONE') return;
    this.formValue.update((current) => applyStatusChange(current, value));
    this.clearServerError('status');
    this.clearServerError('start');
  }

  protected setPriority(value: string | null): void {
    if (value !== 'LOW' && value !== 'NORMAL' && value !== 'HIGH' && value !== 'URGENT') return;
    this.formValue.update((current) => ({ ...current, priority: value }));
    this.clearServerError('priority');
  }

  protected setReminder(reminder: string): void {
    this.formValue.update((current) => ({ ...current, reminder }));
    this.clearServerError('reminder');
  }

  protected setDirection(value: string | null): void {
    if (value !== '' && value !== 'INBOUND' && value !== 'OUTBOUND' && value !== 'INTERNAL') return;
    this.formValue.update((current) => ({ ...current, direction: value }));
    this.clearServerError('direction');
  }

  protected markTouched(field: ActivityFormField): void {
    this.touched.update((current) => (current[field] ? current : { ...current, [field]: true }));
  }

  protected onScheduleFocusOut(field: 'start' | 'end', event: FocusEvent): void {
    const container = event.currentTarget as HTMLElement | null;
    if (!container) return;
    queueMicrotask(() => {
      const active = container.ownerDocument.activeElement;
      if (!active || !container.contains(active)) {
        this.markTouched(field);
      }
    });
  }

  protected formatMetaDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat(`${this.language()}-u-nu-latn`, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  protected retryAssignees(): void {
    const target = this.assigneeTarget();
    if (target) void this.loadAssignees(target);
  }

  private async loadAssignees(target: ActivityAssigneesParams): Promise<void> {
    this.assigneesFailed.set(false);
    this.assignees.set([{ id: this.currentUserId(), name: this.currentUser.user().displayName }]);
    try {
      const list = await this.api.listAssignees(target);
      if (this.assigneeTarget() === target) this.assignees.set(list);
    } catch (error) {
      if (this.assigneeTarget() !== target) return;
      // A user without assignment permission can still create an activity assigned to themselves.
      this.assigneesFailed.set(!(error instanceof ApiError && error.status === 403));
    }
  }

  private async executeSave(action: unknown, request: (key: string) => Promise<Activity>): Promise<Activity | null> {
    const bodyJson = JSON.stringify(action);
    if (this.pendingSave?.bodyJson !== bodyJson) this.pendingSave = { key: newIdempotencyKey(), bodyJson };
    this.savingState.set(true);
    try {
      const result = await request(this.pendingSave.key);
      this.pendingSave = null;
      return result;
    } catch (error) {
      if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) this.pendingSave = null;
      if (isValidationError(error)) {
        const fields = fieldErrorsOf(error);
        let mappedAny = false;
        for (const field of Object.keys(fields)) {
          const mapped = API_FIELD_MAP[field];
          if (!mapped) continue;
          this.serverErrors.update((current) => ({ ...current, [mapped]: 'CORE_VALIDATION_FAILED' }));
          mappedAny = true;
        }
        if (mappedAny) return null;
      }
      throw error;
    } finally {
      this.savingState.set(false);
    }
  }

  private resetValidationState(): void {
    this.touched.set({});
    this.revealAllErrors.set(false);
    this.serverErrors.set({});
  }

  private clearServerError(field: ActivityFormField): void {
    this.serverErrors.update((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  private clearServerErrors(): void {
    if (Object.keys(this.serverErrors()).length > 0) {
      this.serverErrors.set({});
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
