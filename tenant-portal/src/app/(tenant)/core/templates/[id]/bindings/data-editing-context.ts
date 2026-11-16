"use client";
import { createContext, useContext } from "react";

export const DataEditingContext = createContext(false);
export function useDataEditingDisabled() { return useContext(DataEditingContext); }
