export interface ReplacementItem {
  id: string;
  /** Already translated / already the display name. */
  label: string;
  /** A second line — a role's scope, a team's branch. */
  hint?: string;
}

export interface ReplacementDiff {
  added: ReplacementItem[];
  removed: ReplacementItem[];
  unchanged: ReplacementItem[];
}

/**
 * The diff behind a full-replacement `PUT`.
 *
 * These endpoints take the **whole** collection and replace it atomically —
 * team memberships (4.15) and scope-role assignments (4.21). The request body
 * says nothing about what is being taken away, so a user who edits a list of
 * eight and submits has no way to see that they just removed three
 * assignments. This function is what makes the removal visible before the
 * write, not after it.
 *
 * `current` is what the server last returned; `next` is what the form holds.
 * Identity is `id`, never label — two records may share a display name.
 */
export function computeReplacementDiff(
  current: ReplacementItem[],
  next: ReplacementItem[],
): ReplacementDiff {
  const currentIds = new Set(current.map((item) => item.id));
  const nextIds = new Set(next.map((item) => item.id));

  return {
    added: next.filter((item) => !currentIds.has(item.id)),
    // Taken from `current`, not `next`: a removed item is by definition absent
    // from `next`, so its label has to come from the server's copy.
    removed: current.filter((item) => !nextIds.has(item.id)),
    unchanged: next.filter((item) => currentIds.has(item.id)),
  };
}

export function isEmptyDiff(diff: ReplacementDiff): boolean {
  return diff.added.length === 0 && diff.removed.length === 0;
}
