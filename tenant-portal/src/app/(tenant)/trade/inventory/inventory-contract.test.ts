import { describe, expect, it } from "vitest";
import {
  INVENTORY_NODES_PATH,
  availabilityPath,
  buildAvailabilityRequest,
  buildCreateNodeRequest,
  buildUpdateNodeRequest,
  computeStockComposition,
  inventoryNodePath,
  parseBranchIdsPreview,
  parseInventoryAvailability,
  parseInventoryNode,
  parseInventoryNodeDetail,
  toNodeForm,
} from "./inventory-contract";
import {
  buildCreatePeriodRequest,
  buildCreateUomConversionRequest,
  buildReasonCode,
  computePeriodDays,
  convertQuantityPreview,
  inventoryDecisionPath,
  inventoryDecisionsListPath,
  parseInventoryDecision,
  parseInventoryPeriod,
  parseInventorySerial,
  parseInventorySerialDetail,
  parseInventoryUomConversion,
  periodActionPath,
  periodsListPath,
  serialPath,
  serialsListPath,
  suggestIntegerFraction,
  uomConversionActionPath,
  uomConversionsListPath,
} from "./inventory-governance-contract";
import {
  buildDeliveryRequest,
  buildOpeningBalanceRequest,
  buildReceiptRequest,
  buildReleaseRequest,
  buildReservationRequest,
  buildReversalRequest,
  parseMovementId,
  receiptActionPath,
} from "./movements/movements-contract";
import { inventoryFormMessage, inventoryMessage } from "./inventory-messages";
import { en } from "@/i18n/dictionaries/en";

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
    expect(serialPath(nodeId)).toBe(`/api/tenant/trade/v1/inventory/serials/${nodeId}`);
    expect(inventoryDecisionPath(nodeId)).toBe(
      `/api/tenant/trade/v1/inventory/decisions/${nodeId}`,
    );
    expect(() => inventoryNodePath("nope")).toThrow("Invalid Trade inventory response.");
    expect(() => serialPath("nope")).toThrow("Invalid Trade inventory response.");
    expect(() => inventoryDecisionPath("nope")).toThrow("Invalid Trade inventory response.");
  });

  it("sends limit but never page on a limit-only list", () => {
    // Sending `page` to a limit-only route is a 400 under forbidNonWhitelisted.
    expect(periodsListPath("OPEN")).toBe(
      "/api/tenant/trade/v1/inventory/periods?limit=50&status=OPEN",
    );
    expect(periodsListPath("OPEN", "2026-08-15")).toBe(
      "/api/tenant/trade/v1/inventory/periods?limit=50&status=OPEN&effectiveAt=2026-08-15T00%3A00%3A00.000Z",
    );
    expect(periodsListPath()).not.toContain("page=");
    expect(serialsListPath("ON_HAND", "SN-1")).toBe(
      "/api/tenant/trade/v1/inventory/serials?limit=50&state=ON_HAND&serialKey=SN-1",
    );
    expect(serialsListPath("ON_HAND", "SN-1", { itemId })).toBe(
      `/api/tenant/trade/v1/inventory/serials?limit=50&state=ON_HAND&serialKey=SN-1&itemId=${itemId}`,
    );
    expect(uomConversionsListPath("PUBLISHED", { itemCompanyProfileId: profileId })).toBe(
      `/api/tenant/trade/v1/inventory/uom-conversions?limit=50&status=PUBLISHED&itemCompanyProfileId=${profileId}`,
    );
    expect(inventoryDecisionsListPath("INVENTORY_RESERVATION", nodeId)).toBe(
      `/api/tenant/trade/v1/inventory/decisions?limit=50&policyKind=INVENTORY_RESERVATION&aggregateId=${nodeId}`,
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

  it("keeps availability quantities as exact strings and computes stock composition safely", () => {
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

    const comp = computeStockComposition(availability);
    expect(comp.availablePct).toBeGreaterThan(80);
    expect(comp.reservedPct).toBeGreaterThan(15);

    const zeroComp = computeStockComposition({
      ...availability,
      onHandQuantity: "0.00000000",
      reservedQuantity: "0.00000000",
      availableQuantity: "0.00000000",
    });
    expect(zeroComp).toEqual({
      onHand: 0,
      reserved: 0,
      available: 0,
      availablePct: 0,
      reservedPct: 0,
      health: "depleted",
    });
  });

  it("previews valid and invalid branch UUIDs before node submission", () => {
    const preview = parseBranchIdsPreview(`${branchId}, invalid-uuid, ${branchId}`);
    expect(preview.validIds).toEqual([branchId]);
    expect(preview.invalidEntries).toEqual(["invalid-uuid"]);
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
    expect(
      buildUpdateNodeRequest(node, {
        ...toNodeForm(node),
        branchIds: `${branchId}\n${profileId}`,
        status: "INACTIVE",
      }),
    ).toEqual({
      branchIds: [branchId, profileId],
      status: "INACTIVE",
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
    expect(computePeriodDays("2026-08-01", "2026-08-31")).toBe(31);
    expect(computePeriodDays("2026-08-31", "2026-08-01")).toBeNull();
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

  it("sends conversion factors as positive integer strings and suggests exact fractions", () => {
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
    expect(suggestIntegerFraction("1.5")).toEqual({ numerator: "3", denominator: "2" });
    expect(suggestIntegerFraction("0.125")).toEqual({ numerator: "1", denominator: "8" });
    expect(suggestIntegerFraction("2.4")).toEqual({ numerator: "12", denominator: "5" });
    expect(suggestIntegerFraction("24")).toBeNull();
    expect(suggestIntegerFraction("0")).toBeNull();
    expect(convertQuantityPreview(10, "12", "1")).toBe("120.0000");
    expect(convertQuantityPreview(3, "3", "2")).toBe("4.5000");
    expect(convertQuantityPreview(10, "12", "0")).toBe("0.0000");
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

  it("reads a period, serial unit detail with lifecycle, and an inventory decision projection", () => {
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

    const serialRow = parseInventorySerial({
      id: nodeId,
      itemId,
      itemCompanyProfileId: profileId,
      serialKey: "SN-2026-001",
      state: "ON_HAND",
      currentFulfillmentNodeId: branchId,
      lastTransitionAt: "2026-08-31T00:00:00.000Z",
      version: 1,
    });
    expect(serialRow.serialKey).toBe("SN-2026-001");
    expect(serialRow.state).toBe("ON_HAND");
    expect(serialRow.currentFulfillmentNodeId).toBe(branchId);

    const serialDetail = parseInventorySerialDetail({
      id: nodeId,
      itemId,
      itemCompanyProfileId: profileId,
      serialKey: "SN-2026-001",
      state: "DELIVERED",
      currentFulfillmentNodeId: null,
      lastTransitionAt: "2026-08-31T02:00:00.000Z",
      version: 2,
      lifecycle: [
        {
          id: uomId,
          eventType: "RECEIPT_POSTED",
          occurredAt: "2026-08-31T01:00:00.000Z",
        },
      ],
    });
    expect(serialDetail.lifecycle).toHaveLength(1);
    expect(serialDetail.lifecycle[0].eventType).toBe("RECEIPT_POSTED");

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

  it("generates the in-body idempotency token every movement needs and attaches optional tracking fields", () => {
    const request = buildOpeningBalanceRequest({
      nodeId,
      itemId,
      uomId,
      quantity: "2",
      itemProfileVersion: "1",
      businessEffectiveAt: "2026-08-31T00:00:00.000Z",
      lotKey: "LOT-2026-01",
      serialKeys: "SN-01, SN-02",
      expiresAt: "2027-01-01T00:00:00.000Z",
    });
    // operationKey is the movement's business identity, separate from the
    // x-idempotency-key header the transport attaches.
    expect(request.operationKey).toMatch(/^[0-9a-f-]{36}$/u);
    expect(request.quantity).toBe("2");
    expect(request.tracking).toEqual({
      lotKey: "LOT-2026-01",
      serialKeys: ["SN-01", "SN-02"],
      expiresAt: "2027-01-01T00:00:00.000Z",
    });
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

  it("builds a receipt and delivery with their respective line keys and optional tracking", () => {
    const receipt = buildReceiptRequest({
      nodeId,
      sourceDocumentId: itemId,
      sourceDocumentVersion: "1",
      businessEffectiveAt: "2026-08-31T00:00:00.000Z",
      lines: [
        {
          sourceLineId: uomId,
          sourceLineVersion: "1",
          uomId,
          quantity: "2",
          lotKey: "LOT-R1",
          serialKeys: "SN-R1, SN-R2",
        },
      ],
    });
    expect(receipt.purchaseOrderId).toBe(itemId);
    expect(receipt.lines[0]).toMatchObject({
      purchaseOrderLineId: uomId,
      tracking: {
        lotKey: "LOT-R1",
        serialKeys: ["SN-R1", "SN-R2"],
      },
    });

    const delivery = buildDeliveryRequest({
      nodeId,
      sourceDocumentId: itemId,
      sourceDocumentVersion: "1",
      businessEffectiveAt: "2026-08-31T00:00:00.000Z",
      lines: [
        {
          sourceLineId: uomId,
          sourceLineVersion: "1",
          uomId,
          quantity: "1",
          reservationId: otherUomId,
        },
      ],
    });
    expect(delivery.salesOrderId).toBe(itemId);
    expect(delivery.lines[0]).toMatchObject({
      salesOrderLineId: uomId,
      reservationId: otherUomId,
    });

    const reservation = buildReservationRequest({
      nodeId,
      itemId,
      uomId,
      quantity: "4",
      sourceDocumentId: itemId,
      sourceLineId: uomId,
      sourceDocumentVersion: "1",
      sourceLineVersion: "1",
      expiresAt: "2026-09-01T00:00:00.000Z",
    });
    expect(reservation.expiresAt).toBe("2026-09-01T00:00:00.000Z");
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

  it("maps documented backend and form error codes to localized messages", () => {
    expect(
      inventoryMessage(
        {
          status: 409,
          code: "TRADE.INVENTORY.PERIOD_CLOSED",
          message: "Closed",
        },
        en,
      ),
    ).toBe(en.tradeInventory.errorPeriodClosed);

    expect(
      inventoryMessage(
        {
          status: 409,
          code: "TRADE.CONCURRENCY.STALE_VERSION",
          message: "Stale",
        },
        en,
      ),
    ).toBe(en.tradeCommon.errorStaleVersion);

    expect(inventoryFormMessage(new Error("INVENTORY_FORM_FACTOR"), en)).toBe(
      en.tradeInventory.formFactorInvalid,
    );
    expect(inventoryFormMessage(new Error("INVENTORY_FORM_REASON"), en)).toBe(
      en.tradeInventory.formReasonInvalid,
    );
  });
});


