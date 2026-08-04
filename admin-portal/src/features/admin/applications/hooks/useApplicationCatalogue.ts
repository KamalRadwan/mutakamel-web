import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
import { useIdempotency } from "@/shared/hooks/useIdempotency";
import { applicationsApi } from "../api/applications.api";
import type {
  BillingCycle,
  CatalogueAuditPageView,
  CreateFeatureDto,
  CreateTierDto,
  FeatureView,
  PriceTierView,
  SetPriceTiersDto,
  SetTierFeaturesDto,
  TierFeatureGrantView,
  TierView,
  UpdateFeatureDto,
  UpdateTierDto,
} from "../types";

type ResourceError = string | null;

export function useApplicationCatalogue(applicationId: string | null) {
  const toast = useToast();
  const { getIdempotencyKey, resetKey } = useIdempotency();
  const [tiers, setTiers] = useState<TierView[]>([]);
  const [features, setFeatures] = useState<FeatureView[]>([]);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [grants, setGrants] = useState<TierFeatureGrantView[]>([]);
  const [prices, setPrices] = useState<PriceTierView[]>([]);
  const [audit, setAudit] = useState<CatalogueAuditPageView | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTierLoading, setIsTierLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [catalogueError, setCatalogueError] = useState<ResourceError>(null);
  const [tierDetailError, setTierDetailError] = useState<ResourceError>(null);
  const [auditError, setAuditError] = useState<ResourceError>(null);

  const reportError = useCallback((error: unknown, setError: (message: string) => void) => {
    const normalized = normalizeApiError(error);
    const correlation = normalized.correlationId ? ` · ${normalized.correlationId}` : "";
    const message = `${normalized.message}${correlation}`;
    setError(message);
    toast.error("Action failed", message);
    return normalized;
  }, [toast]);

  const loadCatalogue = useCallback(async () => {
    if (!applicationId) return;
    setIsLoading(true);
    setCatalogueError(null);
    const [tierResult, featureResult] = await Promise.allSettled([
      applicationsApi.listTiers(applicationId),
      applicationsApi.listFeatures(applicationId),
    ]);

    if (tierResult.status === "fulfilled") {
      setTiers(tierResult.value);
      setSelectedTierId((current) =>
        current && tierResult.value.some((tier) => tier.id === current)
          ? current
          : tierResult.value[0]?.id ?? null,
      );
    }
    if (featureResult.status === "fulfilled") setFeatures(featureResult.value);

    const failure = tierResult.status === "rejected"
      ? tierResult.reason
      : featureResult.status === "rejected"
        ? featureResult.reason
        : null;
    if (failure) {
      const normalized = normalizeApiError(failure);
      setCatalogueError(normalized.message);
    }
    setIsLoading(false);
  }, [applicationId]);

  const loadTierDetails = useCallback(async (tierId: string | null) => {
    if (!tierId) {
      setGrants([]);
      setPrices([]);
      return;
    }
    setIsTierLoading(true);
    setTierDetailError(null);
    const [grantResult, priceResult] = await Promise.allSettled([
      applicationsApi.getTierGrants(tierId),
      applicationsApi.getPriceLadder(tierId),
    ]);
    if (grantResult.status === "fulfilled") setGrants(grantResult.value);
    if (priceResult.status === "fulfilled") setPrices(priceResult.value);
    const failure = grantResult.status === "rejected"
      ? grantResult.reason
      : priceResult.status === "rejected"
        ? priceResult.reason
        : null;
    if (failure) setTierDetailError(normalizeApiError(failure).message);
    setIsTierLoading(false);
  }, []);

  const loadAudit = useCallback(async (page = 1) => {
    if (!applicationId) return;
    setAuditError(null);
    try {
      setAudit(await applicationsApi.getApplicationAudit(applicationId, { page, limit: 20 }));
    } catch (error) {
      setAuditError(normalizeApiError(error).message);
    }
  }, [applicationId]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadCatalogue();
      void loadAudit();
    });
  }, [loadAudit, loadCatalogue]);

  useEffect(() => {
    queueMicrotask(() => { void loadTierDetails(selectedTierId); });
  }, [loadTierDetails, selectedTierId]);

  const runMutation = async <T,>(action: string, payload: unknown, operation: (key: string) => Promise<T>, message: string) => {
    setPendingAction(action);
    setCatalogueError(null);
    try {
      const result = await operation(getIdempotencyKey({ action, applicationId, payload }));
      resetKey();
      toast.success("Saved", message);
      await loadCatalogue();
      await loadAudit();
      return result;
    } catch (error) {
      throw reportError(error, setCatalogueError);
    } finally {
      setPendingAction(null);
    }
  };

  const createTier = async (dto: CreateTierDto) => {
    if (!applicationId) return;
    setPendingAction("tier:create");
    try {
      const tier = await applicationsApi.createTier(applicationId, dto);
      toast.success("Tier created", `${tier.name} is ready to configure.`);
      await loadCatalogue();
      await loadAudit();
      setSelectedTierId(tier.id);
      return tier;
    } catch (error) {
      throw reportError(error, setCatalogueError);
    } finally {
      setPendingAction(null);
    }
  };

  const createFeature = async (dto: CreateFeatureDto) => {
    if (!applicationId) return;
    setPendingAction("feature:create");
    try {
      const feature = await applicationsApi.createFeature(applicationId, dto);
      toast.success("Feature created", `${feature.name} is available for tier grants.`);
      await loadCatalogue();
      await loadAudit();
      return feature;
    } catch (error) {
      throw reportError(error, setCatalogueError);
    } finally {
      setPendingAction(null);
    }
  };

  return {
    tiers,
    features,
    grants,
    prices,
    audit,
    selectedTierId,
    setSelectedTierId,
    isLoading,
    isTierLoading,
    pendingAction,
    catalogueError,
    tierDetailError,
    auditError,
    loadCatalogue,
    loadTierDetails,
    loadAudit,
    createTier,
    updateTier: (tierId: string, dto: UpdateTierDto) =>
      runMutation(`tier:update:${tierId}`, dto, (key) => applicationsApi.updateTier(tierId, dto, key), "Tier updated."),
    deleteTier: (tierId: string) =>
      runMutation(`tier:delete:${tierId}`, null, (key) => applicationsApi.deleteTier(tierId, key), "Tier deleted."),
    createFeature,
    updateFeature: (featureId: string, dto: UpdateFeatureDto) =>
      runMutation(`feature:update:${featureId}`, dto, (key) => applicationsApi.updateFeature(featureId, dto, key), "Feature updated."),
    deleteFeature: (featureId: string) =>
      runMutation(`feature:delete:${featureId}`, null, (key) => applicationsApi.deleteFeature(featureId, key), "Feature deleted."),
    replaceGrants: (tierId: string, dto: SetTierFeaturesDto) =>
      runMutation(`grants:replace:${tierId}`, dto, async (key) => {
        const result = await applicationsApi.replaceTierGrants(tierId, dto, key);
        setGrants(result);
        return result;
      }, "Tier feature grants replaced."),
    replacePrices: (tierId: string, dto: SetPriceTiersDto) =>
      runMutation(`prices:replace:${tierId}:${dto.billingCycle}`, dto, async (key) => {
        const result = await applicationsApi.replacePriceLadder(tierId, dto, key);
        setPrices((current) => [
          ...current.filter((row) => row.billingCycle !== dto.billingCycle),
          ...result,
        ]);
        return result;
      }, `${dto.billingCycle === "MONTHLY" ? "Monthly" : "Annual"} price ladder replaced.`),
    pricesFor: (cycle: BillingCycle) => prices.filter((row) => row.billingCycle === cycle),
  };
}
