"use client";
import { createContext, useContext } from "react";
import type { InspectorExtensionPorts, InspectorFontMetadata, InspectorImageCropPort } from "./inspector-ports";
import type { InspectorCurrencyQualification } from "./inspector-currency";

export const InspectorPortsContext = createContext<{ fonts: readonly InspectorFontMetadata[]; extensions: InspectorExtensionPorts; disabled: boolean; imageCrop?: InspectorImageCropPort; currency?: InspectorCurrencyQualification }>({ fonts: [], extensions: {}, disabled: true });
export function useInspectorPorts() { return useContext(InspectorPortsContext); }
