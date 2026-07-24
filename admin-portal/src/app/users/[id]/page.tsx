"use client";

import { use, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { 
  ArrowLeft, 
  ArrowRight, 
  User, 
  Mail, 
  PhoneCall, 
  Save, 
  CheckCircle2, 
  Lock, 
  Eye, 
  EyeOff, 
  Ban, 
  RefreshCw,
  Shield
} from "lucide-react";
import { useUserDetail } from "../hooks/useUserDetail";

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const {
    lang,
    router,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    email,
    tier,
    setTier,
    status,
    availableRoles,
    assignedRoleIds,
    sipExtension,
    setSipExtension,
    sipUsername,
    setSipUsername,
    sipPassword,
    setSipPassword,
    outboundCallerId,
    setOutboundCallerId,
    isSaving,
    lastSaved,
    handleIdentityBlur,
    toggleRole,
    handleWebphoneBlur,
    handleStatusChange,
  } = useUserDetail(id);

  const [showSipPassword, setShowSipPassword] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto space-y-6">
        {/* Header Title Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/users")}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-slate-600 dark:text-slate-300"
            >
              {lang === "ar" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            </button>
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-sm">
              {firstName[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {firstName} {lastName}
                </h1>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                  tier === "SUPER_ADMIN" ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800" :
                  tier === "ADMIN" ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800" :
                  "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800"
                }`}>
                  {tier}
                </span>
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
                <Save className="w-4 h-4 animate-pulse" />
                {lang === "ar" ? "جاري الحفظ..." : "Saving..."}
              </span>
            ) : lastSaved ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                {lang === "ar" ? "تم الحفظ تلقائياً" : "Saved automatically"}
              </span>
            ) : null}

            {status === "ACTIVE" ? (
              <button
                onClick={() => handleStatusChange("SUSPENDED")}
                className="px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50 rounded-xl border border-amber-200 dark:border-amber-800 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>{lang === "ar" ? "تعليق الحساب" : "Suspend Account"}</span>
              </button>
            ) : (
              <button
                onClick={() => handleStatusChange("ACTIVE")}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50 rounded-xl border border-emerald-200 dark:border-emerald-800 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{lang === "ar" ? "تنشيط الحساب" : "Reactivate Account"}</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Identity & Tier Profile */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-500" />
                  {lang === "ar" ? "الملف الشخصي" : "Identity Profile"}
                </h2>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {lang === "ar" ? "الاسم الأول" : "First Name"}
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    onBlur={handleIdentityBlur}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {lang === "ar" ? "الاسم الأخير" : "Last Name"}
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    onBlur={handleIdentityBlur}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {lang === "ar" ? "البريد الإلكتروني" : "Email Address"}
                  </label>
                  <div className="relative">
                    <input
                      disabled
                      type="email"
                      value={email}
                      className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-80"
                    />
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute top-3 end-3" />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {lang === "ar" ? "البريد غير قابل للتعديل بعد الدعوة." : "Email is immutable after invitation."}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {lang === "ar" ? "مستوى النظام (Tier)" : "Admin Tier"}
                  </label>
                  <select
                    value={tier}
                    onChange={(e) => setTier(e.target.value as "SUPER_ADMIN" | "ADMIN" | "USER")}
                    onBlur={handleIdentityBlur}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="USER">User (View-Only / Support Operator)</option>
                    <option value="ADMIN">Admin (Standard Administrator)</option>
                    <option value="SUPER_ADMIN">Super Admin (Unrestricted System Access)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Roles Assignment & WebPhone Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Roles Assignment Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-500" />
                  {lang === "ar" ? "الأدوار المنسوبة" : "Assigned Control Plane Roles"}
                </h2>
                <span className="text-xs font-medium text-slate-500 bg-white dark:bg-slate-950 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  {assignedRoleIds.size} {lang === "ar" ? "أدوار" : "roles"}
                </span>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableRoles.map((role) => {
                  const isChecked = assignedRoleIds.has(role.id);
                  return (
                    <label
                      key={role.id}
                      className={`flex items-start justify-between p-3.5 rounded-xl border transition-colors cursor-pointer ${
                        isChecked 
                          ? "bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800/50" 
                          : "bg-slate-50/50 border-slate-200 dark:bg-slate-800/30 dark:border-slate-700/50 hover:border-blue-300"
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          {role.name}
                          <span className="text-[10px] font-mono font-normal text-slate-400">({role.type})</span>
                        </div>
                        {role.description && (
                          <div className="text-[11px] text-slate-500 mt-1">
                            {role.description}
                          </div>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleRole(role.id)}
                        className="mt-1 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* WebPhone SIP Credentials Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <PhoneCall className="w-4 h-4 text-blue-500" />
                  {lang === "ar" ? "إعدادات هاتف الـ WebPhone (SIP)" : "WebPhone SIP Configuration"}
                </h2>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {lang === "ar" ? "تكوين امتداد اتصالات الـ WebRTC الخاص بهذا المشرف." : "Configure SIP extension credentials for the floating admin WebPhone."}
                </p>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {lang === "ar" ? "رقم الامتداد (SIP Extension)" : "SIP Extension Number"}
                  </label>
                  <input
                    type="text"
                    value={sipExtension}
                    onChange={(e) => setSipExtension(e.target.value)}
                    onBlur={handleWebphoneBlur}
                    placeholder="e.g. 1001"
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {lang === "ar" ? "اسم المستخدم (SIP Username)" : "SIP Username"}
                  </label>
                  <input
                    type="text"
                    value={sipUsername}
                    onChange={(e) => setSipUsername(e.target.value)}
                    onBlur={handleWebphoneBlur}
                    placeholder="e.g. kamal_sip"
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {lang === "ar" ? "كلمة سر SIP Secret" : "SIP Password / Secret"}
                  </label>
                  <div className="relative">
                    <input
                      type={showSipPassword ? "text" : "password"}
                      value={sipPassword}
                      onChange={(e) => setSipPassword(e.target.value)}
                      onBlur={handleWebphoneBlur}
                      className="w-full ps-3 pe-9 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSipPassword(!showSipPassword)}
                      className="absolute top-2.5 end-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showSipPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {lang === "ar" ? "رقم المتصل الخارجي (Outbound Caller ID)" : "Outbound Caller ID"}
                  </label>
                  <input
                    type="text"
                    value={outboundCallerId}
                    onChange={(e) => setOutboundCallerId(e.target.value)}
                    onBlur={handleWebphoneBlur}
                    placeholder="e.g. +201001234567"
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
