import { describe, expect, it } from "vitest";
import {
  ACQUISITION_SOURCES_PATH,
  ACQUISITION_SOURCE_ICON_MAX_BYTES,
  acquisitionSourceIconPath,
  acquisitionSourcePath,
  buildCreateAcquisitionSourceRequest,
  classifyIconFile,
  moveAcquisitionSourceOrder,
  parseAcquisitionSourceResponse,
  parseAcquisitionSourcesResponse,
  type AcquisitionSource,
} from "./acquisition-source-contract";

const sourceId = "01902001-3000-7000-8000-000000000001";
const source = {
  id: sourceId,
  nameAr: "الموقع الإلكتروني",
  nameEn: "Website",
  isActive: true,
  sortOrder: 10,
  createdAt: "2026-08-25T10:00:00.000Z",
  updatedAt: "2026-08-25T10:05:00.000Z",
  iconUrl: `${ACQUISITION_SOURCES_PATH}/${sourceId}/icon?v=1770000000000`,
};

describe("CRM acquisition-source contract", () => {
  it("uses only the canonical Gateway catalogue and item paths", () => {
    expect(ACQUISITION_SOURCES_PATH).toBe(
      "/api/tenant/crm/v1/acquisition-sources",
    );
    expect(acquisitionSourcePath(sourceId)).toBe(
      `${ACQUISITION_SOURCES_PATH}/${sourceId}`,
    );
    expect(() => acquisitionSourcePath("not-a-uuid")).toThrow(
      "Invalid CRM acquisition-sources response.",
    );
  });

  it("parses the raw ordered CRM projection without fabricated fields", () => {
    const parsed = parseAcquisitionSourcesResponse([
      source,
      {
        ...source,
        id: "01902001-3000-7000-8000-000000000002",
        nameEn: "Facebook",
        sortOrder: 20,
        iconUrl: null,
      },
    ]);

    expect(parsed.map(({ nameEn, sortOrder }) => ({ nameEn, sortOrder }))).toEqual(
      [
        { nameEn: "Website", sortOrder: 10 },
        { nameEn: "Facebook", sortOrder: 20 },
      ],
    );
    expect(Object.keys(parsed[0])).toEqual([
      "id",
      "nameAr",
      "nameEn",
      "isActive",
      "sortOrder",
      "createdAt",
      "updatedAt",
      "iconUrl",
    ]);
  });

  it("rejects envelopes, duplicate catalogue identity, and unsafe icon URLs", () => {
    expect(() =>
      parseAcquisitionSourcesResponse({ success: true, data: [source] }),
    ).toThrow("Invalid CRM acquisition-sources response.");
    expect(() => parseAcquisitionSourcesResponse([source, source])).toThrow(
      "Invalid CRM acquisition-sources response.",
    );
    expect(() =>
      parseAcquisitionSourceResponse({
        ...source,
        iconUrl: "https://storage.example.test/private-key.png",
      }),
    ).toThrow("Invalid CRM acquisition-sources response.");
  });

  it("trims only the two writable names and rejects empty or oversized input", () => {
    expect(
      buildCreateAcquisitionSourceRequest({
        nameAr: "  إحالة  ",
        nameEn: "  Referral  ",
      }),
    ).toEqual({ nameAr: "إحالة", nameEn: "Referral" });
    expect(() =>
      buildCreateAcquisitionSourceRequest({ nameAr: "   ", nameEn: "Referral" }),
    ).toThrow("Acquisition-source names must contain 1-120 characters.");
    expect(() =>
      buildCreateAcquisitionSourceRequest({
        nameAr: "إحالة",
        nameEn: "x".repeat(121),
      }),
    ).toThrow("Acquisition-source names must contain 1-120 characters.");
  });
});

// Task 8.18 — icon upload and reorder.
describe("Acquisition-source icon and reorder contract", () => {
  const source = (id: string, sortOrder: number): AcquisitionSource => ({
    id,
    nameAr: "الموقع",
    nameEn: "Website",
    isActive: true,
    sortOrder,
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-01T09:00:00.000Z",
    iconUrl: null,
  });

  const first = source("01902001-3000-7000-8000-00000000000a", 1);
  const second = source("01902001-3000-7000-8000-00000000000b", 2);
  const third = source("01902001-3000-7000-8000-00000000000c", 3);

  it("builds the COMPLETE ordered id list a reorder replaces the order with", () => {
    // ReorderAcquisitionSourcesDto plus the service's own check require every
    // non-deleted source exactly once — never a single position delta, and
    // never a filtered subset.
    expect(moveAcquisitionSourceOrder([third, first, second], second.id, -1)).toEqual([
      second.id,
      first.id,
      third.id,
    ]);
    expect(moveAcquisitionSourceOrder([first, second, third], first.id, -1)).toBeNull();
    expect(moveAcquisitionSourceOrder([first, second, third], third.id, 1)).toBeNull();
  });

  it("classifies the three icon failures the route answers separately", () => {
    const file = (name: string, type: string, size: number): File =>
      ({ name, type, size }) as File;

    expect(classifyIconFile(file("logo.png", "image/png", 1024))).toBeNull();
    expect(classifyIconFile(file("logo.jpg", "image/jpeg", 1024))).toBeNull();
    expect(classifyIconFile(file("logo.png", "image/png", 0))).toBe("empty");
    expect(
      classifyIconFile(
        file("logo.png", "image/png", ACQUISITION_SOURCE_ICON_MAX_BYTES + 1),
      ),
    ).toBe("tooLarge");
    // 415 — not an allowed bucket MIME.
    expect(classifyIconFile(file("logo.svg", "image/svg+xml", 512))).toBe(
      "unsupportedType",
    );
    // 415 as well, but a different message: the controller checks the
    // extension against the declared type separately.
    expect(classifyIconFile(file("logo.jpeg", "image/png", 512))).toBe(
      "extensionMismatch",
    );
  });

  it("builds the icon path the multipart upload posts to", () => {
    expect(acquisitionSourceIconPath(first.id)).toBe(
      `${ACQUISITION_SOURCES_PATH}/${first.id}/icon`,
    );
  });
});
