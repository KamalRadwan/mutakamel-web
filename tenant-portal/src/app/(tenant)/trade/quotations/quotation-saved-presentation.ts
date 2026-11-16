import { isUUIDv7 } from "@/lib/uuid";
import type { TradeLineDraftState } from "../documents/hooks/useTradeLineDraft";
import { record } from "../documents/trade-document-contract";
import type { TradeItemOption, TradeUomOption } from "../documents/trade-lookup-contract";
import type { QuotationLine } from "./quotation-contract";

export interface QuotationSavedLineDisplay {
  description?: string;
  itemName?: string;
  sku?: string;
  uomCode?: string;
  unavailable?: boolean;
}

export interface QuotationSavedLine {
  line: QuotationLine;
  item: TradeItemOption | null;
  unit: TradeUomOption | null;
  description: string;
  sku: string | null;
  itemName: string | null;
  uomCode: string | null;
  imageItemId: string | null;
  imageId: string | null;
  unavailable: boolean;
}

type QuotationLineWithSnapshots = QuotationLine & {
  itemCompanyProfileId?: unknown;
  itemImageId?: unknown;
  skuSnapshot?: unknown;
  uomCodeSnapshot?: unknown;
  taxSnapshot?: unknown;
};

function boundedSnapshotText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null;
}

function readLineSnapshots(line: QuotationLine) {
  const ext = line as QuotationLineWithSnapshots;
  const tax = record(ext.taxSnapshot);
  return {
    snapshotItemId: isUUIDv7(line.discountSnapshot.itemId) ? line.discountSnapshot.itemId : null,
    snapshotCompanyProfileId: isUUIDv7(ext.itemCompanyProfileId) ? ext.itemCompanyProfileId : null,
    snapshotImageId: isUUIDv7(ext.itemImageId) ? ext.itemImageId : null,
    snapshotSku: boundedSnapshotText(ext.skuSnapshot, 120) ?? boundedSnapshotText(tax?.sku, 120),
    snapshotUomCode: boundedSnapshotText(ext.uomCodeSnapshot, 64) ?? boundedSnapshotText(tax?.uomCode, 64),
  };
}

/** Enrich presentation only; every saved quantity/amount/description stays server-owned. */
export function quotationSavedLines(
  lines: QuotationLine[],
  catalog?: Partial<Pick<TradeLineDraftState, "lines" | "itemsById" | "uomsByItem">>,
  lineDisplayById?: Record<string, QuotationSavedLineDisplay>,
): QuotationSavedLine[] {
  const draftLines = catalog?.lines ?? [];
  const itemsById = catalog?.itemsById ?? {};
  const uomsByItem = catalog?.uomsByItem ?? {};

  const matches = new Map<string, TradeLineDraftState["lines"]>();
  for (const draft of draftLines) {
    matches.set(draft.clientLineId, [...(matches.get(draft.clientLineId) ?? []), draft]);
  }

  return lines.map((line) => {
    const snapshots = readLineSnapshots(line);
    const display = lineDisplayById?.[line.clientLineId];

    const candidates = matches.get(line.clientLineId);
    const uniqueDraft = candidates?.length === 1 ? candidates[0] : null;
    const candidateItemId = snapshots.snapshotItemId ?? (uniqueDraft?.itemId || null);
    const rawItem = candidateItemId ? itemsById[candidateItemId] ?? null : null;
    const idVerifiedItem = rawItem && rawItem.id === candidateItemId ? rawItem : null;

    // Refuse catalogue items whose company profile conflicts with the line's frozen profile.
    const profileMismatch = Boolean(
      idVerifiedItem &&
      snapshots.snapshotCompanyProfileId &&
      idVerifiedItem.eligibility.companyProfileId !== snapshots.snapshotCompanyProfileId,
    );
    const verifiedItem = profileMismatch ? null : idVerifiedItem;

    const unitSourceId = verifiedItem?.id ?? (!profileMismatch ? snapshots.snapshotItemId : null);
    const unit = unitSourceId
      ? uomsByItem[unitSourceId]?.find((candidate) => candidate.id === line.uomId) ?? null
      : null;

    const imageItemId = !profileMismatch ? (snapshots.snapshotItemId ?? verifiedItem?.id ?? null) : null;
    const imageId = imageItemId ? (snapshots.snapshotImageId ?? verifiedItem?.image?.id ?? null) : null;

    return {
      line,
      item: verifiedItem,
      unit,
      description: line.descriptionSnapshot,
      sku: snapshots.snapshotSku ?? boundedSnapshotText(display?.sku, 120) ?? verifiedItem?.canonicalCode ?? null,
      itemName: boundedSnapshotText(display?.itemName, 240),
      uomCode: unit?.code ?? snapshots.snapshotUomCode ?? boundedSnapshotText(display?.uomCode, 64),
      imageItemId,
      imageId,
      unavailable: Boolean(display?.unavailable),
    };
  });
}
