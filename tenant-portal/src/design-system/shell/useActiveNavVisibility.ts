"use client";

import { useLayoutEffect, useRef } from "react";

export function useActiveNavVisibility(activeItemId: string | null, lang: string) {
  const navRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
    if (!active) return;

    const reveal = () => {
      if (!nav.clientWidth) return;
      const viewport = nav.getBoundingClientRect();
      const item = active.getBoundingClientRect();
      if (item.left < viewport.left || item.right > viewport.right) {
        active.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    };

    reveal();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(reveal);
    observer.observe(nav);
    observer.observe(active);
    return () => observer.disconnect();
  }, [activeItemId, lang]);

  return navRef;
}
