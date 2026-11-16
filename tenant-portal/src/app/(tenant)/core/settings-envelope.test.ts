import { afterEach, describe, expect, it, vi } from "vitest";
import { axiosClient } from "@/lib/api/axiosClient";
import { readCorePage } from "@/lib/api/envelope";
import { coreGet } from "./core-api";
import { parseCorePage, parseCorePageMeta } from "./contracts/core-page";
import {
  isActiveStatus,
  isBoundedInteger,
  isDecimalString,
  isNonEmptyString,
  isNullableDecimalString,
  isTimestamp,
  isUnsignedIntegerString,
  isUuidV7,
  record,
  type ActiveStatus,
} from "./core-validation";

const CURRENCY_ID = "01902001-3000-7000-8000-000000000011";
const SEQUENCE_ID = "01902001-3000-7000-8000-000000000022";
const COMPONENT_ID = "01902001-3000-7000-8000-000000000033";
const CORRELATION_ID = "01902001-3000-7000-8000-000000000099";

const CURRENCIES_PATH = "/api/tenant/core/v1/currencies" as const;
const SEQUENCES_PATH = "/api/tenant/core/v1/numbering" as const;
const UPDATES_PATH = "/api/tenant/core/v1/provisioning/updates" as const;

interface WireCurrency {
  id: string;
  code: string;
  exchangeRate: string;
  decimalPlaces: number;
  roundingStep: string | null;
  status: ActiveStatus;
  updatedAt: string;
}

interface WireSequence {
  id: string;
  documentType: string;
  nextValue: string;
  padding: number;
}

function invalidSettings(): never {
  throw new Error("Invalid Core settings response.");
}

function parseWireCurrency(value: unknown): WireCurrency {
  const row = record(value);
  if (
    !row ||
    !isUuidV7(row.id) ||
    !isNonEmptyString(row.code, 3) ||
    !isDecimalString(row.exchangeRate) ||
    !isBoundedInteger(row.decimalPlaces, 0, 8) ||
    !isNullableDecimalString(row.roundingStep) ||
    !isActiveStatus(row.status) ||
    !isTimestamp(row.updatedAt)
  ) {
    invalidSettings();
  }
  return {
    id: row.id,
    code: row.code,
    exchangeRate: row.exchangeRate,
    decimalPlaces: row.decimalPlaces,
    roundingStep: row.roundingStep,
    status: row.status,
    updatedAt: row.updatedAt,
  };
}

function parseWireSequence(value: unknown): WireSequence {
  const row = record(value);
  if (
    !row ||
    !isUuidV7(row.id) ||
    !isNonEmptyString(row.documentType, 64) ||
    !isUnsignedIntegerString(row.nextValue) ||
    !isBoundedInteger(row.padding, 1, 20)
  ) {
    invalidSettings();
  }
  return {
    id: row.id,
    documentType: row.documentType,
    nextValue: row.nextValue,
    padding: row.padding,
  };
}

function stubHttpGet(body: unknown) {
  return vi.spyOn(axiosClient, "get").mockResolvedValue({
    data: body,
    status: 200,
    statusText: "OK",
    headers: new Headers(),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("T01: settings envelope mismatch at the HTTP adapter boundary", () => {
  const wireCurrency = {
    id: CURRENCY_ID,
    code: "EUR",
    exchangeRate: "0.92345678",
    decimalPlaces: 2,
    roundingStep: null,
    status: "ACTIVE",
    updatedAt: "2026-06-01T10:00:00.000Z",
  };

  it("shows coreGet drops meta while canonical readCorePage + parseCorePage accepts only real Core HTTP list envelopes", async () => {
    const wireEnvelope = {
      success: true,
      data: [wireCurrency],
      meta: { page: 1, limit: 20, total: 42, totalPages: 3, hasNext: true, hasPrev: false },
      correlationId: CORRELATION_ID,
      timestamp: "2026-06-01T10:00:00.000Z",
    };
    stubHttpGet(wireEnvelope);

    const response = await coreGet(CURRENCIES_PATH);
    expect(Array.isArray(response.data)).toBe(true);
    expect("meta" in response).toBe(false);

    // `coreGet` discards `meta`, so canonical `parseCorePage` rejects the incomplete envelope.
    expect(() =>
      parseCorePage({ data: response.data, meta: undefined }, parseWireCurrency),
    ).toThrow("Invalid Core identity response.");

    // Internal repository `{ items, total, page, limit }` mocks are rejected at the canonical boundary.
    expect(() =>
      parseCorePage(
        { data: { items: [wireCurrency], total: 42, page: 1, limit: 20 }, meta: undefined },
        parseWireCurrency,
      ),
    ).toThrow("Invalid Core identity response.");

    stubHttpGet(wireEnvelope);
    const canonicalEnvelope = await readCorePage(CURRENCIES_PATH, "page=1&limit=20");
    const parsedPage = parseCorePage(canonicalEnvelope, parseWireCurrency);
    expect(parsedPage.items).toHaveLength(1);
    expect(parsedPage.total).toBe(42);
    expect(parsedPage.totalPages).toBe(3);
    expect(parsedPage.hasNext).toBe(true);
    expect(parsedPage.hasPrev).toBe(false);
  });

  it("shows top-level sibling properties outside data/meta (such as checkedAt) do not survive readCorePage", async () => {
    stubHttpGet({
      success: true,
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
      checkedAt: "2026-06-01T10:00:00.000Z",
      correlationId: CORRELATION_ID,
    });

    const envelope = await readCorePage(UPDATES_PATH, "page=1&limit=20");
    expect(Object.keys(envelope).sort()).toEqual(["data", "meta"]);
    expect("checkedAt" in envelope).toBe(false);
  });
});

describe("T02: canonical readCorePage + core-page + core-validation guards accept true Core wire shapes", () => {
  it("parses paginated currency wire envelopes while preserving exact decimal strings", async () => {
    stubHttpGet({
      success: true,
      data: [
        {
          id: CURRENCY_ID,
          code: "EUR",
          exchangeRate: "0.92345678",
          decimalPlaces: 2,
          roundingStep: "0.0500",
          status: "INACTIVE",
          updatedAt: "2026-06-01T10:00:00.000Z",
        },
      ],
      meta: { page: 2, limit: 20, total: 42, totalPages: 3, hasNext: true, hasPrev: true },
      correlationId: CORRELATION_ID,
      timestamp: "2026-06-01T10:00:00.000Z",
    });

    const envelope = await readCorePage(CURRENCIES_PATH, "page=2&limit=20");
    const page = parseCorePage(envelope, parseWireCurrency);

    expect(page.items[0]?.exchangeRate).toBe("0.92345678");
    expect(page.items[0]?.roundingStep).toBe("0.0500");
    expect(page.total).toBe(42);
    expect(page.totalPages).toBe(3);
    expect(page.hasNext).toBe(true);
    expect(page.hasPrev).toBe(true);
  });

  it("preserves bigint numbering sequence counters past Number.MAX_SAFE_INTEGER as exact strings", async () => {
    const beyondMaxSafeInteger = "9007199254740993";
    stubHttpGet({
      success: true,
      data: [{ id: SEQUENCE_ID, documentType: "INVOICE", nextValue: beyondMaxSafeInteger, padding: 8 }],
      meta: { page: 1, limit: 25, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      correlationId: CORRELATION_ID,
    });

    const envelope = await readCorePage(SEQUENCES_PATH, "page=1&limit=25");
    const page = parseCorePage(envelope, parseWireSequence);

    expect(page.items[0]?.nextValue).toBe(beyondMaxSafeInteger);
  });

  it("validates paginated Core envelopes whose items do not carry an id field via parseCorePageMeta", async () => {
    stubHttpGet({
      success: true,
      data: [{ componentId: COMPONENT_ID, componentKey: "crm.leads", pendingCount: 2 }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      correlationId: CORRELATION_ID,
    });

    const envelope = await readCorePage(UPDATES_PATH, "page=1&limit=20");
    expect(Array.isArray(envelope.data)).toBe(true);
    const items = envelope.data as unknown[];
    expect(parseCorePageMeta(envelope.meta, items.length)).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });

    // Empty out-of-range recovery (`page > totalPages` with `itemCount === 0`), including both `total === 0` `hasPrev` variants.
    expect(
      parseCorePageMeta({ page: 3, limit: 20, total: 25, totalPages: 2, hasNext: false, hasPrev: true }, 0),
    ).toEqual({ page: 3, limit: 20, total: 25, totalPages: 2, hasNext: false, hasPrev: true });
    expect(
      parseCorePageMeta({ page: 2, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false }, 0),
    ).toEqual({ page: 2, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false });
    expect(
      parseCorePageMeta({ page: 2, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: true }, 0),
    ).toEqual({ page: 2, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: true });

    // Non-empty out-of-range (`page > totalPages` with `itemCount > 0`) is rejected.
    expect(() =>
      parseCorePageMeta({ page: 3, limit: 20, total: 25, totalPages: 2, hasNext: false, hasPrev: true }, 1),
    ).toThrow("Invalid Core identity response.");
    expect(() =>
      parseCorePage(
        {
          data: [
            {
              id: CURRENCY_ID,
              code: "EUR",
              exchangeRate: "0.92345678",
              decimalPlaces: 2,
              roundingStep: null,
              status: "ACTIVE",
              updatedAt: "2026-06-01T10:00:00.000Z",
            },
          ],
          meta: { page: 3, limit: 20, total: 25, totalPages: 2, hasNext: false, hasPrev: true },
        },
        parseWireCurrency,
      ),
    ).toThrow("Invalid Core identity response.");

    expect(() =>
      parseCorePageMeta({ page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: true }, 0),
    ).toThrow();
    expect(() =>
      parseCorePageMeta({ page: 2, limit: 20, total: 3, totalPages: 1, hasNext: false, hasPrev: false }, 0),
    ).toThrow();
  });

  it("preserves strict runtime validation across core-validation field guards", () => {
    expect(isUuidV7("550e8400-e29b-41d4-a716-446655440000")).toBe(false);
    expect(isDecimalString(0.92)).toBe(false);
    expect(isDecimalString("14.")).toBe(false);
    expect(isNullableDecimalString(undefined)).toBe(false);
    expect(isUnsignedIntegerString(10)).toBe(false);
    expect(isUnsignedIntegerString("-1")).toBe(false);
    expect(isUnsignedIntegerString("123456789012345678901")).toBe(false);
    expect(isActiveStatus("ARCHIVED")).toBe(false);
    expect(isTimestamp("")).toBe(false);
    expect(() => parseWireCurrency({ id: CURRENCY_ID, code: "EUR", exchangeRate: 0.92 })).toThrow(
      "Invalid Core settings response.",
    );
  });
});
