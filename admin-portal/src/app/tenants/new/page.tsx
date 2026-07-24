"use client";

import { Navbar } from "@/components/layout/Navbar";
import { 
  Building2, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  User, 
  Server, 
  Package, 
  ShieldCheck, 
  Globe, 
  MapPin 
} from "lucide-react";
import { useRegisterTenant } from "./hooks/useRegisterTenant";
import { useI18n } from "@/i18n/I18nContext";

export default function RegisterTenantWizardPage() {
  const {
    t,
    currentStep,
    setCurrentStep,
    formData,
    setFormData,
    isValidatingIdentity,
    identityResult,
    isPreviewingPlan,
    provisioningDag,
    isSubmitting,
    handleValidateIdentity,
    handlePreviewPlan,
    handleSubmit,
    nextStep,
    prevStep,
    onCancel,
  } = useRegisterTenant();
  const { lang } = useI18n();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 p-4 sm:p-6 max-w-5xl w-full mx-auto space-y-6">
        {/* Header Title with Back Button */}
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-slate-600 dark:text-slate-300"
            >
              {lang === "ar" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            </button>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span>{t.tenants.wizardTitle}</span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t.tenants.wizardSubtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Wizard Step Navigation Bar */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="grid grid-cols-5 gap-1 text-center text-xs font-bold">
            <button
              onClick={() => setCurrentStep(1)}
              className={`py-2 px-1 rounded-xl transition-all ${
                currentStep === 1
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : currentStep > 1
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                  : "text-slate-400"
              }`}
            >
              <span>{t.tenants.step1}</span>
            </button>

            <button
              onClick={() => setCurrentStep(2)}
              className={`py-2 px-1 rounded-xl transition-all ${
                currentStep === 2
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : currentStep > 2
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                  : "text-slate-400"
              }`}
            >
              <span>{t.tenants.step2}</span>
            </button>

            <button
              onClick={() => setCurrentStep(3)}
              className={`py-2 px-1 rounded-xl transition-all ${
                currentStep === 3
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : currentStep > 3
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                  : "text-slate-400"
              }`}
            >
              <span>{t.tenants.step3}</span>
            </button>

            <button
              onClick={() => setCurrentStep(4)}
              className={`py-2 px-1 rounded-xl transition-all ${
                currentStep === 4
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : currentStep > 4
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                  : "text-slate-400"
              }`}
            >
              <span>{t.tenants.step4}</span>
            </button>

            <button
              onClick={() => setCurrentStep(5)}
              className={`py-2 px-1 rounded-xl transition-all ${
                currentStep === 5
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "text-slate-400"
              }`}
            >
              <span>{t.tenants.step5}</span>
            </button>
          </div>
        </div>

        {/* Wizard Form Sections */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Identity & Geocoding & Address */}
          {currentStep === 1 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>{lang === "ar" ? "الخطوة 1: هويّة المستأجر والدومين الأساسي (Tenant Identity & Address)" : "Step 1: Tenant Identity & FQDN"}</span>
              </h3>

              {identityResult && (
                <div
                  className={`p-3 text-xs font-semibold rounded-xl border flex items-center gap-2 ${
                    identityResult.valid
                      ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                      : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800"
                  }`}
                >
                  {identityResult.valid ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{identityResult.message}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {lang === "ar" ? "رمز ورابط المستأجر (name) *" : "Tenant Name Code (name) *"}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                      placeholder="e.g. acme-retail"
                      className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                      required
                    />
                    <button
                      type="button"
                      onClick={handleValidateIdentity}
                      disabled={isValidatingIdentity}
                      className="px-3 py-2 text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                      {isValidatingIdentity ? <Loader2 className="w-4 h-4 animate-spin" /> : lang === "ar" ? "فحص التوفر" : "Check Availability"}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {lang === "ar" ? `النطاق المولد: ${formData.name ? `${formData.name}.mutakamel.ai` : "name.mutakamel.ai"}` : `Derived FQDN: ${formData.name ? `${formData.name}.mutakamel.ai` : "name.mutakamel.ai"}`}
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.tenants.detailsTab.companyName} *</label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder="e.g. Acme Retail LLC"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.tenants.detailsTab.industry}</label>
                  <input
                    type="text"
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{lang === "ar" ? "الدولة (countryIsoCode)" : "Country ISO Code"}</label>
                  <select
                    value={formData.countryIsoCode}
                    onChange={(e) => setFormData({ ...formData, countryIsoCode: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  >
                    <option value="EG">{lang === "ar" ? "مصر (EG)" : "Egypt (EG)"}</option>
                    <option value="SA">{lang === "ar" ? "المملكة العربية السعودية (SA)" : "Saudi Arabia (SA)"}</option>
                    <option value="AE">{lang === "ar" ? "الإمارات العربية المتحدة (AE)" : "United Arab Emirates (AE)"}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.tenants.detailsTab.timezone}</label>
                  <input
                    type="text"
                    value={formData.timezone}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Address & Tax Information */}
              <div className="pt-3 space-y-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  <span>{t.tenants.detailsTab.addressSection}</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={formData.street}
                    onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                    placeholder={t.tenants.detailsTab.street1}
                    className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder={t.tenants.detailsTab.city}
                    className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                  <input
                    type="text"
                    value={formData.taxNumber}
                    onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                    placeholder={t.tenants.detailsTab.taxNumber}
                    className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Owner Contact Details */}
          {currentStep === 2 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{lang === "ar" ? "الخطوة 2: اعتمادات مالك الشركة والمدير الأول (Owner Contact & Initial Admin)" : "Step 2: Owner Contact & Admin User"}</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{lang === "ar" ? "البريد الإلكتروني للمالك *" : "Owner Email *"}</label>
                  <input
                    type="email"
                    value={formData.ownerEmail}
                    onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                    placeholder="owner@company.com"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{lang === "ar" ? "الاسم الأول *" : "First Name *"}</label>
                  <input
                    type="text"
                    value={formData.ownerFirstName}
                    onChange={(e) => setFormData({ ...formData, ownerFirstName: e.target.value })}
                    placeholder="Mona"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{lang === "ar" ? "الاسم الأخير *" : "Last Name *"}</label>
                  <input
                    type="text"
                    value={formData.ownerLastName}
                    onChange={(e) => setFormData({ ...formData, ownerLastName: e.target.value })}
                    placeholder="Ali"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{lang === "ar" ? "المسمى الوظيفي" : "Job Title"}</label>
                  <input
                    type="text"
                    value={formData.ownerJobTitle}
                    onChange={(e) => setFormData({ ...formData, ownerJobTitle: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.tenants.detailsTab.phone}</label>
                  <input
                    type="text"
                    value={formData.ownerPhone}
                    onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-3">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.sendInvitation}
                    onChange={(e) => setFormData({ ...formData, sendInvitation: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span>{lang === "ar" ? "إرسال بريد دعوة رسمي للانضمام للمالك تلقائياً (sendInvitation)" : "Automatically send email invitation to owner (sendInvitation)"}</span>
                </label>
              </div>
            </div>
          )}

          {/* Step 3: Database Host Placement */}
          {currentStep === 3 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <Server className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>{lang === "ar" ? "الخطوة 3: تحديد سيرفر قاعدة البيانات (Database Host Placement)" : "Step 3: Database Host Placement"}</span>
              </h3>

              <div className="space-y-3">
                <div className="p-4 bg-blue-50/60 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-400">{lang === "ar" ? "التسكين الذكي التلقائي (Auto Optimal Target Placement)" : "Auto Optimal Placement"}</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">{lang === "ar" ? "يقوم الـ Control Plane بااختيار أفضل سيرفر نشط حسب القرب الجغرافي والسعة المتاحة." : "Control Plane selects the optimal database host based on region and capacity."}</p>
                  </div>
                  <input
                    type="radio"
                    name="placement"
                    checked={formData.placementMode === "AUTO"}
                    onChange={() => setFormData({ ...formData, placementMode: "AUTO", databaseServerId: "" })}
                    className="w-4 h-4 text-blue-600"
                  />
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{lang === "ar" ? "التحديد اليدوي لسيرفر معين" : "Manual Host Selection"}</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">{lang === "ar" ? "اختر سيرفر محدد من قائمة السيرفرات النشطة المعرفة في المنصة." : "Select a specific active database server host from the cluster list."}</p>
                    </div>
                    <input
                      type="radio"
                      name="placement"
                      checked={formData.placementMode === "MANUAL"}
                      onChange={() => setFormData({ ...formData, placementMode: "MANUAL" })}
                      className="w-4 h-4 text-blue-600"
                    />
                  </div>

                  {formData.placementMode === "MANUAL" && (
                    <select
                      value={formData.databaseServerId}
                      onChange={(e) => setFormData({ ...formData, databaseServerId: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                    >
                      <option value="">{lang === "ar" ? "-- اختر السيرفر المطلوب --" : "-- Select Database Host --"}</option>
                      <option value="srv-eg-01">DB-PRIMARY-EG-01 (Egypt - 45/50 tenants)</option>
                      <option value="srv-eg-02">DB-PRIMARY-EG-02 (Egypt - 12/50 tenants)</option>
                      <option value="srv-sa-01">DB-PRIMARY-SA-01 (KSA - 8/50 tenants)</option>
                    </select>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Modules & Provisioning Preview */}
          {currentStep === 4 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <Package className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>{lang === "ar" ? "الخطوة 4: موديولات التطبيق ومعاينة الـ Provisioning DAG" : "Step 4: Application Modules & Subscription"}</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{lang === "ar" ? "دورة الفوترة (billingCycle)" : "Billing Cycle"}</label>
                  <select
                    value={formData.billingCycle}
                    onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value as "MONTHLY" | "YEARLY" })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    <option value="MONTHLY">{lang === "ar" ? "شهري (Monthly)" : "Monthly"}</option>
                    <option value="YEARLY">{lang === "ar" ? "سنوي (Yearly - خصم 20%)" : "Yearly (20% Discount)"}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{lang === "ar" ? "عدد المقاعد (Allowed Users)" : "Allowed User Seats"}</label>
                  <input
                    type="number"
                    value={formData.allowedUsers}
                    onChange={(e) => setFormData({ ...formData, allowedUsers: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              {/* Provisioning DAG Preview Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handlePreviewPlan}
                  disabled={isPreviewingPlan}
                  className="px-4 py-2 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-xl hover:bg-amber-100 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {isPreviewingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                  <span>{lang === "ar" ? "معاينة خطة التجهيز (Preview Provisioning DAG)" : "Preview Provisioning DAG Plan"}</span>
                </button>

                {provisioningDag && (
                  <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs font-mono">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{lang === "ar" ? `✓ تم التحقق من مكونات الـ DAG: (${provisioningDag.stepsCount} خطوات متسلسلة)` : `✓ Provisioning DAG Plan Validated: (${provisioningDag.stepsCount} steps)`}</span>
                    <ul className="space-y-1 text-slate-600 dark:text-slate-300 text-[11px] list-disc list-inside">
                      {provisioningDag.components.map((comp, idx) => (
                        <li key={idx}>{comp}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Final Review & Submit */}
          {currentStep === 5 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{lang === "ar" ? "الخطوة 5: مراجعة البيانات وإرسال أمر التجهيز التلقائي" : "Step 5: Review & Confirm Provisioning Order"}</span>
              </h3>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">{t.tenants.tenantName}:</span>
                  <span className="font-bold font-mono">{formData.name} ({formData.companyName})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t.tenants.primaryFqdn}:</span>
                  <span className="font-bold font-mono text-blue-600">{formData.name}.mutakamel.ai</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{lang === "ar" ? "المالك الرئيسي:" : "Primary Owner:"}</span>
                  <span className="font-bold">{formData.ownerFirstName} {formData.ownerLastName} ({formData.ownerEmail})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t.tenants.hostingServer}:</span>
                  <span className="font-bold font-mono">{formData.placementMode === "AUTO" ? (lang === "ar" ? "تسكين ذكي تلقائي" : "Auto Optimal Placement") : formData.databaseServerId}</span>
                </div>
              </div>
            </div>
          )}

          {/* Wizard Controls Footer */}
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <button
              type="button"
              onClick={prevStep}
              disabled={currentStep === 1}
              className="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
            >
              {lang === "ar" ? "السابق" : "Previous"}
            </button>

            {currentStep < 5 ? (
              <button
                type="button"
                onClick={nextStep}
                className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-600/20 transition-colors cursor-pointer"
              >
                {lang === "ar" ? "التالي" : "Next Step"}
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-lg shadow-emerald-600/20 transition-colors cursor-pointer inline-flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{lang === "ar" ? "جاري التجهيز والإنشاء..." : "Provisioning Environment..."}</span>
                  </>
                ) : (
                  <span>{lang === "ar" ? "تأكيد وبدء التجهيز التلقائي" : "Confirm & Start Provisioning"}</span>
                )}
              </button>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
