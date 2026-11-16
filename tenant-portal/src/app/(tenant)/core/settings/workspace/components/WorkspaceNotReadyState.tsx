"use client";

import Link from "next/link";
import { Clock8, RefreshCw } from "lucide-react";
import { Button, Card, CardContent, EmptyState } from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";

interface WorkspaceNotReadyStateProps {
  t: Dictionary;
  isLoading: boolean;
  onReload: () => void;
}

export function WorkspaceNotReadyState({
  t,
  isLoading,
  onReload,
}: WorkspaceNotReadyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-6">
        <EmptyState
          icon={Clock8}
          title={t.coreSettings.workspaceNotReadyTitle}
          description={t.coreSettings.workspaceNotReadyDescription}
        />

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button size="sm" variant="outline" onClick={onReload} disabled={isLoading}>
            <RefreshCw
              className={isLoading ? "size-3.5 animate-spin" : "size-3.5"}
              aria-hidden="true"
            />
            {t.coreSettings.reload}
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={TENANT_ROUTES.gettingStarted}>
              {t.coreSettings.workspaceUi.notReadyCheckGettingStarted}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
