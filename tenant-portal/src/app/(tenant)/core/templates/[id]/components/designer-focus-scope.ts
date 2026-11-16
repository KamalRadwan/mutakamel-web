"use client";
import { createContext, type RefObject } from "react";
/** The actual current editor/settings subtree; never document.body. */
export const DesignerFocusScopeContext = createContext<RefObject<HTMLDivElement | null> | null>(null);
