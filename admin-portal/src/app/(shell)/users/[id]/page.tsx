"use client";

import { use, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  User,
  Mail,
  PhoneCall,
  Save,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  Ban,
  RefreshCw,
  Shield,
  AlertCircle,
  Loader2,
  Trash2,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  RotateCcw,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Sliders,
} from "lucide-react";
import { useUserDetail } from "../hooks/useUserDetail";
import { useUserPermissions } from "../hooks/useUserPermissions";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { UserMetadataCard } from "../components/UserMetadataCard";
import { UserProfileCard } from "../components/UserProfileCard";
import { WebphoneSummaryCard } from "../components/WebphoneSummaryCard";
import { UserNotFoundState } from "../components/UserNotFoundState";
import { UserPermissionDenied } from "../components/UserPermissionDenied";

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const {
    lang,
    t,
    router,
    user,
    isLoading,
    isSaving,
    notFound,
    permissionDenied,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    reload,

    firstName,
    setFirstName,
    lastName,
    setLastName,
    email,
    isSuperAdmin,
    setIsSuperAdmin,
    assignedRoleId,
    setAssignedRoleId,
    availableRoles,
    status,

    identityHasChanges,
    roleHasChanges,
    webphoneHasChanges,

    webphoneEnabled,
    setWebphoneEnabled,
    sipExtension,
    setSipExtension,
    sipUsername,
    setSipUsername,
    sipPassword,
    setSipPassword,
    webphoneDisplayName,
    setWebphoneDisplayName,
    outboundCallerId,
    setOutboundCallerId,
    webphoneTransport,
    setWebphoneTransport,
    passwordConfigured,

    webphoneConfig,
    extensionError,
    sipUsernameError,

    saveIdentity,
    saveRole,
    saveWebphone,
    handleStatusChange,
    handleDelete,
  } = useUserDetail(id);

  const permissions = useUserPermissions(id, status);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [showSipPassword, setShowSipPassword] = useState(false);
  const [isEditingWebphone, setIsEditingWebphone] = useState(false);
  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <span className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          {lang === "ar" ? "جارٍ تحميل بيانات المستخدم..." : "Loading user details..."}
        </span>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="w-full">
        <UserNotFoundState />
      </div>
    );
  }

  if (permissionDenied) {
    return (
      <div className="w-full">
        <UserPermissionDenied />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
        {/* Header Title Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/users")}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-slate-600 dark:text-slate-300"
            >
              {lang === "ar" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            </button>
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-700 dark:text-blue-300 font-semibold text-sm">
              {firstName[0] || "?"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  {firstName} {lastName}
                </h1>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                    isSuperAdmin
                      ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                      : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800"
                  }`}
                >
                  {isSuperAdmin ? "SUPER_ADMIN" : "ADMIN"}
                </span>
                {permissions.isSelf && (
                  <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 font-mono font-semibold">
                    YOU
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isSaving ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                {lang === "ar" ? "جاري الحفظ..." : "Saving..."}
              </span>
            ) : null}

            {permissions.canSuspend && (
              <button
                disabled={isSaving}
                onClick={() => handleStatusChange("SUSPENDED")}
                className="px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50 rounded-xl border border-amber-200 dark:border-amber-800 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>{t.users.suspendAccount}</span>
              </button>
            )}

            {permissions.canActivate && (
              <button
                disabled={isSaving}
                onClick={() => handleStatusChange("ACTIVE")}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50 rounded-xl border border-emerald-200 dark:border-emerald-800 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{t.users.activateAccount}</span>
              </button>
            )}

            {permissions.canDelete && (
              <button
                disabled={isSaving}
                onClick={() => setIsDeleteModalOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300 dark:hover:bg-rose-900/50 rounded-xl border border-rose-200 dark:border-rose-800 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t.users.delete}</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Identity & Metadata & Profile Cards */}
          <div className="space-y-6">
            {/* Identity Profile Card */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-xl hover:border-blue-500/30 transition-all duration-300 overflow-hidden relative group">
              <div className="absolute top-0 start-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-blue-500/10 transition-colors duration-500" />
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between relative z-10">
                <h2 className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-500" />
                  {t.users.identityProfile}
                </h2>
                {identityHasChanges && permissions.canEdit && (
                  <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 rounded font-mono">
                    UNSAVED
                  </span>
                )}
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t.users.firstNameLabel}
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    disabled={!permissions.canEdit || isSaving}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 disabled:opacity-70"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t.users.lastNameLabel}
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    disabled={!permissions.canEdit || isSaving}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 disabled:opacity-70"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t.users.emailLabel}
                  </label>
                  <div className="relative">
                    <input
                      disabled
                      type="email"
                      value={email}
                      className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-80 font-mono"
                    />
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute top-2.5 end-3" />
                  </div>
                  <span className="text-xs text-slate-400 mt-1 block">
                    {t.users.emailImmutable}
                  </span>
                </div>

                {permissions.isCurrentSuperAdmin && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <label
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
                        isSuperAdmin
                          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400"
                          : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      } ${!permissions.canEdit || isSaving ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSuperAdmin}
                        onChange={(e) => setIsSuperAdmin(e.target.checked)}
                        disabled={!permissions.canEdit || isSaving}
                        className="size-4 rounded text-blue-600 focus:ring-blue-600"
                      />
                      <div className="flex flex-col gap-0.5">
                        <span>
                          {lang === "ar"
                            ? "مدير خارق (Super Admin)"
                            : "Super Admin Privileges"}
                        </span>
                        <span className="text-xs font-normal opacity-80">
                          {lang === "ar"
                            ? "تجاوز كامل للقيود عبر الخادم الموثوق."
                            : "Bypasses system permissions logic."}
                        </span>
                      </div>
                    </label>
                  </div>
                )}

                {permissions.canEdit && identityHasChanges && (
                  <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={saveIdentity}
                      disabled={isSaving}
                      className="flex-1 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{t.users.saveChanges}</span>
                    </button>
                    <button
                      onClick={() => {
                        if (user) {
                          setFirstName(user.firstName);
                          setLastName(user.lastName);
                          setIsSuperAdmin(user.isSuperAdmin);
                        }
                      }}
                      disabled={isSaving}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {t.users.discardChanges}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* System Metadata Card */}
            {user && <UserMetadataCard user={user} />}

            {/* User Profile Preferences Card */}
            <UserProfileCard profile={user?.profile} />
          </div>

          {/* Right Column: Roles Assignment & WebPhone Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Roles Assignment Card */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-xl hover:border-indigo-500/30 transition-all duration-300 overflow-hidden relative group">
              <div className="absolute top-0 end-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/10 transition-colors duration-500" />
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between relative z-10">
                <h2 className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-500" />
                  <span>{lang === "ar" ? "الدور المنسوب (PATCH /roles)" : "Assigned Control Plane Role"}</span>
                </h2>
                {roleHasChanges && permissions.canAssignRole && (
                  <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 rounded font-mono">
                    UNSAVED ROLE
                  </span>
                )}
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t.users.roleLabel}
                  </label>
                  <select
                    value={assignedRoleId ?? ""}
                    onChange={(e) => setAssignedRoleId(e.target.value || undefined)}
                    disabled={!permissions.canAssignRole || permissions.isSelf || isSaving}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="" disabled>
                      {lang === "ar" ? "اختر الدور" : "Select a role"}
                    </option>
                    {availableRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.nameI18n?.[lang] || role.name}
                      </option>
                    ))}
                  </select>
                  {assignedRoleId &&
                    availableRoles.find((r) => r.id === assignedRoleId)?.description && (
                      <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                        {availableRoles.find((r) => r.id === assignedRoleId)?.description}
                      </p>
                    )}
                </div>

                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3 flex gap-2 border border-amber-200 dark:border-amber-900/40">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    {t.users.roleChangeWarning}
                  </p>
                </div>

                {permissions.canAssignRole && !permissions.isSelf && roleHasChanges && (
                  <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={saveRole}
                      disabled={isSaving}
                      className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{lang === "ar" ? "تأكيد وتحديث الدور" : "Apply Role Assignment"}</span>
                    </button>
                    <button
                      onClick={() => setAssignedRoleId(user?.roleId ?? user?.role?.id ?? undefined)}
                      disabled={isSaving}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {t.users.discardChanges}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* WebPhone Section */}
            {!isEditingWebphone ? (
              <WebphoneSummaryCard
                webphone={webphoneConfig}
                canEdit={permissions.canEditWebphone}
                onEditToggle={() => setIsEditingWebphone(true)}
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                      <PhoneCall className="size-4 text-blue-500" />
                      <span>{t.users.webphoneConfig}</span>
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {lang === "ar"
                        ? "بيانات تسجيل JsSIP للمشرف. كلمة المرور لا تُعرض بعد الحفظ."
                        : "JsSIP credentials. The current password is never displayed after save."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={webphoneEnabled}
                        onChange={(e) => setWebphoneEnabled(e.target.checked)}
                        className="size-4 rounded text-blue-600"
                      />
                      <span>{t.users.enablePhone}</span>
                    </label>
                    <button
                      onClick={() => setIsEditingWebphone(false)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                    >
                      {lang === "ar" ? "إلغاء التعديل" : "Cancel Edit"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t.users.sipExtension}
                    </label>
                    <input
                      type="text"
                      maxLength={32}
                      value={sipExtension}
                      onChange={(e) => setSipExtension(e.target.value)}
                      placeholder="7001"
                      className={`w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border rounded-xl font-mono text-slate-900 dark:text-slate-100 focus:outline-none ${
                        extensionError
                          ? "border-red-500 focus:border-red-500"
                          : "border-slate-200 dark:border-slate-700/80 focus:border-blue-600"
                      }`}
                    />
                    {extensionError && (
                      <span className="text-xs text-red-500 font-medium block mt-1">
                        {extensionError}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      SIP Username
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      value={sipUsername}
                      onChange={(e) => setSipUsername(e.target.value)}
                      placeholder="7001"
                      className={`w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border rounded-xl font-mono text-slate-900 dark:text-slate-100 focus:outline-none ${
                        sipUsernameError
                          ? "border-red-500 focus:border-red-500"
                          : "border-slate-200 dark:border-slate-700/80 focus:border-blue-600"
                      }`}
                    />
                    {sipUsernameError && (
                      <span className="text-xs text-red-500 font-medium block mt-1">
                        {sipUsernameError}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      SIP Password
                    </label>
                    <div className="relative">
                      <input
                        type={showSipPassword ? "text" : "password"}
                        maxLength={255}
                        value={sipPassword}
                        onChange={(e) => setSipPassword(e.target.value)}
                        placeholder={passwordConfigured ? "••••••••••••" : ""}
                        className="w-full ps-3 pe-9 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSipPassword(!showSipPassword)}
                        className="absolute top-1/2 end-2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                      >
                        {showSipPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <small className="text-xs text-slate-400 block mt-1">
                      {passwordConfigured
                        ? lang === "ar"
                          ? "اتركها فارغة للاحتفاظ بالحالية"
                          : "Leave empty to keep current password"
                        : lang === "ar"
                        ? "مطلوبة عند تفعيل الهاتف"
                        : "Required when enabling phone"}
                    </small>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      value={webphoneDisplayName}
                      onChange={(e) => setWebphoneDisplayName(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Outbound Caller ID
                    </label>
                    <input
                      type="text"
                      maxLength={64}
                      value={outboundCallerId}
                      onChange={(e) => setOutboundCallerId(e.target.value)}
                      placeholder="+201001234567"
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      SIP Transport
                    </label>
                    <select
                      value={webphoneTransport}
                      onChange={(e) =>
                        setWebphoneTransport(e.target.value === "ws" ? "ws" : "wss")
                      }
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 cursor-pointer"
                    >
                      <option value="wss">WSS</option>
                      <option value="ws">WS</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
                  <span className="text-xs text-slate-500">
                    {passwordConfigured ? t.users.passwordConfigured : t.users.noPasswordConfigured}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!webphoneHasChanges || isSaving}
                      onClick={async () => {
                        await saveWebphone();
                        setIsEditingWebphone(false);
                      }}
                      className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
                    >
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      <span>{t.users.savePhoneSettings}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      <DestructiveActionModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={() => {
          setIsDeleteModalOpen(false);
          void handleDelete();
        }}
        title={lang === "ar" ? "حذف الحساب نهائياً" : "Delete Admin User"}
        targetName={`${firstName} ${lastName}`.trim() || email}
        actionType="delete"
        description={
          lang === "ar"
            ? "هل أنت متأكد من رغبتك في حذف هذا الحساب؟ لا يمكن التراجع عن هذا الإجراء."
            : "Are you sure you want to delete this account? Soft-delete will hide this record."
        }
        isSubmitting={isSaving}
      />
    </div>
  );
}
