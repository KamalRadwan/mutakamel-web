import type { Language } from "@/i18n/I18nContext";
import type { OperationTimelineStep } from "@/design-system";
import {
  isStorageMigrationAwaitingSourceRelease,
  type TenantStorageMigrationStatus,
  type TenantStorageMigrationView,
} from "../../storage/types";
import {
  STORAGE_MIGRATION_PROGRESS_STATUSES,
  type StorageMigrationProgressStatus,
} from "../types";

const STATUS_LABELS: Record<
  StorageMigrationProgressStatus,
  Record<Language, string>
> = {
  ACCEPTED: { en: "Accepted", ar: "مقبول" },
  COPYING: { en: "Copying", ar: "جارٍ النسخ" },
  COPIED: { en: "Copy verified", ar: "تم التحقق من النسخ" },
  PLACEMENT_COMMITTED: { en: "Placement committed", ar: "تم اعتماد التوزيع" },
  COMPLETED: { en: "Completed", ar: "مكتمل" },
};

const STATUS_DESCRIPTIONS: Record<
  StorageMigrationProgressStatus,
  Record<Language, string>
> = {
  ACCEPTED: {
    en: "The fence is taken and the target bytes are reserved.",
    ar: "تم أخذ السياج وحجز البايتات على الوجهة.",
  },
  COPYING: {
    en: "The tenant namespace is being copied to the destination.",
    ar: "يجري نسخ مساحة أسماء المستأجر إلى الوجهة.",
  },
  COPIED: {
    en: "The copy is complete and its namespace digest matched.",
    ar: "اكتمل النسخ وتطابقت بصمة مساحة الأسماء.",
  },
  PLACEMENT_COMMITTED: {
    en: "One placement authority now points at the destination.",
    ar: "أصبح مرجع التوزيع الوحيد يشير إلى الوجهة.",
  },
  COMPLETED: {
    en: "The source namespace is removed and the fence is lifted.",
    ar: "تمت إزالة مساحة الأسماء المصدر ورُفع السياج.",
  },
};

const ROLLBACK_COPY: Record<
  "ROLLING_BACK" | "ROLLED_BACK",
  Record<Language, { label: string; detail: string }>
> = {
  ROLLING_BACK: {
    en: {
      label: "Rolling back",
      detail:
        "The migration is unwinding. Placement stays on the source Storage Server; the reserved destination bytes are being released.",
    },
    ar: {
      label: "جارٍ التراجع",
      detail:
        "يجري التراجع عن الترحيل. يبقى التوزيع على خادم التخزين المصدر، ويجري تحرير البايتات المحجوزة على الوجهة.",
    },
  },
  ROLLED_BACK: {
    en: {
      label: "Rolled back",
      detail:
        "The migration was abandoned. The tenant still runs on its original Storage Server and nothing was committed.",
    },
    ar: {
      label: "تم التراجع",
      detail:
        "تم التخلي عن الترحيل. لا يزال المستأجر يعمل على خادم التخزين الأصلي ولم يُعتمد أي تغيير.",
    },
  },
};

export function isStorageMigrationRollback(
  status: TenantStorageMigrationStatus,
): status is "ROLLING_BACK" | "ROLLED_BACK" {
  return status === "ROLLING_BACK" || status === "ROLLED_BACK";
}

/**
 * Maps a migration's single status onto the documented progress ladder.
 *
 * Core reports one status rather than a step ledger, so everything before the
 * current status is complete, the current status is what is happening now, and
 * everything after is pending. `COMPLETED` is terminal, so it renders as done
 * rather than as the step still in flight.
 */
export function storageMigrationTimelineSteps(
  migration: TenantStorageMigrationView,
  lang: Language,
): OperationTimelineStep[] {
  if (isStorageMigrationRollback(migration.status)) {
    const copy = ROLLBACK_COPY[migration.status][lang];
    return [
      {
        label: copy.label,
        detail: migration.failureCode
          ? `${copy.detail} (${migration.failureCode})`
          : copy.detail,
        state: migration.status === "ROLLED_BACK" ? "failed" : "warning",
      },
    ];
  }

  const currentIndex = STORAGE_MIGRATION_PROGRESS_STATUSES.indexOf(
    migration.status as StorageMigrationProgressStatus,
  );
  // A migration holding its source is resting, not running: the tenant has
  // moved and nothing advances without an operator. Its committed step reads
  // as done, and the final step states what it is waiting for instead of
  // spinning forever on a status that will never arrive on its own.
  const awaitingRelease = isStorageMigrationAwaitingSourceRelease(migration);

  return STORAGE_MIGRATION_PROGRESS_STATUSES.map((status, index) => ({
    label: STATUS_LABELS[status][lang],
    detail:
      awaitingRelease && status === "COMPLETED"
        ? AWAITING_RELEASE_DETAIL[lang]
        : STATUS_DESCRIPTIONS[status][lang],
    state:
      currentIndex < 0
        ? "pending"
        : index < currentIndex ||
            migration.status === "COMPLETED" ||
            (awaitingRelease && index === currentIndex)
          ? "done"
          : index === currentIndex
            ? "active"
            : "pending",
  }));
}

const AWAITING_RELEASE_DETAIL: Record<Language, string> = {
  en: "Waiting for you to confirm removing the old copy. The move itself is finished and the tenant is unaffected.",
  ar: "بانتظار تأكيدك حذف النسخة القديمة. اكتمل النقل نفسه ولا تأثير على المستأجر.",
};

/**
 * Locale-explicit formatting so the same bytes render the same way on every
 * machine. The value stays a string end to end — byte quotas are never parsed
 * into a float for arithmetic, only divided for display.
 */
export function formatStorageBytes(
  value: string | null | undefined,
  lang: Language,
): string {
  const fallback = lang === "ar" ? "غير محدد" : "Not set";
  if (value === null || value === undefined || value === "") return fallback;
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return fallback;
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let amount = bytes;
  let unitIndex = 0;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }
  const digits = amount >= 10 || unitIndex === 0 ? 0 : 1;
  const formatted = new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
  return `${formatted} ${units[unitIndex]}`;
}

export function formatStorageInstant(
  value: string | null | undefined,
  lang: Language,
): string {
  const fallback = lang === "ar" ? "غير متاح" : "Not available";
  if (!value) return fallback;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return fallback;
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(parsed));
}

/**
 * Bytes still unreserved on a destination, as a string.
 *
 * `BigInt` rather than `Number`: these are byte quotas that can exceed
 * `Number.MAX_SAFE_INTEGER`, and the whole contract keeps them as strings for
 * exactly that reason. A server with no declared ceiling returns `null`.
 */
export function remainingStorageBytes(target: {
  maxBytes: string | null;
  reservedBytes: string;
}): string | null {
  if (target.maxBytes === null) return null;
  try {
    // `BigInt(0)` rather than the `0n` literal: the portal targets ES2017, so
    // BigInt literals are a syntax error even though the global exists.
    const zero = BigInt(0);
    const remaining = BigInt(target.maxBytes) - BigInt(target.reservedBytes);
    return remaining > zero ? remaining.toString() : "0";
  } catch {
    return null;
  }
}
