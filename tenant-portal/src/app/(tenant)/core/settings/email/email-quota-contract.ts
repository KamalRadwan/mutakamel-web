import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Language } from "@/i18n/useLanguage";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type {
  EmailConfig,
  EmailConfigFormValues,
  PatchEmailConfigRequest,
} from "./email-config-contract";

/** `PatchTenantEmailConfigDto` & `tenant-email-config.policy.ts` quota bounds. */
export const DAILY_QUOTA_MAX = 1_000_000;
export const RATE_LIMIT_PER_MIN_MAX = 10_000;
export const QUOTA_EXCEEDS_PLAN_CODE = "TENANT_EMAIL_CONFIG_QUOTA_EXCEEDS_PLAN";

const WHOLE_NUMBER_DIGITS = /^\d+$/u;

type ParsedQuotaOverride =
  | { kind: "inherit" }
  | { kind: "number"; value: number }
  | { kind: "invalid" };

/**
 * Blank input represents `null` (inherit the workspace plan limit dynamically).
 * An explicit integer equal to the current plan cap remains `{ kind: "number" }`
 * because pinning a static override has distinct semantics when plan limits change.
 */
function parseQuotaDraftValue(raw: string): ParsedQuotaOverride {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { kind: "inherit" };
  if (!WHOLE_NUMBER_DIGITS.test(trimmed)) return { kind: "invalid" };
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return { kind: "invalid" };
  return { kind: "number", value: parsed };
}

export function savedQuotaToDraftString(value: number | null): string {
  return value === null ? "" : String(value);
}

function isQuotaFieldDirty(saved: number | null, raw: string): boolean {
  const parsed = parseQuotaDraftValue(raw);
  if (parsed.kind === "invalid") return true;
  if (parsed.kind === "inherit") return saved !== null;
  return saved !== parsed.value;
}

export function hasEmailQuotaChanges(
  current: EmailConfig,
  values: Pick<EmailConfigFormValues, "dailyQuota" | "rateLimitPerMin">,
): boolean {
  return (
    isQuotaFieldDirty(current.dailyQuota, values.dailyQuota) ||
    isQuotaFieldDirty(current.rateLimitPerMin, values.rateLimitPerMin)
  );
}

export function validateQuotaField(
  raw: string,
  planCap: number,
  hardMax: number,
  t: Dictionary,
): string | undefined {
  const parsed = parseQuotaDraftValue(raw);
  if (parsed.kind === "inherit") return undefined;
  const formatMax = (value: number) =>
    new Intl.NumberFormat(t.emailSuppression.numberLocale).format(value);
  const allowedMax = Math.min(planCap, hardMax);
  if (parsed.kind === "invalid" || parsed.value > hardMax) {
    return formatTemplate(t.coreSettings.emailFormLimitWholeNumber, {
      max: formatMax(allowedMax),
    });
  }
  if (parsed.value > planCap) {
    return formatTemplate(t.coreSettings.emailFormLimitExceedsPlan, {
      max: formatMax(planCap),
    });
  }
  return undefined;
}

export function applyEmailQuotaPatch(
  request: PatchEmailConfigRequest,
  current: EmailConfig,
  values: Pick<EmailConfigFormValues, "dailyQuota" | "rateLimitPerMin">,
): void {
  const dailyParsed = parseQuotaDraftValue(values.dailyQuota);
  if (
    dailyParsed.kind === "invalid" ||
    (dailyParsed.kind === "number" && dailyParsed.value > DAILY_QUOTA_MAX)
  ) {
    throw new Error("EMAIL_FORM_DAILY_QUOTA");
  }
  if (dailyParsed.kind === "number" && dailyParsed.value > current.planDailyQuota) {
    throw new Error("EMAIL_FORM_DAILY_QUOTA_EXCEEDS_PLAN");
  }
  const nextDaily = dailyParsed.kind === "inherit" ? null : dailyParsed.value;
  if (nextDaily !== current.dailyQuota) {
    request.dailyQuota = nextDaily;
  }

  const perMinParsed = parseQuotaDraftValue(values.rateLimitPerMin);
  if (
    perMinParsed.kind === "invalid" ||
    (perMinParsed.kind === "number" && perMinParsed.value > RATE_LIMIT_PER_MIN_MAX)
  ) {
    throw new Error("EMAIL_FORM_RATE_LIMIT");
  }
  if (perMinParsed.kind === "number" && perMinParsed.value > current.planRateLimitPerMin) {
    throw new Error("EMAIL_FORM_RATE_LIMIT_EXCEEDS_PLAN");
  }
  const nextPerMin = perMinParsed.kind === "inherit" ? null : perMinParsed.value;
  if (nextPerMin !== current.rateLimitPerMin) {
    request.rateLimitPerMin = nextPerMin;
  }
}

export function formatConflictQuotaValue(
  draftValue: string,
  planCap: number,
  t: Dictionary,
  lang: Language,
): string {
  const parsed = parseQuotaDraftValue(draftValue);
  if (parsed.kind === "inherit") {
    return formatTemplate(t.coreSettings.emailLimitPlanDefaultValue, {
      max: formatNumber(planCap, lang),
    });
  }
  if (parsed.kind === "number") {
    return formatNumber(parsed.value, lang);
  }
  return draftValue.trim();
}
