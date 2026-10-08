"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import {
  Button,
  DetailSection,
  ErrorState,
  Field,
  FormDrawer,
  IdentifierText,
  Input,
  Skeleton,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useItemStandardCost } from "../hooks/useItemStandardCost";
import type { ItemStandardCost } from "../item-standard-cost-contract";

export function ItemStandardCostSection({
  itemId,
  onSaved,
}: {
  itemId: string;
  onSaved?: () => void;
}) {
  const { t } = useI18n();
  const state = useItemStandardCost(itemId, true);
  if (!state.canView || state.scopeGap) return null;

  return (
    <>
      <DetailSection
        title={t.trade.itemStandardCost}
        description={t.trade.itemStandardCostProtected}
        action={state.canManage && state.cost ? (
          <Button variant="outline" size="sm" onClick={state.openEditor}>
            <Pencil className="size-4" aria-hidden="true" />
            {t.trade.itemStandardCostEdit}
          </Button>
        ) : null}
        fields={state.cost ? [
          { label: t.trade.itemStandardCost, value: state.cost.standardCost },
          { label: t.trade.itemCurrencyCode, value: state.cost.currencyCode },
          { label: t.trade.version, value: <IdentifierText>{state.cost.version}</IdentifierText> },
        ] : undefined}
      >
        {state.isLoading ? <Skeleton className="h-16" /> : null}
        {state.error ? <ErrorState title={t.trade.itemStandardCostLoadFailed} onRetry={state.reload} retryLabel={t.common.retry} /> : null}
      </DetailSection>
      {state.cost ? (
        <StandardCostDrawer
          key={`${state.cost.version}-${state.open}`}
          open={state.open}
          cost={state.cost}
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
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  cost: ItemStandardCost;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (value: string) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState(cost.standardCost ?? "");
  return (
    <FormDrawer
      open={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      title={t.trade.itemStandardCostEdit}
      description={t.trade.itemStandardCostProtected}
      isDirty={value !== (cost.standardCost ?? "")}
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
      }}
    >
      <Field label={t.trade.itemStandardCost} hint={t.trade.itemNonNegativeDecimal}>
        <Input size="sm" dir="ltr" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} disabled={isSubmitting} />
      </Field>
      <Field label={t.trade.itemCurrencyCode} readOnly>
        <Input size="sm" dir="ltr" value={cost.currencyCode ?? ""} readOnly />
      </Field>
    </FormDrawer>
  );
}
