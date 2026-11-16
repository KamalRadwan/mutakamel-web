"use client";

import { createContext, useContext } from "react";

export const AnalyticsPresentationContext = createContext(false);

/** Analytics keeps its title and actions together in the workspace header. */
export function useAnalyticsPresentation() {
  return useContext(AnalyticsPresentationContext);
}
