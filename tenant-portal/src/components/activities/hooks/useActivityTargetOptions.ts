"use client";

import { useCallback, useEffect, useState } from "react";
import { readCoreData } from "@/lib/api/envelope";
import {
  ACTIVITY_PICKER_RESPONSE_BYTES,
  activityTargetsPath,
  type ActivityScope,
  type ActivityTargetOption,
  type ActivityTargetSelection,
} from "../activity-contract";
import { parseActivityTargetOptions } from "../activity-parsers";
import { activityTargetKinds, type ActivityTargetKind } from "../activity-presentation";

export interface ActivityTargetOptions {
  /** The record types this scope offers. */
  kinds: ActivityTargetKind[];
  /** The record type being searched: the chosen record's, else the one picked, else the first. */
  kind: ActivityTargetKind;
  chooseKind: (type: string) => void;
  options: ActivityTargetOption[];
  isLoading: boolean;
  /** The last search failed; the picker says so instead of claiming there is nothing. */
  failed: boolean;
  /** A `Combobox` `onSearch`: it already waits 300 ms of quiet, and calls once on open. */
  search: (query: string) => void;
}

interface TargetAnswer {
  key: string;
  options: ActivityTargetOption[];
  failed: boolean;
}

/**
 * The record picker — `GET activities/targets`, which answers only records the
 * actor could book an activity on right now, already authorised and capped.
 *
 * Nothing is fetched until the picker opens. Every new query aborts the one
 * before it, and an answer is only shown for the record type and branch it was
 * asked under, so a slow reply for the type the user just left can never fill
 * the list of the one they moved to.
 */
export function useActivityTargetOptions(
  scope: ActivityScope,
  selected: ActivityTargetSelection | null,
  branchId: string | null | undefined,
): ActivityTargetOptions {
  const kinds = activityTargetKinds(scope);
  const [chosenType, setChosenType] = useState<string | null>(null);
  const type = selected?.type ?? chosenType;
  const kind = kinds.find((candidate) => candidate.type === type) ?? kinds[0];
  const { app } = kind;
  const scopeKey = `${app}|${kind.type}|${branchId ?? ""}`;
  const [query, setQuery] = useState<{ scope: string; text: string } | null>(null);
  const [answer, setAnswer] = useState<TargetAnswer | null>(null);
  const text = query?.scope === scopeKey ? query.text : null;
  // The search on screen, if one has been asked for under this type and branch.
  const asked = text === null ? null : `${scopeKey}|${text}`;

  useEffect(() => {
    if (text === null) return;
    const controller = new AbortController();
    const key = `${scopeKey}|${text}`;
    // Async so that a request this client refuses to build (a malformed branch
    // id) fails the search like any other failure instead of throwing.
    const read = async () => parseActivityTargetOptions(await readCoreData(
      activityTargetsPath({ app, type: kind.type, branchId, search: text }),
      { signal: controller.signal, cache: "no-store", maxResponseBytes: ACTIVITY_PICKER_RESPONSE_BYTES },
    ));
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      read()
        .then((all) => {
          if (controller.signal.aborted) return;
          const options = all.filter((option) => option.targetApp === app && option.targetType === kind.type);
          setAnswer({ key, options, failed: false });
        })
        .catch(() => {
          if (!controller.signal.aborted) setAnswer({ key, options: [], failed: true });
        });
    });
    return () => controller.abort();
  }, [app, branchId, kind.type, scopeKey, text]);

  const search = useCallback((next: string) => setQuery({ scope: scopeKey, text: next }), [scopeKey]);
  const current = answer && answer.key === asked ? answer : null;
  return {
    kinds,
    kind,
    chooseKind: setChosenType,
    options: current?.options ?? [],
    // Loading is "asked, not yet answered" rather than a flag of its own, so a
    // search aborted by the next one can never leave the spinner behind.
    isLoading: asked !== null && current === null,
    failed: current?.failed ?? false,
    search,
  };
}
