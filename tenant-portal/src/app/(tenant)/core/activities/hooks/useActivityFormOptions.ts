"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { fetchActivityAssignees, fetchActivityTypes } from "../activities-api";
import {
  ACTIVITY_ASSIGN_PERMISSION,
  type ActivityAssignee,
  type ActivityTypeOption,
} from "../activities-contract";

/**
 * The two catalogues the activity form needs.
 *
 * `GET /activities/assignees` requires `targetApp`, `targetType` **and**
 * `targetId`, and answers only with users eligible inside the authorised target
 * company. It is not a general user picker and is never called without a
 * resolved target.
 */
export function useActivityFormOptions(target: {
  targetApp: string;
  targetType: string;
  targetId: string;
}) {
  const { user } = useTenantAuth();
  const canAssign = user?.permissions.includes(ACTIVITY_ASSIGN_PERMISSION) ?? false;

  const [types, setTypes] = useState<ActivityTypeOption[]>([]);
  const [typesUnavailable, setTypesUnavailable] = useState(false);
  const [assignees, setAssignees] = useState<ActivityAssignee[]>([]);
  const [isLoadingAssignees, setIsLoadingAssignees] = useState(false);
  const [assigneesUnavailable, setAssigneesUnavailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      void (async () => {
        try {
          setTypes(await fetchActivityTypes(controller.signal));
          setTypesUnavailable(false);
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
          // Degrade rather than blank the form: the type list has a documented
          // fallback set, and a catalogue outage is not a form error.
          setTypesUnavailable(true);
        }
      })();
    });
    return () => controller.abort();
  }, []);

  const isTargetResolved = Boolean(target.targetId && target.targetType && target.targetApp);

  const loadAssignees = useCallback(
    async (search: string): Promise<void> => {
      if (!canAssign || !isTargetResolved) return;
      setIsLoadingAssignees(true);
      try {
        setAssignees(
          await fetchActivityAssignees({
            targetApp: target.targetApp,
            targetType: target.targetType,
            targetId: target.targetId,
            search,
          }),
        );
        setAssigneesUnavailable(false);
      } catch {
        setAssignees([]);
        setAssigneesUnavailable(true);
      } finally {
        setIsLoadingAssignees(false);
      }
    },
    [canAssign, isTargetResolved, target.targetApp, target.targetType, target.targetId],
  );

  useEffect(() => {
    if (!isTargetResolved) return;
    // Deferred past the effect body: a synchronous setState there cascades an
    // extra render (react-hooks/set-state-in-effect).
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadAssignees("");
    });
    return () => {
      cancelled = true;
    };
  }, [isTargetResolved, loadAssignees]);

  return {
    canAssign,
    types,
    typesUnavailable,
    // Derived, not reset in an effect: without a resolved target there is no
    // eligible-assignee question to have an answer to.
    assignees: isTargetResolved ? assignees : [],
    isLoadingAssignees,
    assigneesUnavailable,
    isTargetResolved,
    searchAssignees: (query: string) => void loadAssignees(query),
  };
}
