"use client";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DegradedBanner,
  Field,
  Input,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TradeStatusBadge } from "../../documents/components/TradeStatusBadge";
import { tradeDocumentMessage } from "../../documents/trade-document-errors";
import type { SalesOrderConfirmationState } from "../hooks/useSalesOrderConfirmation";

export interface SalesOrderConfirmationPanelProps {
  state: SalesOrderConfirmationState;
  canConfirm: boolean;
  onCancelAttempt: () => void;
}

/**
 * Confirmation, which may finish in the request or continue past it.
 *
 * The in-flight affordance is the attempt's own status badge with its pending
 * dot — the server publishes no progress figure anywhere in the attempt record,
 * so a bar would be a number this page made up.
 */
export function SalesOrderConfirmationPanel({
  state,
  canConfirm,
  onCancelAttempt,
}: SalesOrderConfirmationPanelProps) {
  const { t } = useI18n();
  const { attempt } = state;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <CardTitle>{t.tradeDocuments.salesOrders.attemptTitle}</CardTitle>
        {canConfirm ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void state.confirm()}
            disabled={state.write.isWriting || state.isPolling}
            loading={state.write.isWriting}
          >
            {t.tradeDocuments.salesOrders.confirm}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {canConfirm ? (
          <Field
            label={t.tradeDocuments.salesOrders.requestedDeadline}
            hint={t.tradeDocuments.salesOrders.requestedDeadlineHint}
          >
            <Input
              type="datetime-local"
              value={state.requestedDeadline}
              onChange={(event) => state.setRequestedDeadline(event.target.value)}
            />
          </Field>
        ) : null}

        {attempt === null ? (
          <p className="text-xs text-muted-foreground">
            {t.tradeDocuments.salesOrders.attemptNone}
          </p>
        ) : (
          <div className="flex flex-col gap-2" aria-busy={state.isPolling || undefined}>
            <TradeStatusBadge kind="TradeConfirmationStatus" value={attempt.status} />
            <p className="text-xs text-muted-foreground">
              {t.tradeDocuments.salesOrders.attemptQueued}
            </p>
            {attempt.lastErrorCode ? (
              <p className="text-xs text-destructive">
                {tradeDocumentMessage(attempt.lastErrorCode, t.tradeDocuments.errors) ??
                  attempt.lastErrorCode}
              </p>
            ) : null}
            {/* The 202 body carries no attempt version, so a cancel has no
                `If-Match` to send until the first poll returns one. Offering
                the control before then would produce a guaranteed 400. */}
            {attempt.status === "PENDING" && attempt.version >= 1 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onCancelAttempt}
                disabled={state.write.isWriting}
              >
                {t.tradeDocuments.salesOrders.attemptCancel}
              </Button>
            ) : null}
          </div>
        )}

        {state.isPollExhausted ? (
          <DegradedBanner message={t.tradeDocuments.salesOrders.attemptStopped} />
        ) : null}

        {state.pollError ? (
          <DegradedBanner
            message={
              tradeDocumentMessage(state.pollError.code, t.tradeDocuments.errors) ??
              t.tradeDocuments.salesOrders.attemptStopped
            }
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
