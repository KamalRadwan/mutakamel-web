import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Building2,
  LayoutGrid,
  CreditCard,
  Receipt,
  Database,
  HardDrive,
  DatabaseBackup,
  Rocket,
  Users,
  ShieldCheck,
  ScrollText,
  BarChart3,
  FileClock,
  Settings,
} from "lucide-react";

/**
 * The permission -> route mapping, as data. Covers all 54 (auth) + (shell)
 * routes — see docs/design-system/shell-and-navigation.md for the table
 * that proves nothing was skipped. useNavTree.ts filters this against the
 * exact same adminCan/adminCanAll/adminCanAny checks useNavbar.ts used,
 * just reshaped from hook-computed booleans into a data structure a
 * sidebar can iterate.
 */
export type NavPermission =
  | { kind: "public" }
  | { kind: "single"; permission: string }
  | { kind: "any"; permissions: readonly string[] }
  | { kind: "all"; permissions: readonly string[] };

export interface NavItem {
  key: string;
  labelKey: { en: string; ar: string };
  href: string;
  icon: LucideIcon;
  permission: NavPermission;
  /** Route prefixes this item should also read as "active" for (nested routes). */
  activePrefixes?: string[];
}

export interface NavSection {
  key: string;
  labelKey?: { en: string; ar: string };
  items: NavItem[];
  /** Pinned to the bottom of the sidebar (System/Settings). */
  pinned?: boolean;
}

const single = (permission: string): NavPermission => ({ kind: "single", permission });
const any = (...permissions: string[]): NavPermission => ({ kind: "any", permissions });

export const NAV_SECTIONS: NavSection[] = [
  {
    key: "overview",
    items: [
      {
        key: "dashboard",
        labelKey: { en: "Dashboard", ar: "لوحة التحكم" },
        href: "/dashboard",
        icon: LayoutDashboard,
        permission: single("admin.reports.read"),
      },
    ],
  },
  {
    key: "tenancy",
    labelKey: { en: "Tenancy", ar: "المستأجرون" },
    items: [
      {
        key: "tenants",
        labelKey: { en: "Tenants", ar: "المستأجرون" },
        href: "/tenants",
        icon: Building2,
        permission: single("admin.tenants.read"),
      },
      {
        key: "applications",
        labelKey: { en: "Applications", ar: "التطبيقات" },
        href: "/applications-catalogue",
        icon: LayoutGrid,
        permission: any("admin.applications.read", "admin.applications.create"),
      },
      {
        key: "subscriptions",
        labelKey: { en: "Subscriptions", ar: "الاشتراكات" },
        href: "/subscriptions",
        icon: CreditCard,
        permission: single("admin.subscriptions.read"),
      },
      {
        key: "invoices",
        labelKey: { en: "Invoices", ar: "الفواتير" },
        href: "/invoices",
        icon: Receipt,
        permission: single("admin.invoices.read"),
      },
    ],
  },
  {
    key: "infrastructure",
    labelKey: { en: "Infrastructure", ar: "البنية التحتية" },
    items: [
      {
        key: "database-servers",
        labelKey: { en: "Database Servers", ar: "خوادم قواعد البيانات" },
        href: "/database-servers",
        icon: Database,
        permission: any("admin.database_servers.read", "admin.database_servers.create"),
      },
      {
        key: "storage-servers",
        labelKey: { en: "Storage Servers", ar: "خوادم التخزين" },
        href: "/storage-servers",
        icon: HardDrive,
        permission: any("admin.storage_servers.read", "admin.storage_servers.create"),
      },
      {
        key: "backup",
        labelKey: { en: "Backup & Restore", ar: "النسخ الاحتياطي والاستعادة" },
        href: "/backup",
        icon: DatabaseBackup,
        permission: single("admin.backups.read"),
        activePrefixes: ["/backup"],
      },
      {
        key: "provisioning",
        labelKey: { en: "Provisioning", ar: "التجهيز" },
        href: "/provisioning",
        icon: Rocket,
        permission: any(
          "admin.tenants.read",
          "admin.provisioning.discovery.read",
          "admin.provisioning.rollouts.read",
          "admin.provisioning.rollouts.report",
          "admin.provisioning.publisher-keys.read",
          "admin.provisioning.releases.read",
        ),
        activePrefixes: ["/provisioning"],
      },
    ],
  },
  {
    key: "governance",
    labelKey: { en: "Governance", ar: "الحوكمة" },
    items: [
      {
        key: "users",
        labelKey: { en: "Admin staff", ar: "الموظفون" },
        href: "/users",
        icon: Users,
        permission: single("admin.users.read"),
      },
      {
        key: "roles",
        labelKey: { en: "Roles", ar: "الأدوار" },
        href: "/roles",
        icon: ShieldCheck,
        permission: single("admin.roles.read"),
      },
      {
        key: "audit",
        labelKey: { en: "Audit log", ar: "سجل التدقيق" },
        href: "/audit",
        icon: ScrollText,
        permission: single("admin.audit.read"),
      },
      {
        key: "reports",
        labelKey: { en: "Reports", ar: "التقارير" },
        href: "/reports",
        icon: BarChart3,
        permission: single("admin.reports.read"),
      },
      {
        key: "logging",
        labelKey: { en: "Logging", ar: "السجلات" },
        href: "/logging",
        icon: FileClock,
        permission: single("admin.logging.read"),
      },
    ],
  },
  {
    key: "system",
    pinned: true,
    items: [
      {
        key: "settings",
        labelKey: { en: "Settings", ar: "الإعدادات" },
        href: "/settings",
        icon: Settings,
        // Matches the pre-migration behavior: no page-level permission
        // gate on the settings index itself — each settings sub-page
        // enforces its own via SettingsResourceBoundary.
        permission: { kind: "public" },
        activePrefixes: ["/settings"],
      },
    ],
  },
];

/** The 6 backup SubNav items — see BackupModuleNav.tsx. */
export const BACKUP_SUBNAV: { href: string; labelKey: { en: string; ar: string } }[] = [
  { href: "/backup", labelKey: { en: "Overview", ar: "نظرة عامة" } },
  { href: "/backup/access", labelKey: { en: "Database Access", ar: "الوصول لقاعدة البيانات" } },
  { href: "/backup/policies", labelKey: { en: "Policies", ar: "السياسات" } },
  { href: "/backup/runs", labelKey: { en: "Runs", ar: "التشغيلات" } },
  { href: "/backup/artifacts", labelKey: { en: "Artifacts", ar: "الأرشيفات" } },
  { href: "/backup/restores", labelKey: { en: "Restores", ar: "الاستعادات" } },
];

/** The 8 settings SubNav items — see SettingsSidebar.tsx. */
export const SETTINGS_SUBNAV: { href: string; labelKey: { en: string; ar: string } }[] = [
  { href: "/settings/platform", labelKey: { en: "Platform & Branding", ar: "الهوية والهوية البصرية" } },
  { href: "/settings/auth", labelKey: { en: "Auth & Security", ar: "المصادقة والأمان" } },
  { href: "/settings/billing", labelKey: { en: "Billing & Gateways", ar: "الفواتير وبوابات الدفع" } },
  { href: "/settings/notifications", labelKey: { en: "Notifications & Alerts", ar: "الإشعارات والتنبيهات" } },
  // The WebPhone module replaced the `asterisk.*` settings keys and the
  // /settings/asterisk screen that edited them; that route no longer exists.
  { href: "/settings/webphone", labelKey: { en: "WebPhone", ar: "الهاتف المرئي" } },
  { href: "/settings/smtp", labelKey: { en: "Email (SMTP)", ar: "البريد الإلكتروني (SMTP)" } },
  { href: "/settings/fatal-alerts", labelKey: { en: "Fatal Alerts", ar: "التنبيهات الحرجة" } },
  { href: "/settings/storage", labelKey: { en: "Storage Runtime", ar: "تشغيل التخزين" } },
];
