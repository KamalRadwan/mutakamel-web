// Packing a dashboard's placements back onto the 12-column grid.
//
// `PUT /:id/layout` takes the **complete** visible placement set, validates
// every box against its own visualization's min/max size, and rejects any
// overlap — including overlap with placements the editor cannot see, because
// `DashboardDefinitionsService.updateLayout` runs `assertNoOverlap` over the
// submitted boxes **plus** `unavailablePlacements`.
//
// So reordering cannot just swap two boxes: two widgets of different sizes
// swap into an overlap. Instead the ordered list is repacked first-fit around
// the hidden placements, at each widget's existing width and height — which
// are already inside its constraints, having come from the server.

export interface PlacementBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const GRID_COLUMNS = 12;
/** `@Max(10000)` on `y`; a dashboard is capped at 20 widgets of height ≤ 24. */
const MAX_ROWS = 2000;

function cellKey(x: number, y: number): string {
  return `${x}:${y}`;
}

function occupy(cells: Set<string>, box: Pick<PlacementBox, "x" | "y" | "width" | "height">): void {
  for (let y = box.y; y < box.y + box.height; y += 1) {
    for (let x = box.x; x < box.x + box.width; x += 1) {
      cells.add(cellKey(x, y));
    }
  }
}

function fits(cells: Set<string>, x: number, y: number, width: number, height: number): boolean {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      if (cells.has(cellKey(column, row))) return false;
    }
  }
  return true;
}

/**
 * Lays `ordered` out first-fit, top-left first, around `obstacles`.
 *
 * Width and height are carried through untouched. A widget wider than the
 * grid cannot occur — the server caps `x + width` at 12 on every write — but
 * the clamp is kept so a corrupt row cannot spin the scan.
 */
export function packPlacements(
  ordered: readonly PlacementBox[],
  obstacles: readonly PlacementBox[],
): PlacementBox[] {
  const cells = new Set<string>();
  for (const obstacle of obstacles) occupy(cells, obstacle);

  return ordered.map((placement) => {
    const width = Math.max(1, Math.min(placement.width, GRID_COLUMNS));
    const height = Math.max(1, placement.height);
    for (let y = 0; y < MAX_ROWS; y += 1) {
      for (let x = 0; x <= GRID_COLUMNS - width; x += 1) {
        if (!fits(cells, x, y, width, height)) continue;
        const box = { id: placement.id, x, y, width, height };
        occupy(cells, box);
        return box;
      }
    }
    // Unreachable while the widget cap holds; returning the input unchanged is
    // still better than dropping a placement the server requires to be present.
    return { ...placement, width, height };
  });
}

/** Moves one placement by `offset` positions, or returns null at the ends. */
export function movePlacement(
  ordered: readonly PlacementBox[],
  id: string,
  offset: -1 | 1,
): PlacementBox[] | null {
  const index = ordered.findIndex((placement) => placement.id === id);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= ordered.length) return null;
  const next = [...ordered];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Order as the server renders it: `sort_order`, then y, then x, then id. */
export function orderedBoxes(
  placements: ReadonlyArray<PlacementBox & { sortOrder: number }>,
): PlacementBox[] {
  return [...placements]
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.y - right.y ||
        left.x - right.x ||
        left.id.localeCompare(right.id),
    )
    .map(({ id, x, y, width, height }) => ({ id, x, y, width, height }));
}
