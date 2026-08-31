"use client";

import { PhoneCall, Edit2, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { Badge, Button } from "@/design-system";
import type { AdminWebphoneConfig } from "../types";

export function WebphoneSummaryCard({
  webphone,
  canEdit,
  onEditToggle,
}: {
  webphone?: AdminWebphoneConfig | null;
  canEdit: boolean;
  onEditToggle: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-muted p-4">
        <h2 className="text-xs font-semibold text-foreground flex items-center gap-2">
          <PhoneCall className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>{t.users.webphoneSummary}</span>
        </h2>
        {canEdit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onEditToggle}
          >
            <Edit2 className="size-3.5" aria-hidden="true" />
            <span>{t.users.editWebphone}</span>
          </Button>
        )}
      </div>

      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
        <div>
          <span className="block text-xs text-muted-foreground mb-1">{t.users.status}</span>
          {webphone?.enabled ? (
            <Badge tone="success">
              <CheckCircle2 className="size-3" aria-hidden="true" />
              {t.users.enabledBadge}
            </Badge>
          ) : (
            <Badge tone="neutral">
              <XCircle className="size-3" aria-hidden="true" />
              {t.users.disabledBadge}
            </Badge>
          )}
        </div>

        <div>
          <span className="block text-xs text-muted-foreground mb-1">{t.users.sipExtension}</span>
          <span className="font-mono font-semibold text-foreground">
            {webphone?.extension || t.users.notConfigured}
          </span>
        </div>

        <div>
          <span className="block text-xs text-muted-foreground mb-1">{t.users.sipUsernameLabel}</span>
          <span className="font-mono font-semibold text-foreground">
            {webphone?.sipUsername || t.users.notConfigured}
          </span>
        </div>

        <div>
          <span className="block text-xs text-muted-foreground mb-1">{t.users.displayNameLabel}</span>
          <span className="font-semibold text-foreground">
            {webphone?.displayName || t.users.notConfigured}
          </span>
        </div>

        <div>
          <span className="block text-xs text-muted-foreground mb-1">{t.users.outboundCallerIdLabel}</span>
          <span className="font-mono font-semibold text-foreground">
            {webphone?.outboundCallerId || t.users.notConfigured}
          </span>
        </div>

        <div>
          <span className="block text-xs text-muted-foreground mb-1">{t.users.sipTransportLabel}</span>
          <span className="font-mono font-semibold uppercase text-foreground">
            {webphone?.transport || "wss"}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border bg-muted p-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {webphone?.passwordConfigured ? t.users.passwordConfigured : t.users.noPasswordConfigured}
        </span>
      </div>
    </div>
  );
}
