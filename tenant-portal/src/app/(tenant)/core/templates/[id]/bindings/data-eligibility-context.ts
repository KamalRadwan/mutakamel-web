"use client";
import { createContext, useContext } from "react";
import type { DataEligibilityPort } from "./data-eligibility";

export const DataEligibilityContext = createContext<DataEligibilityPort | null>(null);
export function useDataEligibility() { return useContext(DataEligibilityContext); }
