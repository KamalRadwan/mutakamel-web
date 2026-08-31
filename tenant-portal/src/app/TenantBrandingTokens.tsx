"use client";

import { useEffect } from "react";
import { applyBrandingTokens } from "@/lib/branding/apply-branding";
import { fetchPublicBranding } from "@/lib/branding/public-branding";

/**
 * Mounts in the **root** layout, so the tenant's brand reaches the login screen
 * as well as the shell — `GET /branding/public` is `@Public()` and resolves from
 * the request host, which is exactly why it can run pre-auth.
 *
 * It renders nothing and it never surfaces a failure. Branding is decoration
 * layered over a complete design system; a tenant whose branding call fails
 * gets the system brand, not a broken page. The one place a refusal is
 * *reported* is the branding settings screen, which re-derives the same verdict
 * from the colour the owner typed.
 */
export function TenantBrandingTokens() {
  useEffect(() => {
    const controller = new AbortController();
    void fetchPublicBranding(controller.signal)
      .then((branding) => {
        if (!controller.signal.aborted) applyBrandingTokens(branding);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return null;
}
