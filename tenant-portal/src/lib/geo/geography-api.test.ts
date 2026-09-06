import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGeographyCities, fetchGeographyStates } from "./geography-api";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/axiosClient")>();
  return { ...actual, axiosClient: { ...actual.axiosClient, get } };
});

afterEach(() => get.mockReset());

/** The routes answer through Core's envelope; the reader unwraps `data`. */
function respond(body: unknown) {
  get.mockResolvedValue({ data: { success: true, data: body } });
}

const cairo = { code: "C", name: "Cairo", nativeName: "القاهرة", type: "Governorate" };
const giza = { code: "GZ", name: "Giza", nativeName: null, type: null };

const requestedPath = () => get.mock.calls[0][0] as string;

describe("geography states", () => {
  it("calls the canonical Gateway route with an upper-cased ISO code", async () => {
    respond({ items: [cairo, giza], total: 2, truncated: false });
    await fetchGeographyStates("eg");

    expect(requestedPath()).toBe(
      "/api/tenant/core/v1/public/geography/countries/EG/states?limit=50",
    );
  });

  it("sends the typed query as the server-side search, trimmed", async () => {
    respond({ items: [cairo], total: 1, truncated: false });
    await fetchGeographyStates("EG", { search: "  cai  " });

    expect(requestedPath()).toBe(
      "/api/tenant/core/v1/public/geography/countries/EG/states?limit=50&search=cai",
    );
  });

  it("keeps the optional native name and subdivision type as nulls", async () => {
    respond({ items: [cairo, giza], total: 2, truncated: false });

    await expect(fetchGeographyStates("EG")).resolves.toEqual({
      items: [
        { code: "C", name: "Cairo", nativeName: "القاهرة", type: "Governorate" },
        { code: "GZ", name: "Giza", nativeName: null, type: null },
      ],
      total: 2,
      truncated: false,
    });
  });

  it("treats a country with no subdivisions as an answer, not a failure", async () => {
    // The caller degrades this to a free-text box. Throwing here would make an
    // ordinary country look like a broken catalogue.
    respond({ items: [], total: 0, truncated: false });

    await expect(fetchGeographyStates("VA")).resolves.toEqual({
      items: [],
      total: 0,
      truncated: false,
    });
  });

  it("re-derives `truncated` rather than trusting it", async () => {
    // It is the only thing telling a user their list is partial: a server that
    // got it backwards would present a cut-off catalogue as the whole answer.
    respond({ items: [cairo], total: 27, truncated: false });
    await expect(fetchGeographyStates("EG")).rejects.toThrow(
      "Invalid Core geography response.",
    );

    respond({ items: [cairo, giza], total: 2, truncated: true });
    await expect(fetchGeographyStates("EG")).rejects.toThrow(
      "Invalid Core geography response.",
    );
  });

  it("rejects a page whose total cannot cover the rows it carries", async () => {
    respond({ items: [cairo, giza], total: 1, truncated: false });
    await expect(fetchGeographyStates("EG")).rejects.toThrow(
      "Invalid Core geography response.",
    );
  });

  it("rejects duplicate codes, which would collide as list keys", async () => {
    respond({ items: [cairo, { ...giza, code: "C" }], total: 2, truncated: false });
    await expect(fetchGeographyStates("EG")).rejects.toThrow(
      "Invalid Core geography response.",
    );
  });

  it("rejects a missing name, a bare array, and an unusable country code", async () => {
    respond({ items: [{ code: "C", nativeName: null, type: null }], total: 1, truncated: false });
    await expect(fetchGeographyStates("EG")).rejects.toThrow(
      "Invalid Core geography response.",
    );

    respond([cairo]);
    await expect(fetchGeographyStates("EG")).rejects.toThrow(
      "Invalid Core geography response.",
    );
  });

  it("refuses a country code that is not ISO 3166-1 alpha-2, without a round trip", async () => {
    await expect(fetchGeographyStates("EGY")).rejects.toThrow(
      "Invalid Core geography response.",
    );
    expect(get).not.toHaveBeenCalled();
  });
});

describe("geography cities", () => {
  const nasrCity = { id: 12, name: "Nasr City", nativeName: "مدينة نصر" };

  it("addresses the cities of the subdivision the states call returned", async () => {
    respond({ items: [nasrCity], total: 1, truncated: false });
    await fetchGeographyCities("EG", "C");

    expect(requestedPath()).toBe(
      "/api/tenant/core/v1/public/geography/countries/EG/states/C/cities?limit=50",
    );
  });

  it("reports a partial list so the caller can ask the user to keep typing", async () => {
    respond({ items: [nasrCity], total: 340, truncated: true });

    await expect(fetchGeographyCities("EG", "C", { search: "n" })).resolves.toEqual({
      items: [{ id: 12, name: "Nasr City", nativeName: "مدينة نصر" }],
      total: 340,
      truncated: true,
    });
  });

  it("refuses a subdivision code that would address a different route", async () => {
    // The code goes back out as a PATH SEGMENT, so its shape is pinned rather
    // than escaped.
    await expect(fetchGeographyCities("EG", "../../parties")).rejects.toThrow(
      "Invalid Core geography response.",
    );
    expect(get).not.toHaveBeenCalled();
  });

  it("rejects a city with no usable identity", async () => {
    respond({ items: [{ id: "12", name: "Nasr City", nativeName: null }], total: 1, truncated: false });
    await expect(fetchGeographyCities("EG", "C")).rejects.toThrow(
      "Invalid Core geography response.",
    );
  });
});
