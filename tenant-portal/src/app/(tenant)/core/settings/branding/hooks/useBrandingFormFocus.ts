"use client";

import { useCallback, useRef } from "react";
import type { BrandingFormValues } from "../branding-contract";

export function useBrandingFormFocus() {
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);
  const fieldElementsRef = useRef<Record<keyof BrandingFormValues, HTMLInputElement | null>>({
    appName: null,
    tabTitle: null,
    primaryColor: null,
    secondaryColor: null,
  });

  const setErrorSummaryNode = useCallback((node: HTMLDivElement | null) => {
    errorSummaryRef.current = node;
  }, []);
  const setAppNameNode = useCallback((node: HTMLInputElement | null) => {
    fieldElementsRef.current.appName = node;
  }, []);
  const setTabTitleNode = useCallback((node: HTMLInputElement | null) => {
    fieldElementsRef.current.tabTitle = node;
  }, []);
  const setPrimaryColorNode = useCallback((node: HTMLInputElement | null) => {
    fieldElementsRef.current.primaryColor = node;
  }, []);
  const setSecondaryColorNode = useCallback((node: HTMLInputElement | null) => {
    fieldElementsRef.current.secondaryColor = node;
  }, []);

  const focusField = useCallback((field: keyof BrandingFormValues) => {
    fieldElementsRef.current[field]?.focus();
  }, []);

  const focusErrorSummary = useCallback(() => {
    queueMicrotask(() => errorSummaryRef.current?.focus());
  }, []);

  return {
    setErrorSummaryNode,
    setAppNameNode,
    setTabTitleNode,
    setPrimaryColorNode,
    setSecondaryColorNode,
    focusField,
    focusErrorSummary,
  };
}
