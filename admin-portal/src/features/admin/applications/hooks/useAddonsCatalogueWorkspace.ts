import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { adminCanAll } from "@/lib/auth/rbac";
import { normalizeApiError, type NormalizedApiError } from "@/shared/api/normalized-api-error";
import { readPersistedCommandAttempt, type PersistedCommandAttempt } from "@/shared/api/persisted-command-recovery";
import { addonsApi } from "../api/addons.api";
import { applicationsApi } from "../api/applications.api";
import type { AddonRoot } from "../lib/addon-contract";
import type { ApplicationView } from "../types";

/**
 * Core exposes addons per owning application only
 * (`GET /admin/applications/:applicationKey/addons`); there is no endpoint that
 * returns every addon. A cross-application index therefore fans out over the
 * eligible owners and merges client-side, which makes three things the caller's
 * problem rather than the server's:
 *
 * - one owner failing must not empty the index, so this settles every request
 *   independently and reports the failed owners for a scoped retry;
 * - the merged union has to be COMPLETE before client-side paging over it can
 *   be honest, so each owner is read at the server's maximum page size and any
 *   owner with more rows than that is named as truncated rather than silently
 *   cut off;
 * - the owner list itself is paged, so an eligible owner beyond the first page
 *   is reported too. Neither shortfall is ever presented as a complete index.
 */
const OWNER_PAGE_SIZE = 100;
const ADDON_PAGE_SIZE = 100;
export const ADDONS_INDEX_PAGE_SIZE = 20;

export interface AddonIndexRow {
  addon: AddonRoot;
  application: ApplicationView;
}

export interface AddonOwnerFailure {
  application: ApplicationView;
  error: NormalizedApiError;
}

/**
 * The owner guard is a negative test, not a positive one: Core rejects an owner
 * only when it is a SYSTEM application or a NON_BILLABLE one
 * (`addons.service.ts` -> ADDON_OWNER_INVALID). A TENANT + INCLUDED application
 * is a legitimate owner, so filtering the picker down to SUBSCRIPTION would
 * hide valid targets. This mirrors the guard exactly, the same way the
 * per-application screen computes its `supported` flag.
 */
export function isEligibleAddonOwner(application: ApplicationView): boolean {
  return application.applicationType !== "SYSTEM" && application.commercialMode !== "NON_BILLABLE";
}

const LIFECYCLE_VALUES = ["DRAFT", "ACTIVE", "DEPRECATED", "DISABLED"];

export function useAddonsCatalogueWorkspace() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const actorId = user?.id ?? "";
  const canRead = adminCanAll(user, ["admin.applications.read"]);
  const canReadTiers = adminCanAll(user, ["admin.catalog.read"]);
  const canCreate = adminCanAll(user, ["admin.applications.create"]);
  const canUpdate = adminCanAll(user, ["admin.applications.update"]);
  const canCritical = adminCanAll(user, ["admin.applications.update", "admin.applications.critical"]);
  const canDelete = adminCanAll(user, ["admin.applications.delete", "admin.applications.critical"]);

  /**
   * Filters and the open panel both live in the URL so a filtered index and an
   * open addon are shareable, and Back closes the panel instead of leaving the
   * section.
   *
   * FilterBar writes the filter params itself (`useFilterBar` -> `commit`),
   * under `field.query?.key ?? field.key`. So this reads exactly the field keys
   * the view declares and never writes them back: a second writer here would
   * race FilterBar's own reverse-sync and wipe a shared `?search=` link on
   * mount. The panel params below are ours alone, and neither writer touches
   * the other's keys.
   */
  const search = searchParams.get("search") ?? "";
  const applicationKey = searchParams.get("app") ?? "";
  const rawLifecycle = searchParams.get("lifecycle") ?? "";
  const lifecycleStatus = LIFECYCLE_VALUES.includes(rawLifecycle) ? rawLifecycle : "";
  const selectedAddonKey = searchParams.get("addon") ?? "";
  const creating = searchParams.get("create") === "1";
  const createOwnerKey = searchParams.get("createOwner") ?? "";

  const [owners, setOwners] = useState<ApplicationView[] | null>(null);
  const [ownersError, setOwnersError] = useState<NormalizedApiError | null>(null);
  const [ownersTruncated, setOwnersTruncated] = useState(false);
  const [rows, setRows] = useState<AddonIndexRow[] | null>(null);
  const [failures, setFailures] = useState<AddonOwnerFailure[]>([]);
  const [truncatedOwners, setTruncatedOwners] = useState<ApplicationView[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [isRefreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);

  const generation = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const loaded = useRef(false);
  // Carry-over state for the scoped-retry path. Held in refs so `load` does not
  // take `owners`/`rows` as dependencies and re-run on its own result; synced in
  // an effect because a ref must not be written during render.
  const ownersRef = useRef<ApplicationView[] | null>(null);
  const rowsRef = useRef<AddonIndexRow[] | null>(null);
  useEffect(() => { ownersRef.current = owners; }, [owners]);
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  /**
   * Reading a subset of owners is a retry path, not a filter: `only` narrows
   * which owners are re-requested after a partial failure while every row
   * already held for a healthy owner stays mounted.
   */
  const load = useCallback(async (options: { only?: readonly string[]; reloadOwners?: boolean } = {}) => {
    if (!canRead) return;
    const { only, reloadOwners = false } = options;
    const current = ++generation.current;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const isRetry = only !== undefined;
    if (loaded.current) setRefreshing(true); else setLoading(true);

    const live = () => current === generation.current && !controller.signal.aborted;
    try {
      // A filter cannot change which applications exist, and this read cannot be
      // aborted (`applicationsApi.list` takes no signal), so the owner set is
      // read once and reused until something explicitly asks for it again.
      let eligible = ownersRef.current;
      if (!eligible || reloadOwners) {
        const response = await applicationsApi.list({ applicationType: "TENANT", page: 1, limit: OWNER_PAGE_SIZE });
        if (!live()) return;
        // Core accepts a single commercialMode value, so "anything but
        // NON_BILLABLE" cannot be expressed server-side and is applied here.
        eligible = response.data.filter(isEligibleAddonOwner);
        ownersRef.current = eligible;
        setOwners(eligible);
        setOwnersError(null);
        // `meta` is optional on this envelope. A full page with no total is not
        // evidence of completeness, so it counts as possibly-truncated rather
        // than silently presenting a capped list as the whole set.
        setOwnersTruncated(response.meta
          ? response.meta.total > response.data.length
          : response.data.length >= OWNER_PAGE_SIZE);
      }

      const requested = eligible.filter(application =>
        (!applicationKey || application.key === applicationKey)
        && (!only || only.includes(application.key)));

      const settled = await Promise.allSettled(requested.map(application =>
        addonsApi.list(application.key, {
          page: 1,
          limit: ADDON_PAGE_SIZE,
          search: search || undefined,
          lifecycleStatus: lifecycleStatus || undefined,
        }, controller.signal).then(result => ({ application, result }))));
      if (!live()) return;

      const nextRows: AddonIndexRow[] = [];
      const nextFailures: AddonOwnerFailure[] = [];
      const nextTruncated: ApplicationView[] = [];
      settled.forEach((outcome, index) => {
        if (outcome.status === "fulfilled") {
          const { application, result } = outcome.value;
          result.items.forEach(addon => nextRows.push({ addon, application }));
          if (result.meta.total > result.items.length) nextTruncated.push(application);
          return;
        }
        // An abort always accompanies a newer generation, which `live()` above
        // has already returned on, so anything reaching here is real evidence
        // that this owner could not be read.
        nextFailures.push({ application: requested[index], error: normalizeApiError(outcome.reason) });
      });

      // A scoped retry replaces only the owners it asked for. Rows belonging to
      // owners outside this pass survive untouched, so a recovered owner never
      // costs the operator the rows that were already good.
      const outsideThisPass = <T,>(items: readonly T[], keyOf: (item: T) => string) =>
        items.filter(item => !requested.some(application => application.key === keyOf(item)));
      const merged = isRetry
        ? [...outsideThisPass(rowsRef.current ?? [], row => row.application.key), ...nextRows]
        : nextRows;
      merged.sort((left, right) => left.addon.key.localeCompare(right.addon.key, "en"));
      setRows(merged);
      setFailures(previous => isRetry
        ? [...outsideThisPass(previous, failure => failure.application.key), ...nextFailures]
        : nextFailures);
      setTruncatedOwners(previous => isRetry
        ? [...outsideThisPass(previous, item => item.key), ...nextTruncated]
        : nextTruncated);
      loaded.current = true;
    } catch (cause) {
      if (!live()) return;
      setOwners(null);
      setRows(null);
      setFailures([]);
      setTruncatedOwners([]);
      setOwnersError(normalizeApiError(cause));
    } finally {
      if (current === generation.current) { setLoading(false); setRefreshing(false); }
    }
  }, [applicationKey, canRead, lifecycleStatus, search]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void load(); });
    const cancel = () => { generation.current++; abort.current?.abort(); };
    return () => { active = false; cancel(); };
  }, [load]);

  /**
   * An unresolved CREATE has to be findable from the index, not only from
   * inside the create dialog. `useAddonMutation` scopes its journal per owning
   * application, so recovering one after a reload would otherwise require the
   * operator to guess which owner to reopen before the warning became visible
   * at all. Only non-secret attempt identity is read here.
   */
  const [pendingCreates, setPendingCreates] = useState<Array<{ application: ApplicationView; attempt: PersistedCommandAttempt }>>([]);
  useEffect(() => {
    let active = true;
    // Deferred like useAddonMutation's own recovery read: session storage is an
    // external system, and setting state straight from an effect body would
    // cascade a second render on every load.
    queueMicrotask(() => {
      if (!active) return;
      if (!actorId || owners === null) { setPendingCreates([]); return; }
      setPendingCreates(owners.flatMap(application => {
        const attempt = readPersistedCommandAttempt(
          `admin.addons.command:${actorId}:${application.key}:CREATE`,
          `/api/admin/core/v1/applications/${application.key}/addons`);
        return attempt ? [{ application, attempt }] : [];
      }));
    });
    return () => { active = false; };
    // `creating` and `rows` are re-scan triggers, not inputs: an attempt is
    // journalled or cleared by the create dialog and by a completed load.
  }, [actorId, owners, creating, rows]);

  const writeParams = useCallback((changes: Record<string, string>, mode: "push" | "replace") => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, value]) => { if (value) params.set(key, value); else params.delete(key); });
    const url = params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
    startTransition(() => {
      if (mode === "push") router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    });
  }, [pathname, router, searchParams]);

  // FilterBar commits the filter params to the URL itself; this only has to put
  // the operator back on the first page of the new result set.
  const onFiltersChanged = useCallback(() => { setPage(1); }, []);

  const eligibleOwners = useMemo(() => owners ?? [], [owners]);

  // The owner prefix is part of the addon key, so one parameter identifies both
  // the addon and the application that owns it.
  const selectedOwner = useMemo(() => {
    if (!selectedAddonKey) return null;
    const ownerKey = selectedAddonKey.split(".")[0];
    return eligibleOwners.find(owner => owner.key === ownerKey) ?? null;
  }, [eligibleOwners, selectedAddonKey]);

  /**
   * A shared link can name an addon this index cannot open: its owner may have
   * become ineligible, been deleted, sit beyond the owner page this index
   * reads, or the key may simply be malformed. `owners === null` still means
   * "not read yet", so only a completed owner read counts as evidence — and
   * once it is evidence, the operator is told rather than shown a link that
   * silently does nothing.
   */
  const selectedAddonUnresolved = Boolean(selectedAddonKey) && owners !== null && selectedOwner === null;

  const totalItems = rows?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / ADDONS_INDEX_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = useMemo(
    () => (rows ?? []).slice((safePage - 1) * ADDONS_INDEX_PAGE_SIZE, safePage * ADDONS_INDEX_PAGE_SIZE),
    [rows, safePage]);

  const stats = useMemo(() => ({
    total: totalItems,
    active: (rows ?? []).filter(row => row.addon.lifecycleStatus === "ACTIVE").length,
    drafts: (rows ?? []).filter(row => row.addon.draftVersionId !== null).length,
    owners: new Set((rows ?? []).map(row => row.application.key)).size,
  }), [rows, totalItems]);

  const retryFailed = useCallback(() => {
    const keys = failures.map(failure => failure.application.key);
    if (keys.length > 0) void load({ only: keys });
  }, [failures, load]);

  return {
    actorId,
    canRead, canReadTiers, canCreate, canUpdate, canCritical, canDelete,
    eligibleOwners, ownersError, ownersTruncated,
    rows: visible, failures, truncatedOwners,
    isLoading, isRefreshing,
    search, applicationKey, lifecycleStatus, onFiltersChanged,
    isFiltered: Boolean(search || applicationKey || lifecycleStatus),
    page: safePage, setPage, totalItems, totalPages,
    stats,
    refresh: useCallback(() => { void load({ reloadOwners: true }); }, [load]),
    retryFailed,
    selectedAddonKey, selectedOwner, selectedAddonUnresolved, pendingCreates,
    openDetail: useCallback((addonKey: string) => writeParams({ addon: addonKey }, "push"), [writeParams]),
    closeDetail: useCallback(() => writeParams({ addon: "" }, "replace"), [writeParams]),
    creating, createOwnerKey,
    // Resuming an unresolved CREATE names its owner so the operator lands back
    // on the exact application whose journal holds the original key.
    openCreate: useCallback((ownerKey?: string) =>
      writeParams({ create: "1", createOwner: ownerKey ?? "" }, "push"), [writeParams]),
    closeCreate: useCallback(() => writeParams({ create: "", createOwner: "" }, "replace"), [writeParams]),
    /**
     * Closing create and opening the new addon is ONE write. Two sequential
     * writes in the same tick both build from the same rendered `searchParams`,
     * so the second silently discards the first — which would drop the new
     * addon and leave the operator on a bare index after a successful create.
     */
    completeCreate: useCallback((addonKey: string) =>
      writeParams({ create: "", createOwner: "", addon: addonKey }, "replace"), [writeParams]),
  };
}
