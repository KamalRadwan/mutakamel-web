"use client";

import { useState } from "react";
import { Pencil, Shield } from "lucide-react";
import {
  Badge,
  Button,
  ErrorState,
  Field,
  FormModal,
  IdentifierText,
  Input,
  Skeleton,
  TooltipProvider,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useItemStandardCost } from "../hooks/useItemStandardCost";
import { formatTradeDecimal, isItemDecimalString } from "../item-contract";
import type { ItemStandardCost } from "../item-standard-cost-contract";

export function ItemStandardCostSection({
  itemId,
  salesPrice,
  onSaved,
}: {
  itemId: string;
  salesPrice?: string | null;
  onSaved?: () => void;
}) {
  const { t } = useI18n();
  const state = useItemStandardCost(itemId, true);
  if (!state.canView || state.scopeGap) return null;

  const parsedCost = state.cost?.standardCost ? Number(state.cost.standardCost) : null;
  const parsedPrice = salesPrice ? Number(salesPrice) : null;
  const marginPct =
    parsedCost !== null &&
    Number.isFinite(parsedCost) &&
    parsedPrice !== null &&
    Number.isFinite(parsedPrice) &&
    parsedPrice > 0
      ? (((parsedPrice - parsedCost) / parsedPrice) * 100).toFixed(2)
      : null;

  return (
    <>
      <section className="flex flex-col gap-2.5 rounded-lg border border-border bg-warning-subtle/60 p-3.5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="caution">
              <Shield className="me-1 size-3" aria-hidden />
              {t.trade.itemStandardCost}
            </Badge>
            {state.cost ? (
              <span className="text-xs font-semibold text-foreground">
                <IdentifierText>
                  {state.cost.standardCost
                    ? `${formatTradeDecimal(state.cost.standardCost)}${state.cost.currencyCode ? ` ${state.cost.currencyCode}` : ""}`
                    : "—"}
                </IdentifierText>
              </span>
            ) : null}
            {state.cost ? (
              <Badge tone="neutral">
                <IdentifierText>{`v${state.cost.version}`}</IdentifierText>
              </Badge>
            ) : null}
            {marginPct !== null ? (
              <Badge tone={Number(marginPct) >= 0 ? "positive" : "negative"}>
                <IdentifierText>{`${Number(marginPct) >= 0 ? "+" : ""}${marginPct}%`}</IdentifierText>
              </Badge>
            ) : null}
          </div>

          {state.canManage && state.cost ? (
            <Button variant="outline" size="xs" onClick={state.openEditor}>
              <Pencil className="size-3.5" aria-hidden="true" />
              {t.trade.itemStandardCostEdit}
            </Button>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">{t.trade.itemStandardCostProtected}</p>

        {state.isLoading ? <Skeleton className="h-10" /> : null}
        {state.error ? (
          <ErrorState
            title={t.trade.itemStandardCostLoadFailed}
            onRetry={state.reload}
            retryLabel={t.common.retry}
          />
        ) : null}
      </section>

      {state.cost ? (
        <StandardCostDrawer
          key={`${state.cost.version}-${state.open}`}
          open={state.open}
          cost={state.cost}
          salesPrice={salesPrice}
          isSubmitting={state.isSubmitting}
          error={state.formError}
          onClose={state.closeEditor}
          onSubmit={async (value) => {
            const saved = await state.save(value);
            if (saved) onSaved?.();
            return saved;
          }}
        />
      ) : null}
    </>
  );
}

function StandardCostDrawer({
  open,
  cost,
  salesPrice,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  cost: ItemStandardCost;
  salesPrice?: string | null;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (value: string) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const initialCost = cost.standardCost ? formatTradeDecimal(cost.standardCost) : "";
  const [value, setValue] = useState(initialCost);

  const parsedDraftCost = value.trim() ? Number(value.trim()) : null;
  const parsedSalesPrice = salesPrice ? Number(salesPrice) : null;
  const draftMarginPct =
    parsedDraftCost !== null &&
    Number.isFinite(parsedDraftCost) &&
    parsedSalesPrice !== null &&
    Number.isFinite(parsedSalesPrice) &&
    parsedSalesPrice > 0
      ? (((parsedSalesPrice - parsedDraftCost) / parsedSalesPrice) * 100).toFixed(2)
      : null;

  return (
    <FormModal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t.trade.itemStandardCostEdit}
      description={t.trade.itemStandardCostProtected}
      size="card"
      headerIcon={
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-warning-subtle text-warning-subtle-foreground">
          <Shield className="size-4" aria-hidden />
        </div>
      }
      titleBadge={
        <Badge tone="caution">
          <IdentifierText>{`v${cost.version}`}</IdentifierText>
        </Badge>
      }
      bodyClassName="bg-muted/40 p-4 sm:p-5"
      isDirty={value !== initialCost}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(value)}
      error={error ?? undefined}
      labels={{
        submit: t.trade.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections: t.trade.itemFormSections,
        sectionInvalid: t.trade.itemFormHasErrors,
      }}
    >
      <TooltipProvider>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3.5 shadow-2xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
            <Field
              label={t.trade.itemStandardCost}
              showLabel
              hint={t.trade.itemNonNegativeDecimal}
              hintPlacement="tooltip"
            >
              <Input
                size="sm"
                dir="ltr"
                className="font-mono tabular-nums"
                placeholder="0.00"
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onBlur={() => {
                  if (value.trim() && isItemDecimalString(value.trim())) {
                    setValue(formatTradeDecimal(value));
                  }
                }}
                disabled={isSubmitting}
              />
            </Field>
            <Field label={t.trade.itemCurrencyCode} showLabel readOnly>
              <Input
                size="sm"
                dir="ltr"
                className="font-mono"
                value={cost.currencyCode ?? ""}
                readOnly
              />
            </Field>
          </div>

          {draftMarginPct !== null ? (
            <div className="flex items-center justify-between rounded-md border border-border bg-success-subtle px-3 py-2 text-xs font-medium text-success-subtle-foreground">
              <span>{t.trade.itemSalesPrice}: {formatTradeDecimal(salesPrice)} {cost.currencyCode ?? ""}</span>
              <Badge tone={Number(draftMarginPct) >= 0 ? "positive" : "negative"}>
                <IdentifierText>{`${Number(draftMarginPct) >= 0 ? "+" : ""}${draftMarginPct}%`}</IdentifierText>
              </Badge>
            </div>
          ) : null}
        </div>
      </TooltipProvider>
    </FormModal>
  );
}

