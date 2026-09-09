import { Badge, Card } from "@/design-system";
import type { AcceptedPricing, SubscriptionCommercial } from "../model/subscription-commercial";

export function SubscriptionCommercialEvidence({ value, lang }: { value: SubscriptionCommercial; lang: string }) {
  const copy = lang === "ar" ? {
    title: "الأسعار المقبولة وإضافات الاشتراك", base: "إجمالي التطبيقات الأساسية", addons: "إجمالي الإضافات", combined: "الإجمالي الدوري", allowance: "مقاعد التطبيقات الأساسية فقط",
    revision: "مراجعة الاشتراك", complete: "دليل السعر المقبول مكتمل", unavailable: "تفاصيل السعر التاريخي غير متاحة", seats: "المقاعد المقبولة", definition: "إصدار التعريف المقبول",
    notEvaluated: "لم يتم تقييم صلاحية الاستخدام التشغيلي؛ حالة الاشتراك وحدها لا تثبت التفعيل أو تعيين المستخدم.", pending: "تعديل خطة هذا الاشتراك يحتاج مسار الأوامر التجارية الجديد. إلغاء الاشتراك بالكامل يظل متاحًا عند امتلاك الصلاحيات اللازمة وسماح الحالة الحالية.",
    breakdown: "شرائح السعر المسجلة", from: "من", through: "حتى", charged: "مستخدمون محتسبون", unit: "دولار / مستخدم", amount: "المبلغ بالدولار", open: "بلا حد أعلى",
  } : {
    title: "Accepted prices and subscription addons", base: "Base applications total", addons: "Addons total", combined: "Combined recurring total", allowance: "Base application seats only",
    revision: "Subscription revision", complete: "Complete accepted-price evidence", unavailable: "Historical pricing detail unavailable", seats: "Accepted seats", definition: "Accepted definition version",
    notEvaluated: "Operational use has not been evaluated. Subscription state alone does not prove activation or user assignment.", pending: "Plan changes for this subscription require the new commercial command flow. Whole-subscription cancellation remains available with the required permissions and an eligible current state.",
    breakdown: "Recorded applied brackets", from: "From", through: "Through", charged: "Charged users", unit: "USD / user", amount: "Amount USD", open: "No upper limit",
  };
  const selections = [...value.baseItems.map(item => ({ id: item.id, label: item.applicationName ?? item.applicationKey, seats: item.seats, pricing: item.acceptedPricing, definition: null as string | null })),
    ...value.addonSelections.map(item => ({ id: item.id, label: `${value.baseItems.find(parent => parent.id === item.parentItemId)!.applicationKey} / ${item.addonKey}`,
      seats: item.seats, pricing: item.acceptedPricing, definition: item.definitionVersionId }))];
  return <Card className="space-y-4 p-5"><div><h3 className="font-semibold">{copy.title}</h3><p className="mt-1 text-xs text-muted-foreground">{copy.revision}: <bdi className="font-mono">{value.subscriptionRevision}</bdi></p></div>
    <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
      [copy.base, `USD ${value.totals.baseRecurringUsd}`], [copy.addons, `USD ${value.totals.addonRecurringUsd}`], [copy.combined, `USD ${value.totals.combinedRecurringUsd}`], [copy.allowance, String(value.baseAllowance.effectiveAllowedUsers)],
    ].map(([label, amount]) => <div key={label} className="rounded-md border border-border p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-mono text-sm"><bdi>{amount}</bdi></dd></div>)}</dl>
    <p className="text-sm text-muted-foreground">{copy.notEvaluated}</p>
    <ul className="divide-y divide-border rounded-md border border-border">{selections.map(item => <li key={item.id} className="space-y-2 p-3">
      <div className="flex flex-wrap justify-between gap-3"><div><p className="text-sm font-medium"><bdi>{item.label}</bdi></p><p className="text-xs text-muted-foreground">{copy.seats}: <bdi>{item.seats}</bdi></p></div>
        <p className="font-mono text-sm"><bdi>USD {item.pricing.recurringAmountUsd}</bdi></p></div>
      <Badge tone="info">{copy.complete}</Badge>
      {item.definition && <p className="break-all text-xs text-muted-foreground">{copy.definition}: <bdi className="font-mono">{item.definition}</bdi></p>}
      <PricingBreakdown pricing={item.pricing} copy={copy} />
    </li>)}</ul>
  </Card>;
}
function PricingBreakdown({ pricing, copy }: { pricing: AcceptedPricing; copy: { breakdown: string; from: string; through: string; charged: string; unit: string; amount: string; open: string } }) {
  return <details className="text-xs"><summary className="cursor-pointer rounded-sm py-2 font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">{copy.breakdown}</summary>
    <div className="overflow-x-auto"><table className="w-full text-start"><thead><tr>{[copy.from, copy.through, copy.charged, copy.unit, copy.amount].map(label => <th key={label} className="px-2 py-2 text-start font-medium">{label}</th>)}</tr></thead>
      <tbody>{pricing.breakdown!.map(row => <tr key={row.minUsers} className="border-t border-border">{[String(row.minUsers), row.maxUsers === null ? copy.open : String(row.maxUsers), String(row.chargedUsers), row.unitPriceUsd, row.amountUsd].map((value, index) =>
        <td key={index} className="px-2 py-2 font-mono"><bdi>{value}</bdi></td>)}</tr>)}</tbody></table></div>
  </details>;
}
