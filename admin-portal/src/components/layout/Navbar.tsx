"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  Menu,
  ShieldCheck,
  LayoutDashboard,
  Building2,
  Package,
  Users,
  Shield,
  ChevronDown,
  HardDrive,
  Database,
  DatabaseBackup,
  Network,
} from "lucide-react";
import { NotificationDropdown } from "./NotificationDropdown";
import { LanguageToggle } from "./LanguageToggle";
import { ThemeToggle } from "./ThemeToggle";
import { UserDropdown } from "./UserDropdown";
import { useNavbar, UseNavbarProps } from "./hooks/useNavbar";
import { useI18n } from "@/i18n/I18nContext";

export function Navbar(props: UseNavbarProps) {
  const { lang } = useI18n();
  const {
    isMobileMenuOpen,
    isLinkActive,
    isAdminChildActive,
    isAdminDropdownOpen,
    isInfrastructureChildActive,
    isInfrastructureDropdownOpen,
    toggleAdminDropdown,
    closeAdminDropdown,
    toggleInfrastructureDropdown,
    closeInfrastructureDropdown,
    handleMobileMenuToggle,
    closeMobileMenu,
    navRoutes,
    filteredAdminItems,
    filteredInfrastructureItems,
    canViewBackup,
  } = useNavbar(props);

  return (
    <header className="sticky top-0 z-30 w-full h-15 bg-[#0f172a] dark:bg-[#0b132b] text-slate-100 border-b border-slate-800/90 shadow-md transition-colors">
      <div className="h-full px-4 flex items-center justify-between gap-4">
        {/* Left (RTL Start): Brand Logo & Mobile Toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleMobileMenuToggle}
            aria-expanded={isMobileMenuOpen}
            aria-controls="admin-mobile-navigation"
            aria-label={lang === "ar" ? "فتح القائمة الرئيسية" : "Open main navigation"}
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="القائمة الرئيسية"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link href={navRoutes.dashboard.href} className="flex items-center gap-2.5 group me-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-blue-400 text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5.5 h-5.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-tight text-white leading-tight">
                {lang === "ar" ? "متكامل" : "Mutakamel"}
              </span>
              <span className="text-[10px] font-medium text-slate-400 leading-none">
                Control Plane
              </span>
            </div>
          </Link>
        </div>

        {/* Middle Section: Top Nav Routes */}
        <nav className="hidden lg:flex items-center gap-1.5 flex-1">
          {/* Dashboard Route */}
          <Link
            href={navRoutes.dashboard.href}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              isLinkActive(navRoutes.dashboard.href)
                ? "bg-blue-600/30 text-blue-300 border border-blue-500/40 shadow-xs font-bold"
                : "text-slate-300 hover:text-white hover:bg-slate-800/70"
            }`}
          >
            <LayoutDashboard className="w-4.5 h-4.5 text-blue-400 shrink-0" />
            <span>{navRoutes.dashboard.label}</span>
          </Link>

          {/* Infrastructure Dropdown */}
          <div className="relative">
            <button
              onClick={toggleInfrastructureDropdown}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isInfrastructureChildActive || isInfrastructureDropdownOpen
                  ? "bg-blue-600/30 text-blue-300 border border-blue-500/40 shadow-xs font-bold"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/70"
              }`}
            >
              <Network className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
              <span>{navRoutes.infrastructureDropdown.label}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isInfrastructureDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {isInfrastructureDropdownOpen && (
              <div
                className="absolute top-full start-0 mt-1 w-48 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl py-1.5 z-40 animate-in fade-in"
                onMouseLeave={closeInfrastructureDropdown}
              >
                {filteredInfrastructureItems.length === 0 ? (
                  <div className="px-4 py-2 text-xs font-semibold text-slate-500 italic">
                    {lang === "ar" ? "لا توجد صلاحيات" : "No permissions"}
                  </div>
                ) : (
                  filteredInfrastructureItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeInfrastructureDropdown}
                      className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold hover:bg-slate-800 transition-colors ${
                        isLinkActive(item.href) ? "text-blue-400 font-bold" : "text-slate-300"
                      }`}
                    >
                    {item.href.includes("database") ? (
                      <Database className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                    ) : (
                      <HardDrive className="w-4.5 h-4.5 text-blue-400 shrink-0" />
                    )}
                    <span>{item.label}</span>
                  </Link>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Backup & Restore is a separate operational module. */}
          {canViewBackup && (
            <Link
              href={navRoutes.backup.href}
              aria-current={isLinkActive(navRoutes.backup.href) ? "page" : undefined}
              aria-label={navRoutes.backup.label}
              title={navRoutes.backup.label}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                isLinkActive(navRoutes.backup.href)
                  ? "bg-cyan-600/25 text-cyan-200 border border-cyan-500/40 shadow-xs font-bold"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/70"
              }`}
            >
              <DatabaseBackup className="w-4.5 h-4.5 text-cyan-400 shrink-0" />
              <span className="hidden xl:inline">{navRoutes.backup.label}</span>
            </Link>
          )}

          {/* Tenants Route */}
          <Link
            href={navRoutes.tenants.href}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              isLinkActive(navRoutes.tenants.href)
                ? "bg-blue-600/30 text-blue-300 border border-blue-500/40 shadow-xs font-bold"
                : "text-slate-300 hover:text-white hover:bg-slate-800/70"
            }`}
          >
            <Building2 className="w-4.5 h-4.5 text-indigo-400 shrink-0" />
            <span>{navRoutes.tenants.label}</span>
          </Link>

          {/* Application Catalogue Route */}
          <Link
            href={navRoutes.applications.href}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              isLinkActive(navRoutes.applications.href)
                ? "bg-blue-600/30 text-blue-300 border border-blue-500/40 shadow-xs font-bold"
                : "text-slate-300 hover:text-white hover:bg-slate-800/70"
            }`}
          >
            <Package className="w-4.5 h-4.5 text-amber-400 shrink-0" />
            <span>{navRoutes.applications.label}</span>
          </Link>

          {/* Admin Controls Dropdown */}
          <div className="relative">
            <button
              onClick={toggleAdminDropdown}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isAdminChildActive || isAdminDropdownOpen
                  ? "bg-blue-600/30 text-blue-300 border border-blue-500/40 shadow-xs font-bold"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/70"
              }`}
            >
              <Shield className="w-4.5 h-4.5 text-purple-400 shrink-0" />
              <span>{navRoutes.adminDropdown.label}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isAdminDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {isAdminDropdownOpen && (
              <div
                className="absolute top-full start-0 mt-1 w-48 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl py-1.5 z-40 animate-in fade-in"
                onMouseLeave={closeAdminDropdown}
              >
                {filteredAdminItems.length === 0 ? (
                  <div className="px-4 py-2 text-xs font-semibold text-slate-500 italic">
                    {lang === "ar" ? "لا توجد صلاحيات" : "No permissions"}
                  </div>
                ) : (
                  filteredAdminItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeAdminDropdown}
                      className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold hover:bg-slate-800 transition-colors ${
                        isLinkActive(item.href) ? "text-blue-400 font-bold" : "text-slate-300"
                      }`}
                    >
                    {item.href.includes("users") ? (
                      <Users className="w-4.5 h-4.5 text-cyan-400 shrink-0" />
                    ) : (
                      <Shield className="w-4.5 h-4.5 text-purple-400 shrink-0" />
                    )}
                    <span>{item.label}</span>
                  </Link>
                  ))
                )}
              </div>
            )}
          </div>
        </nav>

        {/* Right (RTL End): Controls, Theme, Lang, User */}
        <div className="flex items-center gap-2 shrink-0">
          <NotificationDropdown />
          <LanguageToggle />
          <ThemeToggle />
          <UserDropdown />
        </div>
      </div>

      {isMobileMenuOpen ? (
        <nav
          id="admin-mobile-navigation"
          aria-label={lang === "ar" ? "التنقل الرئيسي" : "Main navigation"}
          className="absolute inset-x-0 top-full max-h-[calc(100vh-3.75rem)] overflow-y-auto border-b border-slate-800 bg-slate-950 p-4 shadow-2xl lg:hidden"
        >
          <div className="grid gap-2">
            <MobileNavLink href={navRoutes.dashboard.href} label={navRoutes.dashboard.label} active={isLinkActive(navRoutes.dashboard.href)} onClick={closeMobileMenu} icon={<LayoutDashboard className="size-4 text-blue-400" />} />

            {filteredInfrastructureItems.length ? (
              <div className="rounded-xl border border-slate-800 p-2">
                <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{navRoutes.infrastructureDropdown.label}</p>
                {filteredInfrastructureItems.map((item) => (
                  <MobileNavLink key={item.href} href={item.href} label={item.label} active={isLinkActive(item.href)} onClick={closeMobileMenu} icon={item.href.includes("database") ? <Database className="size-4 text-emerald-400" /> : <HardDrive className="size-4 text-blue-400" />} />
                ))}
              </div>
            ) : null}

            {canViewBackup ? <MobileNavLink href={navRoutes.backup.href} label={navRoutes.backup.label} active={isLinkActive(navRoutes.backup.href)} onClick={closeMobileMenu} icon={<DatabaseBackup className="size-4 text-cyan-400" />} /> : null}
            <MobileNavLink href={navRoutes.tenants.href} label={navRoutes.tenants.label} active={isLinkActive(navRoutes.tenants.href)} onClick={closeMobileMenu} icon={<Building2 className="size-4 text-indigo-400" />} />
            <MobileNavLink href={navRoutes.applications.href} label={navRoutes.applications.label} active={isLinkActive(navRoutes.applications.href)} onClick={closeMobileMenu} icon={<Package className="size-4 text-amber-400" />} />

            {filteredAdminItems.length ? (
              <div className="rounded-xl border border-slate-800 p-2">
                <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{navRoutes.adminDropdown.label}</p>
                {filteredAdminItems.map((item) => (
                  <MobileNavLink key={item.href} href={item.href} label={item.label} active={isLinkActive(item.href)} onClick={closeMobileMenu} icon={item.href.includes("users") ? <Users className="size-4 text-cyan-400" /> : <Shield className="size-4 text-purple-400" />} />
                ))}
              </div>
            ) : null}
          </div>
        </nav>
      ) : null}
    </header>
  );
}

function MobileNavLink({ href, label, active, onClick, icon }: { href: string; label: string; active: boolean; onClick: () => void; icon: ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold ${active ? "bg-cyan-600/20 text-cyan-200" : "text-slate-200 hover:bg-slate-900"}`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
