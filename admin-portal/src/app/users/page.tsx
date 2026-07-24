"use client";

import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { 
  Users, 
  Search, 
  UserPlus, 
  Mail, 
  ShieldCheck, 
  PhoneCall, 
  CheckCircle2, 
  Clock, 
  Ban, 
  Trash2, 
  Edit2,
  RefreshCw
} from "lucide-react";
import { useUsers } from "./hooks/useUsers";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { InviteUserModal } from "./components/InviteUserModal";

export default function UsersDirectoryPage() {
  const {
    lang,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    tierFilter,
    setTierFilter,
    users,
    summaryMetrics,
    isInviteModalOpen,
    setIsInviteModalOpen,
    activeModalUser,
    modalActionType,
    openModal,
    closeModal,
    confirmModalAction,
  } = useUsers();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Header Title Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>{lang === "ar" ? "إدارة اعضاء فريق التحكم" : "Control Plane Staff Users"}</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {lang === "ar" ? "إدارة حسابات مشرفي النظام، الأدوار الموكلة، وإعدادات اتصالات الـ WebPhone." : "Manage system admin accounts, role assignments, and WebPhone SIP extensions."}
            </p>
          </div>

          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-600/20 transition-colors flex items-center gap-1.5 cursor-pointer ms-auto sm:ms-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>{lang === "ar" ? "دعوة عضو جديد" : "Invite Staff Member"}</span>
          </button>
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center border border-blue-100 dark:border-blue-800 shrink-0">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <span className="block text-lg font-bold text-slate-900 dark:text-slate-100">{summaryMetrics.total}</span>
              <span className="block text-[10px] text-slate-500 font-medium">{lang === "ar" ? "إجمالي أعضاء الفريق" : "Total Staff Members"}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center border border-emerald-100 dark:border-emerald-800 shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <span className="block text-lg font-bold text-slate-900 dark:text-slate-100">{summaryMetrics.active}</span>
              <span className="block text-[10px] text-slate-500 font-medium">{lang === "ar" ? "حسابات نشطة" : "Active Accounts"}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center border border-amber-100 dark:border-amber-800 shrink-0">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <span className="block text-lg font-bold text-slate-900 dark:text-slate-100">{summaryMetrics.invited}</span>
              <span className="block text-[10px] text-slate-500 font-medium">{lang === "ar" ? "دعوات معلقة" : "Pending Invites"}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center border border-red-100 dark:border-red-800 shrink-0">
              <ShieldCheck className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <span className="block text-lg font-bold text-slate-900 dark:text-slate-100">{summaryMetrics.superAdmins}</span>
              <span className="block text-[10px] text-slate-500 font-medium">{lang === "ar" ? "مدراء خارقون (Super Admin)" : "Super Administrators"}</span>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={lang === "ar" ? "البحث بالاسم أو البريد..." : "Search by name or email..."}
              className="w-full ps-9 pe-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 cursor-pointer"
            >
              <option value="ALL">{lang === "ar" ? "جميع الحالات" : "All Statuses"}</option>
              <option value="ACTIVE">{lang === "ar" ? "نشط" : "Active"}</option>
              <option value="INVITED">{lang === "ar" ? "قيد الدعوة" : "Invited"}</option>
              <option value="SUSPENDED">{lang === "ar" ? "معلق" : "Suspended"}</option>
              <option value="DEACTIVATED">{lang === "ar" ? "غير مفعل" : "Deactivated"}</option>
            </select>

            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 cursor-pointer"
            >
              <option value="ALL">{lang === "ar" ? "جميع المستويات" : "All Tiers"}</option>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="ADMIN">Admin</option>
              <option value="USER">User</option>
            </select>
          </div>
        </div>

        {/* High-Density Data Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4 text-start">{lang === "ar" ? "عضو الفريق" : "Staff Member"}</th>
                  <th className="py-3 px-4 text-start">{lang === "ar" ? "مستوى النظام (Tier)" : "Tier"}</th>
                  <th className="py-3 px-4 text-start">{lang === "ar" ? "الحالة" : "Status"}</th>
                  <th className="py-3 px-4 text-start">{lang === "ar" ? "الأدوار المنسوبة" : "Roles"}</th>
                  <th className="py-3 px-4 text-start">{lang === "ar" ? "امتداد الهاتف (SIP)" : "SIP Extension"}</th>
                  <th className="py-3 px-4 text-end">{lang === "ar" ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      {lang === "ar" ? "لا يوجد أعضاء مطابقة للفلاتر." : "No staff members match the filters."}
                    </td>
                  </tr>
                ) : (
                  users.map((usr) => (
                    <tr
                      key={usr.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors h-12 group"
                    >
                      <td className="py-2.5 px-4">
                        <Link
                          href={`/users/${usr.id}`}
                          className="font-bold text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-2"
                        >
                          <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold text-xs shrink-0">
                            {usr.firstName[0]}
                          </div>
                          <div>
                            <div className="text-slate-900 dark:text-slate-100 font-bold">
                              {usr.firstName} {usr.lastName}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {usr.email}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[10px]">
                        <span className={`px-2 py-0.5 rounded-md font-medium border ${
                          usr.tier === "SUPER_ADMIN" ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800" :
                          usr.tier === "ADMIN" ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800" :
                          "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800"
                        }`}>
                          {usr.tier}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        {usr.status === "ACTIVE" && (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400 px-2 py-0.5 rounded-md w-fit font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            {lang === "ar" ? "نشط" : "Active"}
                          </span>
                        )}
                        {usr.status === "INVITED" && (
                          <span className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400 px-2 py-0.5 rounded-md w-fit font-medium">
                            <Clock className="w-3 h-3" />
                            {lang === "ar" ? "معلق الدعوة" : "Invited"}
                          </span>
                        )}
                        {usr.status === "SUSPENDED" && (
                          <span className="flex items-center gap-1 text-[10px] text-red-700 bg-red-50 border border-red-200 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400 px-2 py-0.5 rounded-md w-fit font-medium">
                            <Ban className="w-3 h-3" />
                            {lang === "ar" ? "معلق" : "Suspended"}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        {usr.rolesCount} {lang === "ar" ? "أدوار" : "roles"}
                      </td>
                      <td className="py-2.5 px-4 text-[11px] font-mono text-slate-500">
                        {usr.sipExtension ? (
                          <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md w-fit">
                            <PhoneCall className="w-3 h-3 text-blue-500" />
                            Ext {usr.sipExtension}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[10px]">{lang === "ar" ? "غير مهيأ" : "Not configured"}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-end">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/users/${usr.id}`}
                            className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors cursor-pointer"
                            title={lang === "ar" ? "تعديل" : "Edit"}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Link>
                          {usr.status === "ACTIVE" && (
                            <button
                              onClick={() => openModal(usr.id, "suspend")}
                              className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors cursor-pointer"
                              title={lang === "ar" ? "تعليق الحساب" : "Suspend Account"}
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {usr.status === "SUSPENDED" && (
                            <button
                              onClick={() => openModal(usr.id, "activate")}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors cursor-pointer"
                              title={lang === "ar" ? "تنشيط الحساب" : "Activate Account"}
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => openModal(usr.id, "delete")}
                            className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer"
                            title={lang === "ar" ? "حذف" : "Delete"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {isInviteModalOpen && (
        <InviteUserModal onClose={() => setIsInviteModalOpen(false)} />
      )}

      {modalActionType && activeModalUser && (
        <DestructiveActionModal
          isOpen={!!modalActionType}
          onClose={closeModal}
          onConfirm={confirmModalAction}
          title={
            modalActionType === "suspend"
              ? (lang === "ar" ? "تعليق حساب المشرف" : "Suspend Admin User")
              : modalActionType === "activate"
              ? (lang === "ar" ? "تنشيط حساب المشرف" : "Activate Admin User")
              : (lang === "ar" ? "حذف حساب المشرف" : "Delete Admin User")
          }
          description={
            modalActionType === "suspend"
              ? (lang === "ar" ? `هل أنت متأكد من تعليق حساب ${activeModalUser.firstName} ${activeModalUser.lastName}؟ سيتم إلغاء الجلسات الفعالة.` : `Are you sure you want to suspend ${activeModalUser.firstName} ${activeModalUser.lastName}? Active sessions will be terminated.`)
              : modalActionType === "activate"
              ? (lang === "ar" ? `هل أنت متأكد من إعادة تنشيط حساب ${activeModalUser.firstName} ${activeModalUser.lastName}؟` : `Are you sure you want to reactivate ${activeModalUser.firstName} ${activeModalUser.lastName}?`)
              : (lang === "ar" ? `هل أنت متأكد من حذف حساب ${activeModalUser.firstName} ${activeModalUser.lastName} نهائياً؟` : `Are you sure you want to delete ${activeModalUser.firstName} ${activeModalUser.lastName}?`)
          }
          targetName={`${activeModalUser.firstName} ${activeModalUser.lastName}`}
          actionType={modalActionType}
          requireNameTyping={false}
        />
      )}
    </div>
  );
}
