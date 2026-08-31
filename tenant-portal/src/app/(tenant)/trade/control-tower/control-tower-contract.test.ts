import { describe, expect, it } from "vitest";
import {
  CONTROL_TOWER_EXCEPTIONS_PATH,
  EXCEPTION_SEVERITY_FILTERS,
  EXCEPTION_STATUSES,
  RESOLUTION_CODES,
  RETRYABLE_RETRY_CLASSES,
  buildResolveExceptionRequest,
  buildRetryExceptionRequest,
  controlTowerActionPath,
  controlTowerListPath,
  parseControlTowerExceptionDetail,
  parseControlTowerExceptionsResponse,
} from "./control-tower-contract";

const exceptionId = "01902001-3000-7000-8000-000000000001";
const attemptId = "01902001-3000-7000-8000-000000000002";
const sourceId = "01902001-3000-7000-8000-000000000003";
const correlationId = "01902001-3000-7000-8000-000000000004";

describe("Trade control tower contract", () => {
  it("builds canonical paths", () => {
    expect(controlTowerListPath(1, "OPEN", "HIGH", "PDF")).toBe(
      `${CONTROL_TOWER_EXCEPTIONS_PATH}?page=1&limit=25&status=OPEN&severity=HIGH&category=PDF`,
    );
    expect(controlTowerActionPath(exceptionId, "resolve")).toBe(
      `${CONTROL_TOWER_EXCEPTIONS_PATH}/${exceptionId}/resolve`,
    );
  });

  it("builds the severity filter from the query DTO, not from ExceptionSeverity", () => {
    // The DTO accepts LOW/MEDIUM/HIGH/CRITICAL; the exported enum is
    // INFO/WARNING/HIGH/CRITICAL. Filtering by INFO or WARNING is a 400.
    expect(EXCEPTION_SEVERITY_FILTERS).toEqual(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
    expect(EXCEPTION_SEVERITY_FILTERS).not.toContain("INFO");
    expect(EXCEPTION_SEVERITY_FILTERS).not.toContain("WARNING");
  });

  it("keeps all six exception statuses", () => {
    expect(EXCEPTION_STATUSES).toHaveLength(6);
    expect(EXCEPTION_STATUSES).toContain("RECONCILIATION_PENDING");
    expect(EXCEPTION_STATUSES).toContain("QUARANTINED");
  });

  it("offers a retry only for the values known to be retryable", () => {
    expect(RETRYABLE_RETRY_CLASSES).toEqual(["TRANSIENT", "AFTER_REFRESH"]);
  });

  it("omits an empty retry reason and requires one on a resolve", () => {
    expect(buildRetryExceptionRequest("")).toEqual({});
    expect(buildRetryExceptionRequest("upstream recovered")).toEqual({
      reason: "upstream recovered",
    });
    // ResolveExceptionDto needs resolutionCode, reason AND evidence.
    expect(buildResolveExceptionRequest("SOURCE_CORRECTED", "fixed", "")).toEqual({
      resolutionCode: "SOURCE_CORRECTED",
      reason: "fixed",
      evidence: {},
    });
    expect(() => buildResolveExceptionRequest("SOURCE_CORRECTED", "", "{}")).toThrow(
      "CONTROL_TOWER_FORM_REASON",
    );
    expect(() => buildResolveExceptionRequest("SOURCE_CORRECTED", "fixed", "[]")).toThrow(
      "CONTROL_TOWER_FORM_EVIDENCE",
    );
    expect(RESOLUTION_CODES).toEqual(["SOURCE_CORRECTED", "OWNER_RESULT_APPLIED"]);
  });

  it("renders an unmapped severity as itself rather than dropping it", () => {
    const page = parseControlTowerExceptionsResponse({
      items: [
        {
          id: exceptionId,
          sourceOwner: "worker-app",
          sourceType: "PDF_RENDER",
          sourceId,
          category: "RENDER",
          // Neither the filter list nor the enum contains this; it must survive.
          severity: "INFO",
          status: "OPEN",
          retryClass: "PERMANENT_SOURCE_CORRECTION",
          safeErrorCode: "RENDER_FAILED",
          correlationId,
          resolvedAt: null,
          version: 1,
          updatedAt: "2026-08-31T00:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      limit: 25,
    });
    expect(page.items[0].severity).toBe("INFO");
    expect(page.items[0].retryClass).toBe("PERMANENT_SOURCE_CORRECTION");
  });

  it("reads the detail with its integration attempts and asOf stamp", () => {
    const detail = parseControlTowerExceptionDetail({
      id: exceptionId,
      sourceOwner: "worker-app",
      sourceType: "PDF_RENDER",
      sourceId,
      category: "RENDER",
      severity: "HIGH",
      status: "ACTION_PENDING",
      retryClass: "TRANSIENT",
      safeErrorCode: "RENDER_FAILED",
      correlationId,
      resolvedAt: null,
      version: 2,
      updatedAt: "2026-08-31T00:00:00.000Z",
      asOf: "2026-08-31T00:00:05.000Z",
      attempts: [
        {
          id: attemptId,
          ownerCode: "worker-app",
          status: "RETRYING",
          retryClass: "TRANSIENT",
          attemptCount: 2,
          nextAttemptAt: null,
          lastErrorCode: "TIMEOUT",
          updatedAt: "2026-08-31T00:00:00.000Z",
        },
      ],
    });
    expect(detail.attempts[0].attemptCount).toBe(2);
    expect(detail.asOf).toBe("2026-08-31T00:00:05.000Z");
  });
});
