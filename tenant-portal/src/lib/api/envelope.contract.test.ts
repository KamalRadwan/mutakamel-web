import { describe, expect, it, vi } from "vitest";
import { readCoreData, readCrmBody } from "./envelope";
import { axiosClient } from "./axiosClient";

// S1 / L4-1. Two of these assertions are runtime; the important one is not.
//
// `@ts-expect-error` below IS the test for "a CRM payload cannot go through
// the Core helper": TypeScript fails the build if an expect-error directive
// stops being needed, so the day someone widens `readCoreData`'s path type to
// `string`, `pnpm typecheck` goes red on this line rather than a CRM screen
// going quietly wrong in production.

const CORE_PATH = "/api/tenant/core/v1/users/me/profile" as const;
const CRM_PATH = "/api/tenant/crm/v1/leads?branchId=x" as const;

function stubResponse(data: unknown) {
  return vi.spyOn(axiosClient, "get").mockResolvedValue({
    data,
    status: 200,
    statusText: "OK",
    headers: new Headers(),
  });
}

describe("envelope discipline", () => {
  it("does not accept a CRM path through the Core reader", () => {
    // @ts-expect-error — a CRM route is not a CorePath. This is the whole point.
    void (() => readCoreData(CRM_PATH));
    expect(CRM_PATH.startsWith("/api/tenant/crm/")).toBe(true);
  });

  it("strips the Core envelope", async () => {
    const spy = stubResponse({ success: true, data: { id: "u1" }, correlationId: "c1" });
    await expect(readCoreData(CORE_PATH)).resolves.toEqual({ id: "u1" });
    spy.mockRestore();
  });

  it("leaves a CRM list body exactly as sent, envelope-shaped or not", async () => {
    const body = { items: [{ id: "l1" }], meta: { page: 1, limit: 20, total: 1 } };
    const spy = stubResponse(body);
    await expect(readCrmBody(CRM_PATH)).resolves.toEqual(body);
    spy.mockRestore();
  });

  it("does not unwrap a CRM body that happens to carry a data key", async () => {
    // The failure mode the type separation exists to prevent: run through the
    // Core helper this would return `{ id: "c1" }` and lose `items`.
    const body = { items: [], data: { id: "c1" } };
    const spy = stubResponse(body);
    await expect(readCrmBody(CRM_PATH)).resolves.toEqual(body);
    spy.mockRestore();
  });
});
