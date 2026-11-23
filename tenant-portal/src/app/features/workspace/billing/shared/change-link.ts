import { inject } from '@angular/core';
import { BillingApi } from '../billing.api';

export const CHANGE_PLAN_PATH = '/workspace/billing/subscription/change';

export type ChangePrefill =
  | { kind: 'app'; applicationId: string; tierId: string }
  | { kind: 'tier'; itemId: string; tierId: string }
  | { kind: 'addon'; addonId: string; definitionVersionId: string; parentItemId: string }
  | { kind: 'seats'; itemId: string };

export function changeLink(p: ChangePrefill): { path: string; queryParams: { add: string } } {
  let add: string;
  switch (p.kind) {
    case 'app':
      add = `app:${p.applicationId}:${p.tierId}`;
      break;
    case 'tier':
      add = `tier:${p.itemId}:${p.tierId}`;
      break;
    case 'addon':
      add = `addon:${p.addonId}:${p.definitionVersionId}:${p.parentItemId}`;
      break;
    case 'seats':
      add = `seats:${p.itemId}`;
      break;
  }
  return { path: CHANGE_PLAN_PATH, queryParams: { add } };
}

export function parseChangePrefill(add: string | null): ChangePrefill | null {
  if (!add) return null;
  const parts = add.trim().split(':');
  const kind = parts[0];

  switch (kind) {
    case 'app': {
      if (parts.length !== 3 || !parts[1] || !parts[2]) return null;
      return { kind: 'app', applicationId: parts[1], tierId: parts[2] };
    }
    case 'tier': {
      if ((parts.length !== 2 && parts.length !== 3) || !parts[1]) return null;
      return { kind: 'tier', itemId: parts[1], tierId: parts[2] ?? '' };
    }
    case 'addon': {
      if (parts.length !== 4 || !parts[1] || !parts[2] || !parts[3]) return null;
      return {
        kind: 'addon',
        addonId: parts[1],
        definitionVersionId: parts[2],
        parentItemId: parts[3],
      };
    }
    case 'seats': {
      if (parts.length !== 2 || !parts[1]) return null;
      return { kind: 'seats', itemId: parts[1] };
    }
    default:
      return null;
  }
}

/**
 * Best-effort map from a seat module key to the `?add=seats:<itemId>` query of its subscription item,
 * so the Seats pages can open the change page ready to add seats. Empty when the subscription cannot be read.
 */
export async function loadSeatsChangeQueries(
  api: Pick<BillingApi, 'getSubscription'> = inject(BillingApi),
): Promise<ReadonlyMap<string, { add: string }>> {
  try {
    const view = await api.getSubscription();
    return new Map(
      view.baseItems.map((item) => [item.applicationKey, changeLink({ kind: 'seats', itemId: item.id }).queryParams]),
    );
  } catch {
    return new Map();
  }
}
