import Link from "next/link";
import { ArrowLeft, ArrowRight, Edit2, Play, StopCircle, PowerOff, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useI18n } from "@/i18n/I18nContext";
import { PageHeader, Button } from "@/design-system";
import type { DatabaseServerView } from "../types";
import type { LifecycleAction } from "../hooks/useDatabaseServerDetailPage";

interface DatabaseServerHeaderHeroProps {
  server: DatabaseServerView;
  canUpdate: boolean;
  canDelete: boolean;
  onEditMetadata: () => void;
  onLifecycleAction: (action: LifecycleAction) => void;
  onDeleteHost: () => void;
}

export function DatabaseServerHeaderHero({
  server,
  canUpdate,
  canDelete,
  onEditMetadata,
  onLifecycleAction,
  onDeleteHost,
}: DatabaseServerHeaderHeroProps) {
  const { dir, t } = useI18n();
  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;
  const d = t.databaseServerDetail;

  return (
    <PageHeader
      breadcrumb={
        <Button variant="link" size="sm" asChild className="w-fit px-0">
          <Link href="/database-servers">
            <BackIcon className="size-4" aria-hidden="true" />
            {d.backToList}
          </Link>
        </Button>
      }
      title={server.name}
      status={<StatusBadge status={server.status} enumType="db-server" />}
      description={`${server.host}:${server.port} · ${server.countryName || server.countryIsoCode}`}
      action={
        <div className="flex flex-wrap items-center gap-2">
          {canUpdate && (
            <Button type="button" variant="outline" size="sm" onClick={onEditMetadata}>
              <Edit2 className="size-3.5" /> {d.editMetadata}
            </Button>
          )}
          {canUpdate && server.status !== "ACTIVE" && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => onLifecycleAction("activate")}
              disabled={server.credentialBootstrap.status !== "READY"}
              title={server.credentialBootstrap.status === "READY" ? d.activateServer : d.readiness.subtitle}
            >
              <Play className="size-3.5" /> {d.activateServer}
            </Button>
          )}
          {canUpdate && server.status === "ACTIVE" && (
            <Button type="button" variant="outline" size="sm" onClick={() => onLifecycleAction("drain")}>
              <StopCircle className="size-3.5 text-warn-500" /> {d.drainConnections}
            </Button>
          )}
          {canUpdate && server.status !== "OFFLINE" && (
            <Button type="button" variant="outline" size="sm" onClick={() => onLifecycleAction("offline")}>
              <PowerOff className="size-3.5" /> {d.takeOffline}
            </Button>
          )}
          {canDelete && (server.status === "OFFLINE" || server.status === "DRAINING") && server.currentTenants === 0 && (
            <Button type="button" variant="destructive" size="sm" onClick={onDeleteHost}>
              <Trash2 className="size-3.5" /> {d.deleteHost}
            </Button>
          )}
        </div>
      }
    />
  );
}
