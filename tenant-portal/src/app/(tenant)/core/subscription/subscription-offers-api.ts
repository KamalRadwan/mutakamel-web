import { readCoreResponse } from "@/lib/api/envelope";
import { parseSubscriptionOfferRequest, parseSubscriptionOffers, type SubscriptionOfferRequest } from "./subscription-offers";

export async function readSubscriptionOffers(request: SubscriptionOfferRequest, signal?: AbortSignal) {
  const input = parseSubscriptionOfferRequest(request);
  const query = new URLSearchParams({ page: String(input.page), limit: String(input.limit) });
  if (input.applicationKey !== undefined) query.set("applicationKey", input.applicationKey);
  if (input.parentTierId !== undefined) query.set("parentTierId", input.parentTierId);
  const response = await readCoreResponse(`/api/tenant/core/v1/subscription/catalogue?${query}`, {
    signal, cache: "no-store", maxResponseBytes: 1_048_576,
  });
  return parseSubscriptionOffers(response.data, input);
}
