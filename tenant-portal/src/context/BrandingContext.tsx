"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { applyBrandingTokens } from "@/lib/branding/apply-branding";
import { fetchPublicBranding, type PublicBranding } from "@/lib/branding/public-branding";
import { generateUUIDv7 } from "@/lib/uuid";

/**
 * The tenant's own name and logo, shared for the whole document and updated
 * from successful settings writes.
 *
 * This replaces `app/TenantBrandingTokens.tsx`, which ran the same fetch and
 * threw the response away after writing the colour tokens. The global nav's
 * brand zone needs two of the fields that response already carried — `appName`
 * and `logoUrl` — and a second fetch for them would be a second round trip for
 * bytes the first one delivered.
 *
 * Mounted in the **root** layout, so the tenant's brand reaches the login
 * screen as well as the shell: `GET /branding/public` is `@Public()` and
 * resolves from the request host, which is exactly why it can run pre-auth.
 *
 * It never surfaces a failure. Branding is decoration layered over a complete
 * design system; a tenant whose branding call fails gets the system brand, not
 * a broken page, and the brand zone falls back to the product wordmark. The one
 * place a refusal is *reported* is the branding settings screen, which
 * re-derives the same verdict from the colour the owner typed.
 */
export interface TenantBranding {
  /** The tenant's display name, or `null` for the product's own wordmark. */
  appName: string | null;
  /**
   * A same-origin path to Core's logo route, never a free-form URL —
   * `parsePublicBranding` validates the path before a local cache key is added.
   */
  logoUrl: string | null;
  updateBranding: (branding: Omit<PublicBranding, "loginHtml">) => void;
}

const EMPTY: TenantBranding = { appName: null, logoUrl: null, updateBranding: () => undefined };

const BrandingContext = createContext<TenantBranding>(EMPTY);

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<Pick<TenantBranding, "appName" | "logoUrl">>(EMPTY);
  const revision = useRef(0);

  const updateBranding = useCallback((saved: Omit<PublicBranding, "loginHtml">) => {
    revision.current += 1;
    // Public asset routes cache for five minutes; each write needs fresh bytes.
    const version = generateUUIDv7();
    const response: PublicBranding = {
      ...saved,
      loginHtml: null,
      logoUrl: saved.logoUrl ? `${saved.logoUrl}?v=${version}` : null,
      iconUrl: saved.iconUrl ? `${saved.iconUrl}?v=${version}` : null,
    };
    applyBrandingTokens(response);
    setBranding({ appName: response.appName, logoUrl: response.logoUrl });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const requestedRevision = revision.current;
    void fetchPublicBranding(controller.signal)
      .then((response: PublicBranding) => {
        if (controller.signal.aborted || revision.current !== requestedRevision) return;
        applyBrandingTokens(response);
        setBranding({ appName: response.appName, logoUrl: response.logoUrl });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const value = useMemo(
    () => ({ appName: branding.appName, logoUrl: branding.logoUrl, updateBranding }),
    [branding.appName, branding.logoUrl, updateBranding],
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

/** Never throws outside the provider: an unbranded tenant is the default. */
export function useTenantBranding(): TenantBranding {
  return useContext(BrandingContext);
}
