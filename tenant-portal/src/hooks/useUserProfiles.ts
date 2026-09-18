"use client";

import { useEffect, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { normalizeApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import { readUserContactProfile, USER_PROFILE_READ_PERMISSION, type UserProfileResult } from "@/lib/people/user-profile";

/** One scoped lookup per unique user; reuse across before/after values and pages. */
export function useUserProfiles(userIds: readonly string[], enabled = true, refreshToken?: object | number) {
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const canRead = user?.permissions.includes(USER_PROFILE_READ_PERMISSION) ?? false;
  const idsKey = [...new Set(userIds.filter(isUUIDv7))].sort().join(",");
  const scope = JSON.stringify([enabled, user?.id, realtimeAuthGeneration, user?.permissions, user?.accessibleBranches, user?.accessibleCompanies, user?.teamMemberships]);
  const cache = useRef<{ scope: string; refreshToken?: object | number; entries: Map<string, UserProfileResult> }>({ scope: "", entries: new Map() });
  const [snapshot, setSnapshot] = useState<{ scope: string; refreshToken?: object | number; entries: ReadonlyMap<string, UserProfileResult> }>({ scope: "", entries: new Map() });
  const [retryCount, setRetryCount] = useState(0);
  const actorId = user?.id;

  useEffect(() => {
    const controller = new AbortController();
    if (cache.current.scope !== scope || cache.current.refreshToken !== refreshToken) {
      cache.current = { scope, refreshToken, entries: new Map() };
    }
    const entries = cache.current.entries;
    const ids = idsKey ? idsKey.split(",") : [];
    const pending = enabled && canRead && actorId
      ? ids.filter((id) => id !== actorId && (!entries.has(id) || entries.get(id)?.status === "error" || entries.get(id)?.status === "loading")) : [];
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      for (const id of pending) entries.set(id, { status: "loading", profile: null });
      setSnapshot({ scope, refreshToken, entries: new Map(entries) });
      // Keep at most four reads in flight, including long histories with many owners.
      let index = 0;
      const worker = async () => {
        while (!controller.signal.aborted && index < pending.length) {
          const id = pending[index++];
          let result: UserProfileResult;
          try {
            result = { status: "ready", profile: await readUserContactProfile(id, controller.signal) };
          } catch (error) {
            const status = normalizeApiError(error).status;
            result = { status: status === 403 ? "forbidden" : status === 404 ? "unavailable" : "error", profile: null };
          }
          if (controller.signal.aborted) return;
          entries.set(id, result);
          setSnapshot({ scope, refreshToken, entries: new Map(entries) });
        }
      };
      void Promise.all(Array.from({ length: Math.min(4, pending.length) }, worker));
    });
    return () => controller.abort();
  }, [actorId, canRead, enabled, idsKey, refreshToken, retryCount, scope]);

  const profiles = new Map<string, UserProfileResult>();
  for (const id of idsKey ? idsKey.split(",") : []) {
    if (enabled && user && id === user.id) {
      const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
      profiles.set(id, fullName ? { status: "ready", profile: {
        id, fullName, email: user.email, phone: null, imageUrl: null,
      } } : { status: "unavailable", profile: null });
    } else if (!enabled || !canRead) {
      profiles.set(id, { status: "forbidden", profile: null });
    } else {
      profiles.set(id, (snapshot.scope === scope && snapshot.refreshToken === refreshToken ? snapshot.entries.get(id) : undefined) ?? { status: "loading", profile: null });
    }
  }
  return { profiles, retry: () => setRetryCount((count) => count + 1) };
}
