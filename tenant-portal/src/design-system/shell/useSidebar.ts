"use client";

import { useCallback, useEffect, useState } from "react";

const COOKIE_NAME = "tenant_sidebar";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export type SidebarState = "expanded" | "collapsed";

function writeCookie(state: SidebarState) {
  document.cookie = `${COOKIE_NAME}=${state}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
}

// Collapse starts from the value app/(tenant)/layout.tsx (a server
// component) read from the tenant_sidebar cookie, so there is no collapse
// flash on first paint — the one thing genuinely resolved server-side; see
// docs/design/theming.md for why theme/language are not. Ctrl/Cmd+B toggles.
export function useSidebar(initialState: SidebarState) {
  const [state, setState] = useState<SidebarState>(initialState);

  const toggle = useCallback(() => {
    setState((current) => {
      const next = current === "expanded" ? "collapsed" : "expanded";
      writeCookie(next);
      return next;
    });
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  return { state, toggle, isCollapsed: state === "collapsed" };
}
