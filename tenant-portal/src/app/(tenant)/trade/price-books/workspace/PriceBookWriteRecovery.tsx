import { CircleAlert, RefreshCw } from "lucide-react";
import { Button, IdentifierText } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { AmbiguousMutationState } from "./idempotent-mutation";
import { usePriceBookWriteRecovery } from "./usePriceBookWriteRecovery";

export function PriceBookWriteRecovery({ command, pending, onResolved }: { command: AmbiguousMutationState; pending: boolean; onResolved?: () => void }) {
  const { t } = useI18n();
  const retry = usePriceBookWriteRecovery(command, onResolved);
  return (
    <section role="status" className="flex flex-col gap-2.5 rounded-lg border border-warning/30 bg-warning-subtle p-3 text-xs text-warning-subtle-foreground">
      <div className="flex items-start gap-2">
        <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
        <div>
          <h2 className="font-semibold">{t.tradePricing.ambiguousTitle}</h2>
          <p className="mt-1">{t.tradePricing.ambiguousUnknownDescription}</p>
          <p className="mt-1 font-medium">{command.operation}</p>
        </div>
      </div>
      <details className="text-caption">
        <summary className="cursor-pointer">{t.tradePricing.ambiguousIdempotencyKeyLabel}</summary>
        <IdentifierText className="mt-1 block select-all">{command.idempotencyKey}</IdentifierText>
        {command.correlationId ? <IdentifierText className="mt-1 block select-all">{command.correlationId}</IdentifierText> : null}
      </details>
      <div>
        <Button size="sm" variant="outline" onClick={retry} loading={pending}>
          <RefreshCw className="me-1.5 size-3.5" aria-hidden="true" />
          {t.tradePricing.ambiguousRetrySameKeyAction}
        </Button>
      </div>
    </section>
  );
}
