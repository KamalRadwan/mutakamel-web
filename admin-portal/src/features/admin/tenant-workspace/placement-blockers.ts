import type { Language } from "@/i18n/I18nContext";

/**
 * Why a tenant cannot start a placement move right now.
 *
 * Both preflights — `GET /tenants/:tenantId/database-relocation-preflight` and
 * `GET /tenants/:tenantId/storage-migration-preflight` — return this same
 * closed union from one Core service, so the two wizards share one vocabulary
 * and one set of explanations instead of drifting apart.
 *
 * Core reports blockers rather than throwing: an operator opening the page on
 * a tenant that is mid-move must see *why* the button is disabled, not a 409
 * with no context. The screens therefore render every blocker and keep the
 * rest of the page mounted.
 */
export type TenantPlacementBlockerCode =
  | "TENANT_NOT_RELOCATABLE"
  | "RELOCATION_IN_PROGRESS"
  | "PLACEMENT_CUTOVER_IN_PROGRESS"
  | "MAINTENANCE_FENCE_OPEN"
  | "STORAGE_MIGRATION_IN_PROGRESS";

export interface TenantPlacementBlockerExplanation {
  code: string;
  title: string;
  explanation: string;
}

const BLOCKER_COPY: Record<
  TenantPlacementBlockerCode,
  Record<Language, { title: string; explanation: string }>
> = {
  TENANT_NOT_RELOCATABLE: {
    en: {
      title: "Tenant status does not allow a move",
      explanation:
        "Only an ACTIVE or SUSPENDED tenant can be moved. Finish provisioning, or restore the tenant, before starting a move.",
    },
    ar: {
      title: "حالة المستأجر لا تسمح بالنقل",
      explanation:
        "يمكن نقل المستأجر فقط عندما تكون حالته ACTIVE أو SUSPENDED. أكمل التجهيز أو استعد المستأجر قبل بدء النقل.",
    },
  },
  RELOCATION_IN_PROGRESS: {
    en: {
      title: "A database relocation is already running",
      explanation:
        "This tenant already holds an open relocation claim. Wait for it to finish, or open its progress below, before starting another move.",
    },
    ar: {
      title: "يوجد نقل لقاعدة البيانات قيد التنفيذ",
      explanation:
        "يحتفظ هذا المستأجر بمطالبة نقل مفتوحة بالفعل. انتظر انتهاءها أو افتح تقدمها بالأسفل قبل بدء نقل آخر.",
    },
  },
  PLACEMENT_CUTOVER_IN_PROGRESS: {
    en: {
      title: "A placement cutover is in progress",
      explanation:
        "The tenant's database placement is mid-cutover. Moving now would race the fence that protects the switch, so the command is refused until the cutover settles.",
    },
    ar: {
      title: "يوجد تحويل توزيع قيد التنفيذ",
      explanation:
        "توزيع قاعدة بيانات المستأجر في منتصف عملية التحويل. النقل الآن يتعارض مع السياج الذي يحمي التبديل، لذلك يُرفض الأمر حتى تستقر عملية التحويل.",
    },
  },
  MAINTENANCE_FENCE_OPEN: {
    en: {
      title: "A maintenance fence is open",
      explanation:
        "Provisioning holds an unreleased maintenance fence on this tenant. Release the fence before moving it, so the two operations cannot write to the same tenant at once.",
    },
    ar: {
      title: "يوجد سياج صيانة مفتوح",
      explanation:
        "يحتفظ التجهيز بسياج صيانة غير محرَّر على هذا المستأجر. حرِّر السياج قبل النقل حتى لا تكتب العمليتان على المستأجر نفسه في وقت واحد.",
    },
  },
  STORAGE_MIGRATION_IN_PROGRESS: {
    en: {
      title: "A storage migration is already running",
      explanation:
        "An open storage migration exists for this tenant. Let it reach COMPLETED or ROLLED_BACK before starting any placement move.",
    },
    ar: {
      title: "يوجد ترحيل تخزين قيد التنفيذ",
      explanation:
        "يوجد ترحيل تخزين مفتوح لهذا المستأجر. اتركه يصل إلى COMPLETED أو ROLLED_BACK قبل بدء أي نقل للتوزيع.",
    },
  },
};

/**
 * Turns a wire blocker code into operator-readable text.
 *
 * An unrecognized code still renders — Core owns this union and may add to it,
 * and silently dropping a blocker would present a disabled submit with no
 * stated reason, which is worse than showing the raw code.
 */
export function describeTenantPlacementBlocker(
  code: string,
  lang: Language,
): TenantPlacementBlockerExplanation {
  const known = BLOCKER_COPY[code as TenantPlacementBlockerCode];
  if (!known) {
    return {
      code,
      title:
        lang === "ar"
          ? "مانع غير معروف يمنع النقل"
          : "An unrecognized blocker refuses this move",
      explanation:
        lang === "ar"
          ? "أبلغت الخدمة عن مانع لا تعرفه هذه الشاشة. لا يمكن بدء النقل حتى يزول."
          : "The service reported a blocker this screen does not recognize. The move cannot start until it clears.",
    };
  }
  return { code, ...known[lang] };
}
