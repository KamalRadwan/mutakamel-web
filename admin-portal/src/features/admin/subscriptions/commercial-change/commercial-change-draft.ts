import { generateUUIDv7 } from "@/lib/utils/uuid";
import type { SubscriptionCommercial } from "@/features/admin/tenant-workspace/billing/model/subscription-commercial";
import { readCommercialPreparationRequest, type CommercialChange } from "./commercial-change-request";

export type AddonTarget = { selectionKey: string; id?: string; addonId: string; name: string; definitionVersionId: string; seats: number; removed: boolean };
export type ApplicationTarget = { selectionKey: string; id?: string; applicationId: string; key: string; name: string; tierId: string; tierName: string; seats: number; removed: boolean; addons: AddonTarget[] };
export function initialCommercialTargets(source: SubscriptionCommercial): ApplicationTarget[] {
  return source.baseItems.map(item => ({ selectionKey: generateUUIDv7(), id: item.id, applicationId: item.applicationId, key: item.applicationKey,
    name: item.applicationName ?? item.applicationKey, tierId: item.tierId, tierName: item.tierName ?? item.tierKey, seats: item.seats, removed: false,
    addons: source.addonSelections.filter(addon => addon.parentItemId === item.id).map(addon => ({ selectionKey: generateUUIDv7(), id: addon.id,
      addonId: addon.addonId, name: addon.addonKey, definitionVersionId: addon.definitionVersionId, seats: addon.seats, removed: false })) }));
}
export function commercialDraftRequest(source: SubscriptionCommercial, targets: ApplicationTarget[]) {
  const changes: CommercialChange[] = [];
  const active = targets.filter(item => !item.removed);
  if (!active.length || active.length > 100 || new Set(active.map(item => item.applicationId)).size !== active.length) return null;
  for (const target of targets) {
    const before = source.baseItems.find(item => item.id === target.id);
    if (target.removed) {
      if (before) changes.push({ selectionKey: target.selectionKey, sourceKind: "APPLICATION", operation: "REMOVE", itemId: before.id });
    } else if (!before) {
      changes.push({ selectionKey: target.selectionKey, sourceKind: "APPLICATION", operation: "ADD", applicationId: target.applicationId, tierId: target.tierId, seats: target.seats });
    } else if (target.seats !== before.seats || target.tierId !== before.tierId) {
      changes.push({ selectionKey: target.selectionKey, sourceKind: "APPLICATION", operation: "CHANGE", itemId: before.id, tierId: target.tierId, seats: target.seats });
    }
    for (const addon of target.addons) {
      const previous = source.addonSelections.find(item => item.id === addon.id);
      if (target.removed || addon.removed) {
        if (previous) changes.push({ selectionKey: addon.selectionKey, sourceKind: "ADDON", operation: "REMOVE", addonSelectionId: previous.id });
      } else {
        if (addon.seats > target.seats) return null;
        if (!previous) changes.push({ selectionKey: addon.selectionKey, sourceKind: "ADDON", operation: "ADD", addonId: addon.addonId,
          targetDefinitionVersionId: addon.definitionVersionId, seats: addon.seats,
          ...(before ? { parentItemId: before.id } : { parentSelectionKey: target.selectionKey }) });
        else if (addon.seats !== previous.seats) changes.push({ selectionKey: addon.selectionKey, sourceKind: "ADDON", operation: "CHANGE", addonSelectionId: previous.id, seats: addon.seats });
      }
    }
  }
  try { return readCommercialPreparationRequest({ expectedSubscriptionRevision: source.subscriptionRevision, changes }); } catch { return null; }
}
