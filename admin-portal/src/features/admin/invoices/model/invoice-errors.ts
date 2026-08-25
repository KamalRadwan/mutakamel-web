import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import type { InvoiceMutationPhase, InvoiceResourceState } from "../types/invoices";

export function classifyInvoiceReadError(
  caught: unknown,
  error: NormalizedApiError,
): InvoiceResourceState {
  if (error.httpStatus === 403) return "FORBIDDEN";
  if (error.httpStatus === 404) return "NOT_FOUND";
  if (isInvoiceContractError(caught)) return "ERROR";
  if (
    error.httpStatus >= 500 ||
    error.errorCode.startsWith("TRANSPORT_") ||
    error.errorCode === "UNKNOWN_ERROR"
  ) {
    return "UNAVAILABLE";
  }
  return "ERROR";
}

export function classifyInvoiceMutationError(
  caught: unknown,
  error: NormalizedApiError,
): InvoiceMutationPhase {
  if (isInvoiceContractError(caught)) return "ERROR";
  if (error.httpStatus === 403) return "FORBIDDEN";
  if (error.errorCode === "GW.IDEM.IN_FLIGHT") return "IN_FLIGHT";
  if (error.httpStatus === 409) return "CONFLICT";
  if (error.httpStatus === 400 || error.httpStatus === 422) return "VALIDATION";
  if (
    error.httpStatus >= 500 ||
    error.errorCode.startsWith("TRANSPORT_") ||
    error.errorCode === "UNKNOWN_ERROR"
  ) {
    return "UNAVAILABLE";
  }
  return "ERROR";
}

function isInvoiceContractError(caught: unknown): boolean {
  return (
    caught instanceof Error &&
    (caught.message === "INVALID_ADMIN_INVOICE_RESPONSE" ||
      caught.message === "INVALID_ADMIN_INVOICE_ID" ||
      caught.message === "INVALID_ADMIN_INVOICE_IDEMPOTENCY_KEY")
  );
}
