"use client";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { SalesOrderConfirmationState } from "../hooks/useSalesOrderConfirmation";

export interface SalesOrderConfirmationPanelProps {
  state: SalesOrderConfirmationState;
  canConfirm: boolean;
}

export function SalesOrderConfirmationPanel({
  state,
  canConfirm,
}: SalesOrderConfirmationPanelProps) {
  const { t } = useI18n();
  if (!canConfirm) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <CardTitle>{t.tradeDocuments.salesOrders.confirm}</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void state.confirm()}
          disabled={state.write.isBlocked}
          loading={state.write.isWriting}
        >
          {t.tradeDocuments.salesOrders.confirm}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Field
          label={t.tradeDocuments.salesOrders.requestedDeadline}
          hint={t.tradeDocuments.salesOrders.requestedDeadlineHint}
        >
          <Input size="sm" placeholder={t.tradeDocuments.salesOrders.requestedDeadline}
            type="datetime-local"
            value={state.requestedDeadline}
            onChange={(event) => state.setRequestedDeadline(event.target.value)}
          />
        </Field>
      </CardContent>
    </Card>
  );
}
