"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, LogOut, ChevronDown } from "lucide-react";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { useUserDropdown } from "./hooks/useUserDropdown";

export function UserDropdown() {
  const { lang, isOpen, currentUser, toggleOpen, close, handleLogout } = useUserDropdown();
  const pathname = usePathname();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fullName = `${currentUser.firstName} ${currentUser.lastName}`.trim();
  const menuLabel =
    lang === "ar" ? `قائمة حساب ${fullName}` : `Account menu for ${fullName}`;

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
      triggerRef.current?.focus({ preventScroll: true });
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [close, isOpen]);

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <button
        id="tenant-user-menu-trigger"
        ref={triggerRef}
        onClick={toggleOpen}
        type="button"
        aria-label={menuLabel}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-controls="tenant-user-menu"
        className="flex cursor-pointer items-center gap-1 rounded-xl p-1 text-slate-700 transition-colors hover:bg-slate-100 sm:gap-2 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {/* Avatar Badge */}
        <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white shadow-xs" aria-hidden="true">
          <span>{currentUser.firstName[0]}</span>
          <span className="absolute -bottom-0.5 -end-0.5 h-2 w-2 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
        </div>

        {/* User Info Labels */}
        <div className="hidden sm:flex flex-col text-start">
          <span className="text-xs font-bold leading-none text-slate-900 dark:text-slate-100">
            {currentUser.firstName} {currentUser.lastName}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-none">
            {currentUser.roleName}
          </span>
        </div>

        <ChevronDown
          className={`hidden h-3.5 w-3.5 text-slate-400 transition-transform sm:block ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
          <div
            id="tenant-user-menu"
            role="menu"
            aria-labelledby="tenant-user-menu-trigger"
            className="fixed inset-x-2 top-[49px] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-in fade-in slide-in-from-top-2 sm:absolute sm:inset-x-auto sm:end-0 sm:top-full sm:mt-2 sm:w-64 dark:border-slate-800 dark:bg-slate-900"
          >
            {/* Header User Card */}
            <div role="presentation" className="border-b border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {currentUser.firstName} {currentUser.lastName}
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded">
                  {currentUser.tier}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {currentUser.email}
              </p>
            </div>

            {/* Menu Links */}
            <div role="none" className="space-y-0.5 p-1.5 text-xs font-medium">
              <Link
                href={TENANT_ROUTES.coreSessions}
                onClick={close}
                role="menuitem"
                aria-current={pathname === TENANT_ROUTES.coreSessions ? "page" : undefined}
                className="flex items-center gap-2.5 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Lock className="h-4 w-4 text-slate-400" aria-hidden="true" />
                <span>{lang === "ar" ? "جلسات تسجيل الدخول" : "Sign-in sessions"}</span>
              </Link>
            </div>

            {/* Logout Footer */}
            <div role="none" className="border-t border-slate-200 p-1.5 dark:border-slate-800">
              <button
                onClick={handleLogout}
                type="button"
                role="menuitem"
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>{lang === "ar" ? "تسجيل الخروج" : "Sign Out"}</span>
              </button>
            </div>
          </div>
      )}
    </div>
  );
}
