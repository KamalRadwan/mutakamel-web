"use client";
import { useI18n } from "@/i18n/I18nContext";
import { initialCommercialCopy } from "./initial-commercial-copy";
import type { InitialCreateOptions } from "./initial-create-options";

/** Pure reference supplied with a verified, current, authorized options value.
 * Display diagnostics never establish price or installation authority. */
export function InitialOptionsReference({ value }: { value: InitialCreateOptions }) {
  const { lang, dir } = useI18n(); const copy = initialCommercialCopy(lang);
  const reference = lang === "ar" ? {
    title: "مرجع التطبيقات والإضافات المنشورة",
    boundary: "للعرض فقط. هذه اللوحة لا تحدد إضافات ولا تغير طلب إنشاء المستأجر الحالي أو قرارات السماح فيه.",
    compatible: "الباقات المتوافقة المنشورة", none: "لا توجد إضافات في الاختيارات المعادة لهذا التطبيق.", revision: "مراجعة التعريف التقني",
  } : {
    title: "Published application and addon reference",
    boundary: "Display only. This panel cannot select addons or change the current tenant-creation request or its selection permissions.",
    compatible: "Published compatible tiers", none: "No addons were returned for this application.", revision: "Technical definition revision",
  };
  return <section dir={dir} aria-label={reference.title} className="min-w-0 space-y-3 rounded-lg border border-border bg-card p-4">
    <h2 className="text-sm font-semibold">{reference.title}</h2>
    <p className="text-sm text-muted-foreground">{reference.boundary}</p>
    <p className="text-xs text-muted-foreground">{copy.optionsBoundary}</p>
    {value.applications.length === 0 && <p role="status" className="text-sm">{copy.optionsEmpty}</p>}
    {value.applications.map(application => <details key={application.applicationId} className="min-w-0 rounded-md border border-border p-3">
      <summary className="cursor-pointer break-words rounded-sm py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">{application.name}</summary>
      <div className="space-y-3 pt-2">
        {application.description !== null && <p className="break-words text-xs text-muted-foreground">{application.description}</p>}
        <p className="break-all font-mono text-xs" dir="ltr">{application.key} · {application.applicationId}</p>
        <p className="text-xs">{reference.revision}: <bdi>{application.technicalDefinitionRevision}</bdi></p>
        <dl className="space-y-2 text-xs"><div><dt>{copy.tier}</dt><dd>{application.tiers.map(tier => <p key={tier.id} className="break-words">{tier.name} <bdi className="font-mono">({tier.id})</bdi></p>)}</dd></div></dl>
        <ReferenceDiagnostics values={[...application.selectionBlockers, ...application.readinessReasons, ...application.catalogueReasons]} label={copy.blocked} />
        {!application.addons.length && <p className="text-xs text-muted-foreground">{reference.none}</p>}
        {application.addons.map(addon => <section key={addon.addonId} className="min-w-0 space-y-2 border-s-2 border-border ps-3">
          <h3 className="break-words text-sm font-medium">{addon.name}</h3>
          {addon.description !== null && <p className="break-words text-xs text-muted-foreground">{addon.description}</p>}
          <p className="break-all font-mono text-xs" dir="ltr">{addon.key} · {addon.addonId}</p>
          <p className="break-all text-xs">{copy.definition}: <bdi className="font-mono">{addon.definitionVersionId}</bdi></p>
          <dl className="text-xs"><dt>{reference.compatible}</dt><dd>{application.tiers.filter(tier => addon.compatibleTierIds.includes(tier.id)).map(tier =>
            <p key={tier.id} className="break-words">{tier.name} <bdi className="font-mono">({tier.id})</bdi></p>)}</dd></dl>
          <ReferenceDiagnostics values={addon.catalogueReasons} label={copy.blocked} />
        </section>)}
      </div>
    </details>)}
  </section>;
}
function ReferenceDiagnostics({ values, label }: { values: readonly string[]; label: string }) {
  if (!values.length) return null;
  return <div className="text-xs text-warning-subtle-foreground"><p>{label}</p><ul className="list-disc space-y-1 ps-5">{values.map(value =>
    <li key={value} className="break-all font-mono"><bdi>{value}</bdi></li>)}</ul></div>;
}
