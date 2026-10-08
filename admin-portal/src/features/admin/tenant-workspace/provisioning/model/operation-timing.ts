import { localeForLanguage } from "@/i18n/locale";
import type { TenantOperationStep } from "../types";

type Lang = "ar" | "en";
type DurationUnit = "day" | "hour" | "minute" | "second";

const DURATION_UNITS: ReadonlyArray<readonly [DurationUnit, number]> = [
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
  ["second", 1],
];

/**
 * A compact duration in the reader's language and numerals: the most
 * significant unit plus the next one when it is not zero — "4 hr 12 min",
 * "٤ س ١٢ د", "42 sec". Never negative.
 */
export function formatProvisioningDuration(
  totalSeconds: number,
  lang: Lang,
): string {
  const seconds = Number.isFinite(totalSeconds)
    ? Math.max(0, Math.floor(totalSeconds))
    : 0;
  const index = DURATION_UNITS.findIndex(([, size]) => seconds >= size);
  if (index === -1) return formatUnit(0, "second", lang);
  const [unit, size] = DURATION_UNITS[index];
  const major = Math.floor(seconds / size);
  const parts = [formatUnit(major, unit, lang)];
  const next = DURATION_UNITS[index + 1];
  if (next) {
    const minor = Math.floor((seconds - major * size) / next[1]);
    if (minor > 0) parts.push(formatUnit(minor, next[0], lang));
  }
  return parts.join(" ");
}

function formatUnit(value: number, unit: DurationUnit, lang: Lang): string {
  return new Intl.NumberFormat(localeForLanguage(lang), {
    style: "unit",
    unit,
    unitDisplay: "short",
  }).format(value);
}

/**
 * How long a step has taken: start to finish, or start to `nowMs` while it is
 * still running. `startedAt` is the first start, so a re-dispatched step keeps
 * counting from it. Null when the step never started or its end is unknown.
 */
export function stepElapsedSeconds(
  step: Pick<TenantOperationStep, "status" | "startedAt" | "finishedAt">,
  nowMs: number | null,
): number | null {
  if (!step.startedAt) return null;
  const startedMs = Date.parse(step.startedAt);
  const endMs = step.finishedAt
    ? Date.parse(step.finishedAt)
    : step.status === "RUNNING"
      ? nowMs
      : null;
  if (endMs === null || !Number.isFinite(startedMs) || !Number.isFinite(endMs)) {
    return null;
  }
  return Math.max(0, Math.floor((endMs - startedMs) / 1_000));
}
