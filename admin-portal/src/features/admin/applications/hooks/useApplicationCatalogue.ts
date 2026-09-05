import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { safeSessionStorage } from "@/lib/safeStorage";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
import { shouldRotateWriteCommandKey } from "@/shared/api/write-command-recovery";
import { useIdempotency } from "@/shared/hooks/useIdempotency";
import { applicationsApi } from "../api/applications.api";
import {
  findCatalogueCreateResult,
  isAmbiguousCatalogueCreateError,
  readPendingCatalogueCreateAttempt,
  type PendingCatalogueCreateAttempt,
} from "../lib/catalogue-create-recovery";
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
const PENDING_CREATE_STORAGE_KEY = "admin.catalogue.pending-create";

export function useApplicationCatalogue(applicationId: string | null) {
  const toast = useToast();
  const { getIdempotencyKey, resetKey } = useIdempotency();
  const applicationIdRef = useRef(applicationId);
  const selectedTierIdRef = useRef<string | null>(null);
  const catalogueGeneration = useRef(0);
  const tierGeneration = useRef(0);
  const auditGeneration = useRef(0);
  const catalogueAbort = useRef<AbortController | null>(null);
  const tierAbort = useRef<AbortController | null>(null);
  const auditAbort = useRef<AbortController | null>(null);

  const [tiers, setTiers] = useState<TierView[]>([]);
  const [features, setFeatures] = useState<FeatureView[]>([]);
  const [loadedApplicationId, setLoadedApplicationId] = useState<string | null>(null);
  const [selectedTierId, setSelectedTierIdState] = useState<string | null>(null);
  const [loadedTierId, setLoadedTierId] = useState<string | null>(null);
  const [grants, setGrants] = useState<TierFeatureGrantView[]>([]);
  const [prices, setPrices] = useState<PriceTierView[]>([]);
  const [audit, setAudit] = useState<CatalogueAuditPageView | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTierLoading, setIsTierLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [pendingCreateAttempt, setPendingCreateAttemptState] =
    useState<PendingCatalogueCreateAttempt | null>(null);
  const [catalogueError, setCatalogueError] = useState<ResourceError>(null);
  const [tierDetailError, setTierDetailError] = useState<ResourceError>(null);
  const [auditError, setAuditError] = useState<ResourceError>(null);

  const setPendingCreateAttempt = useCallback(
    (attempt: PendingCatalogueCreateAttempt | null) => {
      setPendingCreateAttemptState(attempt);
      if (attempt) {
        safeSessionStorage.setItem(PENDING_CREATE_STORAGE_KEY, JSON.stringify(attempt));
      } else {
        safeSessionStorage.removeItem(PENDING_CREATE_STORAGE_KEY);
      }
    },
    [],
  );

  const reportError = useCallback(
    (error: unknown, setError: (message: string) => void) => {
      const normalized = normalizeApiError(error);
      const correlation = normalized.correlationId
        ? ` · ${normalized.correlationId}`
        : "";
      const message = `${normalized.message}${correlation}`;
      setError(message);
      toast.error("Action failed", message);
      return normalized;
    },
    [toast],
  );

  const commitSelectedTier = useCallback((tierId: string | null) => {
    selectedTierIdRef.current = tierId;
    tierGeneration.current += 1;
    tierAbort.current?.abort();
    setSelectedTierIdState(tierId);
    setLoadedTierId(null);
    setGrants([]);
    setPrices([]);
  }, []);

  const loadCatalogue = useCallback(async () => {
    const requestedApplicationId = applicationId;
    if (!requestedApplicationId) return null;
    const generation = ++catalogueGeneration.current;
    catalogueAbort.current?.abort();
    const controller = new AbortController();
    catalogueAbort.current = controller;
    setIsLoading(true);
    setCatalogueError(null);

    const [tierResult, featureResult] = await Promise.allSettled([
      applicationsApi.listTiers(requestedApplicationId, controller.signal),
      applicationsApi.listFeatures(requestedApplicationId, controller.signal),
    ]);
    if (
      generation !== catalogueGeneration.current ||
      controller.signal.aborted ||
      applicationIdRef.current !== requestedApplicationId
    ) {
      return null;
    }

    if (tierResult.status === "fulfilled") setTiers(tierResult.value);
    if (featureResult.status === "fulfilled") setFeatures(featureResult.value);
    if (tierResult.status === "fulfilled" && featureResult.status === "fulfilled") {
      setLoadedApplicationId(requestedApplicationId);
      const current =
        selectedTierIdRef.current &&
        tierResult.value.some((tier) => tier.id === selectedTierIdRef.current)
          ? selectedTierIdRef.current
          : tierResult.value[0]?.id ?? null;
      if (current !== selectedTierIdRef.current) commitSelectedTier(current);
      setIsLoading(false);
      return { tiers: tierResult.value, features: featureResult.value };
    }

    const failure =
      tierResult.status === "rejected"
        ? tierResult.reason
        : featureResult.status === "rejected"
          ? featureResult.reason
          : null;
    if (failure) setCatalogueError(normalizeApiError(failure).message);
    setLoadedApplicationId(null);
    setIsLoading(false);
    return null;
  }, [applicationId, commitSelectedTier]);

  const loadTierDetails = useCallback(async (tierId: string | null) => {
    const requestedApplicationId = applicationIdRef.current;
    const generation = ++tierGeneration.current;
    tierAbort.current?.abort();
    const controller = new AbortController();
    tierAbort.current = controller;
    if (!tierId || !requestedApplicationId) {
      setLoadedTierId(null);
      setGrants([]);
      setPrices([]);
      setIsTierLoading(false);
      return;
    }
    setIsTierLoading(true);
    setTierDetailError(null);
    const [grantResult, priceResult] = await Promise.allSettled([
      applicationsApi.getTierGrants(tierId, controller.signal),
      applicationsApi.getPriceLadder(tierId, undefined, controller.signal),
    ]);
    if (
      generation !== tierGeneration.current ||
      controller.signal.aborted ||
      applicationIdRef.current !== requestedApplicationId ||
      selectedTierIdRef.current !== tierId
    ) {
      return;
    }
    if (grantResult.status === "fulfilled") setGrants(grantResult.value);
    if (priceResult.status === "fulfilled") setPrices(priceResult.value);
    const failure =
      grantResult.status === "rejected"
        ? grantResult.reason
        : priceResult.status === "rejected"
          ? priceResult.reason
          : null;
    if (failure) setTierDetailError(normalizeApiError(failure).message);
    setLoadedTierId(
      grantResult.status === "fulfilled" && priceResult.status === "fulfilled"
        ? tierId
        : null,
    );
    setIsTierLoading(false);
  }, []);

  const loadAudit = useCallback(async (page = 1) => {
    const requestedApplicationId = applicationId;
    if (!requestedApplicationId) return;
    const generation = ++auditGeneration.current;
    auditAbort.current?.abort();
    const controller = new AbortController();
    auditAbort.current = controller;
    setAuditError(null);
    try {
      const next = await applicationsApi.getApplicationAudit(
        requestedApplicationId,
        { page, limit: 20 },
        controller.signal,
      );
      if (
        generation === auditGeneration.current &&
        !controller.signal.aborted &&
        applicationIdRef.current === requestedApplicationId
      ) {
        setAudit(next);
      }
    } catch (error) {
      if (
        generation === auditGeneration.current &&
        !controller.signal.aborted &&
        applicationIdRef.current === requestedApplicationId
      ) {
        setAuditError(normalizeApiError(error).message);
      }
    }
  }, [applicationId]);

  useEffect(() => {
    applicationIdRef.current = applicationId;
    const stored = readPendingCatalogueCreateAttempt(
      safeSessionStorage.getItem(PENDING_CREATE_STORAGE_KEY),
    );
    queueMicrotask(() => {
      setLoadedApplicationId(null);
      setLoadedTierId(null);
      setTiers([]);
      setFeatures([]);
      setGrants([]);
      setPrices([]);
      setAudit(null);
      setPendingAction(null);
      setCatalogueError(null);
      setTierDetailError(null);
      setAuditError(null);
      setPendingCreateAttemptState(
        stored?.applicationId === applicationId ? stored : null,
      );
      void loadCatalogue();
      void loadAudit();
    });
    return () => {
      catalogueAbort.current?.abort();
      tierAbort.current?.abort();
      auditAbort.current?.abort();
    };
  }, [applicationId, loadAudit, loadCatalogue]);

  useEffect(() => {
    queueMicrotask(() => void loadTierDetails(selectedTierId));
  }, [loadTierDetails, selectedTierId]);

  const setSelectedTierId = useCallback(
    (tierId: string) => commitSelectedTier(tierId || null),
    [commitSelectedTier],
  );

  /**
   * Re-reads the selected tier's grants and prices after a write.
   *
   * `loadCatalogue` refreshes the tier and feature lists only; grants and prices
   * have a request of their own, fired by the effect that watches
   * `selectedTierId`. Saving into the tier already selected changes no id, so
   * that effect never runs and the two arrays keep the values they held before
   * the save. The pricing editor rebuilds its brackets from that cache every
   * time the billing cycle changes, so a just-saved ladder came back as the
   * previous one — and saving again wrote the stale ladder over the new one.
   *
   * Skipped when the selection has already moved underneath it — deleting the
   * selected tier is the case — because the effect is then loading whichever
   * tier replaced it, and re-reading the deleted one would report a failure for
   * a command that succeeded.
   */
  const reloadSelectedTierDetails = useCallback(
    async (requestedApplicationId: string, requestedTierId: string | null) => {
      if (
        !requestedTierId ||
        applicationIdRef.current !== requestedApplicationId ||
        selectedTierIdRef.current !== requestedTierId
      ) {
        return;
      }
      await loadTierDetails(requestedTierId);
    },
    [loadTierDetails],
  );

  /** Everything the header's Refresh button is expected to bring up to date. */
  const refreshAll = useCallback(async () => {
    const requestedApplicationId = applicationIdRef.current;
    const requestedTierId = selectedTierIdRef.current;
    if (!requestedApplicationId) return;
    await Promise.all([loadCatalogue(), loadAudit()]);
    await reloadSelectedTierDetails(requestedApplicationId, requestedTierId);
  }, [loadAudit, loadCatalogue, reloadSelectedTierDetails]);

  const runMutation = async <T,>(
    action: string,
    payload: unknown,
    operation: (key: string) => Promise<T>,
    message: string,
  ) => {
    const requestedApplicationId = applicationId;
    if (!requestedApplicationId || applicationIdRef.current !== requestedApplicationId) {
      throw new Error("APPLICATION_CONTEXT_CHANGED");
    }
    const requestedTierId = selectedTierIdRef.current;
    setPendingAction(action);
    setCatalogueError(null);
    try {
      const result = await operation(
        getIdempotencyKey({ action, applicationId: requestedApplicationId, payload }),
      );
      resetKey();
      if (applicationIdRef.current === requestedApplicationId) {
        toast.success("Saved", message);
        await Promise.all([loadCatalogue(), loadAudit()]);
        await reloadSelectedTierDetails(requestedApplicationId, requestedTierId);
      }
      return result;
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (shouldRotateWriteCommandKey(normalized)) resetKey();
      if (applicationIdRef.current === requestedApplicationId) {
        await Promise.allSettled([loadCatalogue(), loadAudit()]);
        // The write may still have landed — an ambiguous outcome is exactly when
        // the operator most needs the arrays to be the server's, not the ones
        // they were editing.
        await reloadSelectedTierDetails(requestedApplicationId, requestedTierId);
        reportError(normalized, setCatalogueError);
      }
      throw normalized;
    } finally {
      if (applicationIdRef.current === requestedApplicationId) setPendingAction(null);
    }
  };

  const recoverPendingCreateAttempt = useCallback(async () => {
    const attempt = pendingCreateAttempt;
    if (!attempt || attempt.applicationId !== applicationIdRef.current) return null;
    setPendingAction(`${attempt.kind}:recover`);
    try {
      const snapshot = await loadCatalogue();
      if (!snapshot || applicationIdRef.current !== attempt.applicationId) return null;
      const recovered = findCatalogueCreateResult(
        attempt,
        snapshot.tiers,
        snapshot.features,
      );
      if (recovered) {
        setPendingCreateAttempt(null);
        if (attempt.kind === "tier") commitSelectedTier(recovered.id);
        toast.success("Create reconciled", `${recovered.name} already exists and is now loaded.`);
        await loadAudit();
        return recovered;
      }
      setPendingCreateAttempt({ ...attempt, absenceConfirmed: true });
      return null;
    } finally {
      if (applicationIdRef.current === attempt.applicationId) setPendingAction(null);
    }
  }, [commitSelectedTier, loadAudit, loadCatalogue, pendingCreateAttempt, setPendingCreateAttempt, toast]);

  const clearAbsentPendingCreateAttempt = useCallback(() => {
    if (pendingCreateAttempt?.absenceConfirmed) setPendingCreateAttempt(null);
  }, [pendingCreateAttempt, setPendingCreateAttempt]);

  const createTier = async (dto: CreateTierDto) => {
    const requestedApplicationId = applicationId;
    if (!requestedApplicationId) return;
    if (pendingCreateAttempt) throw new Error("Resolve the previous create outcome before sending another create request.");
    setPendingAction("tier:create");
    try {
      const tier = await applicationsApi.createTier(requestedApplicationId, dto);
      if (applicationIdRef.current === requestedApplicationId) {
        toast.success("Tier created", `${tier.name} is ready to configure.`);
        await Promise.all([loadCatalogue(), loadAudit()]);
        commitSelectedTier(tier.id);
      }
      return tier;
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (applicationIdRef.current !== requestedApplicationId) throw normalized;
      if (isAmbiguousCatalogueCreateError(normalized)) {
        const attempt: PendingCatalogueCreateAttempt = {
          applicationId: requestedApplicationId,
          kind: "tier",
          resourceKey: dto.key,
          absenceConfirmed: false,
        };
        setPendingCreateAttempt(attempt);
        const snapshot = await loadCatalogue();
        const recovered = snapshot
          ? findCatalogueCreateResult(attempt, snapshot.tiers, snapshot.features)
          : null;
        if (recovered) {
          setPendingCreateAttempt(null);
          commitSelectedTier(recovered.id);
          toast.success("Create reconciled", `${recovered.name} was created and is now loaded.`);
          return recovered as TierView;
        }
        if (snapshot) setPendingCreateAttempt({ ...attempt, absenceConfirmed: true });
      }
      throw reportError(normalized, setCatalogueError);
    } finally {
      if (applicationIdRef.current === requestedApplicationId) setPendingAction(null);
    }
  };

  const createFeature = async (dto: CreateFeatureDto) => {
    const requestedApplicationId = applicationId;
    if (!requestedApplicationId) return;
    if (pendingCreateAttempt) throw new Error("Resolve the previous create outcome before sending another create request.");
    setPendingAction("feature:create");
    try {
      const feature = await applicationsApi.createFeature(requestedApplicationId, dto);
      if (applicationIdRef.current === requestedApplicationId) {
        toast.success("Feature created", `${feature.name} is available for tier grants.`);
        await Promise.all([loadCatalogue(), loadAudit()]);
      }
      return feature;
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (applicationIdRef.current !== requestedApplicationId) throw normalized;
      if (isAmbiguousCatalogueCreateError(normalized)) {
        const attempt: PendingCatalogueCreateAttempt = {
          applicationId: requestedApplicationId,
          kind: "feature",
          resourceKey: dto.key,
          absenceConfirmed: false,
        };
        setPendingCreateAttempt(attempt);
        const snapshot = await loadCatalogue();
        const recovered = snapshot
          ? findCatalogueCreateResult(attempt, snapshot.tiers, snapshot.features)
          : null;
        if (recovered) {
          setPendingCreateAttempt(null);
          toast.success("Create reconciled", `${recovered.name} was created and is now loaded.`);
          return recovered as FeatureView;
        }
        if (snapshot) setPendingCreateAttempt({ ...attempt, absenceConfirmed: true });
      }
      throw reportError(normalized, setCatalogueError);
    } finally {
      if (applicationIdRef.current === requestedApplicationId) setPendingAction(null);
    }
  };

  const isCurrentApplication = loadedApplicationId === applicationId;
  const isCurrentTier = isCurrentApplication && loadedTierId === selectedTierId;
  const visiblePrices = isCurrentTier ? prices : [];

  return {
    tiers: isCurrentApplication ? tiers : [],
    features: isCurrentApplication ? features : [],
    grants: isCurrentTier ? grants : [],
    prices: visiblePrices,
    audit: isCurrentApplication ? audit : null,
    loadedApplicationId,
    loadedTierId,
    selectedTierId: isCurrentApplication ? selectedTierId : null,
    setSelectedTierId,
    isLoading,
    isTierLoading,
    pendingAction,
    pendingCreateAttempt,
    catalogueError,
    tierDetailError,
    auditError,
    loadCatalogue,
    loadTierDetails,
    loadAudit,
    refreshAll,
    recoverPendingCreateAttempt,
    clearAbsentPendingCreateAttempt,
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
    replaceGrants: (tierId: string, dto: SetTierFeaturesDto) => {
      if (tierId !== selectedTierIdRef.current || tierId !== loadedTierId) {
        return Promise.reject(new Error("TIER_CONTEXT_CHANGED"));
      }
      return runMutation(`grants:replace:${tierId}`, dto, (key) => applicationsApi.replaceTierGrants(tierId, dto, key), "Tier feature grants replaced.");
    },
    replacePrices: (tierId: string, dto: SetPriceTiersDto) => {
      if (tierId !== selectedTierIdRef.current || tierId !== loadedTierId) {
        return Promise.reject(new Error("TIER_CONTEXT_CHANGED"));
      }
      return runMutation(`prices:replace:${tierId}:${dto.billingCycle}`, dto, (key) => applicationsApi.replacePriceLadder(tierId, dto, key), `${dto.billingCycle === "MONTHLY" ? "Monthly" : "Annual"} price ladder replaced.`);
    },
    pricesFor: (cycle: BillingCycle) => visiblePrices.filter((row) => row.billingCycle === cycle),
  };
}
