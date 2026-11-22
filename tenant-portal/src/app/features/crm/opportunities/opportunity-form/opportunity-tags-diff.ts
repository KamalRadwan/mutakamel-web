import { attachOpportunityTags, detachOpportunityTag } from '../opportunities.api';

export interface OpportunityTagsDiff {
  attach: string[];
  detach: string[];
}

/** Which tag ids to attach and detach to go from `before` to `after`. Order is kept; duplicates are dropped. */
export function diffOpportunityTags(before: readonly string[], after: readonly string[]): OpportunityTagsDiff {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    attach: [...afterSet].filter((id) => !beforeSet.has(id)),
    detach: [...beforeSet].filter((id) => !afterSet.has(id)),
  };
}

/**
 * Saves tag changes for an existing opportunity. `UpdateOpportunityDto` has no `tagIds`,
 * so hosts call this after the PATCH (or alone, when `toPatchBody` returns null for a
 * tags-only edit). Attach runs first, then each detach. Returns the diff that was applied.
 */
export async function saveTags(
  id: string,
  before: readonly string[],
  after: readonly string[],
): Promise<OpportunityTagsDiff> {
  const diff = diffOpportunityTags(before, after);
  if (diff.attach.length > 0) {
    await attachOpportunityTags(id, diff.attach);
  }
  for (const tagId of diff.detach) {
    await detachOpportunityTag(id, tagId);
  }
  return diff;
}
