import { axiosClient } from "@/lib/api/axiosClient";
import { contractFailure, readCommercialResponse, uuid, uuid7 } from "@/shared/api/commercial-contract";
import { INITIAL_QUOTE_RESPONSE_MAX_BYTES, INITIAL_SEED_RESPONSE_MAX_BYTES, readInitialQuote, readOriginalInitialSeedReceipt,
  type InitialQuoteView } from "../initial-commercial-readers";
import { assertQuoteMatchesRequest, assertSeedMatchesQuote, readInitialQuoteRequest, readInitialSeedRequest,
  type InitialQuoteRequest, type InitialSeedRequest } from "./initial-commercial-request";
import { INITIAL_OPTIONS_RESPONSE_MAX_BYTES, readInitialCreateOptions } from "./initial-create-options";

export const INITIAL_QUOTE_URL = "/api/admin/core/v1/subscriptions/quote";
export const INITIAL_OPTIONS_URL = "/api/admin/core/v1/tenants/create-options";
export const initialSeedUrl = (tenantId: string) => `/api/admin/core/v1/tenants/${uuid(tenantId)}/subscription`;

/** Canonical initial commercial transport; quotes create retained evidence and are never replayed. */
export const initialCommercialApi = {
  options: async (signal?: AbortSignal) => {
    const response = await axiosClient.get<unknown>(INITIAL_OPTIONS_URL, {
      skipAutoIdempotency: true, replayAfterRefresh: true, cache: "no-store", signal,
    });
    return readCommercialResponse(response, value => {
      if (response.status !== 200) contractFailure();
      return readInitialCreateOptions(value);
    }, false, INITIAL_OPTIONS_RESPONSE_MAX_BYTES);
  },
  quote: async (input: InitialQuoteRequest, signal?: AbortSignal) => {
    const request = readInitialQuoteRequest(input);
    const response = await axiosClient.post<unknown>(INITIAL_QUOTE_URL, request, {
      skipAutoIdempotency: true, replayAfterRefresh: false, cache: "no-store", signal,
    });
    return readCommercialResponse(response, value => {
      if (response.status !== 201) contractFailure();
      return assertQuoteMatchesRequest(readInitialQuote(value), request);
    }, false, INITIAL_QUOTE_RESPONSE_MAX_BYTES);
  },
  seed: async (tenantId: string, input: InitialSeedRequest, quote: InitialQuoteView, idempotencyKey: string) => {
    const request = readInitialSeedRequest(input);
    const { quoteId, ...terms } = request;
    const checkedQuote = readInitialQuote(quote);
    assertQuoteMatchesRequest(checkedQuote, readInitialQuoteRequest({ ...terms, purpose: "INITIAL_SEED", targetTenantId: uuid(tenantId) }));
    if (quoteId !== checkedQuote.quoteId) contractFailure();
    const response = await axiosClient.post<unknown>(initialSeedUrl(tenantId), request, {
      headers: { "x-idempotency-key": uuid7(idempotencyKey) }, replayAfterRefresh: true, cache: "no-store",
    });
    return readCommercialResponse(response, value => {
      if (response.status !== 201) contractFailure();
      return assertSeedMatchesQuote(readOriginalInitialSeedReceipt(value), checkedQuote);
    }, false, INITIAL_SEED_RESPONSE_MAX_BYTES);
  },
};
