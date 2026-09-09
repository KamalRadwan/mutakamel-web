import { beforeEach, describe, expect, it, vi } from "vitest";
const client = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: client }));
import { initialCommercialApi, initialSeedUrl, INITIAL_OPTIONS_URL, INITIAL_QUOTE_URL } from "./initial-commercial.api";
import { initialOptionsFixture } from "./initial-create-options.fixture";
import { buildInitialSeedRequest } from "./initial-commercial-request";
import { initialId, initialQuoteFixture, initialReceiptFixture, initialRequestFixture, initialResponse } from "./initial-commercial.fixture";

beforeEach(() => vi.resetAllMocks());
describe("Canonical initial commercial transport", () => {
  it("loads least-privilege options with no organization/key/body/query selectors", async () => {
    const options = initialOptionsFixture(), controller = new AbortController();
    client.get.mockResolvedValue({ ...initialResponse(options), status: 200 });
    expect(await initialCommercialApi.options(controller.signal)).toEqual(options);
    expect(client.get).toHaveBeenCalledExactlyOnceWith(INITIAL_OPTIONS_URL, {
      skipAutoIdempotency: true, replayAfterRefresh: true, cache: "no-store", signal: controller.signal,
    });
  });
  it.each(["legacy field", "unknown field", "wrong status", "oversized envelope"])("keeps options %s failures correlated without fallback", async failure => {
    const response = { ...initialResponse(initialOptionsFixture()), status: 200 };
    if (failure === "legacy field") Object.assign((response.data as { data: object }).data, { contractVersion: 2 });
    if (failure === "unknown field") Object.assign(response.data as object, { ready: true });
    if (failure === "wrong status") response.status = 201;
    if (failure === "oversized envelope") Object.assign(response.data as object, { padding: "x".repeat(1024 * 1024) });
    client.get.mockResolvedValue(response);
    await expect(initialCommercialApi.options()).rejects.toMatchObject({ errorCode: "COMMERCIAL_RESPONSE_UNAVAILABLE", correlationId: initialId(99) });
    expect(client.get).toHaveBeenCalledOnce();
  });
  it.each(["TENANT_CREATION", "INITIAL_SEED"] as const)("quotes %s without body/query scope inventions or idempotency", async purpose => {
    const request = initialRequestFixture(purpose), quote = initialQuoteFixture(purpose), controller = new AbortController();
    client.post.mockResolvedValue(initialResponse(quote));
    expect(await initialCommercialApi.quote(request, controller.signal)).toEqual(quote);
    expect(client.post).toHaveBeenCalledExactlyOnceWith(INITIAL_QUOTE_URL, request, { 
      skipAutoIdempotency: true, replayAfterRefresh: false, cache: "no-store", signal: controller.signal });
  });
  it("seeds the exact tenant path with original body and caller-owned key", async () => {
    const quote = initialQuoteFixture(), request = initialRequestFixture(); delete request.trialDays;
    const body = buildInitialSeedRequest(quote, request);
    client.post.mockResolvedValue(initialResponse(initialReceiptFixture()));
    expect(await initialCommercialApi.seed(initialId(2), body, quote, initialId(77))).toEqual(initialReceiptFixture());
    expect(client.post).toHaveBeenCalledExactlyOnceWith(initialSeedUrl(initialId(2)), body, {
      headers: { "x-idempotency-key": initialId(77) }, replayAfterRefresh: true, cache: "no-store",
    });
    expect(body).not.toHaveProperty("trialDays");
  });
  it.each([null, 1, 2])("rejects obsolete payload version %s", async version => {
    const response = initialResponse(initialQuoteFixture());
    Object.assign((response.data as { data: object }).data, { contractVersion: version });
    client.post.mockResolvedValue(response);
    await expect(initialCommercialApi.quote(initialRequestFixture())).rejects.toMatchObject({ errorCode: "COMMERCIAL_RESPONSE_UNAVAILABLE", correlationId: initialId(99) });
    expect(client.post).toHaveBeenCalledOnce();
  });
  it("preserves correlation on a same-total foreign quote or original receipt", async () => {
    const quote = initialQuoteFixture(); quote.items[0].addons[0].definitionVersionId = initialId(80);
    client.post.mockResolvedValue(initialResponse(quote));
    await expect(initialCommercialApi.quote(initialRequestFixture())).rejects.toMatchObject({ correlationId: initialId(99) });
    const receipt = initialReceiptFixture(); receipt.selections[0].applicationId = initialId(81);
    client.post.mockResolvedValue(initialResponse(receipt));
    const original = initialQuoteFixture();
    await expect(initialCommercialApi.seed(initialId(2), buildInitialSeedRequest(original, initialRequestFixture()), original, initialId(77)))
      .rejects.toMatchObject({ errorCode: "COMMERCIAL_RESPONSE_UNAVAILABLE", correlationId: initialId(99) });
  });
  it("does not dispatch an invalid path/key or a different reviewed seed request", async () => {
    const quote = initialQuoteFixture(), body = buildInitialSeedRequest(quote, initialRequestFixture());
    await expect(initialCommercialApi.seed("not-a-tenant", body, quote, initialId(77))).rejects.toThrow();
    await expect(initialCommercialApi.seed(initialId(2), body, quote, "not-a-key")).rejects.toThrow();
    await expect(initialCommercialApi.seed(initialId(2), { ...body, quoteId: initialId(88) }, quote, initialId(77))).rejects.toThrow();
    expect(client.post).not.toHaveBeenCalled();
  });
  it("rejects a success status outside the frozen201 contract", async () => {
    client.post.mockResolvedValue({ ...initialResponse(initialQuoteFixture()), status: 200 });
    await expect(initialCommercialApi.quote(initialRequestFixture())).rejects.toMatchObject({ errorCode: "COMMERCIAL_RESPONSE_UNAVAILABLE" });
  });
});
