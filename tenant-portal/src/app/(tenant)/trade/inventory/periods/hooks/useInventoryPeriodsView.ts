"use client";
import { useState } from "react";
import type { InventoryPeriod } from "../../inventory-governance-contract";
export function useInventoryPeriodsView(identity: object) {
  const [record, setRecord] = useState<{ identity: object; value: InventoryPeriod } | null>(null);
  return { inspected: record && record.identity === identity ? record.value : null,
    inspect: (value: InventoryPeriod) => setRecord({ identity, value }), close: () => setRecord(null) };
}
