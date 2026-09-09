import { Button } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { InitialCommercialQuote } from "@/features/admin/subscriptions/initial-commercial/InitialCommercialQuote";
import { initialCommercialCopy } from "@/features/admin/subscriptions/initial-commercial/initial-commercial-copy";
import type { useTenantCreationQuote } from "../hooks/useTenantCreationQuote";

export function TenantCreationQuote({ state, locked }: { state: ReturnType<typeof useTenantCreationQuote>; locked: boolean }) {
  const { loading, load, error, errorRef, quote, expired } = state;
  const { lang } = useI18n(); const copy = initialCommercialCopy(lang);
  return <section aria-busy={loading} className="space-y-3">
    <p className="text-sm text-muted-foreground">{lang === "ar" ? "راجع تسعيرة الخادم قبل تأكيد الإنشاء. أي تعديل للطلب أو انتهاء الصلاحية يتطلب تسعيرة جديدة." : "Review the server quote before confirming creation. Changes to the request or expiry require a fresh quote."}</p>
    <Button type="button" variant="outline" disabled={locked || loading} loading={loading} onClick={() => void load()}>{copy.quote}</Button>
    {error && <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-md border border-destructive bg-destructive-subtle p-3 text-sm text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <p>{error.message}</p><p className="break-all font-mono text-xs" dir="ltr">{error.errorCode} {error.correlationId}</p>
    </div>}
    {quote && <InitialCommercialQuote quote={quote} expired={expired} copy={copy} />}
  </section>;
}
