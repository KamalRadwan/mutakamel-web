"use client";

import { use, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { 
  Building2, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  Globe, 
  Users, 
  Save, 
  Trash2, 
  Server, 
  Loader2, 
  Plus, 
  Minus, 
  Activity, 
  CreditCard, 
  Wallet, 
  Lock, 
  Mail, 
  Key, 
  Phone, 
  ShieldAlert, 
  ShieldCheck, 
  Network, 
  MapPin, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  LockIcon, 
  Filter 
} from "lucide-react";
import { useTenantDetail } from "./hooks/useTenantDetail";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { useI18n } from "@/i18n/I18nContext";

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const {
    t,
    tenant,
    setTenant,
    activeTab,
    setActiveTab,
    subscription,
    wallet,
    ledger,
    ledgerDirectionFilter,
    setLedgerDirectionFilter,
    ledgerReasonFilter,
    setLedgerReasonFilter,
    fqdns,
    usersSummary,
    tenantUsers,
    userStatusFilter,
    setUserStatusFilter,
    userRoleFilter,
    setUserRoleFilter,
    showDeletedUsers,
    setShowDeletedUsers,
    operations,
    isSubmitting,
    isSaved,
    setIsSaved,
    isInviteUserOpen,
    setIsInviteUserOpen,
    isEditUserOpen,
    setIsEditUserOpen,
    isResetPasswordOpen,
    setIsResetPasswordOpen,
    isChangePasswordOpen,
    setIsChangePasswordOpen,
    isWebphoneConfigOpen,
    setIsWebphoneConfigOpen,
    isAddCreditOpen,
    setIsAddCreditOpen,
    isAddDebitOpen,
    setIsAddDebitOpen,
    isAddFqdnOpen,
    setIsAddFqdnOpen,
    isRoleAssignmentOpen,
    setIsRoleAssignmentOpen,
    isOperationDagOpen,
    setIsOperationDagOpen,
    selectedUserId,
    setSelectedUserId,
    selectedOperationId,
    setSelectedOperationId,
    newFqdnInput,
    setNewFqdnInput,
    destroySubscriptionsToggle,
    setDestroySubscriptionsToggle,
    adjAmount,
    setAdjAmount,
    adjCurrency,
    setAdjCurrency,
    adjNote,
    setAdjNote,
    handleUpdateSubmit,
    handleCancelProvisioning,
    handleActivate,
    handleSuspend,
    handleDelete,
    handleSuspendUser,
    handleActivateUser,
    handleResendInvite,
    handleRestoreUser,
    handleDeleteUser,
    mockBranches,
    mockDepartments,
    mockTeams,
    handleDestroyConfirm,
    handleAddFqdnSubmit,
    handleSetPrimaryFqdn,
    handleRemoveFqdn,
    handleCancelSubscription,
    submitCreditAdjustment,
    submitDebitAdjustment,
    onBack,
  } = useTenantDetail(id);
  const { lang } = useI18n();

  // Active Destructive Action Modal State
  const [destructiveModalAction, setDestructiveModalAction] = useState<"suspend" | "delete" | "destroy" | null>(null);

  const selectedOpRecord = operations.find((o) => o.id === selectedOperationId);
  const selectedUserRecord = tenantUsers.find((u) => u.id === selectedUserId);

  const confirmDestructiveModal = () => {
    if (!destructiveModalAction) return;
    if (destructiveModalAction === "suspend") {
      handleSuspend();
    } else if (destructiveModalAction === "delete") {
      handleDelete();
    } else if (destructiveModalAction === "destroy") {
      handleDestroyConfirm();
    }
    setDestructiveModalAction(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto space-y-6">
        {/* Header Title with Status & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-slate-600 dark:text-slate-300"
            >
              {lang === "ar" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {tenant.companyName}
                </h1>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-slate-500">
                  {tenant.name}
                </span>
                <StatusBadge status={tenant.status} enumType="tenant" size="md" />
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-blue-500" />
                <span>{tenant.primaryFqdn}</span>
              </p>
            </div>
          </div>

          {/* Mandatory Confirmation Action Control Buttons */}
          <div className="flex items-center gap-2">
            {tenant.status === "PROVISIONING" ? (
              <button
                onClick={handleCancelProvisioning}
                className="px-3.5 py-1.5 text-xs font-bold bg-slate-600 hover:bg-slate-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {lang === "ar" ? "إلغاء التجهيز" : "Cancel Provisioning"}
              </button>
            ) : tenant.status === "SUSPENDED" ? (
              <button
                onClick={handleActivate}
                className="px-3.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {t.tenants.activate}
              </button>
            ) : tenant.status === "ACTIVE" ? (
              <button
                onClick={() => setDestructiveModalAction("suspend")}
                className="px-3.5 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {t.tenants.suspend}
              </button>
            ) : null}

            {tenant.status === "DELETED" ? (
              <button
                onClick={() => setDestructiveModalAction("destroy")}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{t.tenants.destroy}</span>
              </button>
            ) : (
              <button
                onClick={() => setDestructiveModalAction("delete")}
                className="px-3.5 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t.tenants.delete}</span>
              </button>
            )}
          </div>
        </div>

        {/* Saved Toast Notification */}
        {isSaved && (
          <div className="p-3 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>{lang === "ar" ? "تم حفظ تعديلات المستأجر بنجاح!" : "Tenant details updated successfully!"}</span>
          </div>
        )}

        {/* Top Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
            <span className="text-xs text-slate-500 font-semibold">{t.tenants.subscriptionPlan}</span>
            <div className="text-sm font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <CreditCard className="w-4 h-4" />
              <span>{subscription.planName}</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">{subscription.allowedUsers} seats · {subscription.billingCycle}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
            <span className="text-xs text-slate-500 font-semibold">{lang === "ar" ? "رصيد المحفظة الصافي" : "Net Wallet Balance"}</span>
            <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
              ${wallet.balanceUsd.toLocaleString()} USD
            </div>
            <p className="text-[11px] text-slate-400 font-mono">{lang === "ar" ? `متاح: $${wallet.availableBalanceUsd.toLocaleString()}` : `Available: $${wallet.availableBalanceUsd.toLocaleString()}`}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
            <span className="text-xs text-slate-500 font-semibold">{t.tenants.hostingServer}</span>
            <div className="text-sm font-bold font-mono text-purple-600 dark:text-purple-400 flex items-center gap-1">
              <Server className="w-4 h-4" />
              <span>{tenant.databaseServerName}</span>
            </div>
            <p className="text-[11px] text-slate-400">{tenant.countryName}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
            <span className="text-xs text-slate-500 font-semibold">{lang === "ar" ? "إجمالي مستخدمي المستأجر" : "Total Tenant Users"}</span>
            <div className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100 flex items-center gap-1">
              <Users className="w-4 h-4 text-blue-500" />
              <span>{usersSummary.active} / {usersSummary.total} {lang === "ar" ? "نشط" : "active"}</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">{usersSummary.webphoneEnabled} {lang === "ar" ? "مفعلين للهاتف" : "webphone enabled"}</p>
          </div>
        </div>

        {/* Tab Navigation Workspace */}
        <div className="border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 overflow-x-auto pb-px">
            <button
              onClick={() => setActiveTab("details")}
              className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "details"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {t.tenants.tabs.details}
            </button>

            <button
              onClick={() => setActiveTab("subscriptions")}
              className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "subscriptions"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {t.tenants.tabs.subscriptions}
            </button>

            <button
              onClick={() => setActiveTab("wallet")}
              className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "wallet"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {t.tenants.tabs.wallet}
            </button>

            <button
              onClick={() => setActiveTab("fqdns")}
              className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "fqdns"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {t.tenants.tabs.fqdns} ({fqdns.length})
            </button>

            <button
              onClick={() => setActiveTab("users")}
              className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "users"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {t.tenants.tabs.users} ({usersSummary.total})
            </button>

            <button
              onClick={() => setActiveTab("operations")}
              className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "operations"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {t.tenants.tabs.operations} ({operations.length})
            </button>
          </div>
        </div>

        {/* Tab 1: Profile & Metadata */}
        {activeTab === "details" && (
          <form onSubmit={handleUpdateSubmit} className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>{t.tenants.detailsTab.companyName}</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.tenants.detailsTab.companyName}</label>
                  <input
                    type="text"
                    value={tenant.companyName}
                    onChange={(e) => setTenant({ ...tenant, companyName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.tenants.detailsTab.industry}</label>
                  <input
                    type="text"
                    value={tenant.industry}
                    onChange={(e) => setTenant({ ...tenant, industry: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.tenants.detailsTab.timezone}</label>
                  <input
                    type="text"
                    value={tenant.timezone}
                    onChange={(e) => setTenant({ ...tenant, timezone: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.tenants.detailsTab.taxNumber}</label>
                  <input
                    type="text"
                    value={tenant.taxNumber}
                    onChange={(e) => setTenant({ ...tenant, taxNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.tenants.detailsTab.commercialRegistrationNumber}</label>
                  <input
                    type="text"
                    value={tenant.commercialRegistrationNumber}
                    onChange={(e) => setTenant({ ...tenant, commercialRegistrationNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.tenants.detailsTab.phone}</label>
                  <input
                    type="text"
                    value={tenant.phone}
                    onChange={(e) => setTenant({ ...tenant, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Structured Address DTO Section */}
              <div className="pt-3 space-y-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  <span>{t.tenants.detailsTab.addressSection}</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={tenant.address.street1}
                    onChange={(e) => setTenant({ ...tenant, address: { ...tenant.address, street1: e.target.value } })}
                    placeholder={t.tenants.detailsTab.street1}
                    className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                  <input
                    type="text"
                    value={tenant.address.buildingNo}
                    onChange={(e) => setTenant({ ...tenant, address: { ...tenant.address, buildingNo: e.target.value } })}
                    placeholder={t.tenants.detailsTab.buildingNo}
                    className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                  <input
                    type="text"
                    value={tenant.address.district}
                    onChange={(e) => setTenant({ ...tenant, address: { ...tenant.address, district: e.target.value } })}
                    placeholder={t.tenants.detailsTab.district}
                    className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                  <input
                    type="text"
                    value={tenant.address.city}
                    onChange={(e) => setTenant({ ...tenant, address: { ...tenant.address, city: e.target.value } })}
                    placeholder={t.tenants.detailsTab.city}
                    className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                  <input
                    type="text"
                    value={tenant.address.state}
                    onChange={(e) => setTenant({ ...tenant, address: { ...tenant.address, state: e.target.value } })}
                    placeholder={t.tenants.detailsTab.state}
                    className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                  <input
                    type="text"
                    value={tenant.address.postalCode}
                    onChange={(e) => setTenant({ ...tenant, address: { ...tenant.address, postalCode: e.target.value } })}
                    placeholder={t.tenants.detailsTab.postalCode}
                    className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/20 transition-colors cursor-pointer flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t.tenants.detailsTab.saving}</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{t.tenants.detailsTab.saveChanges}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Subscriptions */}
        {activeTab === "subscriptions" && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>{lang === "ar" ? "تفاصيل الاشتراك والباقة الحالية" : "Current Subscription & Plan Details"}</span>
                </h3>
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{lang === "ar" ? "الموديولات المضمنة في الباقة:" : "Included Plan Modules:"}</span>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
                      <th className="pb-2 text-start">{lang === "ar" ? "الموديول" : "Module"}</th>
                      <th className="pb-2 text-start">{lang === "ar" ? "المستوى" : "Tier"}</th>
                      <th className="pb-2 text-start">{lang === "ar" ? "عدد المقاعد" : "Seats"}</th>
                      <th className="pb-2 text-end">{lang === "ar" ? "التكلفة الشهرية" : "Monthly Line Total"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {subscription.items.map((it) => (
                      <tr key={it.id}>
                        <td className="py-2.5 font-bold text-slate-900 dark:text-slate-100">{it.moduleName} ({it.moduleKey})</td>
                        <td className="py-2.5 text-blue-600 dark:text-blue-400 font-bold">{it.tierKey}</td>
                        <td className="py-2.5 text-slate-600 dark:text-slate-400">{it.seats} seats</td>
                        <td className="py-2.5 text-end font-bold text-emerald-600">{it.lineTotal.toLocaleString()} {subscription.currencyCode}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Complete Wallet & Ledger Suite */}
        {activeTab === "wallet" && (
          <div className="space-y-6">
            {/* Wallet KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
                <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{lang === "ar" ? "إجمالي الرصيد الصافي" : "Net Balance"}</span>
                </span>
                <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                  ${wallet.balanceUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
                </div>
                <p className="text-[10px] text-slate-400 font-mono">{lang === "ar" ? "الحساب الرئيسي المحاسبي" : "Main Accounting Wallet"}</p>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
                <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                  <LockIcon className="w-3.5 h-3.5 text-amber-500" />
                  <span>{lang === "ar" ? "الرصيد المحجوز" : "Reserved Hold"}</span>
                </span>
                <div className="text-lg font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                  ${wallet.reservedBalanceUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
                </div>
                <p className="text-[10px] text-slate-400 font-mono">{lang === "ar" ? "ضمان أو فواتير معلقة" : "Pending Hold"}</p>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
                <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                  <span>{lang === "ar" ? "الرصيد المتاح للاستخدام" : "Available Balance"}</span>
                </span>
                <div className="text-lg font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                  ${wallet.availableBalanceUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
                </div>
                <p className="text-[10px] text-slate-400 font-mono">{lang === "ar" ? "جاهز للسحب والخصم" : "Available to Use"}</p>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
                <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{lang === "ar" ? "إجمالي الإيداعات" : "Lifetime Credits"}</span>
                </span>
                <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300 font-mono">
                  ${wallet.lifetimeCreditUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
                </div>
                <p className="text-[10px] text-slate-400 font-mono">{lang === "ar" ? "إجمالي المبالغ المودعة" : "Total Credits"}</p>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
                <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                  <span>{lang === "ar" ? "إجمالي الخصومات" : "Lifetime Debits"}</span>
                </span>
                <div className="text-lg font-extrabold text-rose-600 dark:text-rose-400 font-mono">
                  ${wallet.lifetimeDebitUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
                </div>
                <p className="text-[10px] text-slate-400 font-mono">{lang === "ar" ? "إجمالي المسحوبات" : "Total Debits"}</p>
              </div>
            </div>

            {/* Wallet Controls & Ledger Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-5 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{lang === "ar" ? "سجل المعاملات والقيود المالية المباشرة" : "Financial Ledger Transactions"}</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{lang === "ar" ? `رمز المحفظة: ${wallet.id}` : `Wallet ID: ${wallet.id}`}</p>
                </div>

                {/* Explicit Add Credit & Add Debit Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddCreditOpen(true)}
                    className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{lang === "ar" ? "+ إيداع رصيد (Add Credit)" : "+ Add Credit"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAddDebitOpen(true)}
                    className="px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Minus className="w-4 h-4" />
                    <span>{lang === "ar" ? "- خصم رصيد (Add Debit)" : "- Add Debit"}</span>
                  </button>
                </div>
              </div>

              {/* Ledger Filters */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
                  <Filter className="w-3.5 h-3.5 text-blue-500" />
                  <span>{lang === "ar" ? "فلترة قيود المحفظة:" : "Ledger Filters:"}</span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={ledgerDirectionFilter}
                    onChange={(e) => setLedgerDirectionFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  >
                    <option value="ALL">{lang === "ar" ? "جميع الاتجاهات (ALL)" : "All Directions"}</option>
                    <option value="CREDIT">دائن / إيداع (CREDIT)</option>
                    <option value="DEBIT">مدين / خصم (DEBIT)</option>
                  </select>

                  <select
                    value={ledgerReasonFilter}
                    onChange={(e) => setLedgerReasonFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  >
                    <option value="ALL">{lang === "ar" ? "جميع الأسباب (ALL)" : "All Reasons"}</option>
                    <option value="MANUAL_CREDIT">MANUAL_CREDIT (إيداع يدوي)</option>
                    <option value="MANUAL_DEBIT">MANUAL_DEBIT (خصم يدوي)</option>
                    <option value="SUBSCRIPTION_PAYMENT">SUBSCRIPTION_PAYMENT (خصم اشتراك)</option>
                    <option value="DEPOSIT">DEPOSIT (إيداع بنكي)</option>
                    <option value="REFUND">REFUND (استرداد رصيد)</option>
                    <option value="PRORATION_ADJUSTMENT">PRORATION_ADJUSTMENT (تعديل تسوية)</option>
                  </select>
                </div>
              </div>

              {/* High-Density Ledger Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase">
                      <th className="pb-3 text-start">{lang === "ar" ? "رقم القيد والتاريخ" : "Tx Ref & Time"}</th>
                      <th className="pb-3 text-start">{lang === "ar" ? "الاتجاه" : "Direction"}</th>
                      <th className="pb-3 text-start">{lang === "ar" ? "سبب القيد" : "Reason"}</th>
                      <th className="pb-3 text-start">{lang === "ar" ? "المبلغ المصدر والعملة" : "Source Amount & FX Rate"}</th>
                      <th className="pb-3 text-start">{lang === "ar" ? "المبلغ الصافي (USD)" : "USD Converted Amount"}</th>
                      <th className="pb-3 text-start">{lang === "ar" ? "الرصيد المتبقي" : "Balance After"}</th>
                      <th className="pb-3 text-end">{lang === "ar" ? "المنفذ والملاحظة" : "Actor & Note"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {ledger.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                          لا توجد قيود مالية مطابقة للفلاتر المحددة.
                        </td>
                      </tr>
                    ) : (
                      ledger.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 h-12 font-sans">
                          <td className="py-2.5 font-bold font-mono text-slate-900 dark:text-slate-100">
                            {tx.txRef}
                            <div className="text-[10px] text-slate-400 font-mono">{tx.createdAt}</div>
                          </td>
                          <td className="py-2.5">
                            <span
                              className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg font-mono ${
                                tx.direction === "CREDIT"
                                  ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400"
                                  : "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400"
                              }`}
                            >
                              {tx.direction === "CREDIT" ? "+ CREDIT" : "- DEBIT"}
                            </span>
                          </td>
                          <td className="py-2.5">
                            <span className="px-2 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-semibold">
                              {tx.reason}
                            </span>
                          </td>
                          <td className="py-2.5 font-mono text-slate-800 dark:text-slate-200">
                            <span className="font-bold">{tx.sourceAmount.toLocaleString()} {tx.sourceCurrencyCode}</span>
                            {tx.sourceCurrencyCode !== "USD" && (
                              <div className="text-[10px] text-slate-400 font-mono">@ {tx.ratePerUsd} {tx.sourceCurrencyCode} / USD</div>
                            )}
                          </td>
                          <td className={`py-2.5 font-mono font-extrabold ${tx.direction === "CREDIT" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                            {tx.direction === "CREDIT" ? "+" : "-"}${tx.amountUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
                          </td>
                          <td className="py-2.5 font-mono text-slate-700 dark:text-slate-300 font-bold">
                            ${tx.balanceAfterUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 text-end font-sans text-slate-600 dark:text-slate-400">
                            <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs">{tx.actorName}</div>
                            <div className="text-[11px] text-slate-500">{tx.note}</div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Domain & FQDN Management */}
        {activeTab === "fqdns" && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>{lang === "ar" ? "النطاقات والدومينات المسجلة للمستأجر" : "Registered Tenant FQDN Domains"}</span>
              </h3>
            </div>
            <div className="space-y-3">
              {fqdns.map((fq) => (
                <div key={fq.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border flex items-center justify-between font-mono text-xs">
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-blue-600" />
                    <span className="font-bold">{fq.domain}</span>
                    <span className={`px-2 py-0.5 text-[10px] rounded ${fq.type === "PRIMARY" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{fq.type}</span>
                    <span className={`px-2 py-0.5 text-[10px] rounded ${fq.status === "VERIFIED" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>{fq.status}</span>
                  </div>
                  {fq.type !== "PRIMARY" && (
                    <button
                      onClick={() => handleSetPrimaryFqdn(fq.id)}
                      className="px-3 py-1.5 text-[10px] bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 rounded-xl transition-colors cursor-pointer"
                    >
                      {lang === "ar" ? "تعيين كأساسي" : "Set Primary"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 5: Users */}
        {activeTab === "users" && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>{lang === "ar" ? "دليل مستخدمي المستأجر والصلاحيات" : "Tenant User Directory & Access Controls"}</span>
              </h3>
              
              <div className="flex items-center gap-2">
                <select
                  value={userStatusFilter}
                  onChange={(e) => setUserStatusFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 border rounded-xl"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="INVITED">Invited</option>
                </select>

                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 border rounded-xl"
                >
                  <option value="ALL">All Roles</option>
                  <option value="Super Admin">Super Admin</option>
                  <option value="Sales Manager">Sales Manager</option>
                  <option value="CRM User">CRM User</option>
                  <option value="IT Support">IT Support</option>
                  <option value="HR Rep">HR Rep</option>
                </select>

                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={showDeletedUsers} onChange={(e) => setShowDeletedUsers(e.target.checked)} />
                  {lang === "ar" ? "عرض المحذوفين" : "Show Deleted"}
                </label>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
                    <th className="pb-3 text-start">{lang === "ar" ? "المستخدم والإيميل" : "User & Email"}</th>
                    <th className="pb-3 text-start">{lang === "ar" ? "المسمى والقسم" : "Job Title & Dept"}</th>
                    <th className="pb-3 text-start">{lang === "ar" ? "الدور الإداري" : "Role"}</th>
                    <th className="pb-3 text-start">{lang === "ar" ? "الحالة" : "Status"}</th>
                    <th className="pb-3 text-end">{lang === "ar" ? "الإجراءات" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {tenantUsers.map((u) => (
                    <tr key={u.id} className="h-14">
                      <td className="py-2.5 font-semibold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-1">
                          <span>{u.firstName} {u.lastName}</span>
                          {u.isTenantOwner && <span className="text-[10px] bg-amber-100 text-amber-700 px-1 rounded ml-1">Owner</span>}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">{u.email}</div>
                      </td>
                      <td className="py-2.5 text-slate-600">
                        <div>{u.jobTitle}</div>
                        <div className="text-[10px] text-slate-400">{u.departmentName}</div>
                      </td>
                      <td className="py-2.5 font-bold text-blue-600">
                        {u.roles.join(', ')}
                      </td>
                      <td className="py-2.5">
                        <StatusBadge status={u.status} enumType="tenant" size="sm" />
                      </td>
                      <td className="py-2.5 text-end space-x-1 rtl:space-x-reverse">
                        <button
                          onClick={() => {
                            setSelectedUserId(u.id);
                            setIsEditUserOpen(true);
                          }}
                          className="px-2 py-1 text-[10px] bg-slate-100 hover:bg-slate-200 rounded cursor-pointer transition-colors"
                        >
                          Edit
                        </button>
                        
                        {u.status === "ACTIVE" && !u.isTenantOwner && (
                          <button onClick={() => handleSuspendUser(u.id)} className="px-2 py-1 text-[10px] bg-amber-100 text-amber-700 hover:bg-amber-200 rounded cursor-pointer transition-colors">
                            Suspend
                          </button>
                        )}
                        {u.status === "SUSPENDED" && (
                          <button onClick={() => handleActivateUser(u.id)} className="px-2 py-1 text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded cursor-pointer transition-colors">
                            Activate
                          </button>
                        )}
                        {u.status === "INVITED" && (
                          <button onClick={() => handleResendInvite(u.id)} className="px-2 py-1 text-[10px] bg-blue-100 text-blue-700 hover:bg-blue-200 rounded cursor-pointer transition-colors">
                            Resend
                          </button>
                        )}
                        {u.status === "DELETED" ? (
                          <button onClick={() => handleRestoreUser(u.id)} className="px-2 py-1 text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded cursor-pointer transition-colors">
                            Restore
                          </button>
                        ) : !u.isTenantOwner && (
                          <button onClick={() => handleDeleteUser(u.id)} className="px-2 py-1 text-[10px] bg-rose-100 text-rose-700 hover:bg-rose-200 rounded cursor-pointer transition-colors">
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 6: Provisioning Operations */}
        {activeTab === "operations" && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <Activity className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>{lang === "ar" ? "سجل عمليات التجهيز التلقائي للوحة التحكم" : "Automated Provisioning Operations History"}</span>
            </h3>
            <div className="space-y-3">
              {operations.map((op) => (
                <div key={op.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border flex items-center justify-between font-mono text-xs">
                  <span className="font-bold text-purple-600">{op.type}</span>
                  <span>{op.status} ({op.percent}%)</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Add Credit Drawer / Modal */}
      {isAddCreditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {lang === "ar" ? "إيداع رصيد دائن للمحفظة (+ Add Credit)" : "+ Add Credit to Tenant Wallet"}
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === "ar" ? "تعديل دائن يدوي مع تحويل أسعار الصرف (MANUAL_CREDIT)" : "Manual credit entry with auto FX quote conversion"}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">المبلغ</label>
                  <input
                    type="number"
                    value={adjAmount}
                    onChange={(e) => setAdjAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">العملة</label>
                  <select
                    value={adjCurrency}
                    onChange={(e) => setAdjCurrency(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EGP">EGP (ج.م)</option>
                    <option value="SAR">SAR (ر.س)</option>
                    <option value="AED">AED (د.إ)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>

              {/* FX Rate Preview Box */}
              {adjAmount && parseFloat(adjAmount) > 0 && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/80 font-mono text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                  <div className="flex justify-between">
                    <span>سعر الصرف المعتمد:</span>
                    <span className="font-bold">{adjCurrency === "EGP" ? "50.00 EGP / USD" : adjCurrency === "SAR" ? "3.75 SAR / USD" : "1.00 USD / USD"}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-emerald-200 dark:border-emerald-800/60 pt-1 text-sm">
                    <span>المبلغ المضاف الصافي:</span>
                    <span>+${((parseFloat(adjAmount) || 0) / (adjCurrency === "EGP" ? 50 : adjCurrency === "SAR" ? 3.75 : 1)).toFixed(2)} USD</span>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">السبب والملاحظة الإدارية *</label>
                <textarea
                  value={adjNote}
                  onChange={(e) => setAdjNote(e.target.value)}
                  placeholder="أدخل بيان الإيداع والسبب المالي..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddCreditOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={submitCreditAdjustment}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md"
              >
                تأكيد إيداع الرصيد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Debit Drawer / Modal */}
      {isAddDebitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600">
                <Minus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {lang === "ar" ? "خصم رصيد مدين من المحفظة (- Add Debit)" : "- Add Debit from Tenant Wallet"}
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === "ar" ? "تعديل مدين يدوي مع تحويل أسعار الصرف (MANUAL_DEBIT)" : "Manual debit entry with auto FX quote conversion"}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">المبلغ الخصم</label>
                  <input
                    type="number"
                    value={adjAmount}
                    onChange={(e) => setAdjAmount(e.target.value)}
                    placeholder="e.g. 200"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">العملة</label>
                  <select
                    value={adjCurrency}
                    onChange={(e) => setAdjCurrency(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EGP">EGP (ج.م)</option>
                    <option value="SAR">SAR (ر.س)</option>
                    <option value="AED">AED (د.إ)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>

              {/* FX Rate Preview Box */}
              {adjAmount && parseFloat(adjAmount) > 0 && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800/80 font-mono text-xs text-rose-800 dark:text-rose-300 space-y-1">
                  <div className="flex justify-between">
                    <span>سعر الصرف المعتمد:</span>
                    <span className="font-bold">{adjCurrency === "EGP" ? "50.00 EGP / USD" : adjCurrency === "SAR" ? "3.75 SAR / USD" : "1.00 USD / USD"}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-rose-200 dark:border-rose-800/60 pt-1 text-sm">
                    <span>المبلغ المخصوم الصافي:</span>
                    <span>-${((parseFloat(adjAmount) || 0) / (adjCurrency === "EGP" ? 50 : adjCurrency === "SAR" ? 3.75 : 1)).toFixed(2)} USD</span>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">السبب والملاحظة الإدارية *</label>
                <textarea
                  value={adjNote}
                  onChange={(e) => setAdjNote(e.target.value)}
                  placeholder="أدخل سبب الخصم والبيان المالي..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddDebitOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={submitDebitAdjustment}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md"
              >
                تأكيد خصم الرصيد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Destructive Action Confirmation Modal */}
      {destructiveModalAction && (
        <DestructiveActionModal
          isOpen={true}
          onClose={() => setDestructiveModalAction(null)}
          onConfirm={confirmDestructiveModal}
          actionType={destructiveModalAction}
          targetName={tenant.name}
          title={
            destructiveModalAction === "suspend"
              ? lang === "ar" ? `تأكيد إيقاف المستأجر (${tenant.companyName})` : `Confirm Suspend Tenant (${tenant.companyName})`
              : destructiveModalAction === "delete"
              ? lang === "ar" ? `تأكيد حذف المستأجر (${tenant.companyName})` : `Confirm Delete Tenant (${tenant.companyName})`
              : lang === "ar" ? `تأكيد تدمير المستأجر نهائياً (${tenant.companyName})` : `Confirm Permanent Tenant Destruction (${tenant.companyName})`
          }
          description={
            destructiveModalAction === "suspend"
              ? lang === "ar" ? "سيعطل هذا الإجراء بيئة المستأجر مؤقتاً ولن يتمكن مستخدموه من تسجيل الدخول حتى الإعادة." : "This will temporarily disable the tenant environment until reactivated."
              : destructiveModalAction === "delete"
              ? lang === "ar" ? "سيعمل هذا الإجراء على نقل المستأجر لحالة الحذف المؤقت وإلغاء الربط بالسيرفر." : "This will soft-delete the tenant and detach active hosting server bindings."
              : lang === "ar" ? "هذا الإجراء سيقوم بحذف كافة بيانات المستأجر من السيرفر نهائياً ولا يمكن التراجع عنه." : "This will permanently destroy all tenant databases and records. Cannot be undone."
          }
          extraToggle={
            destructiveModalAction === "destroy"
              ? {
                  label: lang === "ar" ? "تدمير اشتراكات وسجلات الفوترة التابعة أيضاً (destroySubscriptions)" : "Destroy associated subscriptions and billing records (destroySubscriptions)",
                  checked: destroySubscriptionsToggle,
                  onChange: setDestroySubscriptionsToggle,
                }
              : undefined
          }
        />
      )}

      {/* Edit User Modal */}
      {isEditUserOpen && selectedUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {lang === "ar" ? "تعديل بيانات وصلاحيات المستخدم" : "Edit User Profile & Placement"}
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === "ar" ? "تعديل التسكين الوظيفي والصلاحيات عبر فروع وأقسام الشركة" : "Update user organization placement and roles"}
                </p>
              </div>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {/* Profile section */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{lang === "ar" ? "الاسم الأول" : "First Name"}</label>
                  <input type="text" defaultValue={tenantUsers.find(u => u.id === selectedUserId)?.firstName} className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{lang === "ar" ? "اسم العائلة" : "Last Name"}</label>
                  <input type="text" defaultValue={tenantUsers.find(u => u.id === selectedUserId)?.lastName} className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl" />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{lang === "ar" ? "المسمى الوظيفي" : "Job Title"}</label>
                  <input type="text" defaultValue={tenantUsers.find(u => u.id === selectedUserId)?.jobTitle} className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl" />
                </div>
              </div>

              {/* Organization Placement */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{lang === "ar" ? "الهيكل التنظيمي للمستخدم" : "Organization Placement"}</span>
                <div className="grid grid-cols-1 gap-3">
                  <select className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl">
                    <option value="">{lang === "ar" ? "اختر الفرع (Branch)..." : "Select Branch..."}</option>
                    {mockBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  
                  <select className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl" defaultValue={tenantUsers.find(u => u.id === selectedUserId)?.departmentId}>
                    <option value="">{lang === "ar" ? "اختر القسم (Department)..." : "Select Department..."}</option>
                    {mockDepartments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>

                  <select className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl">
                    <option value="">{lang === "ar" ? "اختر الفريق (Team - اختياري)..." : "Select Team (Optional)..."}</option>
                    {mockTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 mt-4">
              <button
                type="button"
                onClick={() => setIsEditUserOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl"
              >
                {lang === "ar" ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSaved(true);
                  setIsEditUserOpen(false);
                  setTimeout(() => setIsSaved(false), 3000);
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md"
              >
                {lang === "ar" ? "حفظ التعديلات" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
