"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";

/**
 * One searchable picker over the four CRM records that can own a task, a
 * calendar event, an activity or a custom-field value.
 *
 * It lives in `src/hooks/` because three screens in different route folders
 * need the same list and
 * docs/architecture/file-architecture.md#dependency-direction forbids one CRM
 * screen importing another's hook. This is the layer that page documents for
 * exactly that: "cross-feature hooks only".
 *
 * **`PARTY` is deliberately absent.** `CrmSourceType` includes it and the
 * write DTOs accept it, but CRM exposes no party list to the browser — parties
 * are a Core directory resource — so there is nothing to pick from here. A
 * party-sourced record is created from the directory screen, not this control.
 */
export const CRM_RECORD_SOURCE_TYPES = [
  "LEAD",
  "CUSTOMER_PROFILE",
  "OPPORTUNITY",
] as const;
export type CrmRecordSourceType = (typeof CRM_RECORD_SOURCE_TYPES)[number];

/** Tasks and calendar events additionally accept an activity as their source. */
export const CRM_WORK_SOURCE_TYPES = [
  ...CRM_RECORD_SOURCE_TYPES,
  "ACTIVITY",
] as const;
export type CrmWorkSourceType = (typeof CRM_WORK_SOURCE_TYPES)[number];

/** A reminder targets a task or a calendar event, not a CRM record. */
const CRM_REMINDER_TARGET_TYPES = ["TASK", "CALENDAR_EVENT"] as const;

/** Every list this picker can read. */
export type CrmPickerResource =
  | CrmWorkSourceType
  | (typeof CRM_REMINDER_TARGET_TYPES)[number];

export interface CrmRecordOption {
  value: string;
  label: string;
}

// Every one of these is a BranchListQueryDto list: branchId is required and a
// missing one is a 422, never an empty list (S2).
const SOURCE_PATHS: Record<CrmPickerResource, string> = {
  LEAD: "/api/tenant/crm/v1/leads",
  CUSTOMER_PROFILE: "/api/tenant/crm/v1/customer-profiles",
  OPPORTUNITY: "/api/tenant/crm/v1/opportunities",
  ACTIVITY: "/api/tenant/crm/v1/activities",
  TASK: "/api/tenant/crm/v1/tasks",
  CALENDAR_EVENT: "/api/tenant/crm/v1/calendar/events",
};

// The display field differs per resource: leads and customer profiles are
// party-backed and carry `displayName`, an opportunity, a task and an event
// carry `title`, an activity carries `subject`. Verified against each
// service's own projection.
const LABEL_KEYS: Record<CrmPickerResource, string> = {
  LEAD: "displayName",
  CUSTOMER_PROFILE: "displayName",
  OPPORTUNITY: "title",
  ACTIVITY: "subject",
  TASK: "title",
  CALENDAR_EVENT: "title",
};

const OPTIONS_LIMIT = 25;

export function useCrmRecordOptions(
  sourceType: CrmPickerResource | null,
  branchId: string | null,
) {
  const [options, setOptions] = useState<CrmRecordOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  // Defect D9. The exported `search` handed the caller a function that took no
  // signal, so every keystroke and every branch or source change started a
  // request nothing ordered or cancelled — the slowest response won, and the
  // picker offered records from another resource entirely. The epoch orders
  // them; the controller cancels the ones that lost.
  const epochRef = useRef(0);
  const inFlightRef = useRef<AbortController | null>(null);

  useEffect(() => () => inFlightRef.current?.abort(), []);

  const search = useCallback(
    async (query: string, external?: AbortSignal) => {
      const epoch = epochRef.current + 1;
      epochRef.current = epoch;
      inFlightRef.current?.abort();
      if (!sourceType || !branchId || !isUUIDv7(branchId)) {
        inFlightRef.current = null;
        setOptions([]);
        setError(null);
        return;
      }
      const controller = new AbortController();
      inFlightRef.current = controller;
      // The effect below owns its own controller for unmount; this one owns
      // supersession. Either aborting must abort the request.
      const relay = () => controller.abort();
      external?.addEventListener("abort", relay);
      if (external?.aborted) controller.abort();
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          branchId,
          page: "1",
          limit: String(OPTIONS_LIMIT),
        });
        const trimmed = query.trim();
        if (trimmed) params.set("search", trimmed);
        const response = await axiosClient.get<unknown>(
          `${SOURCE_PATHS[sourceType]}?${params.toString()}`,
          { signal: controller.signal, cache: "no-store", maxResponseBytes: 512 * 1024 },
        );
        const parsed = parseOptions(response.data, LABEL_KEYS[sourceType]);
        if (epoch !== epochRef.current) return;
        setOptions(parsed);
      } catch (caught) {
        if (isAbortError(caught) || epoch !== epochRef.current) return;
        setOptions([]);
        setError(normalizeApiError(caught));
      } finally {
        external?.removeEventListener("abort", relay);
        if (epoch === epochRef.current && !controller.signal.aborted) {
          inFlightRef.current = null;
          setIsLoading(false);
        }
      }
    },
    [branchId, sourceType],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void search("", controller.signal);
    });
    return () => controller.abort();
  }, [search]);

  return { options, isLoading, error, search: (query: string) => void search(query) };
}

/**
 * CRM lists are the FLAT paginated shape —
 * `{ items, total, page, limit, totalPages, hasNext, hasPrev }` — straight off
 * `PaginatedResult<T>` in @mutakamel/database. There is no `meta` wrapper and
 * no `data` envelope anywhere in crm-app (verified: no CRM service or
 * interceptor produces either).
 */
function parseOptions(payload: unknown, labelKey: string): CrmRecordOption[] {
  const body = record(payload);
  if (!body || !Array.isArray(body.items)) {
    throw new Error("Invalid CRM record-options response.");
  }
  return body.items.flatMap((entry) => {
    const item = record(entry);
    if (!item || !isUUIDv7(item.id)) return [];
    const label = item[labelKey];
    return [
      {
        value: item.id,
        // An unnamed record still has to be selectable; its id is the honest
        // fallback rather than an invented placeholder name.
        label: typeof label === "string" && label.length > 0 ? label : item.id,
      },
    ];
  });
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
