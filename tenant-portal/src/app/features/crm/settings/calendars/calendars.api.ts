import { ApiError, isRetryableWriteError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { crmHttp, crmQueries } from '../../shared/crm-http';
import { PublishWorkingCalendarRequest, WorkingCalendar } from './calendars.model';

const queryKey = ['crm-settings', 'calendars'] as const;
const pendingPublishes = new Map<string, { key: string; bodyJson: string }>();

function calendarPath(branchId: string, year: number): string {
  return `/targets/working-calendars/${encodeURIComponent(branchId)}/${year}`;
}

export function getCalendar(branchId: string, year: number): Promise<WorkingCalendar> {
  return crmQueries().fetchQuery({
    queryKey: [...queryKey, branchId, year],
    queryFn: () => crmHttp().read<WorkingCalendar>(calendarPath(branchId, year)),
  });
}

export async function publishCalendar(
  branchId: string,
  year: number,
  body: PublishWorkingCalendarRequest,
): Promise<WorkingCalendar> {
  const path = calendarPath(branchId, year);
  const bodyJson = JSON.stringify(body);
  let action = pendingPublishes.get(path);
  if (!action || action.bodyJson !== bodyJson) {
    action = { key: newIdempotencyKey(), bodyJson };
    pendingPublishes.set(path, action);
  }
  let saved: WorkingCalendar;
  try {
    const result = await crmHttp().write<WorkingCalendar>(
      'POST',
      path,
      JSON.parse(action.bodyJson),
      { key: action.key },
    );
    saved = result.data;
    pendingPublishes.delete(path);
  } catch (error) {
    if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) {
      pendingPublishes.delete(path);
    }
    throw error;
  }
  await crmQueries().cancelQueries({ queryKey });
  await crmQueries().invalidateQueries({ queryKey });
  return saved;
}
