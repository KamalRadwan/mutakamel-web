// Wire values copied verbatim from
// ../backend/mutakamel-apps/core-app/packages/common/src/enums/access-mode.enum.ts
// (AccessModeEnum). Never extend this list by guessing.
export const ACCESS_MODES = ["FULL", "DUNNING", "READ_ONLY", "BLOCKED"] as const;

export type AccessMode = (typeof ACCESS_MODES)[number];

export function isAccessMode(value: unknown): value is AccessMode {
  return typeof value === "string" && (ACCESS_MODES as readonly string[]).includes(value);
}

export interface AccessModeCapabilities {
  /** The tenant may read this workspace at all. */
  canRead: boolean;
  /** A mutating affordance may be offered. */
  canMutate: boolean;
  /** Some restriction is in force and the user should be told why. */
  isRestricted: boolean;
}

// Mirrors SubscriptionEnforcementGuard.enforceAccessMode in
// ../backend/mutakamel-apps/core-app/src/common/guards/subscription-enforcement.guard.ts:
//
//   BLOCKED    every request, read or write, throws 403 ACCESS_POLICY_BLOCKED
//   READ_ONLY  writes throw; reads pass
//   DUNNING    writes throw unless the route carries @AllowedDuringDunning()
//   FULL       nothing is refused on this axis
//
// The DUNNING carve-out is per-route metadata the browser cannot see, so a
// screen that hosts an allowed-during-dunning action (billing payment) opts
// back in explicitly rather than this helper trying to infer it.
//
// An unresolved mode (null) reports full capability on purpose. Client checks
// are advisory and the backend is authoritative — failing closed on a value
// the browser has no way to read would seal the whole product on every user
// who is not the tenant owner. See docs/build/OPEN-QUESTIONS.md (Q16).
export function accessModeCapabilities(mode: AccessMode | null): AccessModeCapabilities {
  switch (mode) {
    case "BLOCKED":
      return { canRead: false, canMutate: false, isRestricted: true };
    case "READ_ONLY":
    case "DUNNING":
      return { canRead: true, canMutate: false, isRestricted: true };
    case "FULL":
    case null:
      return { canRead: true, canMutate: true, isRestricted: false };
  }
}
