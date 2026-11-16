"use client";
import { useEffect, useLayoutEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { DraftValidationIssue } from "../version-draft";

export interface VersionIssueFocus { issue: DraftValidationIssue; request: number }
interface Options {
  request: VersionIssueFocus | null | undefined;
  rowKeys: readonly string[];
  selectRow: Dispatch<SetStateAction<string | null>>;
  setSearch: Dispatch<SetStateAction<string>>;
  setPage?: Dispatch<SetStateAction<number>>;
  pageSize?: number;
}

/** Only an explicit error-link click changes selection and focus, never a keystroke. */
export function useVersionEditorFocus({ request, ...options }: Options) {
  const latest = useRef(options);
  useLayoutEffect(() => { latest.current = options; });
  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    queueMicrotask(() => {
      if (cancelled) return;
      const { selectRow, setSearch, setPage, pageSize = 50, rowKeys } = latest.current;
      const key = request.issue.rowKey;
      setSearch("");
      if (key) {
        selectRow(key);
        const index = rowKeys.indexOf(key);
        if (index >= 0) setPage?.(Math.floor(index / pageSize) + 1);
      }
      let attempts = 0;
      const focus = () => {
        if (cancelled) return;
        const target = document.getElementById(request.issue.targetDomId);
        if (target) target.focus();
        else if (++attempts < 4) timer = setTimeout(focus, 0);
      };
      timer = setTimeout(focus, 0);
    });
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [request]);
}
