"use client";

import { Badge } from "@/design-system";
import type {
  ControlPlaneAuditCodeQuality,
  ControlPlaneAuditFaultDomain,
} from "../types/control-plane-audit";

/**
 * What a failure row means, at a glance.
 *
 * A log of 3,980 failures where every row looks alike is a log nobody reads:
 * scanning it, an operator cannot tell an expired session from a crash
 * without opening each entry. Exactly one domain — APPLICATION — means the
 * platform is at fault, so only that one is styled as a problem. CLIENT and
 * CAPACITY are deliberately positive: a refused invalid request and a fired
 * rate limit are the platform working, and colouring them like faults is
 * what taught operators to ignore these screens.
 */
type BadgeTone = "success" | "warn" | "danger" | "info" | "neutral";

const DOMAIN_TONES: Record<ControlPlaneAuditFaultDomain, BadgeTone> = {
  APPLICATION: "danger",
  DEPENDENCY: "warn",
  CAPACITY: "success",
  CLIENT: "success",
  INDETERMINATE: "info",
  UNCLASSIFIED: "neutral",
};

const DOMAIN_COPY: Record<
  ControlPlaneAuditFaultDomain,
  { ar: string; en: string; hintAr: string; hintEn: string }
> = {
  APPLICATION: {
    ar: "عطل في المنصة",
    en: "Platform Defect",
    hintAr: "كود المنصة نفسه رمى الخطأ — ده اللي محتاج إصلاح",
    hintEn: "The platform's own code threw. This is what needs fixing.",
  },
  DEPENDENCY: {
    ar: "خدمة خارجية",
    en: "Dependency",
    hintAr: "خدمة بننادي عليها وقعت: تطبيق تاني، SMTP، تخزين، قاعدة بيانات",
    hintEn: "Something we call failed: another app, SMTP, storage, a database.",
  },
  CAPACITY: {
    ar: "حماية السعة",
    en: "Capacity Guard",
    hintAr: "رفض مقصود لحماية المنصة — حد معدل أو قاطع دائرة",
    hintEn: "Shed on purpose to protect the platform: a rate limit or breaker.",
  },
  CLIENT: {
    ar: "رفض صحيح",
    en: "Correctly Refused",
    hintAr: "الطلب كان غير صالح أو غير مصرّح — المنصة رفضته صح",
    hintEn: "The request was invalid or unauthorised. The platform said no.",
  },
  INDETERMINATE: {
    ar: "نتيجة غير مؤكدة",
    en: "Outcome Unknown",
    hintAr: "إعادة تشغيل أو العميل قفل الاتصال — النتيجة محتاجة مطابقة",
    hintEn: "A restart or a client disconnect. The outcome needs reconciling.",
  },
  UNCLASSIFIED: {
    ar: "بانتظار التصنيف",
    en: "Needs Triage",
    hintAr: "كود سبب لسه مش معروف للتصنيف — مش اتهام للكود",
    hintEn: "A reason code the taxonomy does not know yet. Not an accusation.",
  },
};

export function FaultDomainBadge({
  domain,
  lang,
}: {
  domain: ControlPlaneAuditFaultDomain;
  lang: "ar" | "en";
}) {
  const copy = DOMAIN_COPY[domain];
  return (
    <Badge tone={DOMAIN_TONES[domain]} title={lang === "ar" ? copy.hintAr : copy.hintEn}>
      {lang === "ar" ? copy.ar : copy.en}
    </Badge>
  );
}

const QUALITY_COPY: Record<
  ControlPlaneAuditCodeQuality,
  { ar: string; en: string }
> = {
  DESIGNED: { ar: "كود خطأ مقصود", en: "Typed error" },
  GENERIC: { ar: "كود عام", en: "Generic code" },
  LEAKED: { ar: "خطأ غير مُغلَّف", en: "Untyped throw" },
};

/**
 * Shown only for an untyped throw. A row carrying a typed code needs no
 * remark; a row carrying none is the one an operator can do nothing with
 * after the fact, and that is worth saying on the row itself.
 */
export function CodeQualityBadge({
  quality,
  lang,
}: {
  quality: ControlPlaneAuditCodeQuality;
  lang: "ar" | "en";
}) {
  if (quality !== "LEAKED") return null;
  return (
    <Badge
      tone="danger"
      title={
        lang === "ar"
          ? "خرج من غير كود خطأ ولا status، فمفيش حاجة تتشخّص بيها بعدين"
          : "Thrown with no error code and no status, so nothing was recorded to diagnose it."
      }
    >
      {lang === "ar" ? QUALITY_COPY.LEAKED.ar : QUALITY_COPY.LEAKED.en}
    </Badge>
  );
}
