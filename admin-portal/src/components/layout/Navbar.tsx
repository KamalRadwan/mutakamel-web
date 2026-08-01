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
  ChevronDown,
  HardDrive,
  Database,
  Network
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
    isInfrastructureChildActive,
    isInfrastructureDropdownOpen,
    toggleAdminDropdown,
    closeAdminDropdown,
    toggleInfrastructureDropdown,
    closeInfrastructureDropdown,
    handleMobileMenuToggle, 
    handleWebPhoneToggle, 
    navRoutes,
    filteredAdminItems,
    filteredInfrastructureItems
  } = useNavbar(props);

  return (
    <header className="sticky top-0 z-30 w-full h-15 bg-[#0f172a] dark:bg-[#0b132b] text-slate-100 border-b border-slate-800/90 shadow-md transition-colors">
      <div className="h-full px-4 flex items-center justify-between gap-4">
        {/* Left (RTL Start): Brand Logo & Mobile Toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleMobileMenuToggle}
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

          {/* Modules Route */}
          <Link
            href={navRoutes.modules.href}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              isLinkActive(navRoutes.modules.href)
                ? "bg-blue-600/30 text-blue-300 border border-blue-500/40 shadow-xs font-bold"
                : "text-slate-300 hover:text-white hover:bg-slate-800/70"
            }`}
          >
            <Package className="w-4.5 h-4.5 text-amber-400 shrink-0" />
            <span>{navRoutes.modules.label}</span>
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
    </header>
  );
}
