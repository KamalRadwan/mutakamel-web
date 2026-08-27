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
        className="flex items-center gap-2.5 rounded-xl p-1.5 ps-2 text-foreground transition-colors hover:bg-ink-100 dark:hover:bg-ink-800"
      >
        <div className="relative flex size-8 items-center justify-center rounded-lg bg-brand-500 text-xs font-semibold text-ink-950 shadow-xs">
          <span>{currentAdmin.firstName[0]}</span>
          <span className="absolute bottom-0 end-0 size-2.5 rounded-full border-2 border-card bg-brand-500" />
        </div>

        <div className="hidden flex-col text-start md:flex">
          <span className="text-xs font-semibold leading-none text-foreground">
            {currentAdmin.firstName} {currentAdmin.lastName}
          </span>
          <span className="mt-0.5 text-xs leading-none text-muted-foreground">
            {currentAdmin.roleName}
          </span>
        </div>

        <ChevronDown className="ms-0.5 size-3.5 text-muted-foreground" aria-hidden="true" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div className="absolute end-0 z-50 mt-2 w-64 animate-in fade-in slide-in-from-top-2 overflow-hidden rounded-xl border border-border bg-card shadow-xl duration-150">
            <div className="border-b border-border bg-muted p-3.5">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  {currentAdmin.firstName} {currentAdmin.lastName}
                </span>
                <span className="rounded border border-brand-500/30 bg-brand-500/10 px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-400">
                  {currentAdmin.tier}
                </span>
              </div>
              <p className="truncate text-xs text-muted-foreground">{currentAdmin.email}</p>
            </div>

            <div className="space-y-0.5 p-1.5 text-xs">
              <Link
                href="/profile"
                onClick={close}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-foreground transition-colors hover:bg-ink-100 dark:hover:bg-ink-800"
              >
                <User className="size-4 text-muted-foreground" aria-hidden="true" />
                <span>{t.common.profileAndCurrency}</span>
              </Link>
              {canViewRoles ? (
                <Link
                  href="/roles"
                  onClick={close}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-foreground transition-colors hover:bg-ink-100 dark:hover:bg-ink-800"
                >
                  <Shield className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span>{t.common.permissionsAndRoles}</span>
                </Link>
              ) : null}
              {canViewSettings ? (
                <Link
                  href="/settings"
                  onClick={close}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-foreground transition-colors hover:bg-ink-100 dark:hover:bg-ink-800"
                >
                  <Settings className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span>{t.common.systemSettings}</span>
                </Link>
              ) : null}
            </div>

            <div className="border-t border-border p-1.5">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-danger-600 transition-colors hover:bg-danger-500/10 dark:text-danger-400 dark:hover:bg-danger-500/15"
              >
                <LogOut className="size-4" aria-hidden="true" />
                <span>{t.common.signOut}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
