import { Server, Database, Activity, CheckCircle, AlertOctagon, Cpu, HardDrive, ShieldCheck, Globe, BarChart3, Layers, TrendingUp } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ServerCapacityChart } from "./charts/ServerCapacityChart";
import { ServerLatencyScatterChart } from "./charts/ServerLatencyScatterChart";
import { TenantStatusDonutChart } from "./charts/TenantStatusDonutChart";
import { SaaSHealthIndexGauge } from "./charts/SaaSHealthIndexGauge";
import { RegionalDistributionBarChart } from "./charts/RegionalDistributionBarChart";
import { TenantGrowthRevenueChart } from "./charts/TenantGrowthRevenueChart";
import { TenantTreemapChart } from "./charts/TenantTreemapChart";
import { DashboardViewMode } from "./DashboardHeader";
import { toneToColorClass } from "../utils/formatters";

interface ServersTabProps {
  extraCards?: any[];
  servers: Array<{
    id: string;
    name: string;
    hostAddress: string;
    port: number;
    currentTenants: number;
    maxTenants: number;
    utilization: number; // 0..1
    placementStatus: string;
    region?: string;
  }>;
}

export function ServersTab({ servers, extraCards = [] }: ServersTabProps) {
  const { t } = useI18n();

  const highCapacityServers = servers.filter((s) => s.utilization >= 0.85);

  // Compute stats for charts
  const totalCapacity = servers.reduce((acc, s) => acc + s.maxTenants, 0);
  const totalAssigned = servers.reduce((acc, s) => acc + s.currentTenants, 0);
  const overallRatio = totalCapacity > 0 ? totalAssigned / totalCapacity : 0;

  // Placement status donut data
  const statusCounts = servers.reduce((acc: any, s) => {
    const st = (s.placementStatus || "ACTIVE").toUpperCase();
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {});

  const placementDonutItems = [
    { key: "ACTIVE", label: "Active Servers", count: statusCounts["ACTIVE"] || servers.length, ratio: (statusCounts["ACTIVE"] || servers.length) / Math.max(servers.length, 1), tone: "green" as any, description: "Serving requests" },
    { key: "DRAINING", label: "Draining", count: statusCounts["DRAINING"] || 0, ratio: (statusCounts["DRAINING"] || 0) / Math.max(servers.length, 1), tone: "amber" as any, description: "Phase-out mode" },
    { key: "OFFLINE", label: "Offline", count: statusCounts["OFFLINE"] || 0, ratio: (statusCounts["OFFLINE"] || 0) / Math.max(servers.length, 1), tone: "red" as any, description: "Disconnected nodes" },
  ];

  // Region breakdown
  const mockRegions = [
    { key: "us-east", countryName: "US East (N. Virginia)", countryIsoCode: "US", count: Math.ceil(servers.length * 0.5), ratio: 0.5, tone: "blue" as any },
    { key: "eu-central", countryName: "EU Central (Frankfurt)", countryIsoCode: "DE", count: Math.floor(servers.length * 0.3), ratio: 0.3, tone: "purple" as any },
    { key: "mena-riyadh", countryName: "MENA (Riyadh)", countryIsoCode: "SA", count: Math.floor(servers.length * 0.2), ratio: 0.2, tone: "green" as any },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* High Utilization Alert Banner */}
      {highCapacityServers.length > 0 && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl flex items-start gap-3">
          <AlertOctagon className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300">
              {t.dashboard.serversTab.highCapacityAlertTitle} ({highCapacityServers.length})
            </h4>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              السيرفرات التالية تجاوزت 85% من طاقتها الاستيعابية:{" "}
              <span className="font-semibold">{highCapacityServers.map((s) => s.name).join(" ، ")}</span>.
            </p>
          </div>
        </div>
      )}

      {/* 10-CHART SUITE */}
      <div className="space-y-6">
        {/* Row 1: Donut (Placement Status) + Gauge (Cluster Health) + Stacked Progress */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Chart 1: Placement Status Donut */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-2xs flex flex-col justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Placement Status Donut</span>
            </h3>
              <div className="py-2">
                <TenantStatusDonutChart items={placementDonutItems} total={servers.length} height={180} />
              </div>
            </div>

            {/* Chart 2: Cluster Overall Capacity Gauge */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-2xs flex flex-col justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Cluster Utilization Gauge</span>
              </h3>
              <div className="py-2">
                <SaaSHealthIndexGauge score={Math.round(overallRatio * 100) || 75} height={180} />
              </div>
              <div className="text-center text-xs text-slate-500 font-mono font-semibold">
                {totalAssigned} / {totalCapacity} Max Tenants
              </div>
            </div>

            {/* Chart 3: Highest Use vs Headroom Comparison */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-2xs flex flex-col justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Host Load Headroom</span>
              </h3>
              <div className="space-y-3 py-1">
                {servers.slice(0, 3).map((s) => {
                  const pct = Math.round(s.utilization * 100);
                  return (
                    <div key={s.id} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-700 dark:text-slate-300">{s.name}</span>
                        <span className="font-mono text-purple-600">{pct}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div style={{ width: `${pct}%` }} className="h-full bg-purple-500 rounded-full" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Row 2: Capacity Stacked Bar + Latency Scatter */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 4: Capacity Comparison Bar */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>{t.dashboard.serversTab.capacityComparisonTitle}</span>
              </h3>
              <ServerCapacityChart servers={servers || []} height={220} />
            </div>

            {/* Chart 5: Server Latency vs Density Scatter Plot */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Latency vs Tenant Density</span>
              </h3>
              <ServerLatencyScatterChart
                data={servers.map((s) => ({
                  name: s.name,
                  tenants: s.currentTenants,
                  latencyMs: Math.round(12 + Math.random() * 18),
                  capacity: s.maxTenants,
                }))}
                height={220}
              />
            </div>
          </div>

          {/* Row 3: Node Treemap + Regional Footprint Bar Chart + Infrastructure Scaling Curve */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart 6: Node Capacity Treemap */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>Node Capacity Treemap</span>
              </h3>
              <TenantTreemapChart
                data={servers.map((s) => ({
                  name: s.name,
                  size: s.maxTenants,
                  color: s.utilization >= 0.85 ? "#ef4444" : s.utilization >= 0.7 ? "#f59e0b" : "#3b82f6",
                }))}
                height={180}
              />
            </div>

            {/* Chart 7: Region Placement Donut Chart */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Region Node Donut</span>
              </h3>
              <TenantStatusDonutChart
                items={mockRegions.map((r) => ({
                  key: r.key,
                  label: r.countryName,
                  count: r.count,
                  ratio: r.ratio,
                  tone: r.tone,
                  description: `${r.count} nodes`,
                }))}
                total={servers.length || mockRegions.reduce((acc, r) => acc + r.count, 0)}
                height={180}
              />
            </div>

            {/* Chart 8: Infrastructure Scaling Trajectory */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Scaling Trajectory Curve</span>
              </h3>
              <TenantGrowthRevenueChart
                points={servers.length > 0 ? servers.map((s, idx) => ({
                  month: s.name.replace("DB-", "").replace("-01", ""),
                  tenants: s.currentTenants,
                  collected: s.maxTenants,
                })) : [
                  { month: "Node 1", tenants: 25, collected: 50 },
                  { month: "Node 2", tenants: 38, collected: 50 },
                  { month: "Node 3", tenants: 42, collected: 50 },
                ]}
                height={180}
              />
            </div>
          </div>
        </div>

      {/* Database Servers List Grid */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-5 shadow-2xs">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Server className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>{t.dashboard.serversTab.capacityTitle}</span>
          </h3>
          <span className="text-xs text-slate-500 font-semibold">Total Nodes: {servers.length}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {servers.map((server) => {
            const utilizationPercent = server.utilization * 100;
            const dynamicTone = utilizationPercent >= 85 ? "danger" : utilizationPercent >= 70 ? "warning" : "success";
            const toneColor = toneToColorClass(dynamicTone as any);

            return (
              <div
                key={server.id}
                className={`p-4 bg-slate-50/70 dark:bg-slate-800/50 rounded-xl border ${toneColor.split(" ")[1]} border-current/20 space-y-3`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className={`text-xs font-bold flex items-center gap-2 ${toneColor.split(" ")[0]}`}>
                      <span>{server.name}</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{server.hostAddress}:{server.port}</p>
                  </div>
                  {server.placementStatus && (
                    <StatusBadge status={server.placementStatus as any} enumType="db-server" size="sm" />
                  )}
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-600 dark:text-slate-400">{t.dashboard.serversTab.currentVsMax}</span>
                    <span className={`font-bold ${toneColor.split(" ")[0]}`}>
                      {server.currentTenants} / {server.maxTenants} ({utilizationPercent.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${toneColor.split(" ")[0].replace("text-", "bg-")}`}
                      style={{ width: `${utilizationPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

