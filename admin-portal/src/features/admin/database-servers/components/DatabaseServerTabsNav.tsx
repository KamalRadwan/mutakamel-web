import type { ReactNode } from "react";
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
  children: ReactNode;
}

export function DatabaseServerTabsNav({
  activeTab,
  onTabChange,
  bindingsCount,
  historyCount,
  bootstrapStatus,
  children,
}: DatabaseServerTabsNavProps) {
  const { lang, t } = useI18n();
  const d = t.databaseServerDetail.tabs;

  const tabs: {
    id: DatabaseServerTab;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: string | number;
    badgeTone?: "success" | "warn" | "danger" | "neutral";
  }[] = [
    { id: "overview", label: d.overview, icon: LayoutDashboard },
    {
      id: "readiness",
      label: d.readiness,
      icon: ShieldCheck,
      badge: bootstrapStatus,
      badgeTone: bootstrapStatus === "READY" ? "success" : bootstrapStatus === "DEGRADED" ? "danger" : "warn",
    },
    { id: "bindings", label: d.bindings, icon: Database, badge: bindingsCount, badgeTone: "neutral" },
    { id: "security", label: d.security, icon: Lock },
    { id: "history", label: d.history, icon: History, badge: historyCount, badgeTone: "neutral" },
  ];

  return (
    <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as DatabaseServerTab)} dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="overflow-x-auto rounded-lg border border-border bg-muted p-1.5">
        <TabsList
          aria-label={lang === "ar" ? "تفاصيل خادم قاعدة البيانات" : "Database server details"}
          className="h-auto min-w-max border-b-0 bg-transparent"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="h-(--size-control-lg) gap-2 rounded-md px-3 data-[state=active]:bg-info-subtle data-[state=active]:text-info-subtle-foreground after:hidden"
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {tab.label}
                {tab.badge !== undefined && <Badge tone={tab.badgeTone ?? "neutral"}>{tab.badge}</Badge>}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>
      {children}
    </Tabs>
  );
}
