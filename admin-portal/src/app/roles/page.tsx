"use client";

import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { 
  ShieldCheck, 
  Search, 
  Plus,
  Trash2,
  Lock,
  Edit2
} from "lucide-react";
import { useRoles } from "./hooks/useRoles";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { CreateRoleModal } from "./components/CreateRoleModal";

export default function RolesDirectoryPage() {
  const {
    search,
    setSearch,
    typeFilter,
    setTypeFilter,
    isSystemFilter,
    setIsSystemFilter,
    roles,
    totalItems,
    isCreateModalOpen,
    setIsCreateModalOpen,
    activeModalRole,
    isDeleteModalOpen,
    closeDeleteModal,
    openDeleteModal,
    confirmDelete,
    lang
  } = useRoles();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Header Title Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>{lang === "ar" ? "أدوار النظام والصلاحيات" : "Admin Roles & Permissions"}</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {lang === "ar" ? "إدارة أدوار المشرفين وتوزيع الصلاحيات على النظام المركزي." : "Manage control plane admin roles and permissions assignments."}
            </p>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/20 transition-colors flex items-center gap-1.5 cursor-pointer ms-auto sm:ms-0"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === "ar" ? "إنشاء دور جديد" : "Create Role"}</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={lang === "ar" ? "البحث في الأدوار..." : "Search roles..."}
              className="w-full ps-9 pe-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 cursor-pointer"
            >
              <option value="ALL">{lang === "ar" ? "جميع المستويات" : "All Tiers"}</option>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="ADMIN">Admin</option>
              <option value="USER">User</option>
            </select>

            <select
              value={isSystemFilter}
              onChange={(e) => setIsSystemFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 cursor-pointer"
            >
              <option value="ALL">{lang === "ar" ? "جميع الأنواع" : "All Types"}</option>
              <option value="TRUE">{lang === "ar" ? "أدوار النظام الأساسية" : "System Roles"}</option>
              <option value="FALSE">{lang === "ar" ? "أدوار مخصصة" : "Custom Roles"}</option>
            </select>
          </div>
        </div>

        {/* High-Density Data Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4 text-start">{lang === "ar" ? "اسم الدور" : "Role Name"}</th>
                  <th className="py-3 px-4 text-start">{lang === "ar" ? "مستوى الصلاحية (Tier)" : "Tier Type"}</th>
                  <th className="py-3 px-4 text-start">{lang === "ar" ? "النوع" : "System Status"}</th>
                  <th className="py-3 px-4 text-start">{lang === "ar" ? "تاريخ الإنشاء" : "Created At"}</th>
                  <th className="py-3 px-4 text-end">{lang === "ar" ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {roles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      {lang === "ar" ? "لا توجد أدوار مطابقة للبحث." : "No roles match your search."}
                    </td>
                  </tr>
                ) : (
                  roles.map((role) => (
                    <tr
                      key={role.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors h-11 group"
                    >
                      <td className="py-2.5 px-4">
                        <Link
                          href={`/roles/${role.id}`}
                          className="font-bold text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1.5"
                        >
                          {role.name}
                        </Link>
                        {role.description && (
                          <div className="text-[10px] text-slate-500 truncate max-w-xs mt-0.5">
                            {role.description}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[10px]">
                        <span className={`px-2 py-0.5 rounded-md font-medium border ${
                          role.type === "SUPER_ADMIN" ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800" :
                          role.type === "ADMIN" ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800" :
                          "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800"
                        }`}>
                          {role.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        {role.isSystem ? (
                          <span className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md w-fit font-medium">
                            <Lock className="w-3 h-3" />
                            {lang === "ar" ? "نظام (للقراءة فقط)" : "System (Read-only)"}
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400 px-2 py-0.5 rounded-md w-fit font-medium">
                            {lang === "ar" ? "مخصص" : "Custom"}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400 text-[10px]">
                        {new Date(role.createdAt).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </td>
                      <td className="py-2.5 px-4 text-end">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/roles/${role.id}`}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors cursor-pointer"
                            title={lang === "ar" ? "تعديل" : "Edit"}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Link>
                          {!role.isSystem && (
                            <button
                              onClick={() => openDeleteModal(role.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer"
                              title={lang === "ar" ? "حذف" : "Delete"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-[10px] text-slate-500 flex justify-between items-center">
            <span>
              {lang === "ar" ? `عرض ${roles.length} من أصل ${totalItems} دور` : `Showing ${roles.length} of ${totalItems} roles`}
            </span>
          </div>
        </div>
      </main>

      {isCreateModalOpen && (
        <CreateRoleModal onClose={() => setIsCreateModalOpen(false)} />
      )}

      {isDeleteModalOpen && activeModalRole && (
        <DestructiveActionModal
          isOpen={isDeleteModalOpen}
          onClose={closeDeleteModal}
          onConfirm={confirmDelete}
          title={lang === "ar" ? "حذف الدور" : "Delete Role"}
          description={lang === "ar" ? `هل أنت متأكد من رغبتك في حذف هذا الدور؟` : `Are you sure you want to delete this role?`}
          targetName={activeModalRole.name}
          actionType="delete"
        />
      )}
    </div>
  );
}
