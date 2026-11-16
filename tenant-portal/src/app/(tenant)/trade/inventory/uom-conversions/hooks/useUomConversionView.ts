"use client";
import { useState } from "react";
import { convertQuantityPreview, type InventoryUomConversion } from "../../inventory-governance-contract";
export function useUomConversionView(identity: object) {
  const [record, setRecord] = useState<{ identity: object; value: InventoryUomConversion } | null>(null);
  const inspected = record && record.identity === identity ? record.value : null;
  const [quantity, setQuantity] = useState("3");
  const preview = inspected ? convertQuantityPreview(quantity, inspected.factorNumerator, inspected.factorDenominator) : null;
  return { inspected, quantity, setQuantity, preview, inspect: (value: InventoryUomConversion) => { setQuantity("3"); setRecord({ identity, value }); }, close: () => setRecord(null) };
}
