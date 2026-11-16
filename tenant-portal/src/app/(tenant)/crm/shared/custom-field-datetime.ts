// DATETIME custom values require seconds and an explicit zone on the CRM wire.
// Native datetime-local controls instead speak the browser's local clock.
const LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
const ZONED_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/;

interface ClockParts { year: number; month: number; day: number; hour: number; minute: number; second: number; millisecond: number }

function parts(match: RegExpMatchArray): ClockParts {
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), hour: Number(match[4]), minute: Number(match[5]), second: Number(match[6] ?? 0), millisecond: Number((match[7] ?? "").padEnd(3, "0")) };
}

function validClock(value: ClockParts): boolean {
  if (value.year < 1 || value.month < 1 || value.month > 12 || value.day < 1 || value.hour > 23 || value.minute > 59 || value.second > 59) return false;
  const calendar = new Date(0);
  calendar.setUTCFullYear(value.year, value.month - 1, value.day);
  return calendar.getUTCFullYear() === value.year && calendar.getUTCMonth() === value.month - 1 && calendar.getUTCDate() === value.day;
}

function zonedDate(value: unknown): Date | undefined {
  if (typeof value !== "string") return undefined;
  const match = value.match(ZONED_DATETIME);
  if (!match || !validClock(parts(match)) || Number(match[10] ?? 0) > 23 || Number(match[11] ?? 0) > 59) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

const two = (value: number) => String(value).padStart(2, "0");

export function toLocalCustomFieldDateTime(value: unknown): string {
  const date = zonedDate(value);
  if (!date) return "";
  const fraction = date.getMilliseconds() ? `.${String(date.getMilliseconds()).padStart(3, "0")}` : "";
  return `${String(date.getFullYear()).padStart(4, "0")}-${two(date.getMonth() + 1)}-${two(date.getDate())}T${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}${fraction}`;
}

/** Undefined rejects invalid input; null is an intentional clear. */
export function fromLocalCustomFieldDateTime(value: string, original?: unknown): string | null | undefined {
  if (value === "") return null;
  const match = value.match(LOCAL_DATETIME);
  if (!match) return undefined;
  const clock = parts(match);
  if (!validClock(clock)) return undefined;
  const date = new Date(0);
  date.setFullYear(clock.year, clock.month - 1, clock.day);
  date.setHours(clock.hour, clock.minute, clock.second, clock.millisecond);
  // Native Date silently rolls impossible wall times forward, including DST gaps.
  if (date.getFullYear() !== clock.year || date.getMonth() !== clock.month - 1 || date.getDate() !== clock.day || date.getHours() !== clock.hour || date.getMinutes() !== clock.minute || date.getSeconds() !== clock.second || date.getMilliseconds() !== clock.millisecond) return undefined;
  const originalDate = zonedDate(original);
  if (originalDate && typeof original === "string") {
    const originalLocal = toLocalCustomFieldDateTime(originalDate.toISOString()).match(LOCAL_DATETIME);
    if (originalLocal && JSON.stringify(parts(originalLocal)) === JSON.stringify(clock)) return original;
  }
  return date.toISOString();
}
