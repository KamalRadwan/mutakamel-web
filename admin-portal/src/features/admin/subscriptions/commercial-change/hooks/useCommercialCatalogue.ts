import { useEffect, useRef, useState } from "react";
import { applicationsApi } from "@/features/admin/applications/api/applications.api";
import { addonsApi } from "@/features/admin/applications/api/addons.api";
import type { ApplicationView, TierView } from "@/features/admin/applications/types";
import type { AddonDetail, AddonRoot } from "@/features/admin/applications/lib/addon-contract";
import { normalizeApiError, type NormalizedApiError } from "@/shared/api/normalized-api-error";
import { contractFailure } from "@/shared/api/commercial-contract";

/** Catalogue evidence is a candidate list. Preparation still rechecks selection authority. */
export function useCommercialCatalogue(canReadApplications: boolean, canReadCatalogue: boolean) {
  const [applications, setApplications] = useState<ApplicationView[]>([]);
  const [applicationPage, setApplicationPage] = useState(0);
  const [moreApplications, setMoreApplications] = useState(true);
  const [selected, setSelected] = useState<{ id: string; key: string } | null>(null);
  const [tiers, setTiers] = useState<TierView[]>([]);
  const [addons, setAddons] = useState<AddonRoot[]>([]);
  const [addonPage, setAddonPage] = useState(0);
  const [moreAddons, setMoreAddons] = useState(true);
  const [detail, setDetail] = useState<AddonDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => { generation.current++; abort.current?.abort(); }, []);

  const run = async (work: (signal: AbortSignal, current: () => boolean) => Promise<void>) => {
    if (busy.current) return;
    const request = ++generation.current;
    const controller = new AbortController(); abort.current = controller;
    busy.current = true; setLoading(true); setError(null);
    const current = () => generation.current === request && !controller.signal.aborted;
    try { await work(controller.signal, current); }
    catch (cause) { if (current()) setError(normalizeApiError(cause)); }
    finally { if (current()) { busy.current = false; setLoading(false); } }
  };
  const loadApplications = () => {
    if (!canReadApplications || !moreApplications) return;
    return run(async (_signal, current) => {
      const result = await applicationsApi.list({ page: applicationPage + 1, limit: 20, applicationType: "TENANT", lifecycleStatus: "ACTIVE", publicationStatus: "PUBLISHED", catalogueVisibility: "PUBLIC" });
      if (!current()) return;
      if (!Array.isArray(result.data) || result.data.length > 20 || result.data.some(item => item.lifecycleStatus !== "ACTIVE" || item.publicationStatus !== "PUBLISHED")) contractFailure();
      setApplications(previous => [...previous, ...result.data.filter(item => item.commercialMode !== "NON_BILLABLE" && !previous.some(old => old.id === item.id))]);
      setApplicationPage(applicationPage + 1); setMoreApplications(result.data.length === 20);
    });
  };
  const chooseApplication = (application: { id: string; key: string }) => {
    if (!canReadCatalogue || busy.current) return;
    setSelected(application); setTiers([]); setAddons([]); setDetail(null); setAddonPage(0); setMoreAddons(true);
    return run(async (signal, current) => {
      const result = await applicationsApi.listTiers(application.id, signal);
      if (!current()) return;
      if (!Array.isArray(result) || result.some(item => item.moduleId !== application.id)) contractFailure();
      setTiers(result.filter(item => item.isActive && item.deletedAt === null));
    });
  };
  const loadAddons = () => {
    if (!canReadCatalogue || !selected || !moreAddons) return;
    return run(async (signal, current) => {
      const result = await addonsApi.list(selected.key, { page: addonPage + 1, lifecycleStatus: "ACTIVE" }, signal);
      if (!current()) return;
      if (result.items.some(item => item.applicationId !== selected.id)) contractFailure();
      setAddons(previous => [...previous, ...result.items.filter(item => item.publishedVersionId && !item.deleted && !previous.some(old => old.id === item.id))]);
      setAddonPage(addonPage + 1); setMoreAddons(result.items.length === 20);
    });
  };
  const chooseAddon = (key: string) => {
    if (!canReadCatalogue || !selected || busy.current) return;
    setDetail(null);
    return run(async (signal, current) => {
      const result = await addonsApi.get(selected.key, key, signal);
      if (!current()) return;
      if (result.applicationId !== selected.id) contractFailure();
      setDetail(result);
    });
  };
  return { applications, moreApplications, selected, tiers, addons, moreAddons, detail, loading, error,
    loadApplications, chooseApplication, loadAddons, chooseAddon };
}
