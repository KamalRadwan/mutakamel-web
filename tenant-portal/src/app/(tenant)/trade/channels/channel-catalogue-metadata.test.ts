import { describe, expect, it } from "vitest";
import { CHANNEL_TYPES, type Channel } from "./channel-contract";
import {
  CHANNEL_STARTER_TEMPLATES,
  CHANNEL_TYPE_PALETTES,
  buildDuplicateChannelCodeSuggestions,
  evaluateChannelFormReadiness,
  sanitizeChannelCodeInput,
} from "./channel-catalogue-metadata";

const SAMPLE_CHANNEL: Channel = {
  id: "01890a5d-ac96-774b-bcce-b302099a8057",
  companyId: "01890a5d-ac96-774b-bcce-b302099a8058",
  code: "POS-CAIRO-MAIN",
  name: "Cairo Flagship POS",
  channelType: "POS",
  status: "ACTIVE",
  configurationProfileVersionId: null,
  version: 1,
  updatedAt: "2026-10-16T08:00:00.000Z",
};

describe("channel-catalogue-metadata", () => {
  it("defines colorful palettes for all 7 ChannelType enum values", () => {
    for (const type of CHANNEL_TYPES) {
      expect(CHANNEL_TYPE_PALETTES[type]).toBeDefined();
      expect(CHANNEL_TYPE_PALETTES[type].type).toBe(type);
      expect(CHANNEL_TYPE_PALETTES[type].labelEn.length).toBeGreaterThan(0);
      expect(CHANNEL_TYPE_PALETTES[type].labelAr.length).toBeGreaterThan(0);
    }
  });

  it("provides starter templates covering all 7 channel types", () => {
    expect(CHANNEL_STARTER_TEMPLATES.length).toBe(7);
  });

  it("sanitizes channel code inputs to uppercase and valid characters", () => {
    expect(sanitizeChannelCodeInput("  pos cairo 01!")).toBe("POS-CAIRO-01");
  });

  it("generates non-colliding duplicate code suggestions", () => {
    const suggestions = buildDuplicateChannelCodeSuggestions("POS-CAIRO-MAIN", [
      SAMPLE_CHANNEL,
    ]);
    expect(suggestions.length).toBe(3);
    expect(suggestions).not.toContain("POS-CAIRO-MAIN");
  });

  it("evaluates form readiness and detects duplicate channel codes", () => {
    const duplicateCheck = evaluateChannelFormReadiness(
      {
        code: "POS-CAIRO-MAIN",
        name: "Another POS",
        channelType: "POS",
        status: "ACTIVE",
      },
      [SAMPLE_CHANNEL],
    );
    expect(duplicateCheck.codeValid).toBe(true);
    expect(duplicateCheck.codeUnique).toBe(false);
    expect(duplicateCheck.allReady).toBe(false);

    const uniqueCheck = evaluateChannelFormReadiness(
      {
        code: "ECOM-WEB-01",
        name: "Web Storefront",
        channelType: "ECOMMERCE",
        status: "ACTIVE",
      },
      [SAMPLE_CHANNEL],
    );
    expect(uniqueCheck.allReady).toBe(true);
  });
});
