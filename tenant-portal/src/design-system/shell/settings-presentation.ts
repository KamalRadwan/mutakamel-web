"use client";

import { createContext, useContext } from "react";

// React context also reaches dialog/action-bar portals without changing the
// shell's height chain or applying Settings density to other workspaces.
export const SettingsPresentationContext = createContext(false);

export function useSettingsPresentation() {
  return useContext(SettingsPresentationContext);
}
