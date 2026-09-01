// @vitest-environment jsdom

/**
 * Task 2.8 — board columns window themselves above 50 cards.
 *
 * **What these prove:** the threshold is a real switch; a long column mounts a
 * window rather than its whole list; every mounted `Draggable` carries its
 * ABSOLUTE index; the droppable's identity survives being handed to
 * react-window's own scroll container; neither of virtual mode's two
 * invariants is tripped; scrolling mounts cards that were outside the first
 * window; the "Move to…" menu from 2.7 still works inside a windowed column;
 * and the rows' inline offset mirrors with the document direction.
 *
 * **What they do not prove, and cannot:** that a drag works. jsdom has no
 * layout, so every box `@hello-pangea/dnd` measures is 0×0 and no sensor can
 * produce a meaningful drag. A real 200-card drag in a browser — mouse and
 * keyboard, both directions, both languages — is what closes 2.8, and
 * `DECISIONS.md#d9--virtualization--assumed-split-by-surface-on-2026-08-31`
 * records that it has not been performed. See also virtual-dnd.probe.test.tsx,
 * which proves the same composition one layer down.
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BoardView, type BoardViewLabels } from "./BoardView";
import { ESTIMATED_ROW_PX, OVERSCAN_ROWS, UNMEASURED_VIEWPORT_PX, VIRTUALIZE_ABOVE } from "./useColumnWindow";
import type { BoardColumnDef } from "./types";

afterEach(cleanup);

interface Lead {
  id: string;
  name: string;
  stageId: string;
}

const LONG_COLUMN = 200;

const columns: BoardColumnDef[] = [
  { id: "new", label: "New", count: LONG_COLUMN },
  { id: "qualified", label: "Qualified", count: 0 },
];

const labels: BoardViewLabels = {
  retry: "Retry",
  errorTitle: "Could not load",
  emptyTitle: "No results",
  selectAll: "Select all",
  selectRow: "Select this item",
  sortAscending: "Sort ascending",
  sortDescending: "Sort descending",
  notSorted: "Not sorted",
  emptyColumn: "Drop here",
  moveTo: "Move to",
  pagination: { previous: "Previous", next: "Next", summary: (from, to, total) => `${from}-${to} of ${total}` },
};

function leads(count: number): Lead[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `lead-${index}`,
    name: `Lead ${index}`,
    stageId: "new",
  }));
}

function renderBoard(count: number) {
  const onCardMove = vi.fn();
  render(
    <BoardView<Lead>
      columns={columns}
      columnOf={(item) => item.stageId}
      items={leads(count)}
      itemKey={(item) => item.id}
      renderCard={(item) => <span>{item.name}</span>}
      onCardMove={onCardMove}
      isLoading={false}
      labels={labels}
    />,
  );
  return { onCardMove };
}

function mountedCardIds(): string[] {
  return Array.from(document.querySelectorAll("[data-rfd-draggable-id]")).map(
    (node) => node.getAttribute("data-rfd-draggable-id") ?? "",
  );
}

// react-window reads the scroll geometry off the event target, and jsdom
// reports 0 for all of it. Supplying the three numbers it actually reads is
// the library's only seam here — the real windowing arithmetic still runs, it
// is simply told how big the box is.
function scrollColumnTo(offset: number) {
  const scroller = document.querySelector<HTMLElement>('[data-rfd-droppable-id="new"]');
  if (!scroller) throw new Error("no column scroll container");
  Object.defineProperty(scroller, "clientHeight", { value: UNMEASURED_VIEWPORT_PX, configurable: true });
  Object.defineProperty(scroller, "scrollHeight", {
    value: LONG_COLUMN * ESTIMATED_ROW_PX,
    configurable: true,
  });
  scroller.scrollTop = offset;
  fireEvent.scroll(scroller);
}

describe("board column virtualization (2.8)", () => {
  it("renders every card at the threshold, and windows above it", () => {
    renderBoard(VIRTUALIZE_ABOVE);
    expect(mountedCardIds()).toHaveLength(VIRTUALIZE_ABOVE);

    cleanup();

    renderBoard(VIRTUALIZE_ABOVE + 1);
    // The switch is a switch, not a tuning knob: one card past the threshold
    // and the column stops mounting its whole list.
    expect(mountedCardIds().length).toBeLessThan(VIRTUALIZE_ABOVE + 1);
  });

  it("mounts a window, not 200 cards", () => {
    renderBoard(LONG_COLUMN);
    const mounted = mountedCardIds();
    expect(mounted.length).toBeGreaterThan(0);
    expect(mounted.length).toBeLessThan(LONG_COLUMN / 4);
  });

  // The bug this whole file exists to catch. A window index here drops a card
  // at the wrong position with no error anywhere.
  it("keeps every mounted Draggable on its ABSOLUTE index", () => {
    renderBoard(LONG_COLUMN);
    const mounted = mountedCardIds();
    expect(mounted).toEqual(leads(mounted.length).map((lead) => lead.id));
    expect(screen.getByText("Lead 0")).toBeInTheDocument();
    expect(screen.queryByText(`Lead ${LONG_COLUMN - 1}`)).toBeNull();
  });

  // react-window renders the scroll container itself and takes no props for
  // anything but className/style/onScroll/ref, so these attributes reach it
  // only through the outerElementType bridge in VirtualColumnBody. Losing them
  // leaves a droppable no devtool or stylesheet can find.
  it("keeps the droppable's identity on react-window's own scroll container", () => {
    renderBoard(LONG_COLUMN);
    const scroller = document.querySelector('[data-rfd-droppable-id="new"]');
    expect(scroller).not.toBeNull();
    expect(scroller?.getAttribute("data-rfd-droppable-context-id")).not.toBeNull();
    // 2.17: a plain overflow element, never a Radix ScrollArea, whose scroll
    // lives on an inner Viewport that a virtualizer handed the Root never sees.
    expect((scroller as HTMLElement).style.overflow).toBe("auto");
    expect(scroller?.closest("[data-radix-scroll-area-viewport]")).toBeNull();
  });

  it("trips neither of virtual mode's two invariants", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderBoard(LONG_COLUMN)).not.toThrow();
    const messages = errors.mock.calls.flat().join(" ");
    // Missing renderClone throws; a rendered placeholder throws. Both surface
    // through console.error under the library's dev-setup warnings first.
    expect(messages).not.toContain("renderClone");
    expect(messages).not.toContain("placeholder");
    errors.mockRestore();
    expect(document.querySelector("[data-rfd-placeholder-context-id]")).toBeNull();
  });

  // @hello-pangea/dnd's virtual-list contract requires at least one overscan
  // row: with none it cannot tell whether a card exists past the one in the
  // last visible slot, and a drop at the end of a column resolves against a
  // list it believes has ended.
  it("overscans, which the drag library requires", () => {
    expect(OVERSCAN_ROWS).toBeGreaterThanOrEqual(1);
  });

  it("mounts cards that were outside the first window once the column scrolls", () => {
    renderBoard(LONG_COLUMN);
    expect(screen.queryByText("Lead 120")).toBeNull();

    scrollColumnTo(120 * ESTIMATED_ROW_PX);

    expect(screen.getByText("Lead 120")).toBeInTheDocument();
    expect(screen.queryByText("Lead 0")).toBeNull();

    // Still absolute indices after the window has moved. Asserting the run is
    // CONSECUTIVE from wherever it starts, rather than that it starts at a
    // particular row, is deliberate: react-window overscans asymmetrically in
    // the scroll direction, so pinning the first index would be a test of its
    // overscan tuning. What must hold is that the id at DOM position k is the
    // card at absolute index first+k — the property a leaked window index
    // breaks.
    const mounted = mountedCardIds();
    const first = Number(mounted[0].replace("lead-", ""));
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThanOrEqual(120);
    expect(mounted).toEqual(Array.from({ length: mounted.length }, (_, k) => `lead-${first + k}`));
  });

  // 2.7 is the plan's highest-severity item and shipped before this task. A
  // windowed column must not cost a card its single-pointer move path.
  it("keeps the WCAG AA Move-to menu working inside a windowed column", () => {
    renderBoard(LONG_COLUMN);
    scrollColumnTo(120 * ESTIMATED_ROW_PX);

    const card = screen.getByText("Lead 120").closest("[data-rfd-draggable-id]");
    expect(card).not.toBeNull();
    const trigger = within(card as HTMLElement).getByRole("button", { name: "Move to" });
    fireEvent.keyDown(trigger, { key: "Enter" });

    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Qualified" })).toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "New" })).toBeNull();
  });

  // The board mirrors wholesale, and a virtualizer that computes offsets has
  // to mirror with it. Arabic is the default language, so the list's own
  // direction and the rows' inline offset must both be the RTL ones.
  it("puts the rows' inline offset on the direction-correct side", () => {
    renderBoard(LONG_COLUMN);
    const scroller = document.querySelector<HTMLElement>('[data-rfd-droppable-id="new"]');
    expect(scroller?.style.direction).toBe("rtl");

    const row = scroller?.firstElementChild?.firstElementChild as HTMLElement;
    expect(row.style.right).toBe("0px");
    expect(row.style.left).toBe("");
  });
});
