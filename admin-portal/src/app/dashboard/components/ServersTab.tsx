"use client";

import { ReactNode } from "react";
import {
  AlertOctagon,
  BarChart3,
  Cpu,
  Globe,
  Layers,
  Server,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import {
  DashboardMetric,
  DashboardResponse,
} from "@/types/dashboard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { KpiCard } from "./KpiCard";
import { ServerCapacityChart } from "./charts/ServerCapacityChart";
import { TenantStatusDonutChart } from "./charts/TenantStatusDonutChart";
import { TenantTreemapChart } from "./charts/TenantTreemapChart";
import {
  EmptyDashboardPanel,
  UnavailableDashboardPanel,
} from "./DashboardDataState";

interface ServersTabProps {
  extraCards: DashboardMetric[];
  analytics: DashboardResponse["analytics"]["servers"];
}

export function ServersTab({ analytics, extraCards }: ServersTabProps) {
  const { t, lang } = useI18n();
  const servers = analytics.nodes.data;
  const regions = analytics.regions.data;
  const highCapacityServers = servers.filter(
    (server) => server.utilization >= 0.85,
  );
  const totalCapacity = servers.reduce(
    (sum, server) => sum + server.maxTenants,
    0,
  );
  const totalAssigned = servers.reduce(
    (sum, server) => sum + server.currentTenants,
    0,
  );
  const statusItems = ["ACTIVE", "DRAINING", "OFFLINE"]
    .map((status) => {
      const count = servers.filter((server) => server.status === status).length;
      return {
        key: status,
        label: humanize(status),
        count,
        ratio: servers.length > 0 ? count / servers.length : 0,
        tone:
          status === "ACTIVE"
            ? ("green" as const)
            : status === "DRAINING"
              ? ("amber" as const)
              : ("red" as const),
        description: `${count} ${count === 1 ? "node" : "nodes"}`,
      };
    })
    .filter((item) => item.count > 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {highCapacityServers.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/60 dark:bg-amber-950/30">
          <AlertOctagon className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300">
              {t.dashboard.serversTab.highCapacityAlertTitle} (
              {highCapacityServers.length})
            </h4>
            <p className="text-xs leading-5 text-amber-700 dark:text-amber-400">
              {lang === "ar"
                ? "تجاوزت هذه الخوادم 85% من السعة: "
                : "These servers exceeded 85% utilization: "}
              <span className="font-semibold">
                {highCapacityServers.map((server) => server.name).join("، ")}
              </span>
            </p>
          </div>
        </div>
      )}

      {extraCards.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {extraCards.map((card) => (
            <KpiCard key={card.key} card={card} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard
          title={lang === "ar" ? "حالة الخوادم" : "Server Status"}
          icon={<Server className="size-4 text-emerald-500" />}
        >
          {statusItems.length ? (
            <TenantStatusDonutChart
              items={statusItems}
              total={servers.length}
              height={210}
            />
          ) : (
            <EmptyInline />
          )}
        </ChartCard>

        <ChartCard
          title={lang === "ar" ? "استخدام السعة" : "Cluster Capacity"}
          icon={<Cpu className="size-4 text-blue-500" />}
        >
          <div className="flex h-52 flex-col items-center justify-center gap-3">
            <p className="text-4xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
              {totalCapacity > 0
                ? `${Math.round((totalAssigned / totalCapacity) * 100)}%`
                : "0%"}
            </p>
            <p className="text-xs font-semibold tabular-nums text-slate-500">
              {totalAssigned} / {totalCapacity}{" "}
              {lang === "ar" ? "مستأجر" : "tenants"}
            </p>
            <div className="h-3 w-full max-w-64 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-blue-500"
                style={{
                  width: `${
                    totalCapacity > 0
                      ? Math.min((totalAssigned / totalCapacity) * 100, 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title={lang === "ar" ? "التوزيع الإقليمي" : "Regional Footprint"}
          icon={<Globe className="size-4 text-indigo-500" />}
        >
          {regions.length ? (
            <TenantStatusDonutChart
              items={regions.map((region) => ({
                key: region.key,
                label: region.countryName,
                count: region.count,
                ratio: region.ratio,
                tone: region.tone,
                description: `${region.count} ${
                  region.count === 1 ? "node" : "nodes"
                }`,
              }))}
              total={servers.length}
              height={210}
            />
          ) : (
            <EmptyInline />
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title={t.dashboard.serversTab.capacityComparisonTitle}
          icon={<BarChart3 className="size-4 text-purple-500" />}
        >
          {servers.length ? (
            <ServerCapacityChart servers={servers} height={260} />
          ) : (
            <EmptyInline />
          )}
        </ChartCard>

        <ChartCard
          title={lang === "ar" ? "سعة العقد" : "Node Capacity Map"}
          icon={<Layers className="size-4 text-cyan-500" />}
        >
          {servers.length ? (
            <TenantTreemapChart
              data={servers.map((server) => ({
                name: server.name,
                size: server.maxTenants,
                color:
                  server.utilization >= 0.85
                    ? "#ef4444"
                    : server.utilization >= 0.7
                      ? "#f59e0b"
                      : "#3b82f6",
              }))}
              height={260}
            />
          ) : (
            <EmptyInline />
          )}
        </ChartCard>

        <UnavailableDashboardPanel
          title={lang === "ar" ? "الزمن المستغرق للشبكة" : "Server Latency"}
          dataset={analytics.latency}
        />
        <UnavailableDashboardPanel
          title={lang === "ar" ? "تاريخ السعة" : "Capacity History"}
          dataset={analytics.capacityHistory}
        />
      </div>

      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <Server className="size-4 text-purple-500" />
            <span>{t.dashboard.serversTab.capacityTitle}</span>
          </h3>
          <span className="text-xs font-semibold text-slate-500">
            {lang === "ar" ? "إجمالي العقد" : "Total nodes"}: {servers.length}
          </span>
        </div>

        {servers.length === 0 ? (
          <EmptyInline />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {servers.map((server) => {
              const utilizationPercent = server.utilization * 100;
              const barColor =
                utilizationPercent >= 85
                  ? "bg-red-500"
                  : utilizationPercent >= 70
                    ? "bg-amber-500"
                    : "bg-emerald-500";

              return (
                <article
                  key={server.id}
                  className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                        {server.name}
                      </h4>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {server.metadata || (lang === "ar" ? "بدون منطقة" : "No region")}
                      </p>
                    </div>
                    <StatusBadge
                      status={server.status}
                      enumType="db-server"
                      size="sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">
                        {t.dashboard.serversTab.currentVsMax}
                      </span>
                      <span className="font-bold tabular-nums text-slate-800 dark:text-slate-100">
                        {server.currentTenants} / {server.maxTenants} (
                        {utilizationPercent.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{
                          width: `${Math.min(utilizationPercent, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function ChartCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-h-72 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
        {icon}
        <span>{title}</span>
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyInline() {
  return (
    <EmptyDashboardPanel
      title="No data"
      className="min-h-40 border-0 bg-transparent p-0 shadow-none"
    />
  );
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
