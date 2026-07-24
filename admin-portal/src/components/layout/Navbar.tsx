"use client";

import Link from "next/link";
import { 
  Menu, 
  ShieldCheck, 
  LayoutDashboard, 
  Server, 
  Building2, 
  Package, 
  Users, 
  Shield, 
  ChevronDown 
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
    isLinkActive, 
    isAdminChildActive, 
    isAdminDropdownOpen,
    toggleAdminDropdown,
    closeAdminDropdown,
    handleMobileMenuToggle, 
    handleWebPhoneToggle, 
    navRoutes
  } = useNavbar(props);

  return (
    <header className="sticky top-0 z-30 w-full h-15 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
      <div className="h-full px-4 flex items-center justify-between gap-4">
        {/* Left (RTL Start): Brand Logo & Mobile Toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleMobileMenuToggle}
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="القائمة الرئيسية"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link href={navRoutes.dashboard.href} className="flex items-center gap-2.5 group me-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-700 to-blue-500 text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5.5 h-5.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
                {lang === "ar" ? "متكامل" : "Mutakamel"}
              </span>
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-none">
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
                ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
            }`}
          >
            <LayoutDashboard className="w-4.5 h-4.5 text-blue-500 shrink-0" />
            <span>{navRoutes.dashboard.label}</span>
          </Link>

          {/* DB Servers Route */}
          <Link
            href={navRoutes.databaseServers.href}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              isLinkActive(navRoutes.databaseServers.href)
                ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
            }`}
          >
            <Server className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
            <span>{navRoutes.databaseServers.label}</span>
          </Link>

          {/* Tenants Route */}
          <Link
            href={navRoutes.tenants.href}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              isLinkActive(navRoutes.tenants.href)
                ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
            }`}
          >
            <Building2 className="w-4.5 h-4.5 text-indigo-500 shrink-0" />
            <span>{navRoutes.tenants.label}</span>
          </Link>

          {/* Modules Route */}
          <Link
            href={navRoutes.modules.href}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              isLinkActive(navRoutes.modules.href)
                ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
            }`}
          >
            <Package className="w-4.5 h-4.5 text-amber-500 shrink-0" />
            <span>{navRoutes.modules.label}</span>
          </Link>

          {/* Admin Controls Dropdown */}
          <div className="relative">
            <button
              onClick={toggleAdminDropdown}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isAdminChildActive || isAdminDropdownOpen
                  ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <Shield className="w-4.5 h-4.5 text-purple-500 shrink-0" />
              <span>{navRoutes.adminDropdown.label}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isAdminDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {isAdminDropdownOpen && (
              <div 
                className="absolute top-full start-0 mt-1 w-48 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl py-1.5 z-40 animate-in fade-in"
                onMouseLeave={closeAdminDropdown}
              >
                {navRoutes.adminDropdown.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeAdminDropdown}
                    className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors ${
                      isLinkActive(item.href) ? "text-blue-600 dark:text-blue-400 font-bold" : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {item.href.includes("users") ? (
                      <Users className="w-4.5 h-4.5 text-cyan-500 shrink-0" />
                    ) : (
                      <Shield className="w-4.5 h-4.5 text-purple-500 shrink-0" />
                    )}
                    <span>{item.label}</span>
                  </Link>
                ))}
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
    </header>
  );
}
