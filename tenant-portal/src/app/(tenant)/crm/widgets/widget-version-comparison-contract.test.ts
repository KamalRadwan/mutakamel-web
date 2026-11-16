import { describe, expect, it } from "vitest";
import { parseWidgetVersionComparison, verifyWidgetVersionRestore, widgetVersionRestoreBody } from "./widget-version-comparison-contract";

const id = (n: number) => `01900300-0000-7000-8000-${String(n).padStart(12, "0")}`;
const widgetId = id(1);
const actorId = id(2);
const date = "2026-11-10T08:00:00.000Z";
const pair = { leftVersionNumber: 2, rightVersionNumber: 1 };
const version = { name: "Lead conversion", visualizationType: "METRIC_CARD", schemaVersion: 1,
  querySpec: { series: [{ metricKey: "crm.leads.created.count" }] }, displaySpec: {} };
const left = { ...version, versionNumber: 2, publishedAt: date, provenance: "USER_PUBLISH" };
const right = { ...version, versionNumber: 1, visualizationType: "RETIRED_CHART", publishedAt: null, provenance: "EXISTING_DEFINITION_BACKFILL" };
const head = { widgetId, widgetRevision: 7, governanceRevision: 3, activeVersionNumber: 4 };
const response = { ...head, archived: false, left, right, changedSections: ["VISUALIZATION"], restoreState: "AVAILABLE",
  proof: { impactId: id(3), expiresAt: date } };

describe("widget comparison restore contract", () => {
  it("accepts any two ordered historical versions and binds the selected source", () => {
    const review = parseWidgetVersionComparison(response, widgetId, pair);
    expect(widgetVersionRestoreBody(review, 2)).toMatchObject({ ...pair, sourceVersionNumber: 2, expectedWidgetRevision: 7 });
    expect(widgetVersionRestoreBody(review, 1)).toMatchObject({ ...pair, sourceVersionNumber: 1,
      expectedGovernanceRevision: 3, impactId: id(3), acknowledged: true });
    expect(() => widgetVersionRestoreBody(review, 4)).toThrow();
  });

  it("rejects a wrong pair, wrong widget, inconsistent change or a proof for a blocked restore", () => {
    expect(() => parseWidgetVersionComparison(response, id(9), pair)).toThrow();
    expect(() => parseWidgetVersionComparison(response, widgetId, { leftVersionNumber: 1, rightVersionNumber: 2 })).toThrow();
    expect(() => parseWidgetVersionComparison({ ...response, changedSections: [] }, widgetId, pair)).toThrow();
    expect(() => parseWidgetVersionComparison({ ...response, restoreState: "DRAFT_EXISTS" }, widgetId, pair)).toThrow();
    expect(parseWidgetVersionComparison({ ...response, restoreState: "DRAFT_EXISTS", proof: null }, widgetId, pair).proof).toBeNull();
  });

  it("verifies the restored source and current base while preserving an unsupported visualization", () => {
    const review = parseWidgetVersionComparison(response, widgetId, pair);
    const receipt = { ...head, restoredFromVersionNumber: 1, draft: { ...right, draftId: id(4), revision: 1,
      baseVersionNumber: 4, updatedAt: date, updatedByUserId: actorId } };
    expect(verifyWidgetVersionRestore(receipt, review, 1, actorId).draft).toMatchObject({ unsupportedVisualization: "RETIRED_CHART", baseVersionNumber: 4 });
    expect(() => verifyWidgetVersionRestore(receipt, review, 2, actorId)).toThrow();
    expect(() => verifyWidgetVersionRestore({ ...receipt, draft: { ...receipt.draft, baseVersionNumber: 1 } }, review, 1, actorId)).toThrow();
  });
});
