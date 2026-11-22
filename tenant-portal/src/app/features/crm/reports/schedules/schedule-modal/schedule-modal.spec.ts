import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../../../shared/widgets/dashboard/analytics-api';
import { isPdfRendererUnavailable, scheduleProblemFields } from './schedule-modal';

describe('scheduleProblemFields', () => {
  it('maps lowercase details.problems to their form fields', () => {
    const error = new ApiError(422, 'CRM_SUBSCRIPTION_SCHEDULE_INVALID', {
      problems: ['weekday_required', 'time_zone_invalid', 'ends_before_starts'],
    });
    expect(scheduleProblemFields(error)).toEqual({ fields: ['scheduleWeekday', 'timeZone', 'endsOn'], unmapped: false });
  });

  it('flags problems without a field, and a missing or non-array list, as unmapped', () => {
    expect(
      scheduleProblemFields(new ApiError(422, 'CRM_SUBSCRIPTION_SCHEDULE_INVALID', { problems: ['filters_too_large'] })),
    ).toEqual({ fields: [], unmapped: true });
    expect(
      scheduleProblemFields(
        new ApiError(422, 'CRM_SUBSCRIPTION_SCHEDULE_INVALID', { problems: ['month_day_forbidden', 'no_next_run'] }),
      ),
    ).toEqual({ fields: ['scheduleMonthDay'], unmapped: true });
    expect(scheduleProblemFields(new ApiError(422, 'CRM_SUBSCRIPTION_SCHEDULE_INVALID'))).toEqual({ fields: [], unmapped: true });
    expect(
      scheduleProblemFields(new ApiError(422, 'CRM_SUBSCRIPTION_SCHEDULE_INVALID', { problems: 'WEEKDAY_REQUIRED' })),
    ).toEqual({ fields: [], unmapped: true });
  });
});

describe('isPdfRendererUnavailable', () => {
  it('reads the lowercase reason array of CRM_EXPORT_FORMAT_INVALID', () => {
    expect(isPdfRendererUnavailable(new ApiError(422, 'CRM_EXPORT_FORMAT_INVALID', { reason: ['pdf_renderer_unavailable'] }))).toBe(true);
    expect(isPdfRendererUnavailable(new ApiError(422, 'CRM_EXPORT_FORMAT_INVALID', { reason: 'PDF_RENDERER_UNAVAILABLE' }))).toBe(false);
    expect(isPdfRendererUnavailable(new ApiError(422, 'CRM_EXPORT_FORMAT_INVALID'))).toBe(false);
  });
});
