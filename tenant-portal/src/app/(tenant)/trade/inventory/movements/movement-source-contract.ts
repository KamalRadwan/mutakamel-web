import { isUUIDv7 } from "@/lib/uuid";
import { isDecimalString, record } from "../../trade-advanced-validation";
import { invalidResponse } from "../inventory-contract";

// Source entity projections: Trade document.entities.ts sales/purchase headers and lines.
interface MovementSourceLine {
  id: string;
  version: number;
  profileId: string;
  uomId: string;
  label: string;
  quantity: string;
  nodeId: string | null;
}
export interface MovementSource {
  id: string;
  version: number;
  label: string;
  lines: MovementSourceLine[];
  nodeId: string | null;
}

export function parseMovementSource(value: unknown, withLines = false): MovementSource {
  const row = record(value);
  if (!row || !isUUIDv7(row.id) || !Number.isSafeInteger(row.version) || Number(row.version) < 1) invalidResponse();
  const label = typeof row.documentNumber === "string" && row.documentNumber.trim()
    ? row.documentNumber : typeof row.draftReference === "string" ? row.draftReference : "";
  if (!label) invalidResponse();
  if (withLines && !Array.isArray(row.lines)) invalidResponse();
  const lines = Array.isArray(row.lines) ? row.lines.map((value: unknown) => {
    const line = record(value);
    if (!line || !isUUIDv7(line.id) || !isUUIDv7(line.itemCompanyProfileId) ||
      !isUUIDv7(line.uomId) || !Number.isSafeInteger(line.version) || Number(line.version) < 1 ||
      !isDecimalString(line.orderedQuantity)) invalidResponse();
    const description = line.receiptDescriptionSnapshot ?? line.deliveryDescriptionSnapshot ?? line.descriptionSnapshot;
    return {
      id: line.id, version: Number(line.version), profileId: line.itemCompanyProfileId, uomId: line.uomId,
      label: typeof description === "string" ? description : "", quantity: line.orderedQuantity,
      nodeId: isUUIDv7(line.receivingNodeId) ? line.receivingNodeId : null,
    };
  }) : [];
  return { id: row.id, version: Number(row.version), label, lines,
    nodeId: isUUIDv7(row.receivingNodeId) ? row.receivingNodeId : null };
}

export function parseMovementSources(value: unknown) {
  const row = record(value);
  if (!row || !Array.isArray(row.items) || !Number.isSafeInteger(row.total) || Number(row.total) < 0) invalidResponse();
  return { items: row.items.map((item: unknown) => parseMovementSource(item)), total: Number(row.total) };
}
