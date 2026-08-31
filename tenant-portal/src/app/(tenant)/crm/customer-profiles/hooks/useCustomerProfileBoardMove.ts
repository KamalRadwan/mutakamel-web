"use client";

import { useCallback, useMemo, useState } from "react";
import { useToast, type BoardCardMove } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type {
  CustomerProfileItem,
  CustomerProfileStatus,
} from "./useCustomerProfiles";
import { useUpdateCustomerProfileStatus } from "./useUpdateCustomerProfileStatus";

/**
 * The board's optimistic status move — MASTER-PLAN 8.7's drag path.
 *
 * Lifted out of `page.tsx` because `AGENTS.md` puts state, effects and handlers
 * in a hook and leaves `.tsx` files holding markup: the page carried the
 * override map, the mutation and the toast routing inline.
 *
 * The override map exists because the list hook is read-only and paginated —
 * it owns `items` and exposes no setter, and it does not need one. A move that
 * fails simply clears its own override.
 */
export function useCustomerProfileBoardMove(
  items: CustomerProfileItem[],
  reload: () => Promise<void> | void,
) {
  const { t } = useI18n();
  const toast = useToast();
  const { updateStatus } = useUpdateCustomerProfileStatus();
  const [overrides, setOverrides] = useState<
    Record<string, CustomerProfileStatus>
  >({});

  const displayItems = useMemo(
    () =>
      items.map((item) =>
        item.id in overrides ? { ...item, status: overrides[item.id] } : item,
      ),
    [items, overrides],
  );

  const handleCardMove = useCallback(
    async (move: BoardCardMove) => {
      const status = move.toColumnId as CustomerProfileStatus;
      setOverrides((current) => ({ ...current, [move.itemId]: status }));
      const result = await updateStatus(move.itemId, status);
      setOverrides((current) => {
        const next = { ...current };
        delete next[move.itemId];
        return next;
      });

      if (result.ok) {
        // A replay means the move already applied — saying so keeps it from
        // reading as a second, duplicate write (S8).
        if (result.replayed) {
          toast.info(
            t.errors.idempotencyReplayedTitle,
            t.errors.idempotencyReplayedDescription,
          );
        }
        await reload();
        return;
      }
      // 429 and the two idempotency conflicts each need their own surface: a
      // generic "the move failed" tells the user to retry something that must
      // not be retried (S8, S9).
      if (!toast.outcomeFromApi(result.error)) {
        toast.errorFromApi(t.crmCustomerProfiles.moveFailed, result.error);
      }
    },
    [reload, t, toast, updateStatus],
  );

  return { displayItems, handleCardMove };
}
