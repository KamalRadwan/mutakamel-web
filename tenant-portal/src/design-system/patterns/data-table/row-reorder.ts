/**
 * Order math for `DataTable`'s optional row reordering.
 *
 * Pure, and separate from the component, because the refusal below is the part
 * worth testing without a DOM: a catalogue ranks its rows through a dedicated
 * `reorder` endpoint that replaces the WHOLE order in one write, so a drop that
 * would displace a pinned row has to be refused *before* it is sent rather than
 * repaired after the server rejects it.
 */
export function moveRowKey(
  ids: readonly string[],
  from: number,
  to: number,
  isPinned?: (id: string) => boolean,
): string[] | null {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= ids.length ||
    to >= ids.length
  ) {
    return null;
  }

  const next = [...ids];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);

  // One rule covers both halves of pinning: a pinned row may not be dragged,
  // and nothing may be dropped through one. Either shows up here as a pinned
  // id that no longer sits at its original index.
  if (isPinned && ids.some((id, index) => isPinned(id) && next[index] !== id)) {
    return null;
  }
  return next;
}

/**
 * The widths of one row's cells, in render order, measured from the live DOM.
 *
 * A lifted `<tr>` is `position: fixed`: it keeps its own width but loses the
 * table that shared that width out across its cells, so every column re-fits to
 * its content mid-drag unless the measured widths are pinned back on. Taken at
 * lift, which is the one moment `@hello-pangea/dnd` documents for locking
 * dimensions.
 */
export function captureCellWidths(
  body: HTMLTableSectionElement | null,
  rowId: string,
): number[] | null {
  const lifted = Array.from(body?.rows ?? []).find(
    (row) => row.dataset.rowId === rowId,
  );
  if (!lifted) return null;
  return Array.from(lifted.cells).map((cell) => cell.getBoundingClientRect().width);
}
