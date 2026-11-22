import {
  Activity,
  ActivityDirection,
  ActivityPriority,
  ActivityType,
  CreateActivity,
  LIMITS,
  MEETING_URL,
  TYPE_FIELDS,
  TargetApp,
  UpdateActivity,
} from '../activities.model';

export type ActivityInitialStatus = 'PLANNED' | 'IN_PROGRESS' | 'DONE';
export type ActivityFormDirection = ActivityDirection | '';

export type ActivityFormField =
  | 'subject'
  | 'start'
  | 'end'
  | 'location'
  | 'meetingUrl'
  | 'description'
  | 'outcome';

export interface ActivityFormValue {
  type: ActivityType;
  subject: string;
  assigneeUserId: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  status: ActivityInitialStatus;
  priority: ActivityPriority;
  reminder: string;
  direction: ActivityFormDirection;
  location: string;
  meetingUrl: string;
  description: string;
  outcome: string;
}

export interface FieldValidationError {
  key:
    | 'required'
    | 'maxLength'
    | 'startInPast'
    | 'doneInFuture'
    | 'endBeforeStart'
    | 'endTooLong'
    | 'invalidUrl';
  params?: Record<string, number>;
}

export type ActivityFormErrors = Partial<Record<ActivityFormField, FieldValidationError>>;

export interface SchedulePreset {
  id: 'today' | 'tomorrow' | 'inTwoDays' | 'nextWeek' | 'nextMonth';
  date: string;
  time: string;
  active: boolean;
}

export interface DurationChip {
  minutes: number;
  unit: 'minutes' | 'hours';
  count: number;
  active: boolean;
}

export const INITIAL_STATUSES: readonly ActivityInitialStatus[] = ['PLANNED', 'IN_PROGRESS', 'DONE'];
export const REMINDER_OFFSETS = [0, 5, 10, 15, 30, 60, 1440] as const;

const MIN_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MIN_MS;

export function codePointLength(value: string): number {
  return Array.from(value).length;
}

export function toLocalDateTime(date: Date): { date: string; time: string } {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
}

export function fromLocalDateTime(dateStr: string, timeStr: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeStr.trim());
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  const result = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (result.getFullYear() !== year || result.getMonth() !== month - 1 || result.getDate() !== day) {
    return null;
  }
  return result;
}

export function nextHalfHour(now = new Date()): Date {
  if (now.getMinutes() < 30) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 30, 0, 0);
  }
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
}

export function currentHalfHour(now = new Date()): Date {
  const minutes = now.getMinutes() < 30 ? 0 : 30;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), minutes, 0, 0);
}

export function addMinutesToLocal(dateStr: string, timeStr: string, minutes: number): { date: string; time: string } | null {
  const parsed = fromLocalDateTime(dateStr, timeStr);
  if (!parsed) return null;
  return toLocalDateTime(new Date(parsed.getTime() + minutes * MIN_MS));
}

export function currentDurationMinutes(
  value: Pick<ActivityFormValue, 'startDate' | 'startTime' | 'endDate' | 'endTime'>,
): number | null {
  if (!value.endDate || !value.endTime) return null;
  const start = fromLocalDateTime(value.startDate, value.startTime);
  const end = fromLocalDateTime(value.endDate, value.endTime);
  if (!start || !end || end.getTime() <= start.getTime()) return null;
  return Math.round((end.getTime() - start.getTime()) / MIN_MS);
}

export function createInitialValue(
  initialType: ActivityType = 'TODO',
  currentUserId = 'u1',
  now = new Date(),
): ActivityFormValue {
  const start = toLocalDateTime(nextHalfHour(now));

  return {
    type: initialType,
    subject: '',
    assigneeUserId: currentUserId,
    startDate: start.date,
    startTime: start.time,
    endDate: '',
    endTime: '',
    status: 'PLANNED',
    priority: 'NORMAL',
    reminder: '15',
    direction: '',
    location: '',
    meetingUrl: '',
    description: '',
    outcome: '',
  };
}

export function resetValueForAnother(current: ActivityFormValue, now = new Date()): ActivityFormValue {
  const startDate = current.status === 'DONE' ? currentHalfHour(now) : nextHalfHour(now);
  const start = toLocalDateTime(startDate);

  return {
    type: current.type,
    subject: '',
    assigneeUserId: current.assigneeUserId,
    startDate: start.date,
    startTime: start.time,
    endDate: '',
    endTime: '',
    status: current.status,
    priority: 'NORMAL',
    reminder: '15',
    direction: '',
    location: '',
    meetingUrl: '',
    description: '',
    outcome: '',
  };
}

export function activityToFormValue(activity: Activity): ActivityFormValue {
  const start = toLocalDateTime(new Date(activity.dueAt));
  const end = activity.endsAt ? toLocalDateTime(new Date(activity.endsAt)) : null;
  const status: ActivityInitialStatus =
    activity.status === 'IN_PROGRESS' || activity.status === 'DONE' ? activity.status : 'PLANNED';

  return {
    type: activity.type,
    subject: activity.subject,
    assigneeUserId: activity.assigneeUserId,
    startDate: start.date,
    startTime: start.time,
    endDate: end?.date ?? '',
    endTime: end?.time ?? '',
    status,
    priority: activity.priority,
    reminder:
      activity.reminderOffsetMinutes !== null && activity.reminderOffsetMinutes !== undefined
        ? String(activity.reminderOffsetMinutes)
        : '',
    direction: activity.direction ?? '',
    location: activity.location ?? '',
    meetingUrl: activity.meetingUrl ?? '',
    description: activity.description ?? '',
    outcome: activity.outcome ?? '',
  };
}

export function applyTypeChange(
  current: ActivityFormValue,
  nextType: ActivityType,
  mode: 'create' | 'edit',
): ActivityFormValue {
  if (current.type === nextType) return current;

  let endDate = current.endDate;
  let endTime = current.endTime;

  // The end is optional for every type: keep it closed when the user has not opened it; when it still has the
  // previous type's default length, give it the new type's default length.
  if (mode === 'create' && (current.endDate || current.endTime)) {
    const prev = addMinutesToLocal(current.startDate, current.startTime, TYPE_FIELDS[current.type].defaultMinutes ?? 60);
    if (prev && current.endDate === prev.date && current.endTime === prev.time) {
      const next = addMinutesToLocal(current.startDate, current.startTime, TYPE_FIELDS[nextType].defaultMinutes ?? 60);
      endDate = next?.date ?? endDate;
      endTime = next?.time ?? endTime;
    }
  }

  return {
    ...current,
    type: nextType,
    endDate,
    endTime,
  };
}

export function applyAddEnd(current: ActivityFormValue): ActivityFormValue {
  const minutes = TYPE_FIELDS[current.type].defaultMinutes ?? 60;
  const end = addMinutesToLocal(current.startDate, current.startTime, minutes);
  if (!end) return current;
  return {
    ...current,
    endDate: end.date,
    endTime: end.time,
  };
}

export function applyStartChange(
  current: ActivityFormValue,
  nextStartDate: string,
  nextStartTime: string,
): ActivityFormValue {
  if (TYPE_FIELDS[current.type].end && current.endDate && current.endTime) {
    const prevStart = fromLocalDateTime(current.startDate, current.startTime);
    const prevEnd = fromLocalDateTime(current.endDate, current.endTime);
    const nextStart = fromLocalDateTime(nextStartDate, nextStartTime);
    if (prevStart && prevEnd && nextStart) {
      const durationMs = prevEnd.getTime() - prevStart.getTime();
      if (durationMs > 0) {
        const shiftedEnd = toLocalDateTime(new Date(nextStart.getTime() + durationMs));
        return {
          ...current,
          startDate: nextStartDate,
          startTime: nextStartTime,
          endDate: shiftedEnd.date,
          endTime: shiftedEnd.time,
        };
      }
    }
  }

  return {
    ...current,
    startDate: nextStartDate,
    startTime: nextStartTime,
  };
}

export function applyStatusChange(
  current: ActivityFormValue,
  nextStatus: ActivityInitialStatus,
  now = new Date(),
): ActivityFormValue {
  let updated: ActivityFormValue = { ...current, status: nextStatus };
  const start = fromLocalDateTime(current.startDate, current.startTime);

  if (nextStatus === 'PLANNED' && (!start || start.getTime() <= now.getTime())) {
    const next = toLocalDateTime(nextHalfHour(now));
    updated = applyStartChange(updated, next.date, next.time);
  } else if (nextStatus === 'DONE' && (!start || start.getTime() > now.getTime() + 5 * MIN_MS)) {
    const currentSlot = toLocalDateTime(currentHalfHour(now));
    updated = applyStartChange(updated, currentSlot.date, currentSlot.time);
  }

  return updated;
}

export function buildSchedulePresets(
  current: Pick<ActivityFormValue, 'startDate' | 'startTime'>,
  now = new Date(),
): SchedulePreset[] {
  const today10am = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0, 0);
  const todaySlot = toLocalDateTime(today10am);
  const tomorrowSlot = toLocalDateTime(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0, 0, 0));
  const inTwoDaysSlot = toLocalDateTime(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 10, 0, 0, 0));
  const nextWeekSlot = toLocalDateTime(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 10, 0, 0, 0));
  const lastDayOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate();
  const nextMonthSlot = toLocalDateTime(
    new Date(now.getFullYear(), now.getMonth() + 1, Math.min(now.getDate(), lastDayOfNextMonth), 10, 0, 0, 0),
  );

  const items: Array<Omit<SchedulePreset, 'active'>> = [
    ...(today10am.getTime() > now.getTime()
      ? [{ id: 'today' as const, date: todaySlot.date, time: todaySlot.time }]
      : []),
    { id: 'tomorrow', date: tomorrowSlot.date, time: tomorrowSlot.time },
    { id: 'inTwoDays', date: inTwoDaysSlot.date, time: inTwoDaysSlot.time },
    { id: 'nextWeek', date: nextWeekSlot.date, time: nextWeekSlot.time },
    { id: 'nextMonth', date: nextMonthSlot.date, time: nextMonthSlot.time },
  ];

  return items.map((item) => ({
    ...item,
    active: current.startDate === item.date && current.startTime === item.time,
  }));
}

export function buildDurationChips(
  current: Pick<ActivityFormValue, 'type' | 'startDate' | 'startTime' | 'endDate' | 'endTime'>,
): DurationChip[] {
  const durations = current.type === 'CALL' ? [15, 30, 60, 90, 120] : [30, 60, 90, 120];
  const activeMinutes = currentDurationMinutes(current);
  return durations.map((minutes) => ({
    minutes,
    unit: minutes < 60 ? 'minutes' : 'hours',
    count: minutes < 60 ? minutes : minutes / 60,
    active: activeMinutes === minutes,
  }));
}

export function isValidMeetingLink(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || codePointLength(trimmed) > LIMITS.meetingUrl || !MEETING_URL.test(trimmed)) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.hostname.includes('.');
  } catch {
    return false;
  }
}

export function validateActivityForm(
  value: ActivityFormValue,
  mode: 'create' | 'edit',
  baseActivity: Activity | null = null,
  now = new Date(),
): ActivityFormErrors {
  const errors: ActivityFormErrors = {};
  const fields = TYPE_FIELDS[value.type];

  const trimmedSubject = value.subject.trim();
  if (!trimmedSubject) {
    errors.subject = { key: 'required' };
  } else if (codePointLength(trimmedSubject) > LIMITS.subject) {
    errors.subject = { key: 'maxLength', params: { max: LIMITS.subject } };
  }

  const startDate = value.startDate && value.startTime ? fromLocalDateTime(value.startDate, value.startTime) : null;
  if (!startDate) {
    errors.start = { key: 'required' };
  } else if (mode === 'create') {
    if (value.status === 'PLANNED' && startDate.getTime() <= now.getTime()) {
      errors.start = { key: 'startInPast' };
    } else if (value.status === 'DONE' && startDate.getTime() > now.getTime() + 5 * MIN_MS) {
      errors.start = { key: 'doneInFuture' };
    }
  } else if (baseActivity?.status === 'PLANNED') {
    const baseForm = activityToFormValue(baseActivity);
    const startChanged = value.startDate !== baseForm.startDate || value.startTime !== baseForm.startTime;
    if (startChanged && startDate.getTime() <= now.getTime()) {
      errors.start = { key: 'startInPast' };
    }
  }

  if (fields.end && (value.endDate || value.endTime)) {
    const endDate = value.endDate && value.endTime ? fromLocalDateTime(value.endDate, value.endTime) : null;
    if (!endDate) {
      errors.end = { key: 'required' };
    } else if (startDate) {
      if (endDate.getTime() <= startDate.getTime()) {
        errors.end = { key: 'endBeforeStart' };
      } else if (endDate.getTime() - startDate.getTime() > LIMITS.maxDays * DAY_MS) {
        errors.end = { key: 'endTooLong', params: { days: LIMITS.maxDays } };
      }
    }
  }

  if (fields.location) {
    const trimmedLocation = value.location.trim();
    if (codePointLength(trimmedLocation) > LIMITS.location) {
      errors.location = { key: 'maxLength', params: { max: LIMITS.location } };
    }
  }

  if (fields.meetingUrl) {
    const trimmedUrl = value.meetingUrl.trim();
    if (trimmedUrl !== '') {
      if (codePointLength(trimmedUrl) > LIMITS.meetingUrl) {
        errors.meetingUrl = { key: 'maxLength', params: { max: LIMITS.meetingUrl } };
      } else if (!isValidMeetingLink(trimmedUrl)) {
        errors.meetingUrl = { key: 'invalidUrl' };
      }
    }
  }

  const trimmedDescription = value.description.trim();
  if (codePointLength(trimmedDescription) > LIMITS.description) {
    errors.description = { key: 'maxLength', params: { max: LIMITS.description } };
  }

  if (mode === 'create' && value.status === 'DONE') {
    const trimmedOutcome = value.outcome.trim();
    if (codePointLength(trimmedOutcome) > LIMITS.outcome) {
      errors.outcome = { key: 'maxLength', params: { max: LIMITS.outcome } };
    }
  }

  return errors;
}

export function buildCreateBody(
  value: ActivityFormValue,
  target: { app: TargetApp; type: string; id: string },
  currentUserId = 'u1',
): CreateActivity {
  const fields = TYPE_FIELDS[value.type];
  const startDate = fromLocalDateTime(value.startDate, value.startTime)!;

  const body: CreateActivity = {
    target,
    type: value.type,
    subject: value.subject.trim(),
    priority: value.priority,
    dueAt: startDate.toISOString(),
  };

  const description = value.description.trim();
  if (description) body.description = description;

  if (fields.direction && value.direction) {
    body.direction = value.direction;
  }

  if (fields.end && value.endDate && value.endTime) {
    const endDate = fromLocalDateTime(value.endDate, value.endTime);
    if (endDate) body.endsAt = endDate.toISOString();
  }

  if (fields.location) {
    const location = value.location.trim();
    if (location) body.location = location;
  }

  if (fields.meetingUrl) {
    const meetingUrl = value.meetingUrl.trim();
    if (meetingUrl) body.meetingUrl = meetingUrl;
  }

  if (value.status !== 'DONE' && value.reminder !== '') {
    body.reminderOffsetMinutes = Number(value.reminder);
  }

  if (value.assigneeUserId && value.assigneeUserId !== currentUserId) {
    body.assigneeUserId = value.assigneeUserId;
  }

  if (value.status === 'IN_PROGRESS' || value.status === 'DONE') {
    body.status = value.status;
  }

  if (value.status === 'DONE') {
    const outcome = value.outcome.trim();
    if (outcome) body.outcome = outcome;
  }

  return body;
}

export function countEditChanges(base: Activity, current: ActivityFormValue): number {
  const baseForm = activityToFormValue(base);
  const fields = TYPE_FIELDS[current.type];
  let count = 0;

  if (current.type !== base.type) count++;
  if (current.subject.trim() !== base.subject) count++;
  if (current.assigneeUserId !== base.assigneeUserId) count++;
  if (current.startDate !== baseForm.startDate || current.startTime !== baseForm.startTime) count++;

  if (!fields.end) {
    if (base.endsAt !== null) count++;
  } else if (current.endDate !== baseForm.endDate || current.endTime !== baseForm.endTime) {
    count++;
  }

  if (current.priority !== base.priority) count++;

  const reminderVal = current.reminder === '' ? null : Number(current.reminder);
  if (reminderVal !== (base.reminderOffsetMinutes ?? null)) count++;

  const directionVal = fields.direction && current.direction ? current.direction : null;
  if (directionVal !== (base.direction ?? null)) count++;

  const locationVal = fields.location && current.location.trim() ? current.location.trim() : null;
  if (locationVal !== (base.location ?? null)) count++;

  const meetingUrlVal = fields.meetingUrl && current.meetingUrl.trim() ? current.meetingUrl.trim() : null;
  if (meetingUrlVal !== (base.meetingUrl ?? null)) count++;

  const descriptionVal = current.description.trim() || null;
  if (descriptionVal !== (base.description ?? null)) count++;

  return count;
}

export function buildUpdateBody(base: Activity, current: ActivityFormValue): UpdateActivity {
  const baseForm = activityToFormValue(base);
  const fields = TYPE_FIELDS[current.type];
  const changes: UpdateActivity = {};

  if (current.type !== base.type) {
    changes.type = current.type;
  }

  const trimmedSubject = current.subject.trim();
  if (trimmedSubject !== base.subject) {
    changes.subject = trimmedSubject;
  }

  if (current.assigneeUserId !== base.assigneeUserId) {
    changes.assigneeUserId = current.assigneeUserId;
  }

  if (current.startDate !== baseForm.startDate || current.startTime !== baseForm.startTime) {
    const startDate = fromLocalDateTime(current.startDate, current.startTime);
    if (startDate) changes.dueAt = startDate.toISOString();
  }

  if (!fields.end) {
    if (base.endsAt !== null) {
      changes.endsAt = null;
    }
  } else if (current.endDate !== baseForm.endDate || current.endTime !== baseForm.endTime) {
    if (!current.endDate && !current.endTime) {
      changes.endsAt = null;
    } else {
      const endDate = fromLocalDateTime(current.endDate, current.endTime);
      if (endDate) changes.endsAt = endDate.toISOString();
    }
  }

  if (current.priority !== base.priority) {
    changes.priority = current.priority;
  }

  const reminderVal = current.reminder === '' ? null : Number(current.reminder);
  if (reminderVal !== (base.reminderOffsetMinutes ?? null)) {
    changes.reminderOffsetMinutes = reminderVal;
  }

  const directionVal = fields.direction && current.direction ? current.direction : null;
  if (directionVal !== (base.direction ?? null)) {
    changes.direction = directionVal;
  }

  const locationVal = fields.location && current.location.trim() ? current.location.trim() : null;
  if (locationVal !== (base.location ?? null)) {
    changes.location = locationVal;
  }

  const meetingUrlVal = fields.meetingUrl && current.meetingUrl.trim() ? current.meetingUrl.trim() : null;
  if (meetingUrlVal !== (base.meetingUrl ?? null)) {
    changes.meetingUrl = meetingUrlVal;
  }

  const descriptionVal = current.description.trim() || null;
  if (descriptionVal !== (base.description ?? null)) {
    changes.description = descriptionVal;
  }

  return changes;
}

export function rebaseFormValue(oldBase: Activity, fresh: Activity, current: ActivityFormValue): ActivityFormValue {
  const oldForm = activityToFormValue(oldBase);
  const freshForm = activityToFormValue(fresh);

  const startChanged = current.startDate !== oldForm.startDate || current.startTime !== oldForm.startTime;
  const endChanged = current.endDate !== oldForm.endDate || current.endTime !== oldForm.endTime;

  return {
    type: current.type !== oldForm.type ? current.type : freshForm.type,
    subject: current.subject.trim() !== oldForm.subject ? current.subject : freshForm.subject,
    assigneeUserId: current.assigneeUserId !== oldForm.assigneeUserId ? current.assigneeUserId : freshForm.assigneeUserId,
    startDate: startChanged ? current.startDate : freshForm.startDate,
    startTime: startChanged ? current.startTime : freshForm.startTime,
    endDate: endChanged ? current.endDate : freshForm.endDate,
    endTime: endChanged ? current.endTime : freshForm.endTime,
    status: freshForm.status,
    priority: current.priority !== oldForm.priority ? current.priority : freshForm.priority,
    reminder: current.reminder !== oldForm.reminder ? current.reminder : freshForm.reminder,
    direction: current.direction !== oldForm.direction ? current.direction : freshForm.direction,
    location: current.location.trim() !== oldForm.location ? current.location : freshForm.location,
    meetingUrl: current.meetingUrl.trim() !== oldForm.meetingUrl ? current.meetingUrl : freshForm.meetingUrl,
    description: current.description.trim() !== oldForm.description ? current.description : freshForm.description,
    outcome: freshForm.outcome,
  };
}

export function isCreateDirty(value: ActivityFormValue): boolean {
  const fields = TYPE_FIELDS[value.type];
  if (value.subject !== '' || value.description !== '') return true;
  if (fields.location && value.location !== '') return true;
  if (fields.meetingUrl && value.meetingUrl !== '') return true;
  if (value.status === 'DONE' && value.outcome !== '') return true;
  return false;
}
