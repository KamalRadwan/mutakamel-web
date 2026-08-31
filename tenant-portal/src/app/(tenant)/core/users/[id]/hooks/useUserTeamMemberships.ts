"use client";

import { useCallback, useEffect, useState } from "react";
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
} from "../../../contracts/user-subresource-contract";

export function useUserTeamMemberships(userId: string, enabled: boolean) {
  const [memberships, setMemberships] = useState<TeamMembership[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [writeError, setWriteError] = useState<NormalizedApiError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [pendingRemoval, setPendingRemoval] = useState<TeamMembership | null>(null);
  /** null when the replacement editor is closed. */
  const [draftTeamIds, setDraftTeamIds] = useState<string[] | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);

  useEffect(() => {
    // Deferred past the effect body on purpose: a synchronous setState there
    // cascades an extra render (react-hooks/set-state-in-effect), and the abort
    // check means a torn-down screen never writes at all.
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (!enabled || !isUUIDv7(userId)) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setLoadError(null);
      fetchTeamMemberships(userId, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setMemberships(result);
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

  const runWrite = useCallback(
    async (work: () => Promise<void>) => {
      setIsSubmitting(true);
      setWriteError(null);
      try {
        await work();
        reload();
      } catch (error) {
        setWriteError(normalizeApiError(error));
      } finally {
        setIsSubmitting(false);
      }
    },
    [reload],
  );

  const add = useCallback(
    (membership: TeamMembershipInput) =>
      runWrite(async () => {
        await addTeamMembership(userId, membership);
      }),
    [runWrite, userId],
  );

  const remove = useCallback(() => {
    const target = pendingRemoval;
    if (!target) return Promise.resolve();
    return runWrite(async () => {
      await removeTeamMembership(userId, target.id);
      setPendingRemoval(null);
    });
  }, [pendingRemoval, runWrite, userId]);

  /**
   * The `PUT` takes the whole collection, so a team kept in the draft keeps the
   * role and primary flag the server already holds; only a newly added team
   * defaults, and it defaults to the DTO's own default rather than a guess.
   */
  const commitDraft = useCallback(() => {
    const ids = draftTeamIds;
    if (!ids || ids.length === 0) return Promise.resolve();
    const current = new Map(memberships.map((membership) => [membership.teamId, membership]));
    return runWrite(async () => {
      await replaceTeamMemberships(
        userId,
        ids.map((teamId) => {
          const existing = current.get(teamId);
          return {
            teamId,
            role: existing?.role ?? "MEMBER",
            isPrimary: existing?.isPrimary ?? false,
          };
        }),
      );
      setDraftTeamIds(null);
      setIsReviewing(false);
    });
  }, [draftTeamIds, memberships, runWrite, userId]);

  const draftDiff = useCallback(
    (labelFor: (teamId: string) => string): ReplacementDiff =>
      computeReplacementDiff(
        memberships.map((membership) => ({
          id: membership.teamId,
          label: labelFor(membership.teamId),
        })),
        (draftTeamIds ?? []).map((teamId) => ({ id: teamId, label: labelFor(teamId) })),
      ),
    [draftTeamIds, memberships],
  );

  return {
    memberships,
    isLoading,
    loadError,
    writeError,
    isSubmitting,
    reload,
    add,
    pendingRemoval,
    requestRemoval: setPendingRemoval,
    cancelRemoval: () => setPendingRemoval(null),
    remove,
    draftTeamIds,
    setDraftTeamIds,
    startReplace: () =>
      setDraftTeamIds(memberships.map((membership) => membership.teamId)),
    cancelReplace: () => {
      setDraftTeamIds(null);
      setIsReviewing(false);
    },
    isReviewing,
    review: () => setIsReviewing(true),
    closeReview: () => setIsReviewing(false),
    commitDraft,
    draftDiff,
  };
}
