import { beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { readCorePage } from "@/lib/api/envelope";
import {
  CURRENCY_OPTIONS_MAX_ITEMS,
  CURRENCY_OPTIONS_PATH,
  loadCurrencyOptions,
  parseCurrencyOptionsPage,
  type CurrencyOptionsResult,
} from "./currency-options";
import { WorkspaceInvalidResponseError } from "./workspace-errors";
import {
  WORKSPACE_SETTINGS_PATH,
  WORKSPACE_TRACKED_FIELDS,
  buildWorkspaceSettingsRequest,
  formatTimezoneLiveClock,
  formatTimezoneLongName,
  formatTimezoneOffset,
  formatWorkspaceFieldValue,
  getWorkspaceFieldLabel,
  isWorkspaceSettingsDraftValid,
  parseWorkspaceSettingsResponse,
  toWorkspaceSettingsDraft,
} from "./workspace-settings-contract";

vi.mock("@/lib/api/envelope", () => ({
  readCorePage: vi.fn(),
}));

const settings = {
  id: "01902001-3000-7000-8000-000000000015",
  defaultLanguage: "en",
  defaultCurrencyCode: "USD",
  timezone: "Africa/Cairo",
  allowSupport: true,
  createdAt: "2026-08-25T10:00:00.000Z",
  updatedAt: "2026-08-25T10:05:00.000Z",
};

function makeCode(index: number): string {
  const a = String.fromCharCode(65 + Math.floor(index / 676));
  const b = String.fromCharCode(65 + (Math.floor(index / 26) % 26));
  const c = String.fromCharCode(65 + (index % 26));
  return `${a}${b}${c}`;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Core workspace-settings contract", () => {
  it("uses the canonical Gateway paths without inline query fragments", () => {
    expect(WORKSPACE_SETTINGS_PATH).toBe("/api/tenant/core/v1/workspace-settings");
    expect(CURRENCY_OPTIONS_PATH).toBe("/api/tenant/core/v1/currencies");
    expect(CURRENCY_OPTIONS_MAX_ITEMS).toBe(500);
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
    expect(buildWorkspaceSettingsRequest(parsed, { ...draft, defaultLanguage: "AR" })).toEqual({
      defaultLanguage: "ar",
    });
    expect(
      buildWorkspaceSettingsRequest(parsed, { ...draft, defaultCurrencyCode: "eur" }),
    ).toEqual({ defaultCurrencyCode: "EUR" });
    expect(buildWorkspaceSettingsRequest(parsed, { ...draft, timezone: " UTC " })).toEqual({
      timezone: "UTC",
    });
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

  it("parses canonical { data, meta } currency pages, preserves exact decimals, and rejects legacy or malformed shapes", () => {
    expect(
      parseCurrencyOptionsPage(
        {
          data: [
            {
              code: "EGP",
              name: "Egyptian Pound",
              symbol: " E£ ",
              decimalPlaces: 0,
              exchangeRate: "49.12345678",
            },
            { code: "USD", name: "US Dollar", exchangeRate: "1", status: "ACTIVE" },
          ],
          meta: {
            page: 1,
            limit: 100,
            total: 2,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        },
        1,
      ),
    ).toEqual({
      items: [
        {
          code: "EGP",
          name: "Egyptian Pound",
          symbol: "E£",
          decimalPlaces: 0,
          exchangeRate: "49.12345678",
        },
        { code: "USD", name: "US Dollar", exchangeRate: "1" },
      ],
      page: 1,
      limit: 100,
      total: 2,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });

    expect(
      parseCurrencyOptionsPage({
        data: [],
        meta: {
          page: 1,
          limit: 100,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      }).items,
    ).toEqual([]);

    expect(() =>
      parseCurrencyOptionsPage({
        data: { items: [{ code: "USD", name: "US Dollar" }] },
        meta: {
          page: 1,
          limit: 100,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      }),
    ).toThrow(WorkspaceInvalidResponseError);

    expect(() =>
      parseCurrencyOptionsPage({
        data: [{ code: "USD", name: "US Dollar", decimalPlaces: 9 }],
        meta: {
          page: 1,
          limit: 100,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      }),
    ).toThrow(WorkspaceInvalidResponseError);

    expect(() =>
      parseCurrencyOptionsPage({
        data: [{ code: "USD", name: "US Dollar", exchangeRate: 49.5 }],
        meta: {
          page: 1,
          limit: 100,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      }),
    ).toThrow(WorkspaceInvalidResponseError);

    expect(() =>
      parseCurrencyOptionsPage({
        data: [
          { code: "USD", name: "US Dollar" },
          { code: "USD", name: "Duplicate Dollar" },
        ],
        meta: {
          page: 1,
          limit: 100,
          total: 2,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      }),
    ).toThrow(WorkspaceInvalidResponseError);

    expect(() =>
      parseCurrencyOptionsPage(
        {
          data: [{ code: "USD", name: "US Dollar" }],
          meta: {
            page: 2,
            limit: 100,
            total: 101,
            totalPages: 2,
            hasNext: false,
            hasPrev: true,
          },
        },
        1,
      ),
    ).toThrow(WorkspaceInvalidResponseError);
  });

  it("loads active currencies across multiple canonical pages using buildCoreListQuery", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      code: makeCode(index),
      name: `Currency ${index}`,
    }));
    const secondPage = [{ code: makeCode(100), name: "Currency 100", symbol: "¤" }];

    vi.mocked(readCorePage)
      .mockResolvedValueOnce({
        data: firstPage,
        meta: {
          page: 1,
          limit: 100,
          total: 101,
          totalPages: 2,
          hasNext: true,
          hasPrev: false,
        },
      })
      .mockResolvedValueOnce({
        data: secondPage,
        meta: {
          page: 2,
          limit: 100,
          total: 101,
          totalPages: 2,
          hasNext: false,
          hasPrev: true,
        },
      });

    const controller = new AbortController();
    const loaded: CurrencyOptionsResult = await loadCurrencyOptions(controller.signal);

    expect(loaded.currencies).toHaveLength(101);
    expect(loaded.total).toBe(101);
    expect(loaded.isTruncated).toBe(false);
    expect(loaded.currencies[0]).toEqual({ code: "AAA", name: "Currency 0" });
    expect(loaded.currencies[100]).toEqual({ code: "ADW", name: "Currency 100", symbol: "¤" });
    expect(readCorePage).toHaveBeenCalledTimes(2);
    expect(readCorePage).toHaveBeenNthCalledWith(
      1,
      CURRENCY_OPTIONS_PATH,
      "page=1&limit=100&sortBy=code&sortDir=ASC&status=ACTIVE",
      expect.objectContaining({
        signal: controller.signal,
        cache: "no-store",
        suppressForbiddenToast: true,
      }),
    );
    expect(readCorePage).toHaveBeenNthCalledWith(
      2,
      CURRENCY_OPTIONS_PATH,
      "page=2&limit=100&sortBy=code&sortDir=ASC&status=ACTIVE",
      expect.objectContaining({
        signal: controller.signal,
        cache: "no-store",
        suppressForbiddenToast: true,
      }),
    );
  });

  it("rejects cross-page duplicate currency overlap rather than silently skipping rows", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      code: makeCode(index),
      name: `Currency ${index}`,
    }));
    const overlappingSecondPage = [{ code: makeCode(0), name: "Overlapping Currency 0" }];

    vi.mocked(readCorePage)
      .mockResolvedValueOnce({
        data: firstPage,
        meta: {
          page: 1,
          limit: 100,
          total: 101,
          totalPages: 2,
          hasNext: true,
          hasPrev: false,
        },
      })
      .mockResolvedValueOnce({
        data: overlappingSecondPage,
        meta: {
          page: 2,
          limit: 100,
          total: 101,
          totalPages: 2,
          hasNext: false,
          hasPrev: true,
        },
      });

    await expect(loadCurrencyOptions()).rejects.toBeInstanceOf(WorkspaceInvalidResponseError);
  });

  it("exposes isTruncated=true when capped at 500 with hasNext=true and false when 500 is exact", async () => {
    vi.mocked(readCorePage).mockImplementation(async (_path, query) => {
      const page = Number(new URLSearchParams(query).get("page"));
      const offset = (page - 1) * 100;
      return {
        data: Array.from({ length: 100 }, (_, index) => ({
          code: makeCode(offset + index),
          name: `Currency ${offset + index}`,
        })),
        meta: {
          page,
          limit: 100,
          total: 620,
          totalPages: 7,
          hasNext: page < 7,
          hasPrev: page > 1,
        },
      };
    });

    const truncated = await loadCurrencyOptions();
    expect(truncated.currencies).toHaveLength(500);
    expect(truncated.total).toBe(620);
    expect(truncated.isTruncated).toBe(true);
    expect(readCorePage).toHaveBeenCalledTimes(5);

    vi.clearAllMocks();
    vi.mocked(readCorePage).mockImplementation(async (_path, query) => {
      const page = Number(new URLSearchParams(query).get("page"));
      const offset = (page - 1) * 100;
      return {
        data: Array.from({ length: 100 }, (_, index) => ({
          code: makeCode(offset + index),
          name: `Currency ${offset + index}`,
        })),
        meta: {
          page,
          limit: 100,
          total: 500,
          totalPages: 5,
          hasNext: page < 5,
          hasPrev: page > 1,
        },
      };
    });

    const exact = await loadCurrencyOptions();
    expect(exact.currencies).toHaveLength(500);
    expect(exact.total).toBe(500);
    expect(exact.isTruncated).toBe(false);
    expect(readCorePage).toHaveBeenCalledTimes(5);
  });

  it("localizes workspace field labels and conflict values in English and Arabic", () => {
    const currencies = [{ code: "EGP", name: "Egyptian Pound" }];

    for (const dict of [en, ar]) {
      for (const field of WORKSPACE_TRACKED_FIELDS) {
        const label = getWorkspaceFieldLabel(field, dict);
        expect(label).toBeTruthy();
        expect(label).not.toBe(field);
      }

      expect(formatWorkspaceFieldValue("defaultLanguage", "en", dict, currencies)).toBe(
        dict.coreSettings.languageNames.en,
      );
      expect(formatWorkspaceFieldValue("defaultLanguage", "ar", dict, currencies)).toBe(
        dict.coreSettings.languageNames.ar,
      );
      expect(formatWorkspaceFieldValue("allowSupport", true, dict, currencies)).toBe(
        dict.crmShared.booleanYes,
      );
      expect(formatWorkspaceFieldValue("allowSupport", false, dict, currencies)).toBe(
        dict.crmShared.booleanNo,
      );
      expect(formatWorkspaceFieldValue("defaultCurrencyCode", null, dict, currencies)).toBe(
        dict.audit.valueEmpty,
      );
      expect(formatWorkspaceFieldValue("defaultCurrencyCode", "", dict, currencies)).toBe(
        dict.audit.valueEmpty,
      );
      expect(formatWorkspaceFieldValue("defaultCurrencyCode", "egp", dict, currencies)).toBe(
        "EGP — Egyptian Pound",
      );
      expect(formatWorkspaceFieldValue("defaultCurrencyCode", "SAR", dict, currencies)).toBe(
        "SAR",
      );
    }
  });

  it("formats named IANA timezones deterministically and rejects numeric offsets", () => {
    const sampleDate = new Date("2026-01-15T12:00:00.000Z");

    expect(formatTimezoneOffset("UTC", "en-US", sampleDate)).toBe("UTC+00:00");
    expect(formatTimezoneOffset("Asia/Riyadh", "en-US", sampleDate)).toBe("UTC+03:00");
    expect(formatTimezoneOffset("+02:00", "en-US", sampleDate)).toBeNull();
    expect(formatTimezoneOffset("Invalid/Zone", "en-US", sampleDate)).toBeNull();

    expect(formatTimezoneLongName("UTC", "en-US", sampleDate)).toBeTruthy();
    expect(formatTimezoneLongName("-05:00", "en-US", sampleDate)).toBeNull();

    const live = formatTimezoneLiveClock("UTC", "en-US", sampleDate);
    expect(live).toContain("12:00:00");
    expect(live).toContain("UTC+00:00");
  });

  it("rejects a settings response with a malformed singleton id using WorkspaceInvalidResponseError", () => {
    expect(() => parseWorkspaceSettingsResponse({ ...settings, id: "nope" })).toThrow(
      WorkspaceInvalidResponseError,
    );
  });
});
