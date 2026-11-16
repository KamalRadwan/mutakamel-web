import { afterEach, describe, expect, it, vi } from "vitest";
import { axiosClient } from "@/lib/api/axiosClient";
import { readCorePage } from "@/lib/api/envelope";
import {
  CORE_MAX_PAGE_LIMIT,
  buildCoreListQuery,
  isMember,
  nullableText,
  nullableUuidV7,
  parseCoreArray,
  parseCorePage,
  parseCorePageMeta,
  record,
  requiredBoolean,
  requiredText,
  requiredTimestamp,
  requiredUuidV7,
} from "./core-page";

const ID_ONE = "01902001-3000-7000-8000-000000000001";
const ID_TWO = "01902001-3000-7000-8000-000000000002";
const CORRELATION_ID = "01902001-3000-7000-8000-000000000099";
const CORE_USERS_PATH = "/api/tenant/core/v1/users" as const;

interface SampleRow {
  id: string;
  code: string;
  parentId: string | null;
  note: string | null;
  isSystem: boolean;
  status: "ACTIVE" | "INACTIVE";
  updatedAt: string;
}

function makeWireRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: ID_ONE,
    code: "ROW-1",
    parentId: null,
    note: null,
    isSystem: false,
    status: "ACTIVE",
    updatedAt: "2026-06-01T10:00:00.000Z",
    ...overrides,
  };
}

function parseSampleRow(value: unknown): SampleRow {
  const row = record(value);
  if (!row || !isMember(["ACTIVE", "INACTIVE"] as const, row.status)) {
    throw new Error("Invalid Core identity response.");
  }
  return {
    id: requiredUuidV7(row, "id"),
    code: requiredText(row, "code", 32),
    parentId: nullableUuidV7(row, "parentId"),
    note: nullableText(row, "note", 120),
    isSystem: requiredBoolean(row, "isSystem"),
    status: row.status,
    updatedAt: requiredTimestamp(row, "updatedAt"),
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

describe("core/contracts/core-page canonical envelope & pager rules", () => {
  it("parses a true Core HTTP paginated envelope across the axiosClient + readCorePage boundary", async () => {
    const query = buildCoreListQuery({
      page: 2,
      search: "  alpha  ",
      sortBy: "code",
      sortDir: "DESC",
      limit: 250,
      filters: { status: "ACTIVE", empty: "", omitted: undefined },
    });
    const spy = stubHttpGet({
      success: true,
      data: [makeWireRow({ id: ID_ONE }), makeWireRow({ id: ID_TWO, code: "ROW-2" })],
      meta: { page: 2, limit: 2, total: 5, totalPages: 3, hasNext: true, hasPrev: true },
      correlationId: CORRELATION_ID,
      timestamp: "2026-06-01T10:00:00.000Z",
    });

    const envelope = await readCorePage(CORE_USERS_PATH, query);
    const page = parseCorePage(envelope, parseSampleRow);

    expect(spy).toHaveBeenCalledWith(
      `${CORE_USERS_PATH}?page=2&limit=${CORE_MAX_PAGE_LIMIT}&sortBy=code&sortDir=DESC&search=alpha&status=ACTIVE`,
      undefined,
    );
    expect(page).toEqual({
      items: [
        expect.objectContaining({ id: ID_ONE, code: "ROW-1" }),
        expect.objectContaining({ id: ID_TWO, code: "ROW-2" }),
      ],
      page: 2,
      limit: 2,
      total: 5,
      totalPages: 3,
      hasNext: true,
      hasPrev: true,
    });
  });

  it("accepts zero-total page 1 and both proven zero-total page 2 hasPrev variants (BaseRepository.envelope and emptyPage)", async () => {
    for (const expectedMeta of [
      { page: 1, limit: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
      // `BaseRepository.envelope` emits `hasPrev: page > 1` (`true`) when `total === 0`.
      { page: 2, limit: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: true },
      // `@mutakamel/database` `emptyPage` emits `hasPrev: false` on empty scopes.
      { page: 2, limit: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
    ]) {
      stubHttpGet({
        success: true,
        data: [],
        meta: expectedMeta,
        correlationId: CORRELATION_ID,
      });
      const envelope = await readCorePage(CORE_USERS_PATH, `page=${expectedMeta.page}&limit=25`);
      expect(parseCorePage(envelope, parseSampleRow)).toEqual({ items: [], ...expectedMeta });
    }
  });

  it("accepts empty out-of-range pages for recovery, rejects non-empty out-of-range pages, and enforces hasPrev invariants", async () => {
    const outOfRangeMeta = { page: 3, limit: 20, total: 25, totalPages: 2, hasNext: false, hasPrev: true };
    stubHttpGet({ success: true, data: [], meta: outOfRangeMeta, correlationId: CORRELATION_ID });

    const emptyOutOfRange = await readCorePage(CORE_USERS_PATH, "page=3&limit=20");
    expect(parseCorePage(emptyOutOfRange, parseSampleRow)).toEqual({ items: [], ...outOfRangeMeta });

    // Final in-range page (`page === totalPages`) with non-empty data remains valid.
    expect(
      parseCorePage(
        {
          data: [makeWireRow()],
          meta: { page: 2, limit: 20, total: 25, totalPages: 2, hasNext: false, hasPrev: true },
        },
        parseSampleRow,
      ).items,
    ).toHaveLength(1);

    // Non-empty out-of-range page (`page > totalPages && itemCount > 0`) is impossible and must fail.
    stubHttpGet({
      success: true,
      data: [makeWireRow()],
      meta: outOfRangeMeta,
      correlationId: CORRELATION_ID,
    });
    const nonEmptyOutOfRange = await readCorePage(CORE_USERS_PATH, "page=3&limit=20");
    expect(() => parseCorePage(nonEmptyOutOfRange, parseSampleRow)).toThrow("Invalid Core identity response.");
    expect(() => parseCorePageMeta(outOfRangeMeta, 1)).toThrow("Invalid Core identity response.");
    expect(() =>
      parseCorePageMeta({ page: 2, limit: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false }, 1),
    ).toThrow("Invalid Core identity response.");

    // Page 1 must NEVER claim `hasPrev: true`, and `total > 0` on `page > 1` must ALWAYS report `hasPrev: true`.
    expect(() =>
      parseCorePageMeta({ page: 1, limit: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: true }, 0),
    ).toThrow("Invalid Core identity response.");
    expect(() =>
      parseCorePageMeta({ page: 1, limit: 25, total: 5, totalPages: 1, hasNext: false, hasPrev: true }, 5),
    ).toThrow("Invalid Core identity response.");
    expect(() =>
      parseCorePageMeta({ page: 2, limit: 2, total: 5, totalPages: 3, hasNext: true, hasPrev: false }, 2),
    ).toThrow("Invalid Core identity response.");
    expect(() =>
      parseCorePageMeta({ page: 3, limit: 20, total: 25, totalPages: 2, hasNext: false, hasPrev: false }, 0),
    ).toThrow("Invalid Core identity response.");
  });

  it("rejects internal repository PaginatedResult mocks that bypass ResponseEnvelopeInterceptor", async () => {
    stubHttpGet({ items: [makeWireRow()], total: 1, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false });
    const envelope = await readCorePage(CORE_USERS_PATH, "page=1&limit=20");
    expect(() => parseCorePage(envelope, parseSampleRow)).toThrow("Invalid Core identity response.");
  });

  it("rejects duplicate item IDs in both parseCorePage and parseCoreArray", () => {
    const duplicateRows = [makeWireRow({ id: ID_ONE }), makeWireRow({ id: ID_ONE, code: "DUP" })];
    expect(() =>
      parseCorePage(
        { data: duplicateRows, meta: { page: 1, limit: 20, total: 2, totalPages: 1, hasNext: false, hasPrev: false } },
        parseSampleRow,
      ),
    ).toThrow("Invalid Core identity response.");
    expect(() => parseCoreArray(duplicateRows, parseSampleRow, 10)).toThrow("Invalid Core identity response.");
    expect(() => parseCoreArray([makeWireRow()], parseSampleRow, 0)).toThrow("Invalid Core identity response.");
  });

  it("rejects malformed data, inconsistent meta derivations, and invalid item primitives", () => {
    const validMeta = { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false };

    expect(() => parseCorePage({ data: null, meta: validMeta }, parseSampleRow)).toThrow();
    expect(() => parseCorePageMeta(null, 0)).toThrow();
    expect(() => parseCorePageMeta([], 0)).toThrow();
    expect(() => parseCorePageMeta(validMeta, -1)).toThrow();
    expect(() => parseCorePageMeta(validMeta, Number.NaN)).toThrow();
    expect(() => parseCorePageMeta({ ...validMeta, page: 0 }, 0)).toThrow();
    expect(() => parseCorePageMeta({ ...validMeta, limit: 0 }, 0)).toThrow();
    expect(() =>
      parseCorePageMeta({ ...validMeta, limit: CORE_MAX_PAGE_LIMIT + 1 }, 1),
    ).toThrow();
    expect(() => parseCorePageMeta({ ...validMeta, total: -1, totalPages: 0 }, 0)).toThrow();
    expect(() => parseCorePageMeta({ ...validMeta, limit: 1, total: 2, totalPages: 2, hasNext: true }, 2)).toThrow();
    expect(() => parseCorePageMeta({ ...validMeta, total: 0, totalPages: 0 }, 1)).toThrow();
    expect(() => parseCorePageMeta({ ...validMeta, page: 2, total: 0, totalPages: 1, hasPrev: false }, 0)).toThrow();
    expect(() => parseCorePageMeta({ ...validMeta, page: 2, total: 0, totalPages: 1, hasPrev: true }, 0)).toThrow();
    expect(() => parseCorePageMeta({ ...validMeta, page: 2, total: 0, totalPages: 0, hasNext: true, hasPrev: false }, 0)).toThrow();
    expect(() => parseCorePageMeta({ ...validMeta, page: 2, total: 0, totalPages: 0, hasNext: true, hasPrev: true }, 0)).toThrow();
    expect(() => parseCorePageMeta({ ...validMeta, page: 2, total: 0, totalPages: 0, hasPrev: true }, 1)).toThrow();
    expect(() => parseCorePageMeta({ ...validMeta, hasNext: true }, 1)).toThrow();
    expect(() => parseCorePageMeta({ ...validMeta, hasPrev: "false" }, 1)).toThrow();

    expect(() =>
      parseSampleRow(makeWireRow({ id: "550e8400-e29b-41d4-a716-446655440000" })),
    ).toThrow();
    expect(() => parseSampleRow(makeWireRow({ parentId: "not-a-uuid" }))).toThrow();
    expect(() => parseSampleRow(makeWireRow({ code: "" }))).toThrow();
    expect(() => parseSampleRow(makeWireRow({ isSystem: "false" }))).toThrow();
    expect(() => parseSampleRow(makeWireRow({ updatedAt: "not-a-date" }))).toThrow();
    expect(parseSampleRow(makeWireRow({ parentId: ID_TWO, note: "" }))).toEqual(
      expect.objectContaining({ parentId: ID_TWO, note: null }),
    );
  });
});
