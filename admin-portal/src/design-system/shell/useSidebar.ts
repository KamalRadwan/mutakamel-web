"use client";

import { useCallback, useEffect, useState } from "react";

const COOKIE_NAME = "ds_sidebar";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function writeSidebarCookie(collapsed: boolean) {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=${collapsed ? "collapsed" : "expanded"}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

/**
 * defaultCollapsed comes from the ds_sidebar cookie, read server-side in
 * (shell)/layout.tsx and passed down — so the sidebar renders at the right
 * width on the very first paint, no collapse-flash. Toggling here writes
 * the same cookie so the next server render already knows.
 */
export function useSidebar(defaultCollapsed: boolean) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writeSidebarCookie(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  return { collapsed, toggle };
}
