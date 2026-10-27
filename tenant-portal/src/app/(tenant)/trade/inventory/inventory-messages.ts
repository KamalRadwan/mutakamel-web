import type { NormalizedApiError } from "@/lib/api/errors";
import type { Dictionary } from "@/i18n/dictionaries/ar";

// One message per documented inventory rejection — never a shared "operation
// failed". Codes and statuses come from
// docs/api/trade-advanced.md#errors, verified against
// trade-app/src/modules/inventory/{inventory.service.ts,
// inventory-governance.service.ts}.
//
// Missing records use distinct 404 codes. Movement conflicts can still mean
// duplicate lines or a warehouse refusal, so their messages stay general.

export function inventoryMessage(
  error: NormalizedApiError,
  t: Dictionary,
): string | undefined {
  switch (error.code) {
    case "TRADE.INVENTORY.SCOPE_INVALID":
    case "TRADE.INVENTORY.SCOPE_NOT_FOUND":
      return t.tradeInventory.errorScopeInvalid;
    case "TRADE.INVENTORY.NODE_INVALID":
    case "TRADE.INVENTORY.NODE_NOT_FOUND":
    case "TRADE.INVENTORY.NODE_CONFLICT":
      return t.tradeInventory.errorNodeInvalid;
    case "TRADE.INVENTORY.NODE_IN_USE":
      return t.tradeInventory.errorNodeInUse;
    case "TRADE.INVENTORY.ITEM_NOT_STOCK_TRACKED":
    case "TRADE.INVENTORY.ITEM_TRACKING_CONFLICT":
      return t.tradeInventory.errorItemNotTracked;
    case "TRADE.INVENTORY.QUANTITY_INVALID":
    case "TRADE.INVENTORY.QUANTITY_CONFLICT":
      return t.tradeInventory.errorQuantityInvalid;
    case "TRADE.INVENTORY.TRACKING_REQUIRED":
      return t.tradeInventory.errorTrackingRequired;
    case "TRADE.INVENTORY.TRACKING_UNSUPPORTED":
      return t.tradeInventory.errorTrackingUnsupported;
    case "TRADE.INVENTORY.INSUFFICIENT_AVAILABILITY":
      return t.tradeInventory.errorInsufficient;
    case "TRADE.INVENTORY.PERIOD_CLOSED":
    case "TRADE.INVENTORY.PERIOD_CONFLICT":
      return t.tradeInventory.errorPeriodClosed;
    case "TRADE.INVENTORY.POLICY_REJECTED":
      return t.tradeInventory.errorPolicyRejected;
    case "TRADE.INVENTORY.UOM_CONVERSION_INVALID":
      return t.tradeInventory.errorConversionInvalid;
    case "TRADE.INVENTORY.UOM_CONVERSION_UNAVAILABLE":
      return t.tradeInventory.errorConversionUnavailable;
    case "TRADE.INVENTORY.RECEIPT_NOT_ALLOWED":
    case "TRADE.INVENTORY.RECEIPT_NOT_FOUND":
      return t.tradeInventory.errorReceiptNotAllowed;
    case "TRADE.INVENTORY.DELIVERY_NOT_ALLOWED":
    case "TRADE.INVENTORY.DELIVERY_NOT_FOUND":
      return t.tradeInventory.errorDeliveryNotAllowed;
    case "TRADE.INVENTORY.RELEASE_NOT_ALLOWED":
    case "TRADE.INVENTORY.RELEASE_NOT_FOUND":
      return t.tradeInventory.errorReleaseNotAllowed;
    case "TRADE.INVENTORY.REVERSAL_NOT_ALLOWED":
      return t.tradeInventory.errorReversalNotAllowed;
    case "TRADE.INVENTORY.SERIAL_CONFLICT":
      return t.tradeInventory.errorSerialConflict;
    case "TRADE.INVENTORY.RESERVATION_CONFLICT":
      return t.tradeInventory.errorReservationConflict;
    case "TRADE.CONCURRENCY.STALE_VERSION":
      return t.tradeCommon.errorStaleVersion;
    case "TRADE.CONCURRENCY.IF_MATCH_REQUIRED":
      return t.tradeCommon.errorIfMatchRequired;
    default:
      return undefined;
  }
}

export function inventoryFormMessage(error: unknown, t: Dictionary): string {
  const reason = error instanceof Error ? error.message : "";
  switch (reason) {
    case "INVENTORY_FORM_NODE":
      return t.tradeInventory.formNodeInvalid;
    case "INVENTORY_FORM_ITEM":
      return t.tradeInventory.formItemInvalid;
    case "INVENTORY_FORM_UOM":
      return t.tradeInventory.formUomInvalid;
    case "INVENTORY_FORM_TRACKING":
      return t.tradeInventory.formTrackingInvalid;
    case "INVENTORY_FORM_SERIAL_SELECTION":
      return t.tradeInventory.serialSelectionInvalid;
    case "INVENTORY_FORM_CODE":
      return t.tradeInventory.formCodeInvalid;
    case "INVENTORY_FORM_NAME":
      return t.tradeInventory.formNameInvalid;
    case "INVENTORY_FORM_TIMEZONE":
      return t.tradeInventory.formTimezoneInvalid;
    case "INVENTORY_FORM_BRANCHES":
      return t.tradeInventory.formBranchesInvalid;
    case "INVENTORY_FORM_DATE":
      return t.tradeInventory.formDateInvalid;
    case "INVENTORY_FORM_QUANTITY":
      return t.tradeInventory.formQuantityInvalid;
    case "INVENTORY_FORM_FACTOR":
      return t.tradeInventory.formFactorInvalid;
    case "INVENTORY_FORM_REASON":
      return t.tradeInventory.formReasonInvalid;
    case "INVENTORY_FORM_BACKDATE":
      return t.tradeInventory.formBackdateInvalid;
    case "INVENTORY_FORM_LINES":
      return t.tradeInventory.formLinesInvalid;
    default:
      return t.tradeCommon.actionFailed;
  }
}
