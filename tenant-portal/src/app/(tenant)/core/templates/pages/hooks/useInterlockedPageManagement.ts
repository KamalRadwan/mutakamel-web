"use client";
import { useMemo, useSyncExternalStore } from "react";
import type { PageController } from "../page-controller";
import { createTextInterlockedPageController, guardPageCallback, type PageTextInterlock } from "../page-text-interlock";
import { usePageManagement } from "./usePageManagement";

export function useInterlockedPageManagement(base: PageController, interlock: PageTextInterlock, locale: "ar-EG" | "en-US") {
  const controller = useMemo(() => createTextInterlockedPageController(base, interlock), [base, interlock]);
  const text = useSyncExternalStore(interlock.subscribe, interlock.getSnapshot, interlock.getSnapshot);
  const { state, document, copy, errorRef, fixed, flow, explicit, active, selected, paginationSelected, setup, zoneBase, removal,
    status, pageLabel, openSetup, closeSetup, openZones, closeZones, add, duplicate, requestRemoval, closeRemoval, confirmRemoval, removalDescription } = usePageManagement(controller, locale);
  return { controller, textActive: text.active, state, document, copy, errorRef, fixed, flow, explicit, active, selected, paginationSelected,
    setup, zoneBase, removal, status, pageLabel, removalDescription,
    openSetup: guardPageCallback(interlock, openSetup), closeSetup: guardPageCallback(interlock, closeSetup),
    openZones: guardPageCallback(interlock, openZones), closeZones: guardPageCallback(interlock, closeZones),
    add: guardPageCallback(interlock, add), duplicate: guardPageCallback(interlock, duplicate),
    requestRemoval: guardPageCallback(interlock, requestRemoval), closeRemoval: guardPageCallback(interlock, closeRemoval),
    confirmRemoval: guardPageCallback(interlock, confirmRemoval),
  };
}
