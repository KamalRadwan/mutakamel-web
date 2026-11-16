import { describe, expect, it } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { buildAsteriskPatch, editableAsterisk, parseAsterisk } from "./asterisk-contract";
import { validateSettings } from "./settings-validation";
import { buildCrmSettingsPatch, editableSettings, rebaseSettingsDraft, type CrmSettings } from "./settings-contract";

const publicState = {
  enabled: true, allowInvalidTlsCertificate: false, websocketUrl: "wss://voice.example.test/ws",
  registerExpires: 600, stunServers: ["stun:relay.example.test"],
  turnServers: [{ urls: ["turn:relay.example.test"], username: "sales", hasCredential: true }],
  iceServers: [],
};
const validate = (a: ReturnType<typeof editableAsterisk>) => validateSettings({
  requireQualifiedStageForConversion: true, outboundEmailContentRetentionDays: 730, asteriskIntegration: a,
}, en.crmSettings);

describe("Asterisk settings boundaries", () => {
  it("rebases only intentional edits onto a refreshed policy, including credential decisions", () => {
    const previous: CrmSettings = { id: "01900100-0000-7000-8000-000000000001", defaultPipelineId: "01900100-0000-7000-8000-000000000002",
      requireQualifiedStageForConversion: true, outboundEmailContentRetentionDays: 730, outboundEmailRetentionPolicyRevision: 1,
      asteriskIntegration: { ...publicState, realm: "old-realm" } };
    const draft = editableSettings(previous);
    draft.outboundEmailContentRetentionDays = 365;
    draft.asteriskIntegration!.defaultCallerId = "User edited";
    draft.asteriskIntegration!.replaceTurnServers = true;
    draft.asteriskIntegration!.turnServers![0].credential = "reentered";
    const next = { ...previous, requireQualifiedStageForConversion: false, outboundEmailContentRetentionDays: 900,
      outboundEmailRetentionPolicyRevision: 2, asteriskIntegration: { ...previous.asteriskIntegration, realm: "latest-realm", traceSip: true } };
    const rebased = rebaseSettingsDraft(previous, next, draft);
    expect(rebased.requireQualifiedStageForConversion).toBe(false);
    expect(rebased.asteriskIntegration!.realm).toBe("latest-realm");
    expect(rebased.asteriskIntegration!.traceSip).toBe(true);
    expect(rebased.asteriskIntegration!.defaultCallerId).toBe("User edited");
    expect(rebased.asteriskIntegration!.turnServers![0].credential).toBe("reentered");
    expect(buildCrmSettingsPatch(next, rebased)).toEqual({ outboundEmailContentRetentionDays: 365, expectedOutboundEmailRetentionPolicyRevision: 2,
      asteriskIntegration: { defaultCallerId: "User edited", turnServers: [{ urls: ["turn:relay.example.test"], username: "sales", credential: "reentered" }] } });
  });
  it("validates full public configuration and keeps credential presence only", () => {
    expect(parseAsterisk(publicState)).toEqual(publicState);
    expect(() => parseAsterisk({ ...publicState, turnServers: [{ ...publicState.turnServers[0], credential: "private" }] })).toThrow("INVALID_CRM_SETTINGS_RESPONSE");
    expect(() => parseAsterisk({ ...publicState, turnServers: [{ urls: ["turn:relay"], hasCredential: "true" }] })).toThrow();
  });
  it.each([
    { websocketUrl: "https://voice.example.test" }, { registerExpires: 59 }, { registerExpires: 86401 },
    { sessionTimers: "false" }, { stunServers: Array(17).fill("stun:relay") },
    { iceServers: [{ urls: Array(9).fill("stun:relay"), hasCredential: false }] },
  ])("rejects malformed public configuration %j", (change) => {
    expect(() => parseAsterisk({ ...publicState, ...change })).toThrow("INVALID_CRM_SETTINGS_RESPONSE");
  });
  it("omits unchanged server lists and changed-field-only scalar patches", () => {
    const draft = editableAsterisk(publicState);
    expect(buildAsteriskPatch(publicState, draft)).toEqual({});
    draft.realm = "tenant.example.test";
    expect(buildAsteriskPatch(publicState, draft)).toEqual({ realm: "tenant.example.test" });
  });
  it("requires reentry or explicit clearing when replacing stored credentials", () => {
    const draft = { ...editableAsterisk(publicState), replaceTurnServers: true };
    expect(validate(draft)["turnServers.0.credential"]).toBe(en.crmSettings.credentialDecision);
    draft.turnServers![0].credential = "new-secret";
    expect(validate(draft)).toEqual({});
    expect(buildAsteriskPatch(publicState, draft)).toEqual({ turnServers: [
      { urls: ["turn:relay.example.test"], username: "sales", credential: "new-secret" },
    ] });
    draft.turnServers![0].credential = "";
    draft.turnServers![0].clearCredential = true;
    expect(validate(draft)).toEqual({});
    const patch = buildAsteriskPatch(publicState, draft);
    expect(patch).toEqual({ turnServers: [{ urls: ["turn:relay.example.test"], username: "sales" }] });
    expect(JSON.stringify(patch)).not.toContain("hasCredential");
    expect(JSON.stringify(patch)).not.toContain("clearCredential");
  });
  it("checks edited scalar, server, URL and credential bounds before writing", () => {
    const draft = { ...editableAsterisk(publicState), replaceTurnServers: true, websocketUrl: "https://bad", registerExpires: 12 };
    draft.turnServers![0] = { urls: ["x".repeat(513)], username: "x".repeat(129), hasCredential: true, credential: "x".repeat(257) };
    expect(Object.keys(validate(draft))).toEqual(expect.arrayContaining([
      "websocketUrl", "registerExpires", "turnServers.0.urls", "turnServers.0.username", "turnServers.0.credential",
    ]));
  });
});
