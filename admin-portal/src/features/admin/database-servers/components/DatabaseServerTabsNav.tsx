import { LayoutDashboard, ShieldCheck, Database, Lock, History } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { Tabs, TabsList, TabsTrigger, Badge } from "@/design-system";
import type { DatabaseServerTab } from "../hooks/useDatabaseServerDetailPage";

interface DatabaseServerTabsNavProps {
  activeTab: DatabaseServerTab;
  onTabChange: (tab: DatabaseServerTab) => void;
  bindingsCount: number;
  historyCount: number;
  bootstrapStatus: string;
}

export function DatabaseServerTabsNav({
  activeTab,
  onTabChange,
  bindingsCount,
  historyCount,
  bootstrapStatus,
}: DatabaseServerTabsNavProps) {
  const { t } = useI18n();
  const d = t.databaseServerDetail.tabs;

  const tabs: {
    id: DatabaseServerTab;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: string | number;
    badgeTone?: "brand" | "warn" | "danger" | "neutral";
  }[] = [
    { id: "overview", label: d.overview, icon: LayoutDashboard },
    {
      id: "readiness",
      label: d.readiness,
      icon: ShieldCheck,
      badge: bootstrapStatus,
      badgeTone: bootstrapStatus === "READY" ? "brand" : bootstrapStatus === "DEGRADED" ? "danger" : "warn",
    },
    { id: "bindings", label: d.bindings, icon: Database, badge: bindingsCount, badgeTone: "neutral" },
    { id: "security", label: d.security, icon: Lock },
    { id: "history", label: d.history, icon: History, badge: historyCount, badgeTone: "neutral" },
  ];

  return (
    <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as DatabaseServerTab)}>
      <TabsList aria-label="Database Server Details Tabs" className="h-auto flex-wrap gap-1 border-b-0 bg-ink-100 p-1.5 dark:bg-ink-900/60">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="h-9 gap-2 rounded-md px-3 data-[state=active]:bg-card data-[state=active]:text-brand-700 data-[state=active]:shadow-sm dark:data-[state=active]:text-brand-400 after:hidden"
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {tab.label}
              {tab.badge !== undefined && <Badge tone={tab.badgeTone ?? "neutral"}>{tab.badge}</Badge>}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
