import { readCoreResponse } from "@/lib/api/envelope";
import { commercialReceiptReferenceSchema, parseCommercialReceipt, type CommercialReceiptReference } from "./commercial-apply";

export async function readCommercialReceipt(expected: CommercialReceiptReference, signal?: AbortSignal) {
  const reference = commercialReceiptReferenceSchema.parse(expected);
  const response = await readCoreResponse(`/api/tenant/core/v1/subscription/plan-change-previews/${reference.previewId}/receipt`, {
    signal, cache: "no-store", maxResponseBytes: 4 * 1024 * 1024,
  });
  // The optional preparation pin is local verified context, never a request selector.
  return parseCommercialReceipt(response.data, reference);
}
