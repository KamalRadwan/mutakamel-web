import { describe, expect, it } from "vitest";
import {
  ACQUISITION_SOURCES_PATH,
  acquisitionSourcePath,
  buildCreateAcquisitionSourceRequest,
  parseAcquisitionSourceResponse,
  parseAcquisitionSourcesResponse,
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
