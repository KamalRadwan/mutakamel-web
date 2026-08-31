/**
 * Page numbers to render between the first/last shortcuts.
 *
 * Keeps `radius` pages either side of the current page, always keeps the first
 * and last page reachable, and collapses each remaining run into a gap marker.
 * The window widens near the ends so the control keeps a stable width instead
 * of shrinking on page 1 and growing in the middle.
 */
export type PageSlot = number | "gap-start" | "gap-end";

export function pageWindow(current: number, totalPages: number, radius = 3): PageSlot[] {
  const total = Math.max(1, Math.trunc(totalPages));
  const page = Math.min(Math.max(1, Math.trunc(current)), total);
  const span = radius * 2 + 1;

  if (total <= span + 2) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  // Shift the window inward at the edges so it always renders `span` numbers.
  let start = Math.max(1, page - radius);
  let end = Math.min(total, page + radius);
  if (end - start + 1 < span) {
    if (start === 1) end = Math.min(total, start + span - 1);
    else start = Math.max(1, end - span + 1);
  }

  const slots: PageSlot[] = [];
  if (start > 1) {
    slots.push(1);
    // A gap standing in for a single page is worse than the page itself: it
    // costs the same width and hides a reachable target.
    if (start === 3) slots.push(2);
    else if (start > 3) slots.push("gap-start");
  }
  for (let n = start; n <= end; n += 1) slots.push(n);
  if (end < total) {
    if (end === total - 2) slots.push(total - 1);
    else if (end < total - 2) slots.push("gap-end");
    slots.push(total);
  }
  return slots;
}
