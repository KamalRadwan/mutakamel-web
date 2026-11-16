// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { readConfigurationIntent, retainConfigurationIntent, type ConfigurationCommand } from "./configuration-command";

const id = (n: number) => `018ef54e-2222-7777-8888-${String(n).padStart(12, "0")}`;
const actorId = id(1);
const target = { kind: "COMPANY_CONFIGURATION" as const, companyId: id(2), applicationKey: "crm", addonKey: "crm.email" };
const key = `tenant-configuration-intent:${actorId}:${target.kind}:${target.companyId}:${target.applicationKey}:${target.addonKey}`;
const command: ConfigurationCommand = {
  idempotencyKey: id(3), target, observedResourceId: null,
  body: { expectedConfigRevision: "0", definitionVersionId: id(4),
    schemaRef: { key: "crm.email", version: 1, checksum: "a".repeat(64) },
    values: { password: "secret-password" }, reason: "secret reason" },
};

beforeEach(() => sessionStorage.clear());

describe("configuration intent storage", () => {
  it("retains and reads the current secret-free intent format", () => {
    const intent = retainConfigurationIntent(actorId, command);
    expect(readConfigurationIntent(actorId, target)).toEqual(intent);
    expect(sessionStorage.getItem(key)).not.toContain("secret");
  });

  it("scrubs and rejects a valid older command instead of migrating it", () => {
    sessionStorage.setItem(key, JSON.stringify({ actorId, command }));
    expect(() => readConfigurationIntent(actorId, target)).toThrow("The configuration command could not be verified.");
    expect(sessionStorage.getItem(key)).toBe(JSON.stringify({ actorId, unavailable: true }));
    expect(() => retainConfigurationIntent(actorId, command)).toThrow();
    expect(sessionStorage.getItem(key)).toBe(JSON.stringify({ actorId, unavailable: true }));
  });

  it.each(["{", "null", JSON.stringify({ actorId, unexpected: "secret" })])("scrubs other non-matching entries", (text) => {
    sessionStorage.setItem(key, text);
    expect(() => readConfigurationIntent(actorId, target)).toThrow();
    expect(sessionStorage.getItem(key)).toBe(JSON.stringify({ actorId, unavailable: true }));
  });
});
