import { Server, Globe, Shield, Clock, HardDrive, Cpu, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { Card, StatGrid, StatCard, StatusBadge } from "@/design-system";
import type { DatabaseServerView } from "../../types";

interface DatabaseServerOverviewTabProps {
  server: DatabaseServerView;
}

export function DatabaseServerOverviewTab({ server }: DatabaseServerOverviewTabProps) {
  const { lang, t } = useI18n();
  const d = t.databaseServerDetail.overview;

  const usageRatio = server.maxTenants > 0 ? Math.min(100, Math.round((server.currentTenants / server.maxTenants) * 100)) : 0;
  const sslStatus =
    server.sslMode === "disable"
      ? { label: d.sslStatusDisabled, tone: "danger" as const }
      : server.hasSslConfig
        ? { label: d.sslStatusBundleConfigured, tone: "brand" as const }
        : server.sslRejectUnauthorized
          ? { label: d.sslStatusStrict, tone: "brand" as const }
          : { label: d.sslStatusRelaxed, tone: "warn" as const };

  return (
    <div className="space-y-6">
      <StatGrid>
        <StatCard label={d.maxCapacity} value={server.maxTenants} description={d.maxCapacitySub} icon={HardDrive} />
        <StatCard label={d.currentTenants} value={server.currentTenants} description={d.currentTenantsSub} icon={Cpu} />
        <StatCard label={d.sslSecurityMode} value={server.sslMode.toUpperCase()} description={sslStatus.label} icon={Shield} tone={sslStatus.tone} />
        <StatCard label={d.connectTimeout} value={`${server.connectTimeoutMs}ms`} description={lang === "ar" ? "حد محاولة الاتصال" : "Connection attempt limit"} icon={Clock} />
      </StatGrid>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{d.capacityUtilization}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {d.tenantPlacementStatus}: <span className="font-semibold text-foreground">{server.currentTenants} / {server.maxTenants}</span>
            </p>
          </div>
          <span className="font-mono text-lg font-semibold text-foreground">{usageRatio}%</span>
        </div>
        <div
          role="progressbar"
          aria-label={d.capacityUtilization}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={usageRatio}
          aria-valuetext={`${server.currentTenants} / ${server.maxTenants}`}
          className="h-2.5 overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-info transition-[width] motion-reduce:transition-none" style={{ width: `${usageRatio}%` }} />
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h3 className="flex items-center gap-2 border-b border-border pb-3 text-sm font-semibold text-foreground">
            <Server className="size-4 text-info" aria-hidden="true" />
            {d.hostInformation}
          </h3>
          <dl className="mt-3 space-y-2.5 text-xs">
            <div className="flex flex-wrap justify-between gap-2 border-b border-border py-2">
              <dt className="font-medium text-muted-foreground">{d.hostAddress}</dt>
              <dd className="font-mono font-semibold text-foreground">{server.host}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-b border-border py-2">
              <dt className="font-medium text-muted-foreground">{d.port}</dt>
              <dd className="font-mono font-semibold text-foreground">{server.port}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-b border-border py-2">
              <dt className="font-medium text-muted-foreground">{d.countryRegion}</dt>
              <dd className="flex items-center gap-1.5 font-semibold text-foreground">
                <Globe className="size-3.5 text-muted-foreground" aria-hidden="true" />
                {server.countryName || server.countryIsoCode}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-b border-border py-2">
              <dt className="font-medium text-muted-foreground">{d.placementStatus}</dt>
              <dd><StatusBadge status={server.status} enumType="db-server" /></dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 py-2">
              <dt className="font-medium text-muted-foreground">{d.createdAt}</dt>
              <dd className="font-mono text-foreground">{new Date(server.createdAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5">
          <h3 className="flex items-center gap-2 border-b border-border pb-3 text-sm font-semibold text-foreground">
            <CheckCircle2 className="size-4 text-info" aria-hidden="true" />
            {d.connectionParameters}
          </h3>
          <div className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
            <div className="space-y-2 rounded-lg border border-border bg-muted p-4">
              <div className="font-mono text-xs font-semibold uppercase text-info-subtle-foreground">
                {d.driverConfigLabel}
              </div>
              <div className="break-all rounded-lg border border-border bg-card p-2.5 font-mono text-xs text-foreground">
                postgres://[principal]:***@{server.host}:{server.port}/[tenant_db]?sslmode={server.sslMode}&connect_timeout={Math.round(server.connectTimeoutMs / 1000)}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{d.driverConfigNote}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
