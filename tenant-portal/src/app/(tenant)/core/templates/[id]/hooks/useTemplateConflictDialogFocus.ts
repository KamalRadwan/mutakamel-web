"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import type { TemplateRecoveryAuthority } from "../../template-recovery-policy";

export interface TemplateRecoveryInteraction {
  active: () => boolean;
  cancel: () => void;
}
export interface TemplateConflictFocusInput {
  authority: TemplateRecoveryAuthority;
  interaction?: TemplateRecoveryInteraction;
}

function availableTarget(target: HTMLElement): boolean {
  if (!target.isConnected || target.matches(':disabled, [aria-disabled="true"]')) return false;
  for (let element: HTMLElement | null = target; element; element = element.parentElement) {
    if (element.matches('[inert], [hidden], [aria-hidden="true"]')) return false;
    const style = element.ownerDocument.defaultView?.getComputedStyle(element);
    if (style?.display === "none" || style?.visibility === "hidden" || style?.visibility === "collapse") return false;
  }
  return true;
}

/** DS lifecycle only: one modal trap, with owner-bound restoration for both host and nested portal triggers. */
export function useTemplateConflictDialogFocus(input: TemplateConflictFocusInput) {
  const host = useRef<HTMLElement>(null), comparison = useRef<HTMLDivElement>(null), discard = useRef<HTMLDivElement>(null);
  const latest = useRef(input), mounted = useRef(false);
  useLayoutEffect(() => { latest.current = input; });
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const { key, epoch } = input.authority;
  const current = () => {
    const now = latest.current.authority;
    return mounted.current && now.key === key && now.epoch === epoch && now.readable && now.current();
  };
  const owns = (target: HTMLElement) => !!host.current?.contains(target) || !!comparison.current?.contains(target) || !!discard.current?.contains(target);
  const comparisonLifecycle = useTemplateDialogReturnFocus(current, owns, host, comparison, latest);
  const discardLifecycle = useTemplateDialogReturnFocus(current, owns, host, discard, latest);
  return {
    host, comparison, discard, comparisonLifecycle, discardLifecycle,
    beforeClose: () => {
      if (!current()) return false;
      const gestures = latest.current.interaction;
      if (gestures?.active()) gestures.cancel();
      return current() && !gestures?.active();
    },
    beforeConfirm: () => {
      if (!current()) return false;
      const gestures = latest.current.interaction;
      if (gestures?.active()) { gestures.cancel(); return false; }
      return true;
    },
  };
}

function useTemplateDialogReturnFocus(current: () => boolean, owns: (element: HTMLElement) => boolean,
  host: RefObject<HTMLElement | null>, closing: RefObject<HTMLDivElement | null>, latest: RefObject<TemplateConflictFocusInput>) {
  const returnTo = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (event: Event) => {
      if (!current()) { event.preventDefault(); return; }
      const focused = host.current?.ownerDocument.activeElement;
      returnTo.current = focused instanceof HTMLElement && owns(focused) ? focused : null;
    },
    onCloseAutoFocus: (event: Event) => {
      event.preventDefault();
      const target = returnTo.current;
      returnTo.current = null;
      if (!current() || !target || !owns(target) || !availableTarget(target)) return;
      const document = target.ownerDocument;
      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]');
      const top = dialogs.item(dialogs.length - 1);
      if (top && !top.contains(target)) return;
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && focused !== document.body && focused !== document.documentElement && focused !== target &&
        focused.isConnected && !closing.current?.contains(focused) && focused.closest('[data-state="closed"]') === null) return;
      target.focus();
    },
    onEscapeKeyDown: (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (!current()) { event.preventDefault(); return; }
      if (latest.current.interaction?.active()) {
        event.preventDefault(); event.stopPropagation(); latest.current.interaction.cancel();
      }
    },
  };
}
