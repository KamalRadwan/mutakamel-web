import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { adminCanAll } from "@/lib/auth/rbac";
import { generateUUIDv7 } from "@/lib/utils/uuid";
import { normalizeApiError, type NormalizedApiError } from "@/shared/api/normalized-api-error";
import { initialCommercialApi } from "../initial-commercial.api";
import type { InitialCreateOptions } from "../initial-create-options";
import { isInitialSeatQuantity, type InitialCommercialTerms } from "../initial-commercial-request";

export function useInitialCreateOptions(scope: string, terms: InitialCommercialTerms, onChange: (next: InitialCommercialTerms) => void, locked: boolean, maxApplications: number) {
  const { user } = useAuth();
  const permitted = Boolean(user?.id) && adminCanAll(user, ["admin.tenants.create"]);
  const owner = JSON.stringify([user?.id, scope, permitted]);
  const [result, setResult] = useState<{ owner: string; value: InitialCreateOptions } | null>(null);
  const [failure, setFailure] = useState<{ owner: string; value: NormalizedApiError } | null>(null);
  const [loadingOwner, setLoadingOwner] = useState<string | null>(null);
  const [chosenTiers, setChosenTiers] = useState<{ owner: string; values: Record<string, string> }>({ owner, values: {} });
  const errorRef = useRef<HTMLDivElement>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), [owner]);
  const error = failure?.owner === owner ? failure.value : null;
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  const value = result?.owner === owner && permitted ? result.value : null;
  const tiers = chosenTiers.owner === owner ? chosenTiers.values : {};
  const loading = loadingOwner === owner;
  const canEdit = permitted && !locked && !loading;
  const chooseTier = (applicationId: string, tierId: string) => {
    if (!canEdit || !value?.applications.find(item => item.applicationId === applicationId)?.tiers.some(tier => tier.id === tierId)) return;
    setChosenTiers({ owner, values: { ...tiers, [applicationId]: tierId } });
  };
  const load = async () => {
    if (!permitted || locked) return;
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    setLoadingOwner(owner); setResult(null); setFailure(null);
    try {
      const options = await initialCommercialApi.options(controller.signal);
      if (!controller.signal.aborted) setResult({ owner, value: options });
    } catch (cause) { if (!controller.signal.aborted) setFailure({ owner, value: normalizeApiError(cause) }); }
    finally { if (!controller.signal.aborted) setLoadingOwner(null); }
  };
  const addApplication = (applicationId: string) => {
    const option = value?.applications.find(item => item.applicationId === applicationId);
    const tierId = tiers[applicationId];
    if (!canEdit || !option || !option.tiers.some(tier => tier.id === tierId) || option.selectionBlockers.length || option.readinessReasons.length
      || option.catalogueReasons.length || terms.applications.length >= maxApplications || terms.applications.some(item => item.applicationId === applicationId)) return;
    onChange({ ...terms, applications: [...terms.applications, { selectionKey: generateUUIDv7(), applicationId, tierId, seats: 1, addons: [] }] });
  };
  const addAddon = (applicationId: string, addonId: string) => {
    const parent = terms.applications.find(item => item.applicationId === applicationId);
    const option = value?.applications.find(item => item.applicationId === applicationId);
    const child = option?.addons.find(item => item.addonId === addonId);
    if (!canEdit || !parent || !isInitialSeatQuantity(parent.seats) || !child || option?.selectionBlockers.length || option?.readinessReasons.length || option?.catalogueReasons.length
      || child.catalogueReasons.length || !child.compatibleTierIds.includes(parent.tierId)
      || terms.applications.flatMap(item => item.addons).length >= 100 || terms.applications.some(item => item.addons.some(addon => addon.addonId === addonId))) return;
    onChange({ ...terms, applications: terms.applications.map(item => item.applicationId === applicationId ? { ...item,
      addons: [...item.addons, { selectionKey: generateUUIDv7(), addonId, definitionVersionId: child.definitionVersionId, seats: 1 }] } : item) });
  };
  return { value, error, errorRef, loading, permitted, canEdit, tiers, chooseTier, load, addApplication, addAddon };
}
