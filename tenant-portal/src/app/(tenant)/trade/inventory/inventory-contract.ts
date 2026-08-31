import type { TradePath } from "@/lib/api/envelope";
import {
  isBoundedInteger,
  isDecimalString,
  isMemberOf,
  isNonEmptyString,
  isTimestamp,
  isUuidV7,
  record,
} from "../trade-advanced-validation";

// Inventory — 26 routes, docs/api/trade-advanced.md#inventory--26-routes.
// Verified against trade-app/src/modules/inventory/{inventory.controller.ts,
// inventory.service.ts,dto/inventory.dto.ts} and
// packages/database/src/entities/tenant/inventory.entities.ts.
//
// S6 CANNOT BE SATISFIED HERE. Trade exposes no capabilities endpoint (Q30),
// so action admission falls back to the permission string plus
// `user.isTenantOwner`. Those two are advisory: `TradePermissionsGuard` matches
// `scope_target` EXACTLY and only `is_tenant_owner` bypasses, so a user holding
// `trade.inventory.nodes.manage` at the wrong target is still refused. The
// server stays authoritative and a refusal renders `PermissionGate`.

const INVENTORY_AVAILABILITY_PATH = "/api/tenant/trade/v1/inventory/availability";
export const INVENTORY_NODES_PATH = "/api/tenant/trade/v1/inventory/nodes";
export const INVENTORY_OPENING_BALANCES_PATH =
  "/api/tenant/trade/v1/inventory/opening-balances";
export const INVENTORY_RESERVATIONS_PATH = "/api/tenant/trade/v1/inventory/reservations";
export const INVENTORY_RECEIPTS_PATH = "/api/tenant/trade/v1/inventory/receipts";
export const INVENTORY_DELIVERIES_PATH = "/api/tenant/trade/v1/inventory/deliveries";

export const INVENTORY_READ_PERMISSION = "trade.inventory.read";
export const INVENTORY_NODES_MANAGE_PERMISSION = "trade.inventory.nodes.manage";
export const INVENTORY_GOVERNANCE_PERMISSION = "trade.inventory.governance.manage";
export const INVENTORY_OPENING_BALANCE_PERMISSION = "trade.inventory.opening_balance";
export const INVENTORY_RESERVE_PERMISSION = "trade.inventory.reserve";
export const INVENTORY_RECEIVE_PERMISSION = "trade.inventory.receive";
export const INVENTORY_DELIVER_PERMISSION = "trade.inventory.deliver";
/** Reversal is a different grant from the movement — `receive` cannot undo. */
export const INVENTORY_ADJUST_PERMISSION = "trade.inventory.adjust";

/** `CreateNodeDto` / `UpdateNodeDto` `@IsIn` lists — not exported enums. */
export const NODE_TYPES = ["WAREHOUSE", "STORE", "VIRTUAL"] as const;
export const NODE_STATUSES = ["ACTIVE", "INACTIVE"] as const;
type NodeType = (typeof NODE_TYPES)[number];
type NodeStatus = (typeof NODE_STATUSES)[number];

export const NODE_CODE_MAX_LENGTH = 80;
export const NODE_NAME_MAX_LENGTH = 160;
export const NODE_TIMEZONE_MAX_LENGTH = 64;
const NODE_BRANCHES_MAX = 100;
const TRACKING_KEY_MAX_LENGTH = 120;
export const REASON_CODE_MAX_LENGTH = 80;

export interface InventoryNode {
  id: string;
  code: string;
  name: string;
  nodeType: string;
  status: string;
  timezone: string;
  version: number;
  updatedAt: string;
}

interface InventoryNodeBranch {
  branchId: string;
  isActive: boolean;
}

export interface InventoryNodeDetail extends InventoryNode {
  branches: InventoryNodeBranch[];
}

/** `AvailabilityQueryDto` answers for **one item at one node**, never a list. */
export interface InventoryAvailability {
  nodeId: string;
  itemId: string;
  uomId: string | null;
  onHandQuantity: string;
  reservedQuantity: string;
  availableQuantity: string;
  version: number;
  asOf: string;
  /**
   * The server sends `advisory: true` on every answer. A balance read is not a
   * reservation: it can be spent between the read and the write, which is why
   * the screen never presents it as a promise.
   */
  advisory: boolean;
}

export interface AvailabilityFormValues {
  nodeId: string;
  itemId: string;
  uomId: string;
  lotKey: string;
  serialKey: string;
}

export const EMPTY_AVAILABILITY_FORM: AvailabilityFormValues = {
  nodeId: "",
  itemId: "",
  uomId: "",
  lotKey: "",
  serialKey: "",
};

export interface NodeFormValues {
  code: string;
  name: string;
  nodeType: NodeType;
  timezone: string;
  branchIds: string;
  status: NodeStatus;
}

export const EMPTY_NODE_FORM: NodeFormValues = {
  code: "",
  name: "",
  nodeType: "WAREHOUSE",
  timezone: "",
  branchIds: "",
  status: "ACTIVE",
};

export interface CreateNodeRequest {
  code: string;
  name: string;
  nodeType: NodeType;
  timezone: string;
  branchIds: string[];
}

export interface UpdateNodeRequest {
  name?: string;
  status?: NodeStatus;
  timezone?: string;
  branchIds?: string[];
}

export function toNodeForm(node: InventoryNodeDetail): NodeFormValues {
  return {
    code: node.code,
    name: node.name,
    nodeType: isMemberOf(node.nodeType, NODE_TYPES) ? node.nodeType : "WAREHOUSE",
    timezone: node.timezone,
    branchIds: node.branches.map((branch) => branch.branchId).join("\n"),
    status: isMemberOf(node.status, NODE_STATUSES) ? node.status : "ACTIVE",
  };
}

export function inventoryNodePath(id: string): TradePath {
  if (!isUuidV7(id)) invalidResponse();
  return `${INVENTORY_NODES_PATH}/${encodeURIComponent(id)}` as TradePath;
}

export function availabilityPath(values: AvailabilityFormValues): TradePath {
  const query = new URLSearchParams({
    nodeId: values.nodeId.trim(),
    itemId: values.itemId.trim(),
  });
  const uomId = values.uomId.trim();
  const lotKey = values.lotKey.trim();
  const serialKey = values.serialKey.trim();
  if (uomId) query.set("uomId", uomId);
  if (lotKey) query.set("lotKey", lotKey);
  if (serialKey) query.set("serialKey", serialKey);
  return `${INVENTORY_AVAILABILITY_PATH}?${query.toString()}` as TradePath;
}

export function buildAvailabilityRequest(values: AvailabilityFormValues): AvailabilityFormValues {
  if (!isUuidV7(values.nodeId.trim())) throw new Error("INVENTORY_FORM_NODE");
  if (!isUuidV7(values.itemId.trim())) throw new Error("INVENTORY_FORM_ITEM");
  if (values.uomId.trim().length > 0 && !isUuidV7(values.uomId.trim())) {
    throw new Error("INVENTORY_FORM_UOM");
  }
  if (values.lotKey.trim().length > TRACKING_KEY_MAX_LENGTH) {
    throw new Error("INVENTORY_FORM_TRACKING");
  }
  if (values.serialKey.trim().length > TRACKING_KEY_MAX_LENGTH) {
    throw new Error("INVENTORY_FORM_TRACKING");
  }
  return values;
}

function parseBranchIds(raw: string): string[] {
  const ids = raw
    .split(/[\s,]+/u)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (ids.length < 1 || ids.length > NODE_BRANCHES_MAX) throw new Error("INVENTORY_FORM_BRANCHES");
  if (!ids.every(isUuidV7)) throw new Error("INVENTORY_FORM_BRANCHES");
  return [...new Set(ids)];
}

export function buildCreateNodeRequest(values: NodeFormValues): CreateNodeRequest {
  const code = values.code.trim();
  const name = values.name.trim();
  const timezone = values.timezone.trim();
  if (code.length === 0 || code.length > NODE_CODE_MAX_LENGTH) throw new Error("INVENTORY_FORM_CODE");
  if (name.length === 0 || name.length > NODE_NAME_MAX_LENGTH) throw new Error("INVENTORY_FORM_NAME");
  if (timezone.length === 0 || timezone.length > NODE_TIMEZONE_MAX_LENGTH) {
    throw new Error("INVENTORY_FORM_TIMEZONE");
  }
  return { code, name, nodeType: values.nodeType, timezone, branchIds: parseBranchIds(values.branchIds) };
}

/**
 * `UpdateNodeDto` is a true partial — every field is optional — so only what
 * changed is sent. `branchIds` is all-or-nothing: the server replaces the
 * whole set, so a partial list would silently unlink the rest.
 */
export function buildUpdateNodeRequest(
  current: InventoryNodeDetail,
  values: NodeFormValues,
): UpdateNodeRequest {
  const request: UpdateNodeRequest = {};
  const name = values.name.trim();
  if (name.length === 0 || name.length > NODE_NAME_MAX_LENGTH) throw new Error("INVENTORY_FORM_NAME");
  if (name !== current.name) request.name = name;

  const timezone = values.timezone.trim();
  if (timezone.length === 0 || timezone.length > NODE_TIMEZONE_MAX_LENGTH) {
    throw new Error("INVENTORY_FORM_TIMEZONE");
  }
  if (timezone !== current.timezone) request.timezone = timezone;

  if (values.status !== current.status) request.status = values.status;

  const branchIds = parseBranchIds(values.branchIds);
  const currentBranchIds = current.branches.map((branch) => branch.branchId);
  if (branchIds.join(",") !== currentBranchIds.join(",")) request.branchIds = branchIds;
  return request;
}

export function parseInventoryNode(payload: unknown): InventoryNode {
  const node = record(payload);
  if (
    !node ||
    !isUuidV7(node.id) ||
    !isNonEmptyString(node.code, NODE_CODE_MAX_LENGTH) ||
    !isNonEmptyString(node.name, NODE_NAME_MAX_LENGTH) ||
    !isNonEmptyString(node.nodeType, 32) ||
    !isNonEmptyString(node.status, 16) ||
    !isNonEmptyString(node.timezone, NODE_TIMEZONE_MAX_LENGTH) ||
    !isBoundedInteger(node.version, 0, Number.MAX_SAFE_INTEGER) ||
    !isTimestamp(node.updatedAt)
  ) {
    invalidResponse();
  }
  return {
    id: node.id,
    code: node.code,
    name: node.name,
    nodeType: node.nodeType,
    status: node.status,
    timezone: node.timezone,
    version: node.version,
    updatedAt: node.updatedAt,
  };
}

export function parseInventoryNodeDetail(payload: unknown): InventoryNodeDetail {
  const node = record(payload);
  if (!node || !Array.isArray(node.branches)) invalidResponse();
  return {
    ...parseInventoryNode(payload),
    branches: node.branches.map((entry) => {
      const branch = record(entry);
      if (!branch || !isUuidV7(branch.branchId) || typeof branch.isActive !== "boolean") {
        invalidResponse();
      }
      return { branchId: branch.branchId, isActive: branch.isActive };
    }),
  };
}

export function parseInventoryAvailability(payload: unknown): InventoryAvailability {
  const row = record(payload);
  if (
    !row ||
    !isUuidV7(row.nodeId) ||
    !isUuidV7(row.itemId) ||
    !isDecimalString(row.onHandQuantity) ||
    !isDecimalString(row.reservedQuantity) ||
    !isDecimalString(row.availableQuantity) ||
    !isBoundedInteger(row.version, 0, Number.MAX_SAFE_INTEGER) ||
    !isTimestamp(row.asOf) ||
    typeof row.advisory !== "boolean" ||
    !(row.uomId === null || isUuidV7(row.uomId))
  ) {
    invalidResponse();
  }
  return {
    nodeId: row.nodeId,
    itemId: row.itemId,
    uomId: (row.uomId as string | null) ?? null,
    onHandQuantity: row.onHandQuantity,
    reservedQuantity: row.reservedQuantity,
    availableQuantity: row.availableQuantity,
    version: row.version,
    asOf: row.asOf,
    advisory: row.advisory,
  };
}

export function invalidResponse(): never {
  throw new Error("Invalid Trade inventory response.");
}
