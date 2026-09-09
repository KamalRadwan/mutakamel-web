import { generateUUIDv7 } from "@/lib/utils/uuid";
import type { TenantApplicationCandidate, TenantApplicationSelection } from "../types";

export function useTenantApplicationAddons(candidate: TenantApplicationCandidate, selection: TenantApplicationSelection,
  onChange: (patch: Partial<TenantApplicationSelection>) => void) {
  const toggle = (addonId: string, selected: boolean) => {
    const option = candidate.addons.find(item => item.addonId === addonId);
    if (!option || (selected && (option.catalogueReasons.length || !option.compatibleTierIds.includes(selection.tierId)))) return;
    const previous = selection.addons.filter(item => item.addonId !== addonId);
    onChange({ addons: selected ? [...previous, { selectionKey: generateUUIDv7(), addonId, definitionVersionId: option.definitionVersionId, seats: 1 }] : previous });
  };
  const seats = (addonId: string, value: string) => onChange({ addons: selection.addons.map(item => item.addonId === addonId ? { ...item, seats: Number(value) } : item) });
  return { toggle, seats };
}
