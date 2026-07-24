"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";

export type ModuleTabKey = "preview" | "tiers" | "features" | "grants" | "price";

export interface TierRecord {
  id: string;
  tierKey: string;
  tierName: string;
  color: string;
  rank: number;
  isActive: boolean;
}

export interface FeatureRecord {
  id: string;
  featureKey: string;
  featureName: string;
  valueType: "BOOLEAN" | "NUMERIC_LIMIT" | "TEXT_SET";
  defaultValue: string;
  description: string;
  isActive: boolean;
}

export interface TierFeatureGrant {
  tierId: string;
  featureId: string;
  isEnabled: boolean;
  value: string;
}

export interface PriceBracket {
  id: string;
  tierId: string;
  billingCycle: "MONTHLY" | "YEARLY";
  minUsers: number;
  maxUsers: number | null; // null = open-ended (∞) Infinity
  unitPriceUsd: string;
}

export function useModuleDetail(id: string) {
  const router = useRouter();
  const { t, lang } = useI18n();

  const [activeTab, setActiveTab] = useState<ModuleTabKey>("preview");
  const [isSaved, setIsSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveTabMessage, setSaveTabMessage] = useState("");
  const [pricingValidationError, setPricingValidationError] = useState<string | null>(null);

  // Modals state
  const [isAddTierOpen, setIsAddTierOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<TierRecord | null>(null);

  const [isAddFeatureOpen, setIsAddFeatureOpen] = useState(false);
  const [isImportFeaturesOpen, setIsImportFeaturesOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const [editingFeature, setEditingFeature] = useState<FeatureRecord | null>(null);

  const [isAddPriceBracketOpen, setIsAddPriceBracketOpen] = useState(false);

  // Add Tier Form
  const [newTierKey, setNewTierKey] = useState("");
  const [newTierName, setNewTierName] = useState("");
  const [newTierColor, setNewTierColor] = useState("#0b6ff4");
  const [newTierIsActive, setNewTierIsActive] = useState(true);

  // Add Feature Form
  const [newFeatureKey, setNewFeatureKey] = useState(`${id}.`);
  const [newFeatureName, setNewFeatureName] = useState("");
  const [newFeatureType, setNewFeatureType] = useState<"BOOLEAN" | "NUMERIC_LIMIT" | "TEXT_SET">("BOOLEAN");
  const [newFeatureDefault, setNewFeatureDefault] = useState("true");
  const [newFeatureDesc, setNewFeatureDesc] = useState("");

  // Add Price Bracket Form
  const [newBracketTierId, setNewBracketTierId] = useState("t-1");
  const [newBracketMinUsers, setNewBracketMinUsers] = useState(1);
  const [newBracketMaxUsers, setNewBracketMaxUsers] = useState<number | null>(10);
  const [newBracketIsInfinity, setNewBracketIsInfinity] = useState(false);
  const [newBracketUnitPrice, setNewBracketUnitPrice] = useState("15.00");
  const [newBracketCycle, setNewBracketCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");

  // Section 5 Pricing Filters (Dual Filters: 1: Cycle MONTHLY/YEARLY, 2: Tier)
  const [pricingTierFilter, setPricingTierFilter] = useState<string>("t-1");
  const [pricingCycleFilter, setPricingCycleFilter] = useState<string>("MONTHLY");

  // Section 1: Preview Module Data
  const [moduleData, setModuleData] = useState({
    id: `mod-${id}`,
    moduleKey: id,
    moduleName:
      id === "crm"
        ? "إدارة علاقات العملاء (CRM Suite)"
        : id === "trade"
        ? "محرك التجارة والاشتراكات (Trade Engine)"
        : id === "worker"
        ? "محرك المهام والتحليلات (Worker & Analytics)"
        : "النواة الأساسية (Core Foundation)",
    description:
      "مكّون منصي متكامل يوفر البنية الأساسية وإدارة الأذونات والتكامل البرمجي العالي الكفاءة للمستأجرين.",
    status: "ACTIVE" as "ACTIVE" | "BETA" | "DEPRECATED",
    category: "FOUNDATION",
  });

  // Section 2: Tiers
  const [tiers, setTiers] = useState<TierRecord[]>([
    {
      id: "t-1",
      tierKey: "starter",
      tierName: "الحزمة الأساسية (Starter)",
      color: "#10b981",
      rank: 1,
      isActive: true,
    },
    {
      id: "t-2",
      tierKey: "business",
      tierName: "حزمة الأعمال (Business)",
      color: "#0b6ff4",
      rank: 2,
      isActive: true,
    },
    {
      id: "t-3",
      tierKey: "pro",
      tierName: "الحزمة المتقدمة (Pro)",
      color: "#8b5cf6",
      rank: 3,
      isActive: true,
    },
    {
      id: "t-4",
      tierKey: "enterprise",
      tierName: "حزمة المؤسسات (Enterprise)",
      color: "#f59e0b",
      rank: 4,
      isActive: true,
    },
  ]);

  // Section 3: Features Catalogue
  const [features, setFeatures] = useState<FeatureRecord[]>([
    {
      id: "f-1",
      featureKey: `${id}.leads.export`,
      featureName: "تصدير بيانات العملاء (CSV/Excel)",
      valueType: "BOOLEAN",
      defaultValue: "true",
      description: "السماح بتصدير جداول البيانات والتقرير",
      isActive: true,
    },
    {
      id: "f-2",
      featureKey: `${id}.max_custom_fields`,
      featureName: "الحد الأقصى للحقول المخصصة",
      valueType: "NUMERIC_LIMIT",
      defaultValue: "50",
      description: "عدد الحقول الإضافية المسموحة للنماذج",
      isActive: true,
    },
    {
      id: "f-3",
      featureKey: `${id}.api_rate_limit`,
      featureName: "معدل استدعاءات الـ API / دقيقة",
      valueType: "NUMERIC_LIMIT",
      defaultValue: "1000",
      description: "حد حماية السيرفر والاستدعاءات البرمجية",
      isActive: true,
    },
  ]);

  // Section 4: Tier -> Feature Grants Matrix
  const [grants, setGrants] = useState<TierFeatureGrant[]>([
    { tierId: "t-1", featureId: "f-1", isEnabled: true, value: "true" },
    { tierId: "t-1", featureId: "f-2", isEnabled: true, value: "10" },
    { tierId: "t-2", featureId: "f-1", isEnabled: true, value: "true" },
    { tierId: "t-2", featureId: "f-2", isEnabled: true, value: "50" },
    { tierId: "t-3", featureId: "f-1", isEnabled: true, value: "true" },
    { tierId: "t-3", featureId: "f-2", isEnabled: true, value: "200" },
  ]);

  // Section 5: Price Brackets (Valid contiguity & start at 1, end at ∞ Infinity)
  const [priceBrackets, setPriceBrackets] = useState<PriceBracket[]>([
    // Tier 1 (Starter) Monthly
    { id: "p-101", tierId: "t-1", billingCycle: "MONTHLY", minUsers: 1, maxUsers: 10, unitPriceUsd: "10.00" },
    { id: "p-102", tierId: "t-1", billingCycle: "MONTHLY", minUsers: 11, maxUsers: null, unitPriceUsd: "8.00" },

    // Tier 1 (Starter) Yearly
    { id: "p-103", tierId: "t-1", billingCycle: "YEARLY", minUsers: 1, maxUsers: null, unitPriceUsd: "8.00" },

    // Tier 2 (Business) Monthly
    { id: "p-201", tierId: "t-2", billingCycle: "MONTHLY", minUsers: 1, maxUsers: 10, unitPriceUsd: "15.00" },
    { id: "p-202", tierId: "t-2", billingCycle: "MONTHLY", minUsers: 11, maxUsers: 50, unitPriceUsd: "12.00" },
    { id: "p-203", tierId: "t-2", billingCycle: "MONTHLY", minUsers: 51, maxUsers: null, unitPriceUsd: "9.00" },

    // Tier 2 (Business) Yearly
    { id: "p-204", tierId: "t-2", billingCycle: "YEARLY", minUsers: 1, maxUsers: null, unitPriceUsd: "10.00" },
  ]);

  // Filter Price Brackets by BOTH Tier and Billing Cycle
  const filteredPriceBrackets = priceBrackets.filter((p) => {
    const matchesTier = pricingTierFilter === "ALL" || p.tierId === pricingTierFilter;
    const matchesCycle = pricingCycleFilter === "ALL" || p.billingCycle === pricingCycleFilter;
    return matchesTier && matchesCycle;
  });

  // Tier Reorder Drag & Drop Up/Down
  const moveTierUp = (index: number) => {
    if (index <= 0) return;
    setTiers((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      return next.map((item, idx) => ({ ...item, rank: idx + 1 }));
    });
  };

  const moveTierDown = (index: number) => {
    if (index >= tiers.length - 1) return;
    setTiers((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      return next.map((item, idx) => ({ ...item, rank: idx + 1 }));
    });
  };

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
  const handleCreateTier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTierKey || !newTierName) return;

    const newRecord: TierRecord = {
      id: `t-${Date.now()}`,
      tierKey: newTierKey.toLowerCase().trim(),
      tierName: newTierName.trim(),
      color: newTierColor,
      rank: tiers.length + 1,
      isActive: newTierIsActive,
    };

    setTiers((prev) => [...prev, newRecord]);
    setNewTierKey("");
    setNewTierName("");
    setIsAddTierOpen(false);
  };

  const handleUpdateTier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTier) return;

    setTiers((prev) =>
      prev.map((t) => (t.id === editingTier.id ? editingTier : t))
    );
    setEditingTier(null);
  };

  const handleDeleteTier = (tierId: string) => {
    setTiers((prev) => prev.filter((t) => t.id !== tierId));
    setEditingTier(null);
  };

  // Feature CRUD & Bulk Import/Export
  const handleCreateFeature = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeatureKey || !newFeatureName) return;

    const newRecord: FeatureRecord = {
      id: `f-${Date.now()}`,
      featureKey: newFeatureKey.toLowerCase().trim(),
      featureName: newFeatureName.trim(),
      valueType: newFeatureType,
      defaultValue: newFeatureDefault,
      description: newFeatureDesc,
      isActive: true,
    };

    setFeatures((prev) => [...prev, newRecord]);
    setNewFeatureKey(`${id}.`);
    setNewFeatureName("");
    setNewFeatureDesc("");
    setIsAddFeatureOpen(false);
  };

  const handleImportFeatures = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(importJsonText);
      if (Array.isArray(parsed)) {
        const importedList: FeatureRecord[] = parsed.map((item, idx) => ({
          id: `f-imp-${Date.now()}-${idx}`,
          featureKey: item.key || item.featureKey || `${id}.imported_${idx}`,
          featureName: item.name || item.featureName || `M feature ${idx + 1}`,
          valueType: item.valueType || "BOOLEAN",
          defaultValue: String(item.defaultValue ?? "true"),
          description: item.description || "استيراد كتل برمجية",
          isActive: true,
        }));
        setFeatures((prev) => [...prev, ...importedList]);
        setImportJsonText("");
        setIsImportFeaturesOpen(false);
      }
    } catch {
      alert("البيانات المدخلة ليست صيغة JSON صالحة.");
    }
  };

  const handleExportFeatures = () => {
    const exportData = JSON.stringify(features, null, 2);
    const blob = new Blob([exportData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${moduleData.moduleKey}_features_export.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpdateFeature = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFeature) return;

    setFeatures((prev) =>
      prev.map((f) => (f.id === editingFeature.id ? editingFeature : f))
    );
    setEditingFeature(null);
  };

  const handleDeleteFeature = (featureId: string) => {
    setFeatures((prev) => prev.filter((f) => f.id !== featureId));
    setEditingFeature(null);
  };

  // Price Bracket Validation & CRUD (First min must be 1, last max must be Infinity)
  const handleCreatePriceBracket = (e: React.FormEvent) => {
    e.preventDefault();
    setPricingValidationError(null);

    const minUsers = Number(newBracketMinUsers);
    const maxUsers = newBracketIsInfinity ? null : newBracketMaxUsers !== null ? Number(newBracketMaxUsers) : null;

    if (minUsers < 1) {
      setPricingValidationError(
        lang === "ar"
          ? "فشل التحقق: يجب أن يبدأ الحد الأدنى لفئة المقاعد الأولى من 1 على الأقل (minUsers >= 1)."
          : "Validation Failed: First minUsers must start at 1 (minUsers >= 1)."
      );
      return;
    }

    if (maxUsers !== null && maxUsers <= minUsers) {
      setPricingValidationError(
        lang === "ar"
          ? "فشل التحقق: يجب أن يكون الحد الأقصى للمقاعد أكبر من الحد الأدنى."
          : "Validation Failed: maxUsers must be greater than minUsers."
      );
      return;
    }

    const newRecord: PriceBracket = {
      id: `p-${Date.now()}`,
      tierId: newBracketTierId,
      billingCycle: newBracketCycle,
      minUsers,
      maxUsers,
      unitPriceUsd: parseFloat(newBracketUnitPrice).toFixed(2),
    };

    setPriceBrackets((prev) => [...prev, newRecord]);
    setIsAddPriceBracketOpen(false);
  };

  const handleDeletePriceBracket = (bracketId: string) => {
    setPriceBrackets((prev) => prev.filter((p) => p.id !== bracketId));
  };

  // Save changes & Validate Price Brackets Contiguity Rule (First min = 1, Last max = ∞)
  const handleSaveTabChanges = async (tabName: string) => {
    setPricingValidationError(null);

    if (tabName.includes("Price")) {
      // Validate NestJS Price Bracket Rules: First bracket min = 1, Last bracket max = null (Infinity)
      const currentTierBrackets = priceBrackets.filter(
        (p) => p.tierId === pricingTierFilter && p.billingCycle === (pricingCycleFilter === "ALL" ? "MONTHLY" : pricingCycleFilter)
      );

      if (currentTierBrackets.length > 0) {
        const sorted = [...currentTierBrackets].sort((a, b) => a.minUsers - b.minUsers);
        if (sorted[0].minUsers !== 1) {
          setPricingValidationError(
            lang === "ar"
              ? "خطأ في التحقق من الفئات السعرية: الفئة الأولى يجب أن تبدأ من المقعد رقم 1 (minUsers must start at 1)."
              : "Validation Error: The first price bracket must start at seat 1 (minUsers = 1)."
          );
          return;
        }

        const lastBracket = sorted[sorted.length - 1];
        if (lastBracket.maxUsers !== null) {
          setPricingValidationError(
            lang === "ar"
              ? "خطأ في التحقق من الفئات السعرية: الفئة الأخيرة يجب أن تكون مفتوحة السقف حتى المالانهاية (Last bracket maxUsers must be Infinity ∞ / null)."
              : "Validation Error: The final price bracket must be open-ended (maxUsers = Infinity ∞ / null)."
          );
          return;
        }
      }
    }

    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setIsSubmitting(false);
    setSaveTabMessage(tabName);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
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
    moveTierUp,
    moveTierDown,

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

    // Handlers
    toggleGrant,
    handleCreateTier,
    handleUpdateTier,
    handleDeleteTier,
    handleCreateFeature,
    handleUpdateFeature,
    handleDeleteFeature,
    handleCreatePriceBracket,
    handleDeletePriceBracket,
    handleSaveTabChanges,
    onBack: () => router.push("/modules"),
  };
}
