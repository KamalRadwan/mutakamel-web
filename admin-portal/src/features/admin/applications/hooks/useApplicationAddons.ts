import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { adminCanAll } from "@/lib/auth/rbac";
import { normalizeApiError, type NormalizedApiError } from "@/shared/api/normalized-api-error";
import type { CommercialPage } from "@/shared/api/commercial-contract";
import { addonsApi } from "../api/addons.api";
import type { AddonRoot } from "../lib/addon-contract";

export function useApplicationAddons(applicationKey: string) {
  const { user } = useAuth();
  const canRead = adminCanAll(user, ["admin.applications.read"]);
  const canReadTiers = adminCanAll(user, ["admin.catalog.read"]);
  const canCreate = adminCanAll(user, ["admin.applications.create"]);
  const canUpdate = adminCanAll(user, ["admin.applications.update"]);
  const canCritical = adminCanAll(user, ["admin.applications.update", "admin.applications.critical"]);
  const canDelete = adminCanAll(user, ["admin.applications.delete", "admin.applications.critical"]);
  const [result, setResult] = useState<CommercialPage<AddonRoot> | null>(null);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const generation = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (!canRead) return;
    const current = ++generation.current;
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
    setLoading(true); setError(null);
    try {
      const next = await addonsApi.list(applicationKey, { page, search: query }, controller.signal);
      if (current === generation.current && !controller.signal.aborted) setResult(next);
    } catch (cause) {
      if (current === generation.current && !controller.signal.aborted) { setResult(null); setError(normalizeApiError(cause)); }
    } finally { if (current === generation.current) setLoading(false); }
  }, [applicationKey, canRead, page, query]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void refresh(); });
    const cancel = () => { generation.current++; abort.current?.abort(); };
    return () => { active = false; cancel(); };
  }, [refresh]);
  const searchSubmit = (event: FormEvent) => { event.preventDefault(); setPage(1); setQuery(search.trim()); };
  const created = async (key: string) => { setCreating(false); setSelectedKey(key); await refresh(); };
  return { actorId: user?.id ?? "", canRead, canReadTiers, canCreate, canUpdate, canCritical, canDelete, result, error, isLoading, refresh,
    page, setPage, search, setSearch, searchSubmit, selectedKey, setSelectedKey, creating, setCreating, created };
}
