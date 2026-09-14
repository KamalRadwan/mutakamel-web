import { Calculator } from "lucide-react";
import { Button } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { InitialCommercialQuote } from "@/features/admin/subscriptions/initial-commercial/InitialCommercialQuote";
import { initialCommercialCopy } from "@/features/admin/subscriptions/initial-commercial/initial-commercial-copy";
import type { useTenantCreationQuote } from "../hooks/useTenantCreationQuote";

export function TenantCreationQuote({ state, locked }: { state: ReturnType<typeof useTenantCreationQuote>; locked: boolean }) {
  const { loading, load, error, errorRef, quote, expired } = state;
  const { lang } = useI18n(); const copy = initialCommercialCopy(lang);
  return <section aria-busy={loading} className="space-y-2">
    <Button type="button" variant="outline" size="sm" disabled={locked || loading} loading={loading} onClick={() => void load()}>
      {!loading && <Calculator className="size-3.5" aria-hidden="true" />}
      {copy.quote}
    </Button>
    {error && <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-md border border-destructive bg-destructive-subtle p-2.5 text-xs text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <p>{error.message}</p><p className="break-all font-mono text-xs" dir="ltr">{error.errorCode} {error.correlationId}</p>
    </div>}
    {quote && <InitialCommercialQuote quote={quote} expired={expired} copy={copy} />}
  </section>;
}
