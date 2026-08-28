"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { WebphoneCopy } from "../copy";
import type { WebphoneHttpClient } from "../http";

export type WebphoneContextValue = {
  /** Portal API base, e.g. `/api/admin/webphone/v1`. */
  basePath: string;
  /** The portal's own HTTP client, which owns auth and session handling. */
  http: WebphoneHttpClient;
  /** The portal's session gate — the phone only loads while this is true. */
  active: boolean;
  /** User-facing strings resolved to the portal's current language. */
  copy: WebphoneCopy;
};

export type WebphoneProviderProps = WebphoneContextValue & {
  children: ReactNode;
};

const WebphoneContext = createContext<WebphoneContextValue | null>(null);

export function WebphoneProvider({
  basePath,
  http,
  active,
  copy,
  children,
}: WebphoneProviderProps) {
  const value = useMemo(
    () => ({ basePath, http, active, copy }),
    [basePath, http, active, copy],
  );

  return (
    <WebphoneContext.Provider value={value}>
      {children}
    </WebphoneContext.Provider>
  );
}

export function useWebphoneContext() {
  const context = useContext(WebphoneContext);
  if (!context) {
    throw new Error("WebPhone components require a WebphoneProvider ancestor.");
  }
  return context;
}
