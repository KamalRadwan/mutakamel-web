import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/shared/api/normalized-api-error";
import type { CommercialPage } from "@/shared/api/commercial-contract";
import { addonsApi } from "../api/addons.api";
import type { AddonAudit, AddonDetail, AddonPrices, AddonVersion, AddonDefinition, readPriceReceipt } from "../lib/addon-contract";
import { useAddonMutation } from "./useAddonMutation";
import type { AddonAction } from "./useAddonDefinitionDialog";

export type AddonPanel = "definition" | "pricing" | "versions" | "audit";
type AcceptedReceipt = { noChange: boolean; affectedOperationId?: string | null; deleted?: boolean } | ReturnType<typeof readPriceReceipt>;
export function useAddonWorkspace(applicationKey: string, addonKey: string, actorId: string, onDeleted: () => void) {
  const [detail, setDetail] = useState<AddonDetail | null>(null);
  const [prices, setPrices] = useState<AddonPrices | null>(null);
  const [pricesCurrent, setPricesCurrent] = useState(false);
  const [priceReceipt, setPriceReceipt] = useState<ReturnType<typeof readPriceReceipt> | null>(null);
  const [versions, setVersions] = useState<CommercialPage<AddonVersion> | null>(null);
  const [audit, setAudit] = useState<CommercialPage<AddonAudit> | null>(null);
  const [version, setVersion] = useState<AddonDefinition | null>(null);
  const [panel, setPanel] = useState<AddonPanel>("definition");
  const [pricingCycle, setPricingCycle] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const [historyPage, setHistoryPage] = useState(1);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<"saved" | "pending" | null>(null);
  const [action, setAction] = useState<AddonAction | null>(null);
  const [revokeVersion, setRevokeVersion] = useState<AddonVersion | undefined>();
  const versionGeneration = useRef(0);
  const generation = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const mutation = useAddonMutation(applicationKey, addonKey, actorId);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
    setLoading(true); setError(null); setPricesCurrent(false);
    try {
      const root = await addonsApi.get(applicationKey, addonKey, controller.signal);
      const extra = panel === "pricing" ? await addonsApi.prices(applicationKey, addonKey, controller.signal)
        : panel === "versions" ? await addonsApi.versions(applicationKey, addonKey, historyPage, controller.signal)
          : panel === "audit" ? await addonsApi.audit(applicationKey, addonKey, root.applicationId, historyPage, controller.signal) : null;
      if (current !== generation.current || controller.signal.aborted) return;
      setDetail(root);
      if (panel === "pricing") {
        const next = extra as AddonPrices;
        if (next.addonId !== root.id || next.applicationId !== root.applicationId) throw new Error("ADDON_OWNER_MISMATCH");
        setPrices(next);
        setPricesCurrent(true);
      }
      if (panel === "versions") setVersions(extra as CommercialPage<AddonVersion>);
      if (panel === "audit") setAudit(extra as CommercialPage<AddonAudit>);
    } catch (cause) {
      if (current === generation.current && !controller.signal.aborted) { setError(normalizeApiError(cause)); setVersions(null); setAudit(null); }
    } finally { if (current === generation.current) setLoading(false); }
  }, [addonKey, applicationKey, historyPage, panel]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void refresh(); });
    const cancel = () => { generation.current++; abort.current?.abort(); };
    return () => { active = false; cancel(); };
  }, [refresh]);
  const selectPanel = (value: string) => { versionGeneration.current++; setPricesCurrent(false); setPanel(value as AddonPanel); setHistoryPage(1); setVersion(null); };
  const accepted = async (receipt: AcceptedReceipt | null) => {
    if (!receipt) return false;
    if ("deleted" in receipt && receipt.deleted) { onDeleted(); return true; }
    if ("billingCycle" in receipt) setPriceReceipt(receipt);
    setNotice("affectedOperationId" in receipt && receipt.affectedOperationId ? "pending" : "saved");
    await refresh(); return true;
  };
  const retry = async () => { await accepted(await mutation.retry()); };
  const readVersion = async (id: string) => {
    if (!detail) return;
    const current = generation.current;
    const versionRequest = ++versionGeneration.current;
    try {
      const next = await addonsApi.version(applicationKey, addonKey, id, detail.id, abort.current?.signal);
      if (current === generation.current && versionRequest === versionGeneration.current) setVersion(next);
    } catch (cause) { if (current === generation.current && versionRequest === versionGeneration.current) setError(normalizeApiError(cause)); }
  };
  return { detail, prices, pricesCurrent, priceReceipt, versions, audit, version, panel, selectPanel, historyPage, setHistoryPage, error, loading, refresh, mutation,
    pricingCycle, setPricingCycle,
    notice, accepted, retry, readVersion, action, setAction, revokeVersion,
    startRevoke: (target: AddonVersion) => { setRevokeVersion(target); setAction("VERSION_REVOKE"); },
    dialogAccepted: async (_key: string, receipt: { noChange: boolean; affectedOperationId?: string | null; deleted?: boolean }) => { await accepted(receipt); },
    priceAccepted: async (receipt: { noChange: boolean }) => { await accepted(receipt); },
    writable: detail !== null && !loading && error === null && !mutation.isSubmitting && !mutation.canRetry };
}
