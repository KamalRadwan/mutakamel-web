import { afterEach, describe, expect, it, vi } from "vitest";
import { axiosClient } from "@/lib/api/axiosClient";
import { readSubscriptionOffers } from "./subscription-offers-api";
import { createSubscriptionOffersFixture } from "./subscription-offers.fixture";
afterEach(() => vi.restoreAllMocks());
describe("published offer negotiated transport", () => {
  it("sends only the exact query through the bounded cookie client", async () => {
    const spy = vi.spyOn(axiosClient, "get").mockResolvedValue({ data: createSubscriptionOffersFixture(),
      headers: new Headers(), status: 200, statusText: "OK" });
    const signal = new AbortController().signal;
    await readSubscriptionOffers({ page: 1, limit: 20, applicationKey: "crm", parentTierId: "018ef54e-2222-7777-8888-000000000003" }, signal);
    expect(spy).toHaveBeenCalledExactlyOnceWith("/api/tenant/core/v1/subscription/catalogue?page=1&limit=20&applicationKey=crm&parentTierId=018ef54e-2222-7777-8888-000000000003", {
      signal, cache: "no-store", maxResponseBytes: 1_048_576,
    });
  });
  it("rejects unsupported selectors before transport", async () => {
    const spy = vi.spyOn(axiosClient, "get");
    await expect(readSubscriptionOffers({ page: 1, limit: 20, parentTierId: "018ef54e-2222-7777-8888-000000000003" })).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });
});
