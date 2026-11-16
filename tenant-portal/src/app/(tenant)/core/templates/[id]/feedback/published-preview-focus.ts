"use client";

import { useLayoutEffect, type RefObject } from "react";
import { isTemplateFocusTarget } from "./inspector-feedback-context";

let returnIntent: { href: string; owner: string; expiresAt: number } | null = null;

export function armPublishedPreviewReturnFocus(href: string, owner: string | null) {
  returnIntent = owner ? { href, owner, expiresAt: Date.now() + 15_000 } : null;
}

export function focusTemplateRegionWhenIdle(target: HTMLElement) {
  if (!isTemplateFocusTarget(target, target)) return;
  const document = target.ownerDocument;
  const active = document.activeElement;
  if (active?.isConnected && active !== document.body && active !== document.documentElement) return;
  const dialogs = Array.from(document.querySelectorAll('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'));
  const topDialog = dialogs.at(-1);
  if (!topDialog || topDialog.contains(target)) target.focus();
}

export function usePublishedPreviewReturnFocus(
  href: string,
  owner: string | null,
  root: RefObject<HTMLElement | null>,
  ready: boolean,
) {
  useLayoutEffect(() => {
    const intent = returnIntent;
    if (!intent) return;
    if (intent.owner !== owner || intent.expiresAt <= Date.now()) {
      returnIntent = null;
      return;
    }
    if (intent.href !== href || !ready || !root.current) return;
    returnIntent = null;
    focusTemplateRegionWhenIdle(root.current);
  });
}
