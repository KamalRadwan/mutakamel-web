import { afterEach, describe, expect, it, vi } from "vitest";
import { axiosClient } from "@/lib/api/axiosClient";
import { coreDelete, coreGet, corePatch, corePost, corePut } from "./core-api";

const EMAIL_CONFIG_PATH = "/api/tenant/core/v1/email-config" as const;
const WORKSPACE_PATH = "/api/tenant/core/v1/workspace-settings" as const;
const CURRENCIES_PATH = "/api/tenant/core/v1/currencies" as const;
const CURRENCY_ITEM_PATH =
  "/api/tenant/core/v1/currencies/01902001-3000-7000-8000-000000000011" as const;
const IDEMPOTENCY_KEY = "01902001-3000-7000-8000-000000000088";
const CORRELATION_ID = "01902001-3000-7000-8000-000000000099";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("core/core-api singleton and write envelope transport", () => {
  it("preserves response headers (ETag) and status while unwrapping singleton Core GET data", async () => {
    const headers = new Headers({ ETag: '"3"' });
    const spy = vi.spyOn(axiosClient, "get").mockResolvedValue({
      data: {
        success: true,
        data: { provider: "SMTP", host: "mail.example.com" },
        correlationId: CORRELATION_ID,
      },
      status: 200,
      statusText: "OK",
      headers,
    });

    const result = await coreGet(EMAIL_CONFIG_PATH);

    expect(spy).toHaveBeenCalledWith(EMAIL_CONFIG_PATH, { cache: "no-store" });
    expect(result.status).toBe(200);
    expect(result.headers.get("ETag")).toBe('"3"');
    expect(result.data).toEqual({ provider: "SMTP", host: "mail.example.com" });
  });

  it("unwraps Core write envelopes, forwards If-Match and X-Idempotency-Key headers, and preserves 204 null bodies", async () => {
    const postSpy = vi.spyOn(axiosClient, "post").mockResolvedValue({
      data: { success: true, data: { code: "USD" }, correlationId: CORRELATION_ID },
      status: 201,
      statusText: "Created",
      headers: new Headers(),
    });
    const putSpy = vi.spyOn(axiosClient, "put").mockResolvedValue({
      data: { success: true, data: { provider: "SMTP" }, correlationId: CORRELATION_ID },
      status: 200,
      statusText: "OK",
      headers: new Headers({ ETag: '"4"' }),
    });
    const patchSpy = vi.spyOn(axiosClient, "patch").mockResolvedValue({
      data: { success: true, data: { timezone: "Africa/Cairo" }, correlationId: CORRELATION_ID },
      status: 200,
      statusText: "OK",
      headers: new Headers(),
    });
    const deleteSpy = vi.spyOn(axiosClient, "delete").mockResolvedValue({
      data: null,
      status: 204,
      statusText: "No Content",
      headers: new Headers(),
    });

    const created = await corePost(
      CURRENCIES_PATH,
      { code: "USD" },
      { headers: { "X-Idempotency-Key": IDEMPOTENCY_KEY } },
    );
    const replaced = await corePut(
      EMAIL_CONFIG_PATH,
      { provider: "SMTP" },
      { headers: { "If-Match": '"3"' } },
    );
    const updated = await corePatch(WORKSPACE_PATH, { timezone: "Africa/Cairo" });
    const removed = await coreDelete(CURRENCY_ITEM_PATH);

    expect(postSpy).toHaveBeenCalledWith(
      CURRENCIES_PATH,
      { code: "USD" },
      { cache: "no-store", headers: { "X-Idempotency-Key": IDEMPOTENCY_KEY } },
    );
    expect(putSpy).toHaveBeenCalledWith(
      EMAIL_CONFIG_PATH,
      { provider: "SMTP" },
      { cache: "no-store", headers: { "If-Match": '"3"' } },
    );
    expect(patchSpy).toHaveBeenCalledWith(
      WORKSPACE_PATH,
      { timezone: "Africa/Cairo" },
      { cache: "no-store" },
    );
    expect(deleteSpy).toHaveBeenCalledWith(CURRENCY_ITEM_PATH, { cache: "no-store" });

    expect(created.data).toEqual({ code: "USD" });
    expect(replaced.headers.get("ETag")).toBe('"4"');
    expect(updated.data).toEqual({ timezone: "Africa/Cairo" });
    expect(removed.status).toBe(204);
    expect(removed.data).toBeNull();
  });
});
