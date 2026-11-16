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
const MAX_POSITION_ROW = 10000;
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

export interface PlacementSizeBounds { minW: number; maxW: number; minH: number; maxH: number }
export interface PlacementAdjustment { property: "x" | "y" | "width" | "height"; step: -1 | 1 }
export type PlacementGeometry = Omit<PlacementBox, "id">;

function overlaps(a: PlacementBox, b: PlacementBox) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function adjustPlacement(ordered: readonly PlacementBox[], obstacles: readonly PlacementBox[], id: string,
  adjustment: PlacementAdjustment, bounds: PlacementSizeBounds): PlacementBox[] | null {
  const current = ordered.find((box) => box.id === id);
  if (!current) return null;
  const { property, step } = adjustment;
  return placeAtGeometry(ordered, obstacles, id, { ...current, [property]: current[property] + step }, bounds);
}

export function placeAtGeometry(ordered: readonly PlacementBox[], obstacles: readonly PlacementBox[], id: string,
  geometry: PlacementGeometry, bounds: PlacementSizeBounds): PlacementBox[] | null {
  const current = ordered.find((box) => box.id === id);
  if (!current) return null;
  const { x, y, width, height } = geometry;
  const next = { id, x, y, width, height };
  if (![x, y, width, height].every(Number.isSafeInteger)
    || (x === current.x && y === current.y && width === current.width && height === current.height)) return null;
  if (next.x < 0 || next.x + next.width > GRID_COLUMNS || next.y < 0 || next.y > MAX_POSITION_ROW
    || next.width < bounds.minW || next.width > bounds.maxW || next.height < bounds.minH || next.height > bounds.maxH) return null;
  if (ordered.some((box) => box.id !== id && overlaps(next, box)) || obstacles.some((box) => overlaps(next, box))) return null;
  return ordered.map((box) => box.id === id ? next : box);
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
