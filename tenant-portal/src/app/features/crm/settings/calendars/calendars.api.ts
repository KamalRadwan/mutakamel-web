import { fakeGetCalendar, fakePublishCalendar } from './calendars.fake';
import { PublishWorkingCalendarRequest, WorkingCalendar } from './calendars.model';

// GET /api/tenant/crm/v1/targets/working-calendars/:branchId/:year (dashboard-sales-targets.controller.ts:63)
export function getCalendar(branchId: string, year: number): Promise<WorkingCalendar> {
  return fakeGetCalendar(branchId, year);
}

// POST /api/tenant/crm/v1/targets/working-calendars/:branchId/:year (controller :74; gateway WRITE_SENSITIVE, idempotent:false, so no key needed)
export function publishCalendar(
  branchId: string,
  year: number,
  body: PublishWorkingCalendarRequest,
): Promise<WorkingCalendar> {
  return fakePublishCalendar(branchId, year, body);
}
