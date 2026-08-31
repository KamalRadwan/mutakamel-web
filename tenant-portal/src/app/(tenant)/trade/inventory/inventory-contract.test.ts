import { describe, expect, it } from "vitest";
import {
  INVENTORY_NODES_PATH,
  availabilityPath,
  buildAvailabilityRequest,
  buildCreateNodeRequest,
  buildUpdateNodeRequest,
  inventoryNodePath,
  parseInventoryAvailability,
  parseInventoryNode,
  parseInventoryNodeDetail,
  toNodeForm,
} from "./inventory-contract";
import {
  buildCreatePeriodRequest,
  buildCreateUomConversionRequest,
  buildReasonCode,
  parseInventoryDecision,
  parseInventoryPeriod,
  parseInventoryUomConversion,
  periodActionPath,
  periodsListPath,
  serialsListPath,
  uomConversionActionPath,
} from "./inventory-governance-contract";
import {
  buildOpeningBalanceRequest,
  buildReceiptRequest,
  buildReleaseRequest,
  buildReversalRequest,
  parseMovementId,
  receiptActionPath,
} from "./movements/movements-contract";

const nodeId = "01902001-3000-7000-8000-000000000001";
const itemId = "01902001-3000-7000-8000-000000000002";
const uomId = "01902001-3000-7000-8000-000000000003";
const otherUomId = "01902001-3000-7000-8000-000000000004";
const branchId = "01902001-3000-7000-8000-000000000005";
const profileId = "01902001-3000-7000-8000-000000000006";

describe("Trade inventory contract", () => {
  it("builds canonical paths and refuses a non-UUID id", () => {
    expect(inventoryNodePath(nodeId)).toBe(`${INVENTORY_NODES_PATH}/${nodeId}`);
    expect(periodActionPath(nodeId, "close")).toBe(
      `/api/tenant/trade/v1/inventory/periods/${nodeId}/close`,
    );
    expect(uomConversionActionPath(nodeId, "retire")).toBe(
      `/api/tenant/trade/v1/inventory/uom-conversions/${nodeId}/retire`,
    );
    expect(receiptActionPath(nodeId, "reverse")).toBe(
      `/api/tenant/trade/v1/inventory/receipts/${nodeId}/reverse`,
    );
    expect(() => inventoryNodePath("nope")).toThrow("Invalid Trade inventory response.");
  });

  it("sends limit but never page on a limit-only list", () => {
    // Sending `page` to a limit-only route is a 400 under forbidNonWhitelisted.
    expect(periodsListPath("OPEN")).toBe(
      "/api/tenant/trade/v1/inventory/periods?limit=50&status=OPEN",
    );
    expect(periodsListPath()).not.toContain("page=");
    expect(serialsListPath("ON_HAND", "SN-1")).toBe(
      "/api/tenant/trade/v1/inventory/serials?limit=50&state=ON_HAND&serialKey=SN-1",
    );
  });

  it("requires both node and item on an availability lookup", () => {
    expect(
      availabilityPath({ nodeId, itemId, uomId: "", lotKey: "", serialKey: "" }),
    ).toBe(`/api/tenant/trade/v1/inventory/availability?nodeId=${nodeId}&itemId=${itemId}`);
    expect(() =>
      buildAvailabilityRequest({ nodeId: "", itemId, uomId: "", lotKey: "", serialKey: "" }),
    ).toThrow("INVENTORY_FORM_NODE");
    expect(() =>
      buildAvailabilityRequest({ nodeId, itemId: "x", uomId: "", lotKey: "", serialKey: "" }),
    ).toThrow("INVENTORY_FORM_ITEM");
  });

  it("keeps availability quantities as exact strings", () => {
    const availability = parseInventoryAvailability({
      nodeId,
      itemId,
      uomId,
      onHandQuantity: "12.00000001",
      reservedQuantity: "2.00000000",
      availableQuantity: "10.00000001",
      version: 3,
      asOf: "2026-08-31T00:00:00.000Z",
      advisory: true,
    });
    expect(availability.availableQuantity).toBe("10.00000001");
    expect(availability.advisory).toBe(true);
  });

  it("sends a full branch set on a node update, because the server replaces it", () => {
    const node = parseInventoryNodeDetail({
      id: nodeId,
      code: "WH1",
      name: "Main",
      nodeType: "WAREHOUSE",
      status: "ACTIVE",
      timezone: "Asia/Riyadh",
      version: 4,
      updatedAt: "2026-08-31T00:00:00.000Z",
      branches: [{ branchId, isActive: true }],
    });
    expect(toNodeForm(node).branchIds).toBe(branchId);
    expect(buildUpdateNodeRequest(node, { ...toNodeForm(node), name: "Main 2" })).toEqual({
      name: "Main 2",
    });
    expect(buildUpdateNodeRequest(node, toNodeForm(node))).toEqual({});
  });

  it("refuses a create with no branches, which the DTO requires", () => {
    expect(
      buildCreateNodeRequest({
        code: "WH1",
        name: "Main",
        nodeType: "STORE",
        timezone: "Asia/Riyadh",
        branchIds: branchId,
        status: "ACTIVE",
      }),
    ).toEqual({
      code: "WH1",
      name: "Main",
      nodeType: "STORE",
      timezone: "Asia/Riyadh",
      branchIds: [branchId],
    });
    expect(() =>
      buildCreateNodeRequest({
        code: "WH1",
        name: "Main",
        nodeType: "STORE",
        timezone: "Asia/Riyadh",
        branchIds: "",
        status: "ACTIVE",
      }),
    ).toThrow("INVENTORY_FORM_BRANCHES");
  });

  it("sends a period as plain dates, not timestamps", () => {
    expect(
      buildCreatePeriodRequest({
        code: "aug-2026",
        startsOn: "2026-08-01",
        endsOn: "2026-08-31",
        maxBackdateDays: "7",
      }),
    ).toEqual({
      code: "AUG-2026",
      startsOn: "2026-08-01",
      endsOn: "2026-08-31",
      maxBackdateDays: 7,
    });
    expect(() =>
      buildCreatePeriodRequest({
        code: "AUG",
        startsOn: "2026-08-01T00:00:00Z",
        endsOn: "2026-08-31",
        maxBackdateDays: "0",
      }),
    ).toThrow("INVENTORY_FORM_DATE");
  });

  it("requires a reason CODE, not free text, on a transition", () => {
    expect(buildReasonCode("period_close")).toEqual({ reasonCode: "PERIOD_CLOSE" });
    expect(() => buildReasonCode("closing for month end")).toThrow("INVENTORY_FORM_REASON");
  });

  it("sends conversion factors as positive integer strings", () => {
    expect(
      buildCreateUomConversionRequest({
        itemCompanyProfileId: profileId,
        fromUomId: uomId,
        toUomId: otherUomId,
        factorNumerator: "12",
        factorDenominator: "1",
        effectiveFrom: "2026-08-31T00:00:00.000Z",
      }).factorNumerator,
    ).toBe("12");
    expect(() =>
      buildCreateUomConversionRequest({
        itemCompanyProfileId: profileId,
        fromUomId: uomId,
        toUomId: otherUomId,
        // A decimal is not an integer string and the DTO refuses it.
        factorNumerator: "1.5",
        factorDenominator: "1",
        effectiveFrom: "2026-08-31T00:00:00.000Z",
      }),
    ).toThrow("INVENTORY_FORM_FACTOR");
    expect(() =>
      buildCreateUomConversionRequest({
        itemCompanyProfileId: profileId,
        fromUomId: uomId,
        toUomId: uomId,
        factorNumerator: "1",
        factorDenominator: "1",
        effectiveFrom: "2026-08-31T00:00:00.000Z",
      }),
    ).toThrow("INVENTORY_FORM_UOM");
  });

  it("keeps bigint conversion factors as strings", () => {
    const conversion = parseInventoryUomConversion({
      id: nodeId,
      itemCompanyProfileId: profileId,
      fromUomId: uomId,
      toUomId: otherUomId,
      revisionNumber: 2,
      factorNumerator: "9007199254740993",
      factorDenominator: "1",
      status: "PUBLISHED",
      effectiveFrom: "2026-08-31T00:00:00.000Z",
      version: 1,
    });
    expect(conversion.factorNumerator).toBe("9007199254740993");
  });

  it("reads a period and an inventory decision projection", () => {
    expect(
      parseInventoryPeriod({
        id: nodeId,
        code: "AUG",
        startsOn: "2026-08-01",
        endsOn: "2026-08-31",
        status: "CLOSED",
        maxBackdateDays: 0,
        version: 2,
        closedAt: "2026-08-31T00:00:00.000Z",
        closeReason: "MONTH_END",
      }).closedAt,
    ).toBe("2026-08-31T00:00:00.000Z");

    // safeInventoryDecision sends only outcome, selectedValue and
    // explanationCode out of `result`.
    expect(
      parseInventoryDecision({
        id: nodeId,
        decisionType: "ELIGIBILITY",
        aggregateType: "INVENTORY_RESERVATION",
        aggregateId: itemId,
        result: { outcome: "ALLOW", explanationCode: "OK" },
        explanation: "fine",
        evaluatedAt: "2026-08-31T00:00:00.000Z",
        correlationId: "abc",
      }),
    ).toMatchObject({ outcome: "ALLOW", explanationCode: "OK" });
  });

  it("generates the in-body idempotency token every movement needs", () => {
    const request = buildOpeningBalanceRequest({
      nodeId,
      itemId,
      uomId,
      quantity: "5",
      itemProfileVersion: "1",
      businessEffectiveAt: "2026-08-31T00:00:00.000Z",
    });
    // operationKey is the movement's business identity, separate from the
    // x-idempotency-key header the transport attaches.
    expect(request.operationKey).toMatch(/^[0-9a-f-]{36}$/u);
    expect(request.quantity).toBe("5");
    expect(() =>
      buildOpeningBalanceRequest({
        nodeId,
        itemId,
        uomId,
        quantity: "0",
        itemProfileVersion: "1",
        businessEffectiveAt: "2026-08-31T00:00:00.000Z",
      }),
    ).toThrow("INVENTORY_FORM_QUANTITY");
  });

  it("omits the release quantity for a full release", () => {
    expect(buildReleaseRequest("", "")).toEqual({});
    expect(buildReleaseRequest("2.5", "customer_cancelled")).toEqual({
      quantity: "2.5",
      reasonCode: "CUSTOMER_CANCELLED",
    });
  });

  it("requires both a reason code and an effective date on a reversal", () => {
    expect(buildReversalRequest("damaged", "2026-08-31T00:00:00.000Z")).toEqual({
      reasonCode: "DAMAGED",
      businessEffectiveAt: "2026-08-31T00:00:00.000Z",
    });
    expect(() => buildReversalRequest("damaged", "")).toThrow("INVENTORY_FORM_DATE");
  });

  it("keeps the id a movement create returns, the only handle on it", () => {
    // There is no GET for receipts, deliveries, reservations or opening
    // balances (Q37): losing this id makes the movement unreachable.
    expect(parseMovementId({ id: nodeId })).toBe(nodeId);
    expect(() => parseMovementId({})).toThrow("Invalid Trade inventory response.");
  });

  it("builds a receipt with its purchase-order line key", () => {
    const receipt = buildReceiptRequest({
      nodeId,
      sourceDocumentId: itemId,
      sourceDocumentVersion: "1",
      businessEffectiveAt: "2026-08-31T00:00:00.000Z",
      lines: [{ sourceLineId: uomId, sourceLineVersion: "1", uomId, quantity: "3" }],
    });
    expect(receipt.purchaseOrderId).toBe(itemId);
    expect(receipt.lines[0]).toHaveProperty("purchaseOrderLineId", uomId);
  });

  it("reads a node row without inventing fields", () => {
    expect(
      parseInventoryNode({
        id: nodeId,
        code: "WH1",
        name: "Main",
        nodeType: "VIRTUAL",
        status: "INACTIVE",
        timezone: "UTC",
        version: 0,
        updatedAt: "2026-08-31T00:00:00.000Z",
      }).nodeType,
    ).toBe("VIRTUAL");
    expect(() => parseInventoryNode({ id: nodeId })).toThrow(
      "Invalid Trade inventory response.",
    );
  });
});
