"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  ShieldCheck, 
  CreditCard, 
  Wallet, 
  Activity, 
  FolderOpen, 
  FileText, 
  DollarSign, 
  FileCode, 
  Mail, 
  Lock, 
  UserCheck, 
  RefreshCw, 
  Download, 
  Server, 
  Settings,
  ChevronDown,
  GitBranch,
  Layers
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export function CoreNavbarLinks() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleDropdown = (id: string) => {
    setActiveDropdown((prev) => (prev === id ? null : id));
  };

  const navGroups = [
    {
      id: "staff",
      label: t.nav.staff || "Staff",
      icon: Users,
      color: "text-blue-500",
      items: [
        { label: t.nav.users, href: "/core/users", icon: Users, color: "text-blue-500 bg-blue-50 dark:bg-blue-950/50" },
        { label: t.nav.roles, href: "/core/roles-role-assignments", icon: ShieldCheck, color: "text-rose-500 bg-rose-50 dark:bg-rose-950/50" },
        { label: t.nav.moduleAssignments, href: "/core/user-module-assignments", icon: UserCheck, color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/50" },
        { label: t.nav.authentication, href: "/core/authentication", icon: Lock, color: "text-amber-500 bg-amber-50 dark:bg-amber-950/50" },
      ],
    },
    {
      id: "organization",
      label: t.nav.organization || "Organization",
      icon: Building2,
      color: "text-emerald-500",
      items: [
        { label: t.nav.companies, href: "/core/organization/companies", icon: Building2, color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/50" },
        { label: t.nav.branches, href: "/core/organization/branches", icon: GitBranch, color: "text-teal-500 bg-teal-50 dark:bg-teal-950/50" },
        { label: t.nav.departments, href: "/core/organization/departments", icon: Layers, color: "text-cyan-500 bg-cyan-50 dark:bg-cyan-950/50" },
        { label: t.nav.teams, href: "/core/organization/teams", icon: Users, color: "text-sky-500 bg-sky-50 dark:bg-sky-950/50" },
        { label: t.nav.partyDirectory, href: "/core/party-directory", icon: FolderOpen, color: "text-violet-500 bg-violet-50 dark:bg-violet-950/50" },
      ],
    },
    {
      id: "financials",
      label: t.nav.financials || "Financials",
      icon: CreditCard,
      color: "text-amber-500",
      items: [
        { label: t.nav.billing, href: "/core/billing-invoices-subscription", icon: CreditCard, color: "text-amber-500 bg-amber-50 dark:bg-amber-950/50" },
        { label: t.nav.wallet, href: "/core/wallet-payments", icon: Wallet, color: "text-orange-500 bg-orange-50 dark:bg-orange-950/50" },
        { label: t.nav.currenciesTaxes, href: "/core/currencies-taxes-numbering", icon: DollarSign, color: "text-yellow-500 bg-yellow-50 dark:bg-yellow-950/50" },
      ],
    },
    {
      id: "operationsAndContent",
      label: t.nav.operationsAndContent || "Operations & Content",
      icon: Activity,
      color: "text-purple-500",
      items: [
        { label: t.nav.activities, href: "/core/activities", icon: Activity, color: "text-purple-500 bg-purple-50 dark:bg-purple-950/50" },
        { label: t.nav.businessLetters, href: "/core/business-letters", icon: FileText, color: "text-pink-500 bg-pink-50 dark:bg-pink-950/50" },
        { label: t.nav.templates, href: "/core/template-platform", icon: FileCode, color: "text-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-950/50" },
        { label: t.nav.signedDownloads, href: "/core/core-signed-file-downloads", icon: Download, color: "text-violet-500 bg-violet-50 dark:bg-violet-950/50" },
      ],
    },
    {
      id: "workspaceSettings",
      label: t.nav.workspaceSettings || "Workspace Settings",
      icon: Settings,
      color: "text-slate-500",
      items: [
        { label: t.nav.workspaceSettings, href: "/core/workspace-settings-branding", icon: Settings, color: "text-slate-600 bg-slate-100 dark:bg-slate-800" },
        { label: t.nav.emailConfig, href: "/core/notifications-email-configuration", icon: Mail, color: "text-blue-500 bg-blue-50 dark:bg-blue-950/50" },
        { label: t.nav.provisioningUpdates, href: "/core/provisioning-updates", icon: RefreshCw, color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/50" },
        { label: t.nav.hostStatus, href: "/core/host-status", icon: Server, color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/50" },
      ],
    },
  ];

  return (
    <nav className="flex items-center gap-1" ref={navRef}>
      <Link
        href="/"
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
          pathname === "/"
            ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/80 shadow-xs"
            : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
        }`}
      >
        <LayoutDashboard className={`w-3.5 h-3.5 ${pathname === "/" ? "text-blue-600 dark:text-blue-400" : "text-slate-500"}`} />
        <span>{t.nav.dashboard || "Dashboard"}</span>
      </Link>

      {navGroups.map((group) => {
        const GroupIcon = group.icon;
        const isGroupActive = group.items.some((item) => pathname.startsWith(item.href));
        const isOpen = activeDropdown === group.id;

        return (
          <div key={group.id} className="relative">
            <button
              type="button"
              onClick={() => toggleDropdown(group.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                isGroupActive || isOpen
                  ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/80 shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <GroupIcon className={`w-3.5 h-3.5 ${isGroupActive || isOpen ? "text-blue-600 dark:text-blue-400" : group.color}`} />
              <span>{group.label}</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
              <div className="absolute top-full mt-1.5 start-0 z-50 w-60 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-1.5 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {group.label}
                </div>
                {group.items.map((sub) => {
                  const SubIcon = sub.icon;
                  const isSubActive = pathname === sub.href;
                  return (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      onClick={() => setActiveDropdown(null)}
                      className={`flex items-center gap-2.5 p-1.5 rounded-xl text-xs transition-colors ${
                        isSubActive
                          ? "bg-blue-50/80 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-bold"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium"
                      }`}
                    >
                      <div className={`p-1 rounded-lg shrink-0 ${sub.color}`}>
                        <SubIcon className="w-3.5 h-3.5" />
                      </div>
                      <span className="truncate">{sub.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
