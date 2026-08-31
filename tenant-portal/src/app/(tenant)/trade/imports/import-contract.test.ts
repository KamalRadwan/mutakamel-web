import { describe, expect, it } from "vitest";
import {
  IMPORTS_PATH,
  IMPORT_EXECUTE_PERMISSION,
  IMPORT_MANAGE_PERMISSION,
  IMPORT_RESULT_STATUSES,
  IMPORT_SOURCE_FIELD_NAME,
  IMPORT_SOURCE_MAX_BYTES,
  buildImportSourceBody,
  buildPreviewRequest,
  importMessage,
  importRunExecutePath,
  importRunResultsPath,
  importRunsListPath,
  importSourceReleasePath,
  parseImportResultsResponse,
  parseImportRun,
  parseImportSourceId,
} from "./import-contract";
import {
  buildCreateImportMappingRequest,
  buildUpdateImportMappingRequest,
  importMappingPath,
  parseImportMappingDetail,
  toMappingFieldDrafts,
} from "../import-mappings/import-mapping-contract";
import { ar } from "@/i18n/dictionaries/ar";

const runId = "01902001-3000-7000-8000-000000000001";
const sourceId = "01902001-3000-7000-8000-000000000002";
const mappingId = "01902001-3000-7000-8000-000000000003";
const versionId = "01902001-3000-7000-8000-000000000004";

describe("Trade imports contract", () => {
  it("splits the two grants the way the controller does", () => {
    // The runs list and detail need `.execute`; the mappings need `.manage`.
    expect(IMPORT_EXECUTE_PERMISSION).toBe("trade.import.execute");
    expect(IMPORT_MANAGE_PERMISSION).toBe("trade.import.manage");
  });

  it("builds canonical run paths", () => {
    expect(importRunsListPath(1, "COMPLETED_WITH_ERRORS")).toBe(
      `${IMPORTS_PATH}?page=1&limit=50&status=COMPLETED_WITH_ERRORS`,
    );
    expect(importRunExecutePath(runId)).toBe(`${IMPORTS_PATH}/${runId}/execute`);
    expect(importRunResultsPath(runId, 2, "FAILED")).toBe(
      `${IMPORTS_PATH}/${runId}/results?page=2&limit=50&status=FAILED`,
    );
    expect(importSourceReleasePath(sourceId)).toBe(
      `/api/tenant/trade/v1/imports/sources/${sourceId}/release`,
    );
  });

  it("sends exactly one multipart part, named file", () => {
    // limits: { files: 1, fields: 0, parts: 1 } — no other form field is legal.
    const body = buildImportSourceBody(new File(["a,b"], "rows.csv", { type: "text/csv" }));
    expect([...body.keys()]).toEqual([IMPORT_SOURCE_FIELD_NAME]);
    expect(IMPORT_SOURCE_MAX_BYTES).toBe(52_428_800);
  });

  it("requires both ids on a preview", () => {
    expect(buildPreviewRequest(mappingId, sourceId)).toEqual({ mappingId, sourceId });
    expect(() => buildPreviewRequest("x", sourceId)).toThrow("IMPORT_FORM_MAPPING");
    expect(() => buildPreviewRequest(mappingId, "x")).toThrow("IMPORT_FORM_SOURCE");
  });

  it("discriminates FILE_UNSAFE on status, because the code cannot", () => {
    // One code, five statuses, six throw sites: only the status separates them.
    const code = "TRADE.IMPORT.FILE_UNSAFE";
    const messages = [400, 409, 413, 415, 422].map(
      (status) => importMessage({ status, code }, ar) ?? "",
    );
    expect(new Set(messages).size).toBe(5);
    expect(importMessage({ status: 413, code }, ar)).toBe(ar.tradeAutomation.errorFileTooLarge);
    expect(importMessage({ status: 415, code }, ar)).toBe(
      ar.tradeAutomation.errorFileWrongType,
    );
  });

  it("separates a missing mapping from an invalid one by status", () => {
    const code = "TRADE.IMPORT.MAPPING_INVALID";
    expect(importMessage({ status: 404, code }, ar)).toBe(
      ar.tradeAutomation.errorMappingNotFound,
    );
    expect(importMessage({ status: 422, code }, ar)).toBe(
      ar.tradeAutomation.errorMappingInvalid,
    );
  });

  it("renders all five row statuses, not just the execute three", () => {
    expect(IMPORT_RESULT_STATUSES).toEqual([
      "VALID",
      "INVALID",
      "SUCCEEDED",
      "FAILED",
      "SKIPPED",
    ]);
  });

  it("reads a run with its partial-success counts", () => {
    const run = parseImportRun({
      id: runId,
      mappingId,
      sourceId,
      mediaType: "text/csv",
      fileSizeBytes: 12,
      mode: "PER_ROW",
      status: "COMPLETED_WITH_ERRORS",
      totalCount: 10,
      validCount: 10,
      invalidCount: 0,
      succeededCount: 8,
      failedCount: 2,
      version: 3,
      createdAt: "2026-08-31T00:00:00.000Z",
      updatedAt: "2026-08-31T00:01:00.000Z",
    });
    expect(run.status).toBe("COMPLETED_WITH_ERRORS");
    expect(run.succeededCount).toBe(8);
    expect(run.failedCount).toBe(2);
  });

  it("reads a result row, whose errorCode is data rather than a status", () => {
    const rows = parseImportResultsResponse({
      items: [
        {
          rowNumber: 4,
          stableRowKey: "k",
          status: "FAILED",
          errorCode: "TRADE.AUTH.TARGET_DENIED",
          errorFieldCode: "branchId",
          completedAt: "2026-08-31T00:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      limit: 50,
    });
    expect(rows.items[0].errorCode).toBe("TRADE.AUTH.TARGET_DENIED");
  });

  it("keeps the source id an upload returns", () => {
    expect(parseImportSourceId({ id: sourceId })).toBe(sourceId);
    expect(() => parseImportSourceId({})).toThrow("Invalid Trade import response.");
  });
});

describe("Trade import mappings contract", () => {
  it("sends targetCode, which is what the DTO calls it", () => {
    // The API page names this `mappingKind`; source declares `targetCode`, and
    // forbidNonWhitelisted would reject the other spelling (Q92).
    const request = buildCreateImportMappingRequest({
      code: "CATALOG_MAP",
      targetCode: "CATALOG_COMPANY_PROFILE",
      scopeTarget: "COMPANY",
      fields: [
        {
          sourceColumnCode: "sku",
          sourceOrdinal: "0",
          targetFieldCode: "itemCode",
          transformCode: "TRIM",
          isRequired: true,
        },
      ],
    });
    expect(request).toHaveProperty("targetCode", "CATALOG_COMPANY_PROFILE");
    expect(request).not.toHaveProperty("mappingKind");
    expect(request.executionMode).toBe("PER_ROW");
  });

  it("replaces the whole field list on an update", () => {
    expect(
      buildUpdateImportMappingRequest([
        {
          sourceColumnCode: "sku",
          sourceOrdinal: "1",
          targetFieldCode: "itemCode",
          transformCode: "IDENTITY",
          isRequired: false,
        },
      ]),
    ).toEqual({
      executionMode: "PER_ROW",
      fields: [
        {
          sourceColumnCode: "sku",
          sourceOrdinal: 1,
          targetFieldCode: "itemCode",
          transformCode: "IDENTITY",
          isRequired: false,
        },
      ],
    });
    expect(() => buildUpdateImportMappingRequest([])).toThrow("IMPORT_MAPPING_FORM_FIELDS");
  });

  it("reads a mapping detail and its versioned field rows", () => {
    expect(importMappingPath(mappingId)).toBe(
      `/api/tenant/trade/v1/import-mappings/${mappingId}`,
    );
    const detail = parseImportMappingDetail({
      id: mappingId,
      code: "CATALOG_MAP",
      targetCode: "CATALOG_BRANCH_ASSIGNMENT",
      scopeTarget: "BRANCH",
      branchId: null,
      status: "ACTIVE",
      version: 2,
      updatedAt: "2026-08-31T00:00:00.000Z",
      versions: [
        {
          id: versionId,
          versionNumber: 1,
          status: "ACTIVE",
          executionMode: "PER_ROW",
          publishedAt: null,
          fields: [
            {
              sourceColumnCode: "sku",
              sourceOrdinal: 0,
              targetFieldCode: "itemCode",
              transformCode: "NORMALIZE_CODE",
              isRequired: true,
            },
          ],
        },
      ],
    });
    expect(toMappingFieldDrafts(detail.versions[0].fields)[0]).toEqual({
      sourceColumnCode: "sku",
      sourceOrdinal: "0",
      targetFieldCode: "itemCode",
      transformCode: "NORMALIZE_CODE",
      isRequired: true,
    });
  });
});
