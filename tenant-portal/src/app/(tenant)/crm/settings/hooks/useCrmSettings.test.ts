import { describe, expect, it } from "vitest";
import {
  buildCrmSettingsPatch,
  parseCrmSettingsResponse,
} from "./useCrmSettings";

const settings = {
  id: "01900100-0000-7000-8000-000000000001",
  requireQualifiedStageForConversion: true,
  defaultLeadStageId: null,
  defaultPipelineId: "01900100-0000-7000-8000-000000000002",
  outboundEmailContentRetentionDays: 730,
  outboundEmailRetentionPolicyRevision: 4,
  asteriskIntegration: {
    enabled: false,
    registerExpires: 600,
    sessionTimers: false,
    traceSip: false,
    allowInvalidTlsCertificate: false,
    stunServers: [],
    turnServers: [],
    iceServers: [],
    extra: {},
  },
};

describe("CRM settings API contract", () => {
  it("accepts the raw singleton and keeps only fields rendered by the portal", () => {
    expect(parseCrmSettingsResponse(settings)).toEqual({
      id: settings.id,
      requireQualifiedStageForConversion: true,
      defaultLeadStageId: null,
      defaultPipelineId: settings.defaultPipelineId,
      outboundEmailContentRetentionDays: 730,
      outboundEmailRetentionPolicyRevision: 4,
      asteriskIntegration: {
        enabled: false,
        allowInvalidTlsCertificate: false,
      },
    });
  });

  it("rejects fabricated envelopes and malformed security state", () => {
    expect(() =>
      parseCrmSettingsResponse({ success: true, data: settings }),
    ).toThrow("INVALID_CRM_SETTINGS_RESPONSE");
    expect(() =>
      parseCrmSettingsResponse({
        ...settings,
        asteriskIntegration: {
          ...settings.asteriskIntegration,
          allowInvalidTlsCertificate: "false",
        },
      }),
    ).toThrow("INVALID_CRM_SETTINGS_RESPONSE");
    expect(() =>
      parseCrmSettingsResponse({ ...settings, id: "settings" }),
    ).toThrow("INVALID_CRM_SETTINGS_RESPONSE");
    expect(() =>
      parseCrmSettingsResponse({
        ...settings,
        defaultLeadStageId: "stage-one",
      }),
    ).toThrow("INVALID_CRM_SETTINGS_RESPONSE");
    expect(() =>
      parseCrmSettingsResponse({ ...settings, defaultPipelineId: "pipeline" }),
    ).toThrow("INVALID_CRM_SETTINGS_RESPONSE");
  });

  it("normalizes an omitted optional Asterisk state to secure defaults", () => {
    expect(
      parseCrmSettingsResponse({ ...settings, asteriskIntegration: {} })
        .asteriskIntegration,
    ).toEqual({
      enabled: false,
      allowInvalidTlsCertificate: false,
    });
    expect(
      parseCrmSettingsResponse({
        ...settings,
        asteriskIntegration: undefined,
      }).asteriskIntegration,
    ).toEqual({
      enabled: false,
      allowInvalidTlsCertificate: false,
    });
  });

  it("sends only changed writable fields and enforces retention bounds", () => {
    const parsed = parseCrmSettingsResponse(settings);
    expect(
      buildCrmSettingsPatch(parsed, {
        requireQualifiedStageForConversion: false,
        outboundEmailContentRetentionDays: 730,
      }),
    ).toEqual({ requireQualifiedStageForConversion: false });
    expect(() =>
      buildCrmSettingsPatch(parsed, {
        requireQualifiedStageForConversion: true,
        outboundEmailContentRetentionDays: 29,
      }),
    ).toThrow("CRM_SETTINGS_RETENTION_INVALID");
  });
});
