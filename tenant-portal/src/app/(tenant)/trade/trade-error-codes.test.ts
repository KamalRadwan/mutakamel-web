import { describe, expect, it } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { importMessage } from "./imports/import-contract";
import { inventoryMessage } from "./inventory/inventory-messages";
import { pricingMessage } from "./price-books/pricing-messages";
import { governanceMessage } from "./policies/governance-messages";
import { analyticsMessage, isDashboardPermissionRefusal } from "./dashboards/analytics-contract";
import { extensionMessage } from "./extensions/extension-contract";
import { documentProfileMessage } from "./document-profiles/document-profile-contract";
import { controlTowerMessage } from "./control-tower/control-tower-contract";
import { webhookMessage } from "./webhooks/webhook-contract";

const cases = [
  [importMessage, "TRADE.IMPORT.FILE_TOO_LARGE", 413],
  [importMessage, "TRADE.IMPORT.FILE_TYPE_UNSUPPORTED", 415],
  [importMessage, "TRADE.IMPORT.FILE_SCAN_PENDING", 409],
  [importMessage, "TRADE.IMPORT.FILE_REJECTED", 422],
  [importMessage, "TRADE.IMPORT.MAPPING_NOT_FOUND", 404],
  [inventoryMessage, "TRADE.INVENTORY.NODE_NOT_FOUND", 404],
  [inventoryMessage, "TRADE.INVENTORY.NODE_CONFLICT", 409],
  [inventoryMessage, "TRADE.INVENTORY.SCOPE_NOT_FOUND", 404],
  [inventoryMessage, "TRADE.INVENTORY.PERIOD_CONFLICT", 409],
  [inventoryMessage, "TRADE.INVENTORY.QUANTITY_CONFLICT", 409],
  [inventoryMessage, "TRADE.INVENTORY.ITEM_TRACKING_CONFLICT", 409],
  [inventoryMessage, "TRADE.INVENTORY.RELEASE_NOT_FOUND", 404],
  [inventoryMessage, "TRADE.INVENTORY.RECEIPT_NOT_FOUND", 404],
  [inventoryMessage, "TRADE.INVENTORY.DELIVERY_NOT_FOUND", 404],
  [pricingMessage, "TRADE.PRICE.RULE_SELECTION_INVALID", 422],
  [pricingMessage, "TRADE.PRICE.LOCK_DATA_INVALID", 422],
  [governanceMessage, "TRADE.AUTH.TARGET_INVALID", 422],
  [governanceMessage, "TRADE.POLICY.TEST_CONFLICT", 409],
  [analyticsMessage, "TRADE.DASHBOARD.SCOPE_INVALID", 422],
  [analyticsMessage, "TRADE.DASHBOARD.WIDGET_ACCESS_DENIED", 403],
  [analyticsMessage, "TRADE.DASHBOARD.WIDGET_INVALID", 422],
  [extensionMessage, "TRADE.EXTENSION.DEFINITION_NOT_FOUND", 404],
  [extensionMessage, "TRADE.EXTENSION.DEFINITION_CONFLICT", 409],
  [extensionMessage, "TRADE.EXTENSION.PROFILE_CONFLICT", 409],
  [documentProfileMessage, "TRADE.DOCUMENT_PROFILE.COMPATIBILITY_CHANGED", 409],
  [controlTowerMessage, "TRADE.CONTROL_TOWER.RESOLUTION_CONFLICT", 409],
  [webhookMessage, "TRADE.WEBHOOK.PAYLOAD_INVALID", 422],
] as const;

describe("Trade split error codes", () => {
  it.each(cases)("localizes %s / %s", (messageFor, code, status) => {
    const english = messageFor({ code, status }, en);
    const arabic = messageFor({ code, status }, ar);
    expect(english).toBeTruthy();
    expect(arabic).toBeTruthy();
    expect(arabic).not.toBe(english);
  });

  it("keeps split scope and widget access refusals in the permission state", () => {
    expect(isDashboardPermissionRefusal({ status: 422, code: "TRADE.DASHBOARD.SCOPE_INVALID" })).toBe(true);
    expect(isDashboardPermissionRefusal({ status: 403, code: "TRADE.DASHBOARD.WIDGET_ACCESS_DENIED" })).toBe(true);
  });
});
