import type { Language } from "@/i18n/useLanguage";
import { INTL_LOCALE } from "@/lib/format/locale";

const MINUTE_MS = 60_000;

/**
 * How long a lead has sat in its current stage, as "3d" / "3 يوم" — the board
 * card, the card grid and their expanded views all show the same badge.
 * `stageEnteredAt` is the clock (it resets only on a stage move); a row
 * without one, or with an unreadable timestamp, has no age to show.
 */
export function formatLeadStageAge(since: string | undefined, now: number, lang: Language): string | null {
  if (!since) return null;
  const time = Date.parse(since);
  if (Number.isNaN(time)) return null;
  const minutes = Math.max(1, Math.floor((now - time) / MINUTE_MS));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const [value, unit]: [number, "day" | "hour" | "minute"] =
    days > 0 ? [days, "day"] : hours > 0 ? [hours, "hour"] : [minutes, "minute"];
  return new Intl.NumberFormat(INTL_LOCALE[lang], { style: "unit", unit, unitDisplay: "narrow" }).format(value);
}
