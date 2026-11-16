"use client";
import { useSyncExternalStore } from "react";
import type { PageController } from "../page-controller";
import { pageNumberLocales } from "../page-copy";

export function usePageGuides(controller: PageController, locale: "ar-EG" | "en-US") {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const page = state.pages[state.activeIndex]?.page ?? state.document?.page;
  const number = new Intl.NumberFormat(pageNumberLocales[locale]);
  const ticks = (extent: number) => Array.from({ length: Math.floor(extent / 10) + 1 }, (_, index) => ({ mm: index * 10, label: number.format(index * 10) }));
  return { page, printBounds: state.printBounds, rulers: state.rulers,
    horizontal: page ? ticks(page.widthMm) : [], vertical: page ? ticks(page.heightMm) : [] };
}
