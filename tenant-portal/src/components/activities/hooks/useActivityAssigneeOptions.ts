"use client";

import { useCallback, useEffect, useState } from "react";
import { readCoreData } from "@/lib/api/envelope";
import {
  ACTIVITY_PICKER_RESPONSE_BYTES,
  activityAssigneesPath,
  type ActivityAssignee,
  type ActivityTargetSelection,
} from "../activity-contract";
import { parseActivityAssignees } from "../activity-parsers";

export interface ActivityAssigneeOptions {
  options: ActivityAssignee[];
  isLoading: boolean;
  failed: boolean;
  /** A `Combobox` `onSearch`: it already waits 300 ms of quiet, and calls once on open. */
  search: (query: string) => void;
}

interface AssigneeAnswer {
  key: string;
  options: ActivityAssignee[];
  failed: boolean;
}

/**
 * `GET activities/assignees` — the people who may hold an activity on THIS
 * record: active in its branch, seated in its app, able to read it. It is not a
 * general user picker, so it is never asked without a chosen record, and it
 * needs `activities.assign`; without either the form shows the default
 * assignee read-only instead of mounting a picker at all.
 */
export function useActivityAssigneeOptions(target: ActivityTargetSelection | null): ActivityAssigneeOptions {
  // The record as primitives, so a rebuilt selection object is not a new search.
  const app = target?.app;
  const type = target?.type;
  const id = target?.id;
  const scope = app && type && id ? `${app}|${type}|${id}` : null;
  const [query, setQuery] = useState<{ scope: string; text: string } | null>(null);
  const [answer, setAnswer] = useState<AssigneeAnswer | null>(null);
  const text = scope !== null && query?.scope === scope ? query.text : null;
  // The search on screen, if one has been asked for about this record.
  const asked = text === null ? null : `${scope}|${text}`;

  useEffect(() => {
    if (!app || !type || !id || text === null) return;
    const controller = new AbortController();
    const key = `${scope}|${text}`;
    // Async so that a request this client refuses to build fails the search
    // like any other failure instead of throwing.
    const read = async () => parseActivityAssignees(await readCoreData(
      activityAssigneesPath({ app, type, id }, text),
      { signal: controller.signal, cache: "no-store", maxResponseBytes: ACTIVITY_PICKER_RESPONSE_BYTES },
    ));
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      read()
        .then((options) => {
          if (!controller.signal.aborted) setAnswer({ key, options, failed: false });
        })
        .catch(() => {
          if (!controller.signal.aborted) setAnswer({ key, options: [], failed: true });
        });
    });
    return () => controller.abort();
  }, [app, id, scope, text, type]);

  const search = useCallback((next: string) => {
    if (scope !== null) setQuery({ scope, text: next });
  }, [scope]);
  const current = answer && answer.key === asked ? answer : null;
  // "Asked, not yet answered": an aborted search cannot leave the spinner behind.
  return { options: current?.options ?? [], isLoading: asked !== null && current === null, failed: current?.failed ?? false, search };
}
