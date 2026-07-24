"use client";

import { use } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { 
  ArrowLeft,
  ArrowRight,
  ShieldAlert,
  Save,
  CheckCircle2,
  Lock,
  Info
} from "lucide-react";
import { useRoleDetail } from "../hooks/useRoleDetail";

export default function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  const {
    lang,
    router,
    name,
    setName,
    description,
    setDescription,
    type,
    setType,
    isSystem,
    groupedPermissions,
    assignedPermissions,
    isSaving,
    lastSaved,
    handleMetadataBlur,
    togglePermission,
    toggleGroup,
  } = useRoleDetail(id);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 p-4 sm:p-6 max-w-5xl w-full mx-auto space-y-6">
        {/* Header Title with Save Status */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/roles")}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-slate-600 dark:text-slate-300"
            >
              {lang === "ar" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {name || (lang === "ar" ? "دور بدون اسم" : "Unnamed Role")}
                </h1>
                {isSystem && (
                  <span className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-medium">
                    <Lock className="w-3 h-3" />
                    {lang === "ar" ? "نظام (للقراءة فقط)" : "System (Read-only)"}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">
                ID: {id}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium">
            {isSaving ? (
              <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                <Save className="w-4 h-4 animate-pulse" />
                {lang === "ar" ? "جاري الحفظ..." : "Saving..."}
              </span>
            ) : lastSaved ? (
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                {lang === "ar" ? "تم الحفظ تلقائياً" : "Saved automatically"}
              </span>
            ) : null}
          </div>
        </div>

        {isSystem && (
          <div className="bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-xl p-4 flex gap-3 text-blue-800 dark:text-blue-300">
            <Info className="w-5 h-5 shrink-0" />
            <div className="text-xs">
              <h4 className="font-semibold mb-1">
                {lang === "ar" ? "هذا دور نظام أساسي" : "This is a System Role"}
              </h4>
              <p className="opacity-80">
                {lang === "ar"
                  ? "لا يمكن تعديل اسم أو صلاحيات الأدوار الأساسية المدمجة في النظام لأنها مرتبطة بمنطق عمل حرج."
                  : "System roles are deeply integrated and cannot be modified or deleted. Their permissions are managed automatically by the platform."}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Metadata */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-indigo-500" />
                  {lang === "ar" ? "المعلومات الأساسية" : "General Information"}
                </h2>
              </div>
              <div className="p-5 space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {lang === "ar" ? "اسم الدور" : "Role Name"}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={handleMetadataBlur}
                    disabled={isSystem}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-colors disabled:opacity-60 disabled:bg-slate-100 dark:disabled:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {lang === "ar" ? "مستوى الصلاحية (Tier)" : "Tier Type"}
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    onBlur={handleMetadataBlur}
                    disabled={isSystem}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-colors cursor-pointer disabled:opacity-60 disabled:bg-slate-100 dark:disabled:bg-slate-900"
                  >
                    <option value="USER">User (View-Only / Operator)</option>
                    <option value="ADMIN">Admin (Standard Administrator)</option>
                    <option value="SUPER_ADMIN">Super Admin (Unrestricted)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {lang === "ar" ? "الوصف" : "Description"}
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={handleMetadataBlur}
                    disabled={isSystem}
                    rows={4}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-colors resize-none disabled:opacity-60 disabled:bg-slate-100 dark:disabled:bg-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Permissions Matrix */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-indigo-500" />
                    {lang === "ar" ? "مصفوفة الصلاحيات" : "Permissions Matrix"}
                  </h2>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {lang === "ar" ? "يتم حفظ التغييرات فوراً." : "Changes are saved immediately."}
                  </p>
                </div>
                <div className="text-xs font-medium text-slate-500 bg-white dark:bg-slate-950 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                  {assignedPermissions.size} {lang === "ar" ? "محددة" : "selected"}
                </div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {Object.entries(groupedPermissions).map(([groupName, perms]) => {
                  const isAllChecked = perms.every(p => assignedPermissions.has(p.id));
                  
                  return (
                    <div key={groupName} className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          {groupName}
                        </h3>
                        {!isSystem && (
                          <button
                            onClick={() => toggleGroup(groupName, !isAllChecked)}
                            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                          >
                            {isAllChecked 
                              ? (lang === "ar" ? "إلغاء تحديد الكل" : "Deselect All") 
                              : (lang === "ar" ? "تحديد الكل" : "Select All")}
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                        {perms.map(p => {
                          const isChecked = assignedPermissions.has(p.id);
                          return (
                            <label
                              key={p.id}
                              className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                                isChecked 
                                  ? "bg-indigo-50/50 border-indigo-200 dark:bg-indigo-900/10 dark:border-indigo-800/50" 
                                  : "bg-slate-50/50 border-slate-200 dark:bg-slate-800/30 dark:border-slate-700/50"
                              } ${!isSystem ? "cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700" : "opacity-70"}`}
                            >
                              <div>
                                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                  {lang === "ar" ? p.labelAr : p.labelEn}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                  {p.key}
                                </div>
                              </div>
                              <div className="relative">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => togglePermission(p.id)}
                                  disabled={isSystem}
                                  className="sr-only"
                                />
                                <div className={`block w-10 h-6 rounded-full transition-colors ${
                                  isChecked ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"
                                }`}></div>
                                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                                  isChecked ? "translate-x-4" : ""
                                }`}></div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
