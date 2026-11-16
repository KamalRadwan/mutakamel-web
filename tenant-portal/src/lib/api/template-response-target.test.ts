// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchTemplateDataSources } from "../../app/(tenant)/core/templates/template-data-sources-api";
import owners from "../../app/(tenant)/core/templates/template-owner-metadata.fixture.json";
import { customTenantFetch } from "./axiosClient";

const companyId = "01902001-3000-7000-8000-000000000005";
const endpoint = `/api/tenant/core/v1/templates/data-sources?scopeType=COMPANY&companyId=${companyId}`;
const sourceUrl = `${window.location.origin}${endpoint}`;
function response(url: string, redirected = false): Response {
  const reply = new Response(JSON.stringify({ success: true, data: { items: [owners[0]] } }), { status: 200 });
  Object.defineProperties(reply, { url: { value: url }, redirected: { value: redirected } });
  return reply;
}
beforeEach(() => {
  sessionStorage.setItem("tenant_session_meta", JSON.stringify({ sessionId: "target-test-session", savedAt: Date.now(),
    expiresIn: 300, sessionExpiresIn: 300, tokenType: "Bearer", remember: false,
    authorizationVersion: 1, profileVersion: 1, authEventId: "target-test-event" }));
});
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); });

it("accepts the exact query-bearing source discovery response target", async () => {
  const fetch = vi.fn().mockResolvedValue(response(sourceUrl));
  vi.stubGlobal("fetch", fetch);
  await expect(fetchTemplateDataSources({ type: "COMPANY", companyId })).resolves.toEqual([owners[0]]);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe(endpoint);
});

it.each([
  ["origin", `https://other.example.invalid${endpoint}`, false],
  ["path", sourceUrl.replace("/data-sources?", "/data-sources/other?"), false],
  ["query value", sourceUrl.replace(companyId, "01902001-3000-7000-8000-000000000006"), false],
  ["query order", `${window.location.origin}/api/tenant/core/v1/templates/data-sources?companyId=${companyId}&scopeType=COMPANY`, false],
  ["extra query", `${sourceUrl}&scopeType=TENANT`, false],
  ["missing query", sourceUrl.split("?")[0], false],
  ["fragment", `${sourceUrl}#other`, false],
  ["credentials", sourceUrl.replace("://", "://user:password@"), false],
  ["redirect", sourceUrl, true],
] as const)("refuses a response with different %s evidence", async (_name, target, redirected) => {
  const fetch = vi.fn().mockResolvedValue(response(target, redirected));
  vi.stubGlobal("fetch", fetch);
  await expect(fetchTemplateDataSources({ type: "COMPANY", companyId })).rejects.toMatchObject({
    response: { status: 409, data: { errorCode: "RESPONSE_TARGET_UNCONFIRMED" } },
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("retains exact queryless target admission", async () => {
  const target = "/api/tenant/core/v1/templates";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(`${window.location.origin}${target}`)));
  await expect(customTenantFetch(target, { requireExactResponseTarget: true })).resolves.toMatchObject({
    status: 200, provenance: "http", request: { endpoint: target, finalUrl: `${window.location.origin}${target}`, redirected: false },
  });
});
