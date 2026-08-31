import { describe, expect, it } from "vitest";
import {
  WORKSPACE_SETTINGS_PATH,
  buildWorkspaceSettingsRequest,
  isWorkspaceSettingsDraftValid,
  parseWorkspaceSettingsResponse,
  toWorkspaceSettingsDraft,
} from "./workspace-settings-contract";
import { CURRENCY_OPTIONS_PATH, parseCurrencyOptionsResponse } from "./currency-options";

const settings = {
  id: "01902001-3000-7000-8000-000000000015",
  defaultLanguage: "en",
  defaultCurrencyCode: "USD",
  timezone: "Africa/Cairo",
  allowSupport: true,
  createdAt: "2026-08-25T10:00:00.000Z",
  updatedAt: "2026-08-25T10:05:00.000Z",
};

describe("Core workspace-settings contract", () => {
  it("uses the canonical Gateway paths", () => {
    expect(WORKSPACE_SETTINGS_PATH).toBe("/api/tenant/core/v1/workspace-settings");
    expect(CURRENCY_OPTIONS_PATH).toBe(
      "/api/tenant/core/v1/currencies?status=ACTIVE&limit=100&sortBy=code&sortDir=ASC",
    );
  });

  it("treats an absent default currency as null rather than a fabricated code", () => {
    const withoutCurrency: Record<string, unknown> = { ...settings };
    delete withoutCurrency.defaultCurrencyCode;
    expect(parseWorkspaceSettingsResponse(withoutCurrency).defaultCurrencyCode).toBeNull();
    expect(
      parseWorkspaceSettingsResponse({ ...settings, defaultCurrencyCode: null })
        .defaultCurrencyCode,
    ).toBeNull();
  });

  it("sends only what changed, normalised the way the DTO transforms it", () => {
    const parsed = parseWorkspaceSettingsResponse(settings);
    const draft = toWorkspaceSettingsDraft(parsed);

    expect(buildWorkspaceSettingsRequest(parsed, draft)).toEqual({});
    expect(
      buildWorkspaceSettingsRequest(parsed, { ...draft, defaultLanguage: "AR" }),
    ).toEqual({ defaultLanguage: "ar" });
    expect(
      buildWorkspaceSettingsRequest(parsed, { ...draft, defaultCurrencyCode: "eur" }),
    ).toEqual({ defaultCurrencyCode: "EUR" });
    expect(
      buildWorkspaceSettingsRequest(parsed, { ...draft, timezone: " UTC " }),
    ).toEqual({ timezone: "UTC" });
    expect(buildWorkspaceSettingsRequest(parsed, { ...draft, allowSupport: false })).toEqual({
      allowSupport: false,
    });
  });

  it("never sends an empty currency code — the DTO requires exactly three characters", () => {
    const parsed = parseWorkspaceSettingsResponse(settings);
    const draft = toWorkspaceSettingsDraft(parsed);

    expect(buildWorkspaceSettingsRequest(parsed, { ...draft, defaultCurrencyCode: "" })).toEqual(
      {},
    );
  });

  it("blocks a save whose timezone is blank or whose currency is the wrong length", () => {
    const parsed = parseWorkspaceSettingsResponse(settings);
    const draft = toWorkspaceSettingsDraft(parsed);

    expect(isWorkspaceSettingsDraftValid(draft)).toBe(true);
    expect(isWorkspaceSettingsDraftValid({ ...draft, timezone: "   " })).toBe(false);
    expect(isWorkspaceSettingsDraftValid({ ...draft, defaultCurrencyCode: "US" })).toBe(false);
    expect(isWorkspaceSettingsDraftValid({ ...draft, defaultCurrencyCode: "" })).toBe(true);
  });

  it("validates the currency selector projection down to what it renders", () => {
    expect(
      parseCurrencyOptionsResponse({
        items: [{ code: "USD", name: "US Dollar", exchangeRate: "1", status: "ACTIVE" }],
        total: 1,
        page: 1,
        limit: 100,
      }),
    ).toEqual([{ code: "USD", name: "US Dollar" }]);

    expect(() => parseCurrencyOptionsResponse({ items: [{ code: "USD" }] })).toThrow(
      "Invalid Core currencies response.",
    );
  });

  it("rejects a settings response with a malformed singleton id", () => {
    expect(() => parseWorkspaceSettingsResponse({ ...settings, id: "nope" })).toThrow(
      "Invalid Core workspace-settings response.",
    );
  });
});
