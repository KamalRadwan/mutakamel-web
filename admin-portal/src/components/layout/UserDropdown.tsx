"use client";

import Link from "next/link";
import { User, Shield, Settings, LogOut, ChevronDown } from "lucide-react";
import { useUserDropdown } from "./hooks/useUserDropdown";

export function UserDropdown() {
  const {
    t,
    isOpen,
    currentAdmin,
    canViewRoles,
    canViewSettings,
    toggleOpen,
    close,
    handleLogout,
  } = useUserDropdown();

  return (
    <div className="relative">
      <button
        onClick={toggleOpen}
        className="flex items-center gap-2.5 p-1.5 ps-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
      >
        {/* Avatar Badge */}
        <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white font-semibold text-xs shadow-xs">
          <span>{currentAdmin.firstName[0]}</span>
          <span className="absolute bottom-0 end-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
        </div>

        {/* User Info Labels */}
        <div className="hidden md:flex flex-col text-start">
          <span className="text-xs font-semibold leading-none text-slate-900 dark:text-slate-100">
            {currentAdmin.firstName} {currentAdmin.lastName}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-none">
            {currentAdmin.roleName}
          </span>
        </div>

        <ChevronDown className="w-3.5 h-3.5 text-slate-400 ms-0.5" />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div className="absolute end-0 mt-2 z-50 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Header User Card */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {currentAdmin.firstName} {currentAdmin.lastName}
                </span>
                <span className="px-1.5 py-0.5 text-2xs font-semibold tracking-wider uppercase bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded">
                  {currentAdmin.tier}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {currentAdmin.email}
              </p>
            </div>

            {/* Menu Links */}
            <div className="p-1.5 space-y-0.5 text-xs">
              <Link
                href="/profile"
                onClick={close}
                className="flex items-center gap-2.5 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <User className="w-4 h-4 text-slate-400" />
                <span>{t.common.profileAndCurrency}</span>
              </Link>
              {canViewRoles ? (
                <Link
                  href="/roles"
                  onClick={close}
                  className="flex items-center gap-2.5 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <Shield className="w-4 h-4 text-slate-400" />
                  <span>{t.common.permissionsAndRoles}</span>
                </Link>
              ) : null}
              {canViewSettings ? (
                <Link
                  href="/settings"
                  onClick={close}
                  className="flex items-center gap-2.5 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span>{t.common.systemSettings}</span>
                </Link>
              ) : null}
            </div>

            {/* Logout Footer */}
            <div className="p-1.5 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>{t.common.signOut}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
