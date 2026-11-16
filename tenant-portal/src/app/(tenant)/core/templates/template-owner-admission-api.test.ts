// @vitest-environment jsdom
import { createRequire } from "node:module";
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import fixture from "./template-owner-admission-api.fixture.json";
import { fetchTemplateOwnerAdmission } from "./template-owner-admission-api";
import type { TemplateOwnerAdmissionHost } from "./template-owner-admission";

const localRequire = createRequire(import.meta.url);
const schema = createRequire(localRequire.resolve("@mutakamel/core-app-contracts/package.json"))("@mutakamel/template-schema") as {
  canonicalJson(value: unknown): string;
};
const body = fixture.rows[0];
// A separate pinned producer observation is a test control, not production loader/session qualification.
const pins = fixture.producerObservations.find(row => row.adapterKey === body.adapterKey)!.pins;
const host = (): TemplateOwnerAdmissionHost => ({ pins, canonicalJson: schema.canonicalJson, isCurrent: () => true });
const companyId = "01902001-3000-7000-8000-000000000005";
const adapterKey = "CRM_LEAD_OUTBOUND_EMAIL_V1";
const endpoint = `/api/tenant/core/v1/templates/data-sources/${adapterKey}/schema?scopeType=COMPANY&schemaVersion=1&companyId=${companyId}`;
function reply(value: unknown, target = endpoint, status = 200): Response {
  const response = new Response(JSON.stringify(value), { status });
  Object.defineProperties(response, { url: { value: `${window.location.origin}${target}` }, redirected: { value: false } });
  return response;
}
const read = (qualifiedHost = host()) => fetchTemplateOwnerAdmission(adapterKey, { type: "COMPANY", companyId }, qualifiedHost);
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  sessionStorage.setItem("tenant_session_meta", JSON.stringify({ sessionId: "owner-context-contract-test", savedAt: Date.now(),
    expiresIn: 300, sessionExpiresIn: 300, tokenType: "Bearer", remember: false,
    authorizationVersion: 1, profileVersion: 1, authEventId: "owner-context-test-event" }));
});
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); });

it.each(["raw", "wrapped"] as const)("retains the full immutable actual R8 owner context from a %s response", async form => {
  const fetch = vi.fn().mockResolvedValue(reply(form === "raw" ? body : { success: true, data: body }));
  vi.stubGlobal("fetch", fetch);
  const context = await read();
  expect(context).toEqual(body.ownerContext);
  expect(context).not.toBe(body.ownerContext);
  expect(context?.descriptor).toEqual(body.admission.descriptor);
  expect(Object.isFrozen(context?.descriptor.fields)).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe(endpoint);
  expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: "include", cache: "no-store" });
});
it("refuses a coherent row for another source returned to the requested schema endpoint", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ success: true, data: fixture.rows[1] })));
  await expect(read()).rejects.toThrow();
});
it("refuses producer pins that differ from independent host qualification", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ success: true, data: body })));
  const independent = host();
  await expect(read({ ...independent, pins: { ...independent.pins,
    engine: { ...independent.pins.engine, entrypointSha256: "f".repeat(64) } } })).resolves.toBeNull();
});
it("refuses context after the captured host generation retires during the request", async () => {
  let current = true;
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => {
    current = false;
    return reply({ success: true, data: body });
  }));
  await expect(read({ ...host(), isCurrent: () => current })).resolves.toBeNull();
});
it("does not fetch when its captured host generation is already retired", async () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  await expect(read({ ...host(), isCurrent: () => false })).resolves.toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});
it("refuses changed full descriptor JSON including its presentation label commitment", async () => {
  const changed = structuredClone(body);
  changed.ownerContext.descriptor.fields[0].labelKey += ".changed";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ success: true, data: changed })));
  await expect(read()).resolves.toBeNull();
});
it("keeps a projected fields response without ownerContext unavailable", async () => {
  const { ownerContext: omitted, ...projection } = body;
  expect(omitted).toBeDefined();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ success: true, data: projection })));
  await expect(read()).resolves.toBeNull();
});
it.each([403, 503])("preserves actual HTTP %s owner failures", async status => {
  const errorCode = status === 403 ? "ACCESS_POLICY_BLOCKED" : "CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ errorCode }, endpoint, status)));
  await expect(read()).rejects.toMatchObject({ response: { status, data: { errorCode } } });
});
it("refuses a full owner row delivered from another company query target", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ success: true, data: body }, endpoint.replace(companyId, "01902001-3000-7000-8000-000000000006"))));
  await expect(read()).rejects.toMatchObject({ response: { status: 409, data: { errorCode: "RESPONSE_TARGET_UNCONFIRMED" } } });
});
