"use client";

import { useEffect, useMemo, useState } from "react";

interface AddressPlaceOption {
  /** Row identity — a subdivision code, a city id. Never stored on the record. */
  key: string;
  /** What the record actually holds: these DTO fields are free text. */
  name: string;
  /** A second line — the native-script name, a subdivision type. */
  description?: string;
}

export interface AddressPlaceResult {
  options: AddressPlaceOption[];
  /** More matches exist than were returned; the user has to narrow. */
  truncated: boolean;
  total: number;
}

export type AddressPlaceLoader = (
  query: string,
  signal: AbortSignal,
) => Promise<AddressPlaceResult>;

/**
 * `ready` is the ONLY state that renders a picker.
 *
 * `unavailable` covers three different causes on purpose — no loader (nothing
 * upstream is chosen yet), an empty catalogue (a country with no subdivisions),
 * and a request that failed. They are one state because the user's remedy is
 * one thing: type the address. Nobody may be left unable to record where a
 * customer lives because a reference table is down.
 */
type AddressPlaceStatus = "loading" | "ready" | "unavailable";

export interface AddressPlaceOptions extends AddressPlaceResult {
  status: AddressPlaceStatus;
  isLoading: boolean;
  search: (query: string) => void;
}

const EMPTY_OPTIONS: AddressPlaceOption[] = [];

/** The result, plus the query it answers — see the status rule below. */
interface LoadedPage extends AddressPlaceResult {
  query: string;
}

const FAILED_PAGE = (query: string): LoadedPage => ({
  options: EMPTY_OPTIONS,
  truncated: false,
  total: 0,
  query,
});

/**
 * One remote place catalogue behind a `Combobox`.
 *
 * Modelled on `useRemoteOptions` in app/(tenant)/core/hooks/useCoreOptions.ts —
 * same abort-per-effect shape, same deferred writes — but it keeps the loader's
 * `truncated`/`total` and answers whether a picker is possible at all, neither
 * of which a Core identity picker has to decide.
 *
 * The loader's own identity is the reset key. A caller rebuilds it when the
 * country or the state changes, which both clears the previous catalogue and
 * aborts its request — so a slow answer for the country the user just left can
 * never repopulate the list under the country they moved to.
 *
 * The first page is fetched eagerly rather than on open, because "does this
 * country have subdivisions at all" is the question that decides whether this
 * field is a picker or a text box, and only the server can answer it.
 */
export function useAddressPlaceOptions(
  loader: AddressPlaceLoader | null,
): AddressPlaceOptions {
  const [page, setPage] = useState<LoadedPage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState("");

  // A new loader is a new catalogue, so the query starts over with it. Written
  // past the effect body because React's compiler lint bans a synchronous
  // setState there — the same rule `useRemoteOptions` works around.
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setPage(null);
      setQuery("");
    });
    return () => controller.abort();
  }, [loader]);

  useEffect(() => {
    if (!loader) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setIsLoading(true);
      loader(query, controller.signal)
        .then((next) => {
          if (!controller.signal.aborted) setPage({ ...next, query });
        })
        .catch(() => {
          // A catalogue that cannot be reached degrades to a text box, so a
          // failure is recorded as "no options" rather than raised: the form
          // stays usable, and the server still has the last word on submit.
          if (!controller.signal.aborted) setPage(FAILED_PAGE(query));
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    });
    return () => controller.abort();
  }, [loader, query]);

  return useMemo(() => {
    const status: AddressPlaceStatus = !loader
      ? "unavailable"
      : page === null
        ? "loading"
        : // An empty page only degrades the control when it answers the
          // UNSEARCHED list. "No city matches zzz" is an empty picker; "this
          // country has no subdivisions" is a text box — and the query the page
          // answers, not the one now in the box, is what tells them apart.
          page.options.length === 0 && page.query.trim().length === 0
          ? "unavailable"
          : "ready";
    return {
      options: page?.options ?? EMPTY_OPTIONS,
      truncated: page?.truncated ?? false,
      total: page?.total ?? 0,
      status,
      isLoading,
      search: setQuery,
    };
  }, [isLoading, loader, page]);
}
