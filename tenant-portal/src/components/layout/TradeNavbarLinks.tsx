"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Compass, 
  Package, 
  Boxes, 
  CreditCard as CreditCardIcon, 
  Tag, 
  Receipt, 
  FileCheck, 
  ShoppingCart, 
  FileText, 
  Layout, 
  FileDigit, 
  FileBadge, 
  SlidersHorizontal, 
  FileCode2, 
  Puzzle, 
  GitBranch, 
  Webhook, 
  Sparkles,
  ChevronDown,
  Settings,
  Truck
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export function TradeNavbarLinks() {
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
      id: "operations",
      label: "Operations",
      icon: Truck,
      color: "text-blue-500",
      items: [
        { label: t.nav.controlTower || "Control Tower", href: "/trade/control-tower", icon: Compass, color: "text-blue-500 bg-blue-50 dark:bg-blue-950/50" },
        { label: t.nav.inventory || "Inventory", href: "/trade/inventory", icon: Package, color: "text-amber-500 bg-amber-50 dark:bg-amber-950/50" },
        { label: t.nav.catalog || "Catalog", href: "/trade/catalog-uom-channels", icon: Boxes, color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/50" },
        { label: t.nav.commercialAccounts || "Commercial Accounts", href: "/trade/commercial-accounts-credit", icon: CreditCardIcon, color: "text-purple-500 bg-purple-50 dark:bg-purple-950/50" },
        { label: t.nav.pricing || "Pricing", href: "/trade/pricing-price-books", icon: Tag, color: "text-cyan-500 bg-cyan-50 dark:bg-cyan-950/50" },
      ],
    },
    {
      id: "sales_procurement",
      label: "Sales & Procurement",
      icon: ShoppingCart,
      color: "text-emerald-500",
      items: [
        { label: t.nav.quotations || "Quotations", href: "/trade/quotations-sales-orders", icon: Receipt, color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/50" },
        { label: t.nav.purchaseQuotations || "Purchase Quotations", href: "/trade/purchase-quotations", icon: FileCheck, color: "text-teal-500 bg-teal-50 dark:bg-teal-950/50" },
        { label: t.nav.purchaseOrders || "Purchase Orders", href: "/trade/purchase-orders", icon: ShoppingCart, color: "text-rose-500 bg-rose-50 dark:bg-rose-950/50" },
        { label: t.nav.invoicesContracts || "Invoices & Contracts", href: "/trade/invoices-contracts", icon: FileText, color: "text-violet-500 bg-violet-50 dark:bg-violet-950/50" },
      ],
    },
    {
      id: "system",
      label: "System & Config",
      icon: Settings,
      color: "text-slate-500",
      items: [
        { label: t.nav.tradeDashboardWidgets || "Dashboard Widgets", href: "/trade/dashboard-widgets", icon: Layout, color: "text-blue-500 bg-blue-50 dark:bg-blue-950/50" },
        { label: t.nav.pdfRenderJobs || "PDF Render Jobs", href: "/trade/business-document-pdf-render-jobs", icon: FileDigit, color: "text-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-950/50" },
        { label: t.nav.documentProfilePlatform || "Document Profile Platform", href: "/trade/document-profile-platform", icon: FileBadge, color: "text-amber-500 bg-amber-50 dark:bg-amber-950/50" },
        { label: t.nav.configurationScope || "Configuration Scope", href: "/trade/configuration-scope", icon: SlidersHorizontal, color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/50" },
        { label: t.nav.policyStudio || "Policy Studio", href: "/trade/policy-studio", icon: FileCode2, color: "text-cyan-500 bg-cyan-50 dark:bg-cyan-950/50" },
        { label: t.nav.extensionProfiles || "Extension Profiles", href: "/trade/extension-profiles", icon: Puzzle, color: "text-purple-500 bg-purple-50 dark:bg-purple-950/50" },
        { label: t.nav.workflowVersions || "Workflow Versions", href: "/trade/workflow-versions", icon: GitBranch, color: "text-sky-500 bg-sky-50 dark:bg-sky-950/50" },
        { label: t.nav.importsWebhooks || "Imports & Webhooks", href: "/trade/imports-webhooks", icon: Webhook, color: "text-teal-500 bg-teal-50 dark:bg-teal-950/50" },
        { label: t.nav.aiGuide || "AI Implementation Guide", href: "/trade/ai-implementation-guide-for-portal-trade", icon: Sparkles, color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/50" },
      ],
    },
  ];

  return (
    <nav className="flex items-center gap-1" ref={navRef}>
      <Link
        href="/trade/dashboard-builder"
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
          pathname === "/trade/dashboard-builder"
            ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/80 shadow-xs"
            : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
        }`}
      >
        <LayoutDashboard className={`w-3.5 h-3.5 ${pathname === "/trade/dashboard-builder" ? "text-blue-600 dark:text-blue-400" : "text-slate-500"}`} />
        <span>{t.nav.tradeDashboard || "Trade Dashboard"}</span>
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
              <div className="absolute top-full mt-1.5 start-0 z-50 w-64 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-1.5 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150 max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
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
