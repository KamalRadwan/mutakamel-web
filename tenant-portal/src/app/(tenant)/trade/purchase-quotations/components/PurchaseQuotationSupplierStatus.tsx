"use client";

import { Button, DegradedBanner, PermissionGate } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { PurchaseQuotationFormState } from "../hooks/usePurchaseQuotationForm";
import { PURCHASE_QUOTATION_PERMISSIONS } from "../purchase-quotation-contract";
import { tradeDocumentMessage } from "../../documents/trade-document-errors";

export function PurchaseQuotationSupplierStatus({ state, isEdit = false }: {
  state: Pick<PurchaseQuotationFormState, "suppliersError" | "searchSuppliers" | "isLoadingSuppliers">;
  isEdit?: boolean;
}) {
  const { t } = useI18n();
  if (!state.suppliersError) return null;
  return (
    <div className="flex flex-col items-start gap-2">
      {state.suppliersError.status === 403 ? (
        <PermissionGate require={isEdit ? PURCHASE_QUOTATION_PERMISSIONS.update : PURCHASE_QUOTATION_PERMISSIONS.create} denied>
          {null}
        </PermissionGate>
      ) : (
        <DegradedBanner message={tradeDocumentMessage(state.suppliersError.code, t.tradeDocuments.errors) ??
          t.tradeDocuments.purchaseQuotations.suppliersUnavailable} />
      )}
      <Button size="sm" variant="outline" onClick={() => state.searchSuppliers("")} disabled={state.isLoadingSuppliers}>
        {t.common.retry}
      </Button>
    </div>
  );
}
