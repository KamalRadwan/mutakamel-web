"use client";

import { useMemo } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import {
  accessModeCapabilities,
  isAccessMode,
  type AccessMode,
  type AccessModeCapabilities,
} from "@/lib/access-mode";

export interface AccessModeState extends AccessModeCapabilities {
  /** null until a server contract actually carries the value — see the TODO below. */
  mode: AccessMode | null;
  /** false means "the browser cannot know", not "the tenant has full access". */
  isResolved: boolean;
}

function readAccessMode(source: unknown): AccessMode | null {
  if (typeof source !== "object" || source === null) return null;
  const candidate = (source as { accessMode?: unknown }).accessMode;
  return isAccessMode(candidate) ? candidate : null;
}

// TODO(access-mode): there is no client-readable source for the tenant's
// access mode on any route this portal may call for a general staff user.
//
// Proven, 2026-08-30:
//   - GET /api/tenant/core/v1/auth/me returns TenantMe, which has no
//     accessMode field —
//     ../backend/mutakamel-apps/core-app/src/tenant/tenant-auth/tenant-auth.service.ts
//   - The only tenant-audience route that projects it is
//     GET /api/tenant/core/v1/billing/summary (subscription.accessMode), and
//     TenantBillingController is guarded by TenantOwnerGuard — so every
//     non-owner user gets 403 there, not a mode.
//   - Enforcement itself lives server-side in SubscriptionEnforcementGuard,
//     which answers 403 ACCESS_POLICY_BLOCKED. That is a rejection after the
//     fact, not a mode the UI can read before offering an action.
//
// Recorded as Q16 in docs/build/OPEN-QUESTIONS.md. When /auth/me grows the
// field, nothing here changes but the shape it is read from — every consumer
// already takes AccessMode | null and every capability rule is written.
//
// Until then this reports unresolved, and accessModeCapabilities() reports
// full capability for an unresolved mode on purpose: client checks are
// advisory, the backend is authoritative, and failing closed on a value the
// browser cannot read would seal the product for every non-owner user.
export function useAccessMode(): AccessModeState {
  const { user } = useTenantAuth();

  return useMemo(() => {
    const mode = readAccessMode(user);
    return { mode, isResolved: mode !== null, ...accessModeCapabilities(mode) };
  }, [user]);
}
