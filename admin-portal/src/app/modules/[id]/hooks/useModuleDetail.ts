"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient, generateUUIDv7 } from "@/lib/api/axiosClient";
import { useToast } from "@/components/ui/ToastContext";
import {
  ModuleView,
  TierView,
  FeatureView,
  TierFeatureGrantView,
  PriceTierView,
} from "@/types/module";

export type ModuleTabKey = "preview" | "tiers" | "features" | "grants" | "price" | "history";

export interface TierFeatureGrant {
  tierId: string;
  featureId: string;
  isEnabled: boolean;
  value: string;
}

export interface ModuleAuditLogEntry {
  id: string;
  schemaVersion: number;
  entityType: string;
  action: string;
  entityId: string | null;
  moduleId: string;
  tierId: string | null;
  actorAdminId: string | null;
  actorLabel: string | null;
  operationId: string;
  idempotencyKey: string | null;
  sourceType: string;
  sourceId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  diff: { field: string; before?: unknown; after?: unknown }[];
  correlationId: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
}

export function useModuleDetail(id: string) {
  const router = useRouter();
  const { t, lang } = useI18n();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<ModuleTabKey>("preview");
  const [isSaved, setIsSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveTabMessage, setSaveTabMessage] = useState("");
  const [pricingValidationError, setPricingValidationError] = useState<string | null>(null);

  // Modals state
  const [isAddTierOpen, setIsAddTierOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<TierView | null>(null);
  const [isAddFeatureOpen, setIsAddFeatureOpen] = useState(false);
  const [isImportFeaturesOpen, setIsImportFeaturesOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const [editingFeature, setEditingFeature] = useState<FeatureView | null>(null);
  const [isAddPriceBracketOpen, setIsAddPriceBracketOpen] = useState(false);
  const [editingPriceBracket, setEditingPriceBracket] = useState<PriceTierView | null>(null);

  // Add Tier Form
  const [newTierKey, setNewTierKey] = useState("");
  const [newTierName, setNewTierName] = useState("");
  const [newTierColor, setNewTierColor] = useState("#0b6ff4");
  const [newTierIsActive, setNewTierIsActive] = useState(true);

  // Add Feature Form
  const [newFeatureKey, setNewFeatureKey] = useState("");
  const [newFeatureName, setNewFeatureName] = useState("");
  const [newFeatureType, setNewFeatureType] = useState<"BOOLEAN" | "NUMERIC_LIMIT" | "TEXT_SET">("BOOLEAN");
  const [newFeatureDefault, setNewFeatureDefault] = useState("true");
  const [newFeatureDesc, setNewFeatureDesc] = useState("");

  // Add Price Bracket Form
  const [newBracketTierId, setNewBracketTierId] = useState("");
  const [newBracketMinUsers, setNewBracketMinUsers] = useState(1);
  const [newBracketMaxUsers, setNewBracketMaxUsers] = useState<number | null>(10);
  const [newBracketIsInfinity, setNewBracketIsInfinity] = useState(false);
  const [newBracketUnitPrice, setNewBracketUnitPrice] = useState("15.00");
  const [newBracketCycle, setNewBracketCycle] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");

  // Filters
  const [pricingTierFilter, setPricingTierFilter] = useState<string>("ALL");
  const [pricingCycleFilter, setPricingCycleFilter] = useState<string>("MONTHLY");

  // Data states
  const [moduleData, setModuleData] = useState<ModuleView | null>(null);
  const [resolvedModuleId, setResolvedModuleId] = useState<string>(id);
  const [tiers, setTiers] = useState<TierView[]>([]);
  const [features, setFeatures] = useState<FeatureView[]>([]);
  const [grants, setGrants] = useState<TierFeatureGrant[]>([]);
  const [priceBrackets, setPriceBrackets] = useState<PriceTierView[]>([]);
  const [auditLogs, setAuditLogs] = useState<ModuleAuditLogEntry[]>([]);
  const [auditFilter, setAuditFilter] = useState<string>("ALL");
  const [auditSearch, setAuditSearch] = useState<string>("");

  // Audit log initial population helper
  const fetchAuditLogs = useCallback(async (targetId: string, modName?: string) => {
    try {
      const res = await axiosClient.get(`/api/admin/core/v1/modules/${targetId}/audit`).catch(() => null);
      if (res?.data?.data?.items && Array.isArray(res.data.data.items)) {
        setAuditLogs(res.data.data.items);
        return;
      }
    } catch (e) {
      console.warn("Failed to fetch audit logs");
    }
    setAuditLogs([]);
  }, []);

  // Resolve ID helper if passed key instead of UUID
  const resolveTargetId = useCallback(async (): Promise<string> => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (isUuid) return id;

    try {
      const res = await axiosClient.get('/api/admin/core/v1/modules?limit=100');
      const items: ModuleView[] = res.data?.items || res.data?.data || (Array.isArray(res.data) ? res.data : []);
      const found = items.find((m) => m.key.toLowerCase() === id.toLowerCase() || m.id === id);
      if (found) return found.id;
    } catch (e) {
      console.warn("Failed to resolve module ID from key");
    }
    return id;
  }, [id]);

  // Fetch Module
  const fetchModule = useCallback(async (targetId: string) => {
    try {
      const res = await axiosClient.get(`/api/admin/core/v1/modules/${targetId}`);
      setModuleData(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Module not found.");
    }
  }, []);

  // Fetch Tiers
  const fetchTiers = useCallback(async (targetId: string) => {
    try {
      const res = await axiosClient.get(`/api/admin/core/v1/modules/${targetId}/tiers`);
      setTiers(res.data.data || []);
      
      const loadedTiers = res.data.data || [];
      if (loadedTiers.length > 0 && pricingTierFilter === "ALL") {
         setPricingTierFilter(loadedTiers[0].id);
         setNewBracketTierId(loadedTiers[0].id);
      }
    } catch (err) {
      console.warn("Failed to fetch tiers");
    }
  }, [pricingTierFilter]);

  // Fetch Features
  const fetchFeatures = useCallback(async (targetId: string) => {
    try {
      const res = await axiosClient.get(`/api/admin/core/v1/modules/${targetId}/features`);
      setFeatures(res.data.data || []);
    } catch (err) {
      console.warn("Failed to fetch features");
    }
  }, []);

  // Fetch Grants
  const fetchGrants = useCallback(async (currentTiers: TierView[]) => {
    try {
      const allGrants: TierFeatureGrant[] = [];
      for (const tier of currentTiers) {
        const res = await axiosClient.get(`/api/admin/core/v1/tiers/${tier.id}/features`);
        const tierGrants = res.data.data || [];
        tierGrants.forEach((g: any) => {
          allGrants.push({
            tierId: g.tierId,
            featureId: g.featureId,
            isEnabled: true,
            value: g.config ? JSON.stringify(g.config) : "true",
          });
        });
      }
      setGrants(allGrants);
    } catch (err) {
      console.warn("Failed to fetch grants");
    }
  }, []);

  // Fetch Pricing
  const fetchPricing = useCallback(async (currentTiers: TierView[]) => {
    try {
      let allBrackets: PriceTierView[] = [];
      for (const tier of currentTiers) {
        const res = await axiosClient.get(`/api/admin/core/v1/tiers/${tier.id}/price-tiers?billingCycle=MONTHLY`);
        const resAnn = await axiosClient.get(`/api/admin/core/v1/tiers/${tier.id}/price-tiers?billingCycle=ANNUAL`);
        const monthlyData = (res.data?.data || []).map((b: any) => ({
          ...b,
          tierId: b.tierId || tier.id,
          unitPriceUsd: b.unitPriceUsd !== undefined ? String(b.unitPriceUsd) : (b.unitPrice !== undefined ? String(b.unitPrice) : "0.0000"),
          minUsers: b.minUsers ?? 1,
          maxUsers: b.maxUsers ?? null,
        }));
        const annualData = (resAnn.data?.data || []).map((b: any) => ({
          ...b,
          tierId: b.tierId || tier.id,
          unitPriceUsd: b.unitPriceUsd !== undefined ? String(b.unitPriceUsd) : (b.unitPrice !== undefined ? String(b.unitPrice) : "0.0000"),
          minUsers: b.minUsers ?? 1,
          maxUsers: b.maxUsers ?? null,
        }));
        allBrackets = [...allBrackets, ...monthlyData, ...annualData];
      }
      setPriceBrackets(allBrackets);
    } catch (err) {
      console.warn("Failed to fetch prices");
    }
  }, []);

  // Initial Load
  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      const targetId = await resolveTargetId();
      setResolvedModuleId(targetId);

      await fetchModule(targetId);
      
      try {
        const tiersRes = await axiosClient.get(`/api/admin/core/v1/modules/${targetId}/tiers`);
        const loadedTiers = tiersRes.data.data || [];
        setTiers(loadedTiers);
        
        if (loadedTiers.length > 0) {
           setPricingTierFilter(loadedTiers[0].id);
           setNewBracketTierId(loadedTiers[0].id);
        }

        await fetchFeatures(targetId);
        await fetchGrants(loadedTiers);
        await fetchPricing(loadedTiers);
        await fetchAuditLogs(targetId, moduleData?.name);
      } catch (e) {
        // Handle failures gracefully
      } finally {
        setIsLoading(false);
      }
    };
    loadAll();
  }, [id, resolveTargetId, fetchModule, fetchFeatures, fetchGrants, fetchPricing]);


  const filteredPriceBrackets = priceBrackets.filter((p) => {
    const matchesTier = pricingTierFilter === "ALL" || p.tierId === pricingTierFilter;
    const matchesCycle = pricingCycleFilter === "ALL" || p.billingCycle === pricingCycleFilter;
    return matchesTier && matchesCycle;
  });

  const toggleGrant = (tierId: string, featureId: string) => {
    setGrants((prev) => {
      const existing = prev.find((g) => g.tierId === tierId && g.featureId === featureId);
      if (existing) {
        return prev.map((g) =>
          g.tierId === tierId && g.featureId === featureId ? { ...g, isEnabled: !g.isEnabled } : g
        );
      }
      return [...prev, { tierId, featureId, isEnabled: true, value: "true" }];
    });
  };

  // Tier CRUD
  const handleCreateTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTierKey || !newTierName) return;
    setIsSubmitting(true);
    try {
      await axiosClient.post(`/api/admin/core/v1/modules/${resolvedModuleId}/tiers`, {
        key: newTierKey.toLowerCase().trim(),
        name: newTierName.trim(),
        color: newTierColor,
        isActive: newTierIsActive,
      });
      await fetchTiers(resolvedModuleId);
      toast.success(
        lang === "ar" ? "تم إضافة المستوى" : "Tier Created",
        lang === "ar" ? `تم إضافة المستوى (${newTierName}) بنجاح` : `Tier (${newTierName}) created successfully`
      );
      setNewTierKey("");
      setNewTierName("");
      setIsAddTierOpen(false);
    } catch (err: any) {
      toast.error(lang === "ar" ? "فشل إنشاء المستوى" : "Failed to create tier", err.response?.data?.message || err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTier) return;
    setIsSubmitting(true);
    try {
      await axiosClient.patch(`/api/admin/core/v1/tiers/${editingTier.id}`, {
        name: editingTier.name,
        color: editingTier.color,
        isActive: editingTier.isActive,
      }, {
        headers: { "x-idempotency-key": generateUUIDv7() }
      });
      await fetchTiers(resolvedModuleId);
      toast.success(
        lang === "ar" ? "تم تحديث المستوى" : "Tier Updated",
        lang === "ar" ? `تم حفظ تعديلات المستوى بنجاح` : `Tier updated successfully`
      );
      setEditingTier(null);
    } catch (err: any) {
      toast.error(lang === "ar" ? "فشل تعديل المستوى" : "Failed to update tier", err.response?.data?.message || err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTier = async (tierId: string) => {
    try {
      await axiosClient.delete(`/api/admin/core/v1/tiers/${tierId}`, {
        headers: { "x-idempotency-key": generateUUIDv7() }
      });
      await fetchTiers(resolvedModuleId);
      toast.success(
        lang === "ar" ? "تم حذف المستوى" : "Tier Deleted",
        lang === "ar" ? `تم إزالة المستوى بنجاح` : `Tier deleted successfully`
      );
      setEditingTier(null);
    } catch (err: any) {
      toast.error(lang === "ar" ? "فشل حذف المستوى" : "Delete Failed", err.response?.data?.message || err.message);
    }
  };

  // Feature CRUD
  const handleCreateFeature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeatureKey || !newFeatureName) return;
    setIsSubmitting(true);
    try {
      await axiosClient.post(`/api/admin/core/v1/modules/${resolvedModuleId}/features`, {
        key: newFeatureKey.toLowerCase().trim(),
        name: newFeatureName.trim(),
        description: newFeatureDesc.trim() || undefined,
        rank: 0,
        isActive: true,
      });
      await fetchFeatures(resolvedModuleId);
      toast.success(
        lang === "ar" ? "تم إضافة الميزة" : "Feature Created",
        lang === "ar" ? `تم إضافة الميزة (${newFeatureName}) بنجاح` : `Feature (${newFeatureName}) created successfully`
      );
      setNewFeatureKey("");
      setNewFeatureName("");
      setNewFeatureDesc("");
      setIsAddFeatureOpen(false);
    } catch (err: any) {
      toast.error(lang === "ar" ? "فشل إضافة الميزة" : "Failed to create feature", err.response?.data?.message || err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateFeature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFeature) return;
    setIsSubmitting(true);
    try {
      await axiosClient.patch(`/api/admin/core/v1/features/${editingFeature.id}`, {
        description: editingFeature.description || null,
        isActive: editingFeature.isActive,
      }, {
        headers: { "x-idempotency-key": generateUUIDv7() }
      });
      await fetchFeatures(resolvedModuleId);
      toast.success(
        lang === "ar" ? "تم تعديل الميزة" : "Feature Updated",
        lang === "ar" ? `تم حفظ تعديلات الميزة بنجاح` : `Feature updated successfully`
      );
      setEditingFeature(null);
    } catch (err: any) {
      toast.error(lang === "ar" ? "فشل تعديل الميزة" : "Failed to update feature", err.response?.data?.message || err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFeature = async (featureId: string) => {
    try {
      await axiosClient.delete(`/api/admin/core/v1/features/${featureId}`, {
        headers: { "x-idempotency-key": generateUUIDv7() }
      });
      await fetchFeatures(resolvedModuleId);
      toast.success(
        lang === "ar" ? "تم حذف الميزة" : "Feature Deleted",
        lang === "ar" ? `تم إزالة الميزة بنجاح` : `Feature deleted successfully`
      );
      setEditingFeature(null);
    } catch (err: any) {
      toast.error(lang === "ar" ? "فشل حذف الميزة" : "Delete Failed", err.response?.data?.message || err.message);
    }
  };

  const handleImportFeatures = (e: React.FormEvent) => {
    e.preventDefault();
    toast.error(
      lang === "ar" ? "غير مدعوم حالياً" : "Import Not Supported",
      lang === "ar" ? "الاستيراد الجماعي يتطلب واجهة دفعة مجمعة غير متوفرة حالياً" : "Bulk import requires batch API which is not supported."
    );
  };
  const handleExportFeatures = () => {
    toast.error(
      lang === "ar" ? "غير مدعوم حالياً" : "Export Disabled",
      lang === "ar" ? "خاصية التصدير معطلة مؤقتاً" : "Export functionality is disabled."
    );
  };

  // Price Bracket Validation & CRUD
  const openAddPriceBracketModal = (targetTierId?: string, targetCycle?: "MONTHLY" | "ANNUAL") => {
    const activeTierId = targetTierId || (newBracketTierId ? newBracketTierId : (pricingTierFilter !== "ALL" ? pricingTierFilter : (tiers[0]?.id || "")));
    const activeCycle = targetCycle || (newBracketCycle ? newBracketCycle : (pricingCycleFilter !== "ALL" ? pricingCycleFilter : "MONTHLY"));

    setNewBracketTierId(activeTierId);
    setNewBracketCycle(activeCycle as "MONTHLY" | "ANNUAL");

    const existingForTier = priceBrackets.filter(p => p.tierId === activeTierId && p.billingCycle === activeCycle);
    if (existingForTier.length === 0) {
      setNewBracketMinUsers(1);
      setNewBracketMaxUsers(10);
      setNewBracketIsInfinity(false);
    } else {
      const sorted = [...existingForTier].sort((a, b) => a.minUsers - b.minUsers);
      const last = sorted[sorted.length - 1];
      if (last.maxUsers === null) {
        setNewBracketMinUsers(last.minUsers + 10);
        setNewBracketMaxUsers(null);
        setNewBracketIsInfinity(true);
      } else {
        setNewBracketMinUsers(last.maxUsers + 1);
        setNewBracketMaxUsers(last.maxUsers + 10);
        setNewBracketIsInfinity(false);
      }
    }
    setIsAddPriceBracketOpen(true);
  };

  const handleCreatePriceBracket = (e: React.FormEvent) => {
    e.preventDefault();
    setPricingValidationError(null);

    const minUsers = Number(newBracketMinUsers);
    const maxUsers = newBracketIsInfinity ? null : newBracketMaxUsers !== null ? Number(newBracketMaxUsers) : null;

    const effectiveTierId = newBracketTierId || (tiers[0]?.id || "");

    if (!effectiveTierId) {
      toast.error(
        lang === "ar" ? "تحديـد المستوى مطلوب" : "Tier Selection Required",
        lang === "ar" ? "يرجى إنشاء وإضافة مستوى (Tier) أولاً قبل إضافة فئة سعرية." : "Please create a Tier first before adding price brackets."
      );
      return;
    }

    const existingForTier = priceBrackets.filter(p => p.tierId === effectiveTierId && p.billingCycle === newBracketCycle);
    const sorted = [...existingForTier].sort((a, b) => a.minUsers - b.minUsers);
    const lastBracket = sorted.length > 0 ? sorted[sorted.length - 1] : null;

    // Rule 4: If previous bracket is Infinity (maxUsers === null), block adding new bracket
    if (lastBracket && lastBracket.maxUsers === null) {
      const msg = lang === "ar"
        ? "توجد فئة سعرية مفتوحة (Infinity) حالياً لهذه الدورة. يرجى تعديل الفئة السابقة لتحديد حد أقصى للمقاعد قبل إضافة فئة جديدة."
        : "The previous price bracket is open-ended (Infinity). Edit the previous bracket to set a max limit before adding a new bracket.";
      setPricingValidationError(msg);
      toast.error(lang === "ar" ? "الفئة السعرية مسدودة" : "Infinity Bracket Exists", msg);
      return;
    }

    // Rule 1: First price bracket MUST have minUsers = 1
    if (sorted.length === 0 && minUsers !== 1) {
      const msg = lang === "ar"
        ? "خطأ في التسلسل: الفئة السعرية الأولى لهذه الباقة والدورة يجب أن تبدأ من المقعد 1."
        : "Sequence Error: The first price bracket for this tier and cycle must start at seat 1.";
      setPricingValidationError(msg);
      toast.error(lang === "ar" ? "خطأ تسلسل المقاعد" : "Seat Sequence Error", msg);
      return;
    }

    // Rule 3: Adding more prices -> minUsers MUST be lastMax + 1
    if (sorted.length > 0 && lastBracket && lastBracket.maxUsers !== null) {
      const expectedMin = lastBracket.maxUsers + 1;
      if (minUsers !== expectedMin) {
        const msg = lang === "ar"
          ? `خطأ في التسلسل: يجب أن يبدأ الحد الأدنى للمقاعد من المقعد ${expectedMin} للتسلسل الصحيح.`
          : `Sequence Error: Min seats must start at ${expectedMin} to follow the previous bracket cleanly.`;
        setPricingValidationError(msg);
        toast.error(lang === "ar" ? "خطأ تسلسل المقاعد" : "Seat Sequence Error", msg);
        return;
      }
    }

    if (maxUsers !== null && maxUsers <= minUsers) {
      const msg = lang === "ar" ? "خطأ في التحقق: يجب أن يكون الحد الأقصى للمقاعد أكبر من الحد الأدنى." : "Validation Failed: maxUsers must be greater than minUsers.";
      setPricingValidationError(msg);
      toast.error(lang === "ar" ? "خطأ في الفئة السعرية" : "Pricing Validation Error", msg);
      return;
    }

    const newRecord: PriceTierView = {
      id: generateUUIDv7(), // Temp ID for draft
      tierId: effectiveTierId,
      billingCycle: newBracketCycle as "MONTHLY" | "ANNUAL",
      minUsers,
      maxUsers,
      unitPriceUsd: parseFloat(newBracketUnitPrice).toFixed(4),
    };

    setPriceBrackets((prev) => [...prev, newRecord]);
    toast.success(
      lang === "ar" ? "تم إضافة الفئة السعرية" : "Price Bracket Added",
      lang === "ar" ? `تم إضافة الفئة السعرية بنجاح` : `Price bracket added successfully`
    );
    setIsAddPriceBracketOpen(false);
  };

  const handleDeletePriceBracket = (bracketId: string) => {
    const target = priceBrackets.find(p => p.id === bracketId);
    if (target) {
      const tierCycleBrackets = priceBrackets
        .filter(b => b.tierId === target.tierId && b.billingCycle === target.billingCycle)
        .sort((a, b) => a.minUsers - b.minUsers);
      
      const isLast = tierCycleBrackets.length > 0 && tierCycleBrackets[tierCycleBrackets.length - 1].id === bracketId;
      if (!isLast) {
        toast.error(
          lang === "ar" ? "حذف غير مسموح" : "Delete Not Allowed",
          lang === "ar"
            ? "يسمح فقط بحذف الفئة السعرية الأخيرة في التسلسل للحفاظ على ترابط المقاعد."
            : "Only the last price bracket in the sequence can be deleted to preserve seat continuity."
        );
        return;
      }
    }

    setPriceBrackets((prev) => prev.filter((p) => p.id !== bracketId));
    toast.success(
      lang === "ar" ? "تم حذف الفئة السعرية" : "Bracket Deleted",
      lang === "ar" ? `تم إزالة الفئة السعرية بنجاح` : `Price bracket deleted successfully`
    );
  };

  const handleUpdatePriceBracket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPriceBracket) return;

    if (editingPriceBracket.minUsers < 1) {
      const msg = lang === "ar" ? "خطأ في التحقق: يجب أن تبدأ الفئة السعرية الأولى من المقعد 1." : "Validation Failed: First minUsers must start at 1.";
      setPricingValidationError(msg);
      toast.error(lang === "ar" ? "خطأ في الفئة السعرية" : "Pricing Validation Error", msg);
      return;
    }

    if (editingPriceBracket.maxUsers !== null && editingPriceBracket.maxUsers <= editingPriceBracket.minUsers) {
      const msg = lang === "ar" ? "خطأ في التحقق: يجب أن يكون الحد الأقصى للمقاعد أكبر من الحد الأدنى." : "Validation Failed: maxUsers must be greater than minUsers.";
      setPricingValidationError(msg);
      toast.error(lang === "ar" ? "خطأ في الفئة السعرية" : "Pricing Validation Error", msg);
      return;
    }

    setPriceBrackets((prev) =>
      prev.map((p) => (p.id === editingPriceBracket.id ? editingPriceBracket : p))
    );
    toast.success(
      lang === "ar" ? "تم تعديل الفئة السعرية" : "Price Bracket Updated",
      lang === "ar" ? `تم تحديث بيانات الفئة السعرية بنجاح` : `Price bracket updated successfully`
    );
    setEditingPriceBracket(null);
  };

  // Save Tab Changes (Module Preview, Grants, Pricing)
  const handleSaveTabChanges = async (tabName: string) => {
    const key = tabName.toLowerCase();
    setPricingValidationError(null);
    setIsSubmitting(true);

    try {
      if ((key.includes("preview") || key === "preview") && moduleData) {
        await axiosClient.patch(`/api/admin/core/v1/modules/${resolvedModuleId}`, {
          name: moduleData.name,
          description: moduleData.description,
          isActive: moduleData.isActive,
        }, {
          headers: { "x-idempotency-key": generateUUIDv7() }
        });
      }

      if (key.includes("grant") || key.includes("grants")) {
        for (const tier of tiers) {
          const tierGrants = grants.filter(g => g.tierId === tier.id && g.isEnabled);
          const payload = {
            features: tierGrants.map(g => {
               // Try to parse config, otherwise send nothing
               let config = undefined;
               try {
                 if (g.value && g.value !== "true" && g.value !== "false") {
                    config = JSON.parse(g.value);
                 }
               } catch(e) {}
               return { featureId: g.featureId, config };
            })
          };
          await axiosClient.patch(`/api/admin/core/v1/tiers/${tier.id}/features`, payload, {
            headers: { "x-idempotency-key": generateUUIDv7() }
          });
        }
      }

      if (key.includes("price") || key.includes("pricing")) {
        const currentTierBrackets = priceBrackets.filter(
          (p) => p.tierId === pricingTierFilter && p.billingCycle === pricingCycleFilter
        );

        if (currentTierBrackets.length > 0) {
          const sorted = [...currentTierBrackets].sort((a, b) => a.minUsers - b.minUsers);
          if (sorted[0].minUsers !== 1) {
             const msg = "Validation Error: The first price bracket must start at seat 1.";
             setPricingValidationError(msg);
             toast.error(lang === "ar" ? "خطأ تسعير" : "Pricing Error", msg);
             setIsSubmitting(false);
             return;
          }
          const lastBracket = sorted[sorted.length - 1];
          if (lastBracket.maxUsers !== null) {
             const msg = "Validation Error: The final price bracket must be open-ended.";
             setPricingValidationError(msg);
             toast.error(lang === "ar" ? "خطأ تسعير" : "Pricing Error", msg);
             setIsSubmitting(false);
             return;
          }

          const payload = {
            billingCycle: pricingCycleFilter,
            brackets: sorted.map(b => ({
              minUsers: b.minUsers,
              maxUsers: b.maxUsers,
              unitPrice: b.unitPriceUsd
            }))
          };

          await axiosClient.patch(`/api/admin/core/v1/tiers/${pricingTierFilter}/price-tiers`, payload, {
            headers: { "x-idempotency-key": generateUUIDv7() }
          });
        }
      }

      setSaveTabMessage(tabName);
      setIsSaved(true);
      toast.success(
        lang === "ar" ? "تم حفظ التعديلات" : "Saved Successfully",
        lang === "ar" ? `تم حفظ تعديلات (${tabName}) بنجاح` : `Changes for (${tabName}) saved successfully`
      );
      setTimeout(() => setIsSaved(false), 3000);
      
      // Refetch
      if (key.includes("grant") || key.includes("grants")) await fetchGrants(tiers);
      if (key.includes("price") || key.includes("pricing")) await fetchPricing(tiers);
      if (key.includes("preview") || key === "preview") await fetchModule(resolvedModuleId);

    } catch (err: any) {
      toast.error(
        lang === "ar" ? "فشل حفظ التعديلات" : "Save Failed",
        err.response?.data?.message || err.message
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    t,
    moduleData,
    setModuleData,
    activeTab,
    setActiveTab,
    tiers,
    features,
    grants,
    priceBrackets: filteredPriceBrackets,
    allPriceBrackets: priceBrackets,
    pricingTierFilter,
    setPricingTierFilter,
    pricingCycleFilter,
    setPricingCycleFilter,
    pricingValidationError,
    isLoading,
    error,
    isSubmitting,
    isSaved,
    saveTabMessage,

    // Tier Modal States & Functions
    isAddTierOpen,
    setIsAddTierOpen,
    editingTier,
    setEditingTier,
    newTierKey,
    setNewTierKey,
    newTierName,
    setNewTierName,
    newTierColor,
    setNewTierColor,
    newTierIsActive,
    setNewTierIsActive,

    // Feature Modal States & Import/Export Functions
    isAddFeatureOpen,
    setIsAddFeatureOpen,
    isImportFeaturesOpen,
    setIsImportFeaturesOpen,
    importJsonText,
    setImportJsonText,
    editingFeature,
    setEditingFeature,
    newFeatureKey,
    setNewFeatureKey,
    newFeatureName,
    setNewFeatureName,
    newFeatureType,
    setNewFeatureType,
    newFeatureDefault,
    setNewFeatureDefault,
    newFeatureDesc,
    setNewFeatureDesc,
    handleImportFeatures,
    handleExportFeatures,

    // Price Bracket States
    isAddPriceBracketOpen,
    setIsAddPriceBracketOpen,
    editingPriceBracket,
    setEditingPriceBracket,
    newBracketTierId,
    setNewBracketTierId,
    newBracketMinUsers,
    setNewBracketMinUsers,
    newBracketMaxUsers,
    setNewBracketMaxUsers,
    newBracketIsInfinity,
    setNewBracketIsInfinity,
    newBracketUnitPrice,
    setNewBracketUnitPrice,
    newBracketCycle,
    setNewBracketCycle,

    // Audit Log States
    auditLogs,
    auditFilter,
    setAuditFilter,
    auditSearch,
    setAuditSearch,

    // Handlers
    toggleGrant,
    handleCreateTier,
    handleUpdateTier,
    handleDeleteTier,
    handleCreateFeature,
    handleUpdateFeature,
    handleDeleteFeature,
    openAddPriceBracketModal,
    handleCreatePriceBracket,
    handleUpdatePriceBracket,
    handleDeletePriceBracket,
    handleSaveTabChanges,
    onBack: () => router.push("/modules"),
  };
}
