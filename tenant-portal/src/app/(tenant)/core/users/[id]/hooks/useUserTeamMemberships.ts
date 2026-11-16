"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { computeReplacementDiff, type ReplacementDiff } from "@/design-system";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import {
  addTeamMembership,
  fetchTeamMemberships,
  removeTeamMembership,
  replaceTeamMemberships,
  type TeamMembership,
  type TeamMembershipInput,
  type TeamMembershipRole,
} from "../../../contracts/user-subresource-contract";

export interface TeamMembershipDraftItem {
  teamId: string;
  role: TeamMembershipRole;
  isPrimary: boolean;
}

interface ScopedState<T> {
  userId: string;
  value: T;
}

function scopedForUser<T>(state: ScopedState<T> | null, userId: string): T | null {
  return state?.userId === userId ? state.value : null;
}

export function useUserTeamMemberships(
  userId: string,
  enabled: boolean,
  canWrite: boolean = enabled,
) {
  const [memberships, setMemberships] = useState<TeamMembership[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [baselineStamp, setBaselineStamp] = useState<{
    userId: string;
    token: number;
  } | null>(null);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [writeErrorState, setWriteErrorState] =
    useState<ScopedState<NormalizedApiError> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [addOpenUserId, setAddOpenUserId] = useState<string | null>(null);
  const [removalState, setRemovalState] =
    useState<ScopedState<TeamMembership> | null>(null);
  const [draftState, setDraftState] =
    useState<ScopedState<TeamMembershipDraftItem[]> | null>(null);
  const [reviewUserId, setReviewUserId] = useState<string | null>(null);

  const hasBaseline =
    baselineStamp?.userId === userId && baselineStamp.token === reloadToken;
  const activeMemberships = useMemo(
    () => enabled && hasBaseline ? memberships : [],
    [enabled, hasBaseline, memberships],
  );
  const writeReady =
    enabled && canWrite && isUUIDv7(userId) && hasBaseline && !isLoading && !loadError;
  const writeError = scopedForUser(writeErrorState, userId);
  const pendingRemoval = scopedForUser(removalState, userId);
  const draft = scopedForUser(draftState, userId);

  const inFlightRef = useRef(false);
  const latestRef = useRef({
    userId,
    canWrite,
    writeReady,
    memberships: activeMemberships,
    removalState,
    draftState,
  });

  useEffect(() => {
    latestRef.current = {
      userId,
      canWrite,
      writeReady,
      memberships: activeMemberships,
      removalState,
      draftState,
    };
  });

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (!enabled || !isUUIDv7(userId)) {
        setIsLoading(false);
        setBaselineStamp(null);
        return;
      }
      setIsLoading(true);
      setLoadError(null);
      setBaselineStamp(null);
      fetchTeamMemberships(userId, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          setMemberships(result);
          setBaselineStamp({ userId, token: reloadToken });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setMemberships([]);
          setLoadError(normalizeApiError(error));
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    });
    return () => controller.abort();
  }, [enabled, reloadToken, userId]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);
  const clearWriteError = useCallback(() => setWriteErrorState(null), []);

  const setDraft: Dispatch<SetStateAction<TeamMembershipDraftItem[] | null>> = useCallback(
    (action) => {
      const targetUserId = latestRef.current.userId;
      const prev = scopedForUser(latestRef.current.draftState, targetUserId);
      const next = typeof action === "function" ? action(prev) : action;
      const scoped = next ? { userId: targetUserId, value: next } : null;
      latestRef.current.draftState = scoped;
      setDraftState(scoped);
    },
    [],
  );

  const runWrite = useCallback(
    async (targetUserId: string, work: () => Promise<void>): Promise<boolean> => {
      if (inFlightRef.current) return false;
      inFlightRef.current = true;
      setIsSubmitting(true);
      setWriteErrorState(null);
      try {
        await work();
        reload();
        return true;
      } catch (error) {
        setWriteErrorState({ userId: targetUserId, value: normalizeApiError(error) });
        return false;
      } finally {
        inFlightRef.current = false;
        setIsSubmitting(false);
      }
    },
    [reload],
  );

  const add = useCallback(
    (membership: TeamMembershipInput): Promise<boolean> => {
      const state = latestRef.current;
      if (inFlightRef.current || !state.writeReady) return Promise.resolve(false);
      return runWrite(state.userId, async () => {
        await addTeamMembership(state.userId, membership);
      });
    },
    [runWrite],
  );

  const remove = useCallback((): Promise<boolean> => {
    const state = latestRef.current;
    const activeRemoval = scopedForUser(state.removalState, state.userId);
    if (inFlightRef.current || !activeRemoval || !state.writeReady) {
      if (!state.canWrite) setRemovalState(null);
      return Promise.resolve(false);
    }
    return runWrite(state.userId, async () => {
      await removeTeamMembership(state.userId, activeRemoval.id);
      latestRef.current.removalState = null;
      setRemovalState(null);
    });
  }, [runWrite]);

  const commitDraft = useCallback((): Promise<boolean> => {
    const state = latestRef.current;
    const activeDraft = scopedForUser(state.draftState, state.userId);
    if (inFlightRef.current || !activeDraft || activeDraft.length === 0 || !state.writeReady) {
      if (!state.canWrite) setReviewUserId(null);
      return Promise.resolve(false);
    }
    return runWrite(state.userId, async () => {
      await replaceTeamMemberships(
        state.userId,
        activeDraft.map(({ teamId, role, isPrimary }) => ({ teamId, role, isPrimary })),
      );
      setDraft(null);
      setReviewUserId(null);
    });
  }, [runWrite, setDraft]);

  const draftDiff = useCallback(
    (describe: (item: TeamMembershipDraftItem) => { label: string; hint?: string }): ReplacementDiff =>
      computeReplacementDiff(
        activeMemberships.map((m) => ({
          id: `${m.teamId}:${m.role}:${String(m.isPrimary)}`,
          ...describe({ teamId: m.teamId, role: m.role, isPrimary: m.isPrimary }),
        })),
        (draft ?? []).map((item) => ({
          id: `${item.teamId}:${item.role}:${String(item.isPrimary)}`,
          ...describe(item),
        })),
      ),
    [activeMemberships, draft],
  );

  const setPrimaryTeam = useCallback(
    (teamId: string) => {
      setDraft((current) =>
        current ? current.map((item) => ({ ...item, isPrimary: item.teamId === teamId })) : null,
      );
    },
    [setDraft],
  );

  return {
    memberships: activeMemberships,
    isLoading,
    loadError,
    writeError,
    clearWriteError,
    isSubmitting,
    reload,
    isAddOpen: addOpenUserId === userId && canWrite,
    openAdd: () => {
      const state = latestRef.current;
      if (inFlightRef.current || !state.writeReady) return;
      setWriteErrorState(null);
      setAddOpenUserId(state.userId);
    },
    closeAdd: () => {
      if (!inFlightRef.current) {
        setWriteErrorState(null);
        setAddOpenUserId(null);
      }
    },
    add,
    pendingRemoval,
    requestRemoval: (target: TeamMembership | null) => {
      const state = latestRef.current;
      if (target && (inFlightRef.current || !state.writeReady)) return;
      setWriteErrorState(null);
      const scoped = target ? { userId: state.userId, value: target } : null;
      latestRef.current.removalState = scoped;
      setRemovalState(scoped);
    },
    cancelRemoval: () => {
      if (!inFlightRef.current) {
        latestRef.current.removalState = null;
        setRemovalState(null);
        setWriteErrorState(null);
      }
    },
    remove,
    draft,
    setDraft,
    setPrimaryTeam,
    startReplace: () => {
      const state = latestRef.current;
      if (inFlightRef.current || !state.writeReady) return;
      setWriteErrorState(null);
      setDraft(state.memberships.map(({ teamId, role, isPrimary }) => ({ teamId, role, isPrimary })));
    },
    cancelReplace: () => {
      if (!inFlightRef.current) {
        setDraft(null);
        setReviewUserId(null);
        setWriteErrorState(null);
      }
    },
    isReviewing: reviewUserId === userId && canWrite && draft !== null,
    review: () => {
      const state = latestRef.current;
      if (!inFlightRef.current && state.writeReady && scopedForUser(state.draftState, state.userId)) {
        setReviewUserId(state.userId);
      }
    },
    closeReview: () => {
      if (!inFlightRef.current) setReviewUserId(null);
    },
    commitDraft,
    draftDiff,
  };
}
