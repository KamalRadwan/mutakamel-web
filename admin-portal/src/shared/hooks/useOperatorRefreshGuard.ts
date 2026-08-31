"use client";

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";

export type OperatorRefreshPauseReason =
  | "operator"
  | "active-call"
  | "modal-or-menu"
  | "page-hidden"
  | "active-editing"
  | "region-focus"
  | "region-selection";

export interface UseOperatorRefreshGuardOptions {
  /**
   * Stable refs for the regions whose editing and text selection must not be
   * disrupted by a background refresh. Ordinary button/tab focus does not
   * pause; mark the rare non-editable focus zone that must pause with
   * `data-refresh-disruptive-focus`. The hook never queries application-wide
   * roles or overlays.
   */
  ownedRegionRefs?: readonly RefObject<HTMLElement | null>[];
  /** A caller-owned signal from its dialog/menu primitives. */
  modalOrMenuOpen?: boolean;
  /** A caller-owned, explicit pause controlled by the operator. */
  operatorPaused?: boolean;
  /** A caller-owned signal from the phone/call lifecycle. */
  activeCall?: boolean;
}

export interface OperatorRefreshGuard {
  isPaused: boolean;
  isAutomaticallyPaused: boolean;
  pauseReasons: readonly OperatorRefreshPauseReason[];
}

interface OwnedRegionActivity {
  focused: boolean;
  editing: boolean;
  selection: boolean;
}

const NO_ACTIVITY: OwnedRegionActivity = {
  focused: false,
  editing: false,
  selection: false,
};

const NO_REGION_REFS: readonly RefObject<HTMLElement | null>[] = [];

/**
 * Derives whether background refresh should pause without changing the
 * caller's polling or data ownership model. Consumers keep their current
 * data mounted and use `isPaused` only to stop scheduling new background
 * work.
 */
export function useOperatorRefreshGuard({
  ownedRegionRefs = NO_REGION_REFS,
  modalOrMenuOpen = false,
  operatorPaused = false,
  activeCall = false,
}: UseOperatorRefreshGuardOptions = {}): OperatorRefreshGuard {
  const pageHidden = useSyncExternalStore(
    subscribeToPageVisibility,
    readPageHidden,
    () => false,
  );
  const [regionActivity, setRegionActivity] =
    useState<OwnedRegionActivity>(NO_ACTIVITY);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const regions = ownedRegionRefs
      .map((ref) => ref.current)
      .filter((region): region is HTMLElement => region !== null);
    if (regions.length === 0) return;

    let disposed = false;
    let updateQueued = false;
    const updateActivity = () => {
      if (disposed) return;
      const next = readOwnedRegionActivity(regions);
      setRegionActivity((current) =>
        sameActivity(current, next) ? current : next,
      );
    };
    const queueActivityUpdate = () => {
      if (updateQueued) return;
      updateQueued = true;
      queueMicrotask(() => {
        updateQueued = false;
        updateActivity();
      });
    };

    regions.forEach((region) => {
      region.addEventListener("focusin", updateActivity);
      region.addEventListener("focusout", queueActivityUpdate);
      region.addEventListener("input", updateActivity);
    });
    document.addEventListener("selectionchange", updateActivity);
    queueActivityUpdate();

    return () => {
      disposed = true;
      regions.forEach((region) => {
        region.removeEventListener("focusin", updateActivity);
        region.removeEventListener("focusout", queueActivityUpdate);
        region.removeEventListener("input", updateActivity);
      });
      document.removeEventListener("selectionchange", updateActivity);
    };
  }, [ownedRegionRefs]);

  const pauseReasons = useMemo(() => {
    const reasons: OperatorRefreshPauseReason[] = [];
    if (operatorPaused) reasons.push("operator");
    if (activeCall) reasons.push("active-call");
    if (modalOrMenuOpen) reasons.push("modal-or-menu");
    if (pageHidden) reasons.push("page-hidden");
    if (regionActivity.editing) {
      reasons.push("active-editing");
    } else if (regionActivity.focused) {
      reasons.push("region-focus");
    }
    if (regionActivity.selection) reasons.push("region-selection");
    return reasons;
  }, [activeCall, modalOrMenuOpen, operatorPaused, pageHidden, regionActivity]);

  return {
    isPaused: pauseReasons.length > 0,
    isAutomaticallyPaused: pauseReasons.some((reason) => reason !== "operator"),
    pauseReasons,
  };
}

function subscribeToPageVisibility(onChange: () => void): () => void {
  if (typeof document === "undefined") return () => undefined;
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

function readPageHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

function readOwnedRegionActivity(
  regions: readonly HTMLElement[],
): OwnedRegionActivity {
  const activeElement = document.activeElement;
  const focusInsideOwnedRegion = regions.some((region) =>
    nodeIsInside(region, activeElement),
  );
  const disruptiveFocusTarget =
    activeElement instanceof Element
      ? activeElement.closest("[data-refresh-disruptive-focus]")
      : null;
  const focused =
    focusInsideOwnedRegion &&
    regions.some((region) => nodeIsInside(region, disruptiveFocusTarget));
  return {
    focused,
    editing: focusInsideOwnedRegion && isEditable(activeElement),
    selection: hasSelectionInside(regions, document.getSelection()),
  };
}

function hasSelectionInside(
  regions: readonly HTMLElement[],
  selection: Selection | null,
): boolean {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return false;
  }
  return regions.some(
    (region) =>
      nodeIsInside(region, selection.anchorNode) ||
      nodeIsInside(region, selection.focusNode),
  );
}

function nodeIsInside(region: HTMLElement, node: Node | null): boolean {
  return node !== null && (node === region || region.contains(node));
}

function isEditable(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element instanceof HTMLInputElement) {
    return !element.disabled && !element.readOnly && element.type !== "hidden";
  }
  if (element instanceof HTMLTextAreaElement) {
    return !element.disabled && !element.readOnly;
  }
  if (element instanceof HTMLSelectElement) return !element.disabled;
  return (
    element.isContentEditable ||
    element.closest('[contenteditable]:not([contenteditable="false"])') !== null
  );
}

function sameActivity(
  current: OwnedRegionActivity,
  next: OwnedRegionActivity,
): boolean {
  return (
    current.focused === next.focused &&
    current.editing === next.editing &&
    current.selection === next.selection
  );
}
