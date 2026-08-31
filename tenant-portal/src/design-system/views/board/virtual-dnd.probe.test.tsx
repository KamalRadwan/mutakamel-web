// @vitest-environment jsdom

/**
 * The task 1.46 de-risk probe, kept as a test rather than thrown away.
 *
 * **What it proves:** `@hello-pangea/dnd`'s `mode="virtual"` and
 * `@tanstack/react-virtual` mount together; a windowed subset renders; every
 * mounted `Draggable` carries its **absolute** index rather than its window
 * index; the library's two virtual-mode invariants (a `renderClone` is
 * required, a placeholder is forbidden) are satisfied.
 *
 * **What it does not prove, and cannot:** that a drag works. jsdom has no
 * layout, so every box `@hello-pangea/dnd` measures is 0×0 and no sensor can
 * produce a meaningful drag. A real 200-card drag in a browser is what closes
 * task 2.8, and `DECISIONS.md#d9--virtualization--assumed-split-by-surface-on-2026-08-31`
 * records that it has not been performed.
 *
 * The probe stays because the structural half is the half that regresses
 * silently — an absolute-index bug drops cards into the wrong position with no
 * error anywhere.
 */

import { useRef } from "react";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(cleanup);

const CARDS = Array.from({ length: 200 }, (_, index) => ({ id: `card-${index}`, label: `Card ${index}` }));
const VIEWPORT_PX = 400;
const ROW_PX = 64;

function VirtualColumn() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: CARDS.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_PX,
    overscan: 2,
    // jsdom has no layout, so the virtualizer's ResizeObserver never fires and
    // it would compute an empty window. These three are the library's own
    // documented seams for supplying measurements: the real virtualizer still
    // does the range arithmetic, it is simply told how big the box is.
    initialRect: { width: 320, height: VIEWPORT_PX },
    observeElementRect: (_instance, cb) => cb({ width: 320, height: VIEWPORT_PX }),
    observeElementOffset: (_instance, cb) => cb(0, false),
  });

  return (
    <DragDropContext onDragEnd={vi.fn()}>
      <Droppable
        droppableId="stage-new"
        mode="virtual"
        // Mandatory in virtual mode: the virtualizer may unmount the dragged
        // node, so the library portals a clone out of the list instead.
        // Omitting it throws "Must provide a clone render function".
        renderClone={(provided, _snapshot, rubric) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            data-testid="drag-clone"
          >
            {CARDS[rubric.source.index].label}
          </div>
        )}
      >
        {(droppableProvided) => (
          <div ref={scrollRef} data-testid="column-scroll" style={{ height: 400, overflowY: "auto" }}>
            <div
              ref={droppableProvided.innerRef}
              {...droppableProvided.droppableProps}
              style={{ height: virtualizer.getTotalSize(), position: "relative" }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => (
                <Draggable
                  // The ABSOLUTE index, never the position within the window.
                  // This is the bug the probe exists to catch: with the window
                  // index, a drop from row 3 of the window lands at position 3
                  // of the column.
                  key={CARDS[virtualItem.index].id}
                  draggableId={CARDS[virtualItem.index].id}
                  index={virtualItem.index}
                >
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      // `top`, not `transform`. @tanstack/react-virtual's
                      // documented pattern positions with
                      // translateY(item.start), and provided.draggableProps.style
                      // sets `transform` on this same element while a drag is in
                      // flight — object spread cannot merge two transforms, so
                      // one silently wins. This is the concrete collision D9
                      // records, and positioning with `top` is what avoids it.
                      style={{
                        ...provided.draggableProps.style,
                        position: "absolute",
                        insetInlineStart: 0,
                        width: "100%",
                        height: virtualItem.size,
                        top: virtualItem.start,
                      }}
                    >
                      {CARDS[virtualItem.index].label}
                    </div>
                  )}
                </Draggable>
              ))}
              {/* No droppableProvided.placeholder: virtual mode throws
                  "Expected virtual list to not have a placeholder". */}
            </div>
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}

describe("1.46 — @hello-pangea/dnd virtual mode over @tanstack/react-virtual", () => {
  it("mounts without tripping either virtual-mode invariant", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<VirtualColumn />)).not.toThrow();
    // The library's dev-setup warnings go through console.error; a placeholder
    // or a missing renderClone would surface there rather than as a throw.
    const messages = errors.mock.calls.flat().join(" ");
    expect(messages).not.toContain("renderClone");
    expect(messages).not.toContain("placeholder");
    errors.mockRestore();
  });

  it("renders a window, not all 200 cards", () => {
    render(<VirtualColumn />);
    const rendered = document.querySelectorAll("[data-rfd-draggable-id]");
    // A 400px viewport over 64px rows plus overscan — an order of magnitude
    // fewer nodes than the column holds, which is the whole point of 2.8.
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThan(CARDS.length / 4);
  });

  it("keeps every mounted Draggable on its ABSOLUTE index", () => {
    render(<VirtualColumn />);
    const ids = Array.from(document.querySelectorAll("[data-rfd-draggable-id]")).map((node) =>
      node.getAttribute("data-rfd-draggable-id"),
    );
    expect(ids).toEqual(CARDS.slice(0, ids.length).map((card) => card.id));
    expect(screen.getByText("Card 0")).toBeInTheDocument();
    expect(screen.queryByText("Card 199")).toBeNull();
  });

  it("emits no placeholder node, which virtual mode forbids", () => {
    render(<VirtualColumn />);
    expect(document.querySelector("[data-rfd-placeholder-context-id]")).toBeNull();
  });

  it("positions with `top`, leaving `transform` to the drag library", () => {
    render(<VirtualColumn />);
    const first = document.querySelector<HTMLElement>("[data-rfd-draggable-id]")!;
    expect(first.style.top).toBe("0px");
    // Nothing has claimed transform, so provided.draggableProps.style can.
    expect(first.style.transform).toBe("");
  });
});
