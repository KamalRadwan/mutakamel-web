"use client";
import { createContext, useContext } from "react";
import type { DescriptorBoundDesignerProvider } from "../../designer-native-context";
import type { useTemplateDesignEditor } from "../hooks/useTemplateDesignEditor";
export interface DesignerExtensionScope {
  readonly editor: ReturnType<typeof useTemplateDesignEditor>;
  readonly provider: DescriptorBoundDesignerProvider;
  readonly onRichSession: (pending: boolean) => void;
}
export const DesignerExtensionContext = createContext<DesignerExtensionScope | null>(null);
export function useDesignerExtensionScope() {
  const scope = useContext(DesignerExtensionContext);
  if (!scope) throw new Error("Designer extension requires its owner-bound host");
  return scope;
}
