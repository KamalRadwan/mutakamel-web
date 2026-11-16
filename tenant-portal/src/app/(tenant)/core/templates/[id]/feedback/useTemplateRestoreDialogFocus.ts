"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { isTemplateFocusTarget } from "./inspector-feedback-context";
import { focusTemplateRegionWhenIdle } from "./published-preview-focus";

export interface TemplateRestoreDialogFocus {
  remember(trigger: HTMLButtonElement): void;
  onCloseAutoFocus(event: Event): void;
}

export function useTemplateRestoreDialogFocus(
  scope: RefObject<HTMLElement | null>,
  owner: string | null,
): TemplateRestoreDialogFocus {
  const returnFocus = useRef<{ opener: HTMLButtonElement | null; region: HTMLElement } | null>(null);
  useLayoutEffect(() => () => {
    // Radix dispatches close autofocus after the previous authority has been cleared.
    if (returnFocus.current) returnFocus.current.opener = null;
  }, [owner]);

  return {
    remember(trigger) {
      const region = scope.current;
      if (owner !== null && region) returnFocus.current = { opener: trigger, region };
    },
    onCloseAutoFocus(event) {
      event.preventDefault();
      const targets = returnFocus.current;
      returnFocus.current = null;
      if (!targets || targets.region !== scope.current) return;
      const { opener, region } = targets;
      focusTemplateRegionWhenIdle(opener && isTemplateFocusTarget(opener, region) ? opener : region);
    },
  };
}
