"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type HTMLAttributes,
} from "react";
import { Droppable, type DroppableProvidedProps } from "@hello-pangea/dnd";
import { VariableSizeList, type ListChildComponentProps } from "react-window";
import { useDirection } from "@/i18n/useLanguage";
import { cn } from "../../lib/cn";
import { BoardCard, BoardCardSurface, type BoardCardModel } from "./BoardCard";
import { ESTIMATED_ROW_PX, OVERSCAN_ROWS, ROW_GAP_CLASS, useColumnWindow } from "./useColumnWindow";

interface ColumnRowData {
  cards: BoardCardModel[];
  onMeasure: (id: string, index: number, height: number) => void;
}

// react-window renders the scroll container itself and passes it only
// className, style, onScroll and a ref — there is no prop for anything else.
// The droppable's data attributes have no way in except through the element
// type it is told to render, so they arrive by context instead. They are
// write-only for @hello-pangea/dnd (nothing in the library reads them back),
// but dropping them would leave a droppable that is invisible to every
// devtool and stylesheet that looks for one.
const DroppablePropsContext = createContext<DroppableProvidedProps | null>(null);

const ColumnScrollContainer = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function ColumnScrollContainer(props, ref) {
    const droppableProps = useContext(DroppablePropsContext);
    return <div ref={ref} {...props} {...droppableProps} />;
  },
);

function MeasuredRow({
  card,
  index,
  style,
  onMeasure,
}: {
  card: BoardCardModel;
  index: number;
  style: CSSProperties;
  onMeasure: (id: string, index: number, height: number) => void;
}) {
  const measured = useRef<HTMLDivElement | null>(null);
  const cardId = card.id;

  useLayoutEffect(() => {
    const node = measured.current;
    if (!node) return;
    const report = () => {
      // While THIS card is the one being dragged, @hello-pangea/dnd unmounts
      // it from the list and renders the portalled clone instead, leaving this
      // wrapper holding nothing but its own 6px of padding. That is not the
      // row's height, and writing it into the cache would collapse the row and
      // jump every card below it mid-drag. Measure a row only while it has a
      // card in it.
      if (!node.firstElementChild) return;
      // The padded wrapper, not the card: the 6px gap is part of the row's
      // pitch once absolute positioning has taken the flex gap away, and a
      // measurement that leaves it out stacks every card 6px too high.
      onMeasure(cardId, index, node.getBoundingClientRect().height);
    };
    report();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(report);
    observer.observe(node);
    return () => observer.disconnect();
  }, [cardId, index, onMeasure]);

  return (
    // react-window's own style, applied as handed over. It positions with
    // `top` and flips `left`/`right` for the list's direction, leaving
    // `transform` free for @hello-pangea/dnd to displace a card with — the
    // exact collision D9 chose this library to avoid, and the reason the
    // offset sits on this wrapper rather than on the Draggable inside it.
    <div style={style}>
      <div ref={measured} className={ROW_GAP_CLASS}>
        <BoardCard card={card} index={index} />
      </div>
    </div>
  );
}

function ColumnRow({ data, index, style }: ListChildComponentProps<ColumnRowData>) {
  const card = data.cards.at(index);
  // The extra slot @hello-pangea/dnd asks for while a card is being dragged in
  // from another column. Nothing is behind it — its only job is to occupy a
  // row's worth of height so the list makes room for the incoming card.
  if (!card) return null;
  return <MeasuredRow card={card} index={index} style={style} onMeasure={data.onMeasure} />;
}

export interface VirtualColumnBodyProps {
  columnId: string;
  cards: BoardCardModel[];
  className: string;
}

// A board column body that mounts a window over its cards instead of all of
// them. See docs/design/views.md#virtualization and
// DECISIONS.md#d9--virtualization--assumed-split-by-surface-on-2026-08-31.
//
// @hello-pangea/dnd supports this through exactly one contract, and all four
// of its parts are load-bearing:
//
//   mode="virtual"   tells the library the list may add and remove Draggables
//                    mid-drag. Without it, a scroll during a drag trips
//                    "You are attempting to add or remove a Draggable while a
//                    drag is occurring" and the update is dropped.
//   renderClone      is mandatory in virtual mode — the library throws
//                    without it. The card being dragged is UNMOUNTED from the
//                    list (draggable-api returns null for it), and this clone,
//                    portalled to document.body, is what the pointer carries.
//   no placeholder   is also mandatory — provided.placeholder throws
//                    "Expected virtual list to not have a placeholder". Space
//                    for an incoming card is made by hand instead, by adding
//                    a row while snapshot.isUsingPlaceholder.
//   overscan >= 1    is required so the library can tell whether a card exists
//                    past the last visible one.
//
// The scroll element is react-window's own outer div — a plain overflow:auto
// element, NOT a Radix ScrollArea, whose scroll lives on an inner Viewport and
// whose content sits in a display:table wrapper. Hand a virtualizer the
// ScrollArea Root and it measures a box that never scrolls and windows to
// nothing (task 2.17). Keeping the plain element avoids the question.
export function VirtualColumnBody({ columnId, cards, className }: VirtualColumnBodyProps) {
  const dir = useDirection();
  const { viewportRef, viewportHeight, listRef, sizeAt, keyAt, onMeasure } = useColumnWindow(cards);

  const rowData = useMemo<ColumnRowData>(() => ({ cards, onMeasure }), [cards, onMeasure]);

  return (
    // The list needs a pixel height, and it cannot read one off the element it
    // is about to size. This wrapper is the thing that gets measured; the list
    // fills it. A plain block, not a flex column — react-window's scroll
    // container carries an explicit pixel height, and as a flex item that
    // height is a starting point a shrink can walk back.
    <div ref={viewportRef} className="min-h-0 flex-1">
      <Droppable
        droppableId={columnId}
        mode="virtual"
        renderClone={(provided, snapshot, rubric) => {
          // rubric.source.index indexes THIS column, which is the only one
          // that renders a clone. The fallback is unreachable in practice, but
          // it still carries the drag handle: a clone without one is a drag
          // the library can start and never move.
          const card = cards.at(rubric.source.index);
          if (!card) {
            return <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} />;
          }
          return <BoardCardSurface card={card} provided={provided} snapshot={snapshot} />;
        }}
      >
        {(provided, snapshot) => (
          <DroppablePropsContext.Provider value={provided.droppableProps}>
            <VariableSizeList<ColumnRowData>
              ref={listRef}
              // The droppable IS the scroll container, which is what puts
              // getClosestScrollable's answer and the element the library
              // tracks scroll on at the same node.
              outerRef={provided.innerRef}
              outerElementType={ColumnScrollContainer}
              className={cn(className, snapshot.isDraggingOver && "bg-accent")}
              // Flips the rows' inline offset and sets the list's own CSS
              // direction. The board mirrors wholesale; a windowed column that
              // computes offsets must mirror with it.
              direction={dir}
              height={viewportHeight}
              width="100%"
              itemCount={snapshot.isUsingPlaceholder ? cards.length + 1 : cards.length}
              itemData={rowData}
              itemKey={keyAt}
              itemSize={sizeAt}
              estimatedItemSize={ESTIMATED_ROW_PX}
              overscanCount={OVERSCAN_ROWS}
            >
              {ColumnRow}
            </VariableSizeList>
            {/* Deliberately no provided.placeholder — see above. */}
          </DroppablePropsContext.Provider>
        )}
      </Droppable>
    </div>
  );
}
