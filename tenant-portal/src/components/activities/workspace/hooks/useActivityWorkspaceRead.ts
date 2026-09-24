"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";

/** One read, identified by everything it asks for. */
export interface ActivityWorkspaceRequest<T> {
  /** Changes exactly when the answer would: the serialised query. */
  key: string;
  read: (signal: AbortSignal) => Promise<T>;
}

interface ReadAnswer<T> {
  key: string;
  data: T | null;
  error: NormalizedApiError | null;
}

export interface ActivityWorkspaceRead<T> {
  /** The answer for the current request; kept on screen while the same request is read again. */
  data: T | null;
  /** Nothing has answered the current request yet, so the view shows its skeleton. */
  isLoading: boolean;
  error: NormalizedApiError | null;
  /** Core refused the read. A 403 is not an empty state. */
  denied: boolean;
  /** Reads the same request again, keeping an answer on screen until the new one lands; a failure is cleared. */
  reload: () => void;
  /** Adjusts the answer in place — an optimistic move, a page appended. Ignored once the request has changed. */
  update: (change: (data: T) => T) => void;
}

/**
 * The workspace's one read discipline, shared by the summary and all three views.
 *
 * A new request (other filters, another period) starts from nothing, so its
 * view shows its own skeleton. A reload of the same request — after a write, or
 * a realtime resync — keeps the current answer until the new one lands, so the
 * board does not blank out every time a card is completed. Each read owns an
 * AbortController, so a slow answer can never land over a newer one. `null`
 * reads nothing: a view that is not on screen holds no request open.
 */
export function useActivityWorkspaceRead<T>(request: ActivityWorkspaceRequest<T> | null): ActivityWorkspaceRead<T> {
  const key = request?.key ?? null;
  const [answer, setAnswer] = useState<ReadAnswer<T> | null>(null);
  // Bumped to ask again. The effect owns the AbortController, so a reload goes through it.
  const [reloadCount, setReloadCount] = useState(0);
  // The latest request's reader. The key already names everything it depends
  // on, so a new closure on every render must not restart the read.
  const readRef = useRef(request?.read);
  useEffect(() => {
    readRef.current = request?.read;
  });

  useEffect(() => {
    if (key === null) return;
    const controller = new AbortController();
    // Deferred past the effect body (react-hooks/set-state-in-effect), and past
    // the effect above, so the reader is the one this key was rendered with.
    queueMicrotask(() => {
      const read = readRef.current;
      if (controller.signal.aborted || !read) return;
      read(controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) setAnswer({ key, data, error: null });
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) setAnswer({ key, data: null, error: normalizeApiError(error) });
        });
    });
    return () => controller.abort();
  }, [key, reloadCount]);

  const reload = useCallback(() => {
    // A retry after a failure shows the view's skeleton: an error left on
    // screen while the new read runs looks like a retry that did nothing.
    setAnswer((current) => (current?.error ? null : current));
    setReloadCount((count) => count + 1);
  }, []);
  const update = useCallback((change: (data: T) => T) => {
    setAnswer((current) => (current && current.key === key && current.data !== null
      ? { ...current, data: change(current.data) }
      : current));
  }, [key]);

  const current = answer && answer.key === key ? answer : null;
  return {
    data: current?.data ?? null,
    isLoading: key !== null && current === null,
    error: current?.error ?? null,
    denied: current?.error?.status === 403,
    reload,
    update,
  };
}
