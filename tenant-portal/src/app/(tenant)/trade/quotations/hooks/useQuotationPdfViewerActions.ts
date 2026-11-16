import { useCallback, useRef } from "react";

export interface QuotationPdfLinkRenewal {
  refresh: () => Promise<void>;
  busy: boolean;
  disabled: boolean;
  error: string | null;
}

export function useQuotationPdfViewerActions(renewal?: QuotationPdfLinkRenewal) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const focusFrom = useRef<HTMLElement | null>(null);
  const actionRef = useCallback((action: HTMLAnchorElement | HTMLButtonElement | null) => {
    if (!action) return;
    const group = action.parentElement;
    if (group && focusFrom.current === group) action.focus({ preventScroll: true });
    focusFrom.current = null;

    // Carry focus across a control swap in this dialog, including when expiry is automatic.
    return () => {
      if (action.ownerDocument.activeElement === action) focusFrom.current = group;
    };
  }, []);

  const focusTitle = (event: Event) => {
    if (!titleRef.current) return;
    event.preventDefault();
    titleRef.current.focus({ preventScroll: true });
  };

  const refreshDisabled = Boolean(renewal?.busy || renewal?.disabled);
  const refresh = () => {
    if (renewal && !refreshDisabled) void renewal.refresh();
  };

  return { actionRef, titleRef, focusTitle, refresh, refreshDisabled };
}
