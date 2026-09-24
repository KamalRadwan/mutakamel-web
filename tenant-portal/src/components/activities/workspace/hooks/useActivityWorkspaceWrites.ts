"use client";

import { useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useToast, type BoardCardMove } from "@/design-system";
import { useAccessMode } from "@/hooks/useAccessMode";
import type { Activity, ActivityStatus } from "../../activity-contract";
import {
  canActOnActivity,
  canCreateActivities,
  isOpenActivityStatus,
  type ActivityAction,
} from "../../activity-presentation";
import type { ActivityModalRequest } from "../../ActivityModal";
import { useActivityCommands, type ActivityCommandResult } from "../../hooks/useActivityCommands";
import { useActivityOutcome } from "../../hooks/useActivityOutcome";

/** What a row's or a card's actions menu may do, and to which activity. */
export interface ActivityRowActions {
  view: (activity: Activity) => void;
  edit: (activity: Activity) => void;
  setStatus: (activity: Activity, status: "PLANNED" | "IN_PROGRESS") => void;
  complete: (activity: Activity) => void;
  cancel: (activity: Activity) => void;
  /** Advisory, per activity: assignee or creator, or the `.all` grant. Core decides. */
  can: (action: ActivityAction, activity: Activity) => boolean;
  /** A write is in flight, or its outcome is unknown; every menu waits for it. */
  busy: boolean;
}

export interface ActivityBoardMoves {
  canDrag: (activity: Activity) => boolean;
  canMoveTo: (activity: Activity, status: string) => boolean;
  confirmMove: (move: BoardCardMove) => boolean;
  onCardMove: (move: BoardCardMove) => void;
}

export interface ActivityWorkspaceWritesInput {
  /** Reads the KPIs and the view on screen again. */
  refresh: () => void;
  refreshSummary: () => void;
  /** The board, while it is on screen: a status change there moves its card first. */
  board: { statuses: readonly ActivityStatus[]; items: Activity[]; place: (activity: Activity) => void } | null;
}

// The lifecycle's moves out of an open status, and the grant each needs.
// Nothing moves out of DONE or CANCELLED — they never change again.
const MOVE_ACTION: Readonly<Record<string, ActivityAction | undefined>> = {
  PLANNED: "update",
  IN_PROGRESS: "update",
  DONE: "complete",
  CANCELLED: "cancel",
};

function moveAction(from: string, to: string): ActivityAction | null {
  return from !== to && isOpenActivityStatus(from) ? MOVE_ACTION[to] ?? null : null;
}

/**
 * Every write the workspace makes itself — the board's moves and the row and
 * card menus — plus the one template modal and the one outcome dialog it hosts.
 *
 * Results land where docs/design/patterns.md#where-a-result-belongs puts them:
 * a success toasts (inside the command hook) and reloads what is on screen, a
 * refusal is a toast, and an unknown outcome is held in-body with its key.
 */
export function useActivityWorkspaceWrites({ refresh, refreshSummary, board }: ActivityWorkspaceWritesInput) {
  const { user } = useTenantAuth();
  // A tenant in a read-only access mode keeps reading its activities and changes none of them.
  const { canMutate } = useAccessMode();
  const toast = useToast();
  const commands = useActivityCommands();
  const [request, setRequest] = useState<ActivityModalRequest | null>(null);

  function settle(result: ActivityCommandResult) {
    if (result.kind === "ambiguous") return;
    // A 403 carries no message: the transport has already said it.
    if (result.kind !== "saved" && result.message) {
      if (result.kind === "applied") toast.warning(result.message);
      else toast.error(result.message);
    }
    if (result.kind !== "failed") refresh();
  }

  const outcome = useActivityOutcome(commands, settle);
  // An unknown outcome holds everything until it is retried or dismissed: a
  // later write must not take its place, or its key would be lost.
  const busy = commands.busy;
  const can = (action: ActivityAction, activity: Activity) => canMutate && canActOnActivity(user, action, activity);
  const canMoveTo = (activity: Activity, status: string) => {
    const action = moveAction(activity.status, status);
    return action !== null && can(action, activity);
  };

  async function setStatus(activity: Activity, status: "PLANNED" | "IN_PROGRESS") {
    // On the board the card moves at once, and moves back if Core refuses.
    const lanes = board !== null && board.items.some((item) => item.id === activity.id) ? board : null;
    lanes?.place({ ...activity, status });
    const result = await commands.setStatus(activity, status);
    if (lanes && result.kind === "saved") {
      // The answer is the card's new state, so only the counts need reading again.
      lanes.place(result.activity);
      refreshSummary();
      return;
    }
    // "applied" did happen: the card stays where the user put it until the refresh confirms it.
    if (result.kind !== "applied") lanes?.place(activity);
    settle(result);
  }

  function findOnBoard(id: string): Activity | undefined {
    return board?.items.find((item) => item.id === id);
  }

  const moves: ActivityBoardMoves = {
    canDrag: (activity) => !busy && (board?.statuses ?? []).some((status) => canMoveTo(activity, status)),
    // "Move to…" waits like the drag does: a move started now would jump the
    // card and bounce it straight back.
    canMoveTo: (activity, status) => !busy && canMoveTo(activity, status),
    // A drag is not checked against `canMoveTo` by the board, so it is checked
    // here. A finished activity never changes again, so a drop into Completed
    // or Cancelled only opens the outcome dialog — the card stays put until
    // Core has completed or cancelled it and the lanes are read again.
    confirmMove: (move) => {
      const activity = findOnBoard(move.itemId);
      if (!activity || !canMoveTo(activity, move.toColumnId)) return false;
      if (move.toColumnId === "DONE" || move.toColumnId === "CANCELLED") {
        outcome.start(move.toColumnId === "DONE" ? "complete" : "cancel", activity);
        return false;
      }
      return true;
    },
    onCardMove: (move) => {
      const activity = findOnBoard(move.itemId);
      if (activity && (move.toColumnId === "PLANNED" || move.toColumnId === "IN_PROGRESS")) {
        void setStatus(activity, move.toColumnId);
      }
    },
  };

  const rowActions: ActivityRowActions = {
    view: (activity) => setRequest({ kind: "view", activity }),
    edit: (activity) => setRequest({ kind: "edit", activity }),
    setStatus: (activity, status) => void setStatus(activity, status),
    complete: (activity) => outcome.start("complete", activity),
    cancel: (activity) => outcome.start("cancel", activity),
    can,
    busy,
  };

  return {
    commands,
    outcome,
    moves,
    rowActions,
    canCreate: canMutate && canCreateActivities(user),
    actorId: user?.id ?? null,
    modal: {
      request,
      openCreate: () => setRequest({ kind: "create" }),
      openCreateAt: (start: Date) => setRequest({ kind: "create", defaults: { start } }),
      close: () => setRequest(null),
    },
    retryAmbiguous: async () => settle(await commands.retry()),
    dismissAmbiguous: () => {
      // The user accepts not knowing; reading again is what shows whether it landed.
      commands.dismissAmbiguous();
      refresh();
    },
  };
}
