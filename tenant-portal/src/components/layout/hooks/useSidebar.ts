"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
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
  FolderGit2,
  UserCircle,
  Kanban,
  GitCommit,
  History,
  Sliders,
  Share2,
  Calendar,
  Paperclip,
  Send,
  Layout,
  Database,
  Code,
  FileSpreadsheet,
  Package,
  Boxes,
  CreditCard as CreditCardIcon,
  Tag,
  Receipt,
  FileCheck,
  ShoppingCart,
  FileDigit,
  FileBadge,
  SlidersHorizontal,
  FileCode2,
  Puzzle,
  GitBranch,
  Webhook,
  Sparkles,
  Compass
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

export function useSidebar() {
  const pathname = usePathname();
  const { t, dir } = useI18n();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const savedState = localStorage.getItem("tenant_sidebar_collapsed");
    if (savedState !== null) {
      setIsCollapsed(savedState === "true");
    }
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const newState = !prev;
      localStorage.setItem("tenant_sidebar_collapsed", String(newState));
      return newState;
    });
  };

  const isCRM = pathname.startsWith("/crm");
  const isTrade = pathname.startsWith("/trade");

  // 1. Core / Workspace Center Navigation Items
  const coreNavItems: NavItem[] = [
    { label: t.nav.dashboard, href: "/", icon: LayoutDashboard },
    { label: t.nav.users, href: "/core/users", icon: Users },
    { label: t.nav.organization, href: "/core/organization", icon: Building2 },
    { label: t.nav.roles, href: "/core/roles-role-assignments", icon: ShieldCheck },
    { label: t.nav.billing, href: "/core/billing-invoices-subscription", icon: CreditCard },
    { label: t.nav.wallet, href: "/core/wallet-payments", icon: Wallet },
    { label: t.nav.activities, href: "/core/activities", icon: Activity },
    { label: t.nav.partyDirectory, href: "/core/party-directory", icon: FolderOpen },
    { label: t.nav.businessLetters, href: "/core/business-letters", icon: FileText },
    { label: t.nav.currenciesTaxes, href: "/core/currencies-taxes-numbering", icon: DollarSign },
    { label: t.nav.templates, href: "/core/template-platform", icon: FileCode },
    { label: t.nav.emailConfig, href: "/core/notifications-email-configuration", icon: Mail },
    { label: t.nav.authentication, href: "/core/authentication", icon: Lock },
    { label: t.nav.moduleAssignments, href: "/core/user-module-assignments", icon: UserCheck },
    { label: t.nav.provisioningUpdates, href: "/core/provisioning-updates", icon: RefreshCw },
    { label: t.nav.signedDownloads, href: "/core/core-signed-file-downloads", icon: Download },
    { label: t.nav.hostStatus, href: "/core/host-status", icon: Server },
    { label: t.nav.workspaceSettings, href: "/core/workspace-settings-branding", icon: Settings },
  ];

  // 2. CRM Navigation Items
  const crmNavItems: NavItem[] = [
    { label: t.nav.crmDashboard, href: "/crm/dashboard", icon: LayoutDashboard },
    { label: t.nav.leads, href: "/crm/leads", icon: FolderGit2 },
    { label: t.nav.customerProfiles, href: "/crm/customer-profiles", icon: UserCircle },
    { label: t.nav.pipelines, href: "/crm/pipelines-boards-opportunity-stages", icon: Kanban },
    { label: t.nav.leadStages, href: "/crm/lead-stages", icon: GitCommit },
    { label: t.nav.opportunitiesHistory, href: "/crm/opportunities-stage-history", icon: History },
    { label: t.nav.customFields, href: "/crm/custom-fields", icon: Sliders },
    { label: t.nav.acquisitionSources, href: "/crm/acquisition-sources", icon: Share2 },
    { label: t.nav.crmActivities, href: "/crm/activities-tasks-calendar-reminders", icon: Calendar },
    { label: t.nav.notesAttachments, href: "/crm/notes-attachments", icon: Paperclip },
    { label: t.nav.outboundEmails, href: "/crm/outbound-emails", icon: Send },
    { label: t.nav.crmDashboardBuilder, href: "/crm/dashboard-builder-widgets", icon: Layout },
    { label: t.nav.staticData, href: "/crm/static-data-catalogue", icon: Database },
    { label: t.nav.crmSettings, href: "/crm/settings", icon: Settings },
    { label: t.nav.apiDocs, href: "/crm/api-documentation", icon: Code },
    { label: t.nav.browserContracts, href: "/crm/common-browser-contract", icon: FileSpreadsheet },
    { label: t.nav.browserExamples, href: "/crm/browser-examples", icon: FileCode2 },
  ];

  // 3. Trade Navigation Items
  const tradeNavItems: NavItem[] = [
    { label: t.nav.tradeDashboard, href: "/trade/dashboard-builder", icon: LayoutDashboard },
    { label: t.nav.controlTower, href: "/trade/control-tower", icon: Compass },
    { label: t.nav.inventory, href: "/trade/inventory", icon: Package },
    { label: t.nav.catalog, href: "/trade/catalog-uom-channels", icon: Boxes },
    { label: t.nav.commercialAccounts, href: "/trade/commercial-accounts-credit", icon: CreditCardIcon },
    { label: t.nav.pricing, href: "/trade/pricing-price-books", icon: Tag },
    { label: t.nav.quotations, href: "/trade/quotations-sales-orders", icon: Receipt },
    { label: t.nav.purchaseQuotations, href: "/trade/purchase-quotations", icon: FileCheck },
    { label: t.nav.purchaseOrders, href: "/trade/purchase-orders", icon: ShoppingCart },
    { label: t.nav.invoicesContracts, href: "/trade/invoices-contracts", icon: FileText },
    { label: t.nav.tradeDashboardWidgets, href: "/trade/dashboard-widgets", icon: Layout },
    { label: t.nav.pdfRenderJobs, href: "/trade/business-document-pdf-render-jobs", icon: FileDigit },
    { label: t.nav.documentProfilePlatform, href: "/trade/document-profile-platform", icon: FileBadge },
    { label: t.nav.configurationScope, href: "/trade/configuration-scope", icon: SlidersHorizontal },
    { label: t.nav.policyStudio, href: "/trade/policy-studio", icon: FileCode2 },
    { label: t.nav.extensionProfiles, href: "/trade/extension-profiles", icon: Puzzle },
    { label: t.nav.workflowVersions, href: "/trade/workflow-versions", icon: GitBranch },
    { label: t.nav.importsWebhooks, href: "/trade/imports-webhooks", icon: Webhook },
    { label: t.nav.aiGuide, href: "/trade/ai-implementation-guide-for-portal-trade", icon: Sparkles },
  ];

  const activeNavItems = isCRM ? crmNavItems : isTrade ? tradeNavItems : coreNavItems;
  const currentAppTitle = isCRM ? "CRM" : isTrade ? "Trade" : t.nav.workspaceCenter;

  const isItemActive = (href: string) => {
    if (href === "/" || href === "/crm" || href === "/trade") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return {
    t,
    dir,
    pathname,
    currentAppTitle,
    activeNavItems,
    isItemActive,
    isCollapsed,
    toggleCollapse,
  };
}
