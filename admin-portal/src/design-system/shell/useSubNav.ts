"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ScrollDirection = "start" | "end";

interface OverflowState {
  start: boolean;
  end: boolean;
}

const INITIAL_OVERFLOW: OverflowState = { start: false, end: false };
const OVERFLOW_CONTROL_INSET = 48;

function getLinks(scroller: HTMLDivElement): HTMLAnchorElement[] {
  return Array.from(scroller.querySelectorAll<HTMLAnchorElement>("[data-subnav-link]"));
}

function isFullyVisible(element: HTMLElement, scroller: HTMLElement): boolean {
  const elementRect = element.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();
  const tolerance = 1;

  return (
    elementRect.left >= scrollerRect.left + OVERFLOW_CONTROL_INSET - tolerance &&
    elementRect.right <= scrollerRect.right - OVERFLOW_CONTROL_INSET + tolerance
  );
}

function isStartEdgeVisible(element: HTMLElement, scroller: HTMLElement, direction: string): boolean {
  const elementRect = element.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();
  const tolerance = 1;

  return direction === "rtl"
    ? elementRect.right <= scrollerRect.right - OVERFLOW_CONTROL_INSET + tolerance
    : elementRect.left >= scrollerRect.left + OVERFLOW_CONTROL_INSET - tolerance;
}

function isEndEdgeVisible(element: HTMLElement, scroller: HTMLElement, direction: string): boolean {
  const elementRect = element.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();
  const tolerance = 1;

  return direction === "rtl"
    ? elementRect.left >= scrollerRect.left + OVERFLOW_CONTROL_INSET - tolerance
    : elementRect.right <= scrollerRect.right - OVERFLOW_CONTROL_INSET + tolerance;
}

/** Keeps the active destination visible and exposes explicit controls when the row overflows. */
export function useSubNav(pathname: string, layoutKey: string) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState<OverflowState>(INITIAL_OVERFLOW);

  const updateOverflow = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const links = getLinks(scroller);
    const direction = window.getComputedStyle(scroller).direction;
    const next = {
      start: links.length > 0 && !isStartEdgeVisible(links[0], scroller, direction),
      end: links.length > 0 && !isEndEdgeVisible(links[links.length - 1], scroller, direction),
    };

    setOverflow((current) => (current.start === next.start && current.end === next.end ? current : next));
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const animationFrame = window.requestAnimationFrame(updateOverflow);
    const resizeObserver = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(updateOverflow);

    resizeObserver?.observe(scroller);
    getLinks(scroller).forEach((link) => resizeObserver?.observe(link));
    scroller.addEventListener("scroll", updateOverflow, { passive: true });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      scroller.removeEventListener("scroll", updateOverflow);
    };
  }, [updateOverflow]);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      const activeLink = scrollerRef.current?.querySelector<HTMLAnchorElement>('[data-subnav-link][aria-current="page"]');
      activeLink?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
      updateOverflow();
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [pathname, layoutKey, updateOverflow]);

  const scroll = useCallback((direction: ScrollDirection) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const links = getLinks(scroller);
    if (links.length === 0) return;

    const visibleIndexes = links.flatMap((link, index) => (isFullyVisible(link, scroller) ? [index] : []));
    const targetIndex = direction === "start"
      ? Math.max(0, (visibleIndexes[0] ?? links.length) - 1)
      : Math.min(links.length - 1, (visibleIndexes.at(-1) ?? -1) + 1);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    links[targetIndex]?.scrollIntoView({
      block: "nearest",
      inline: direction,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, []);

  return {
    scrollerRef,
    canScrollStart: overflow.start,
    canScrollEnd: overflow.end,
    scrollToStart: () => scroll("start"),
    scrollToEnd: () => scroll("end"),
  };
}
