// `@IsDateString()` date-only fields — `expectedCloseDate` on the opportunity
// DTOs — against `DatePicker`, which speaks `Date`.
//
// The conversion is built from the **local** calendar parts on purpose.
// `toISOString()` converts to UTC first, so a date picked in any timezone east
// of UTC lands on the previous day for part of the year: a close date of the
// 1st silently becomes the 31st. This app runs in Africa/Cairo by default,
// which is UTC+2 or +3, so that is not a hypothetical.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function toIsoDate(date: Date | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return "";
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromIsoDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const dateOnly = value.slice(0, 10);
  if (!ISO_DATE.test(dateOnly)) return undefined;
  const [year, month, day] = dateOnly.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
