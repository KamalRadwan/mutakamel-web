"use client";

import { PhoneCall, Edit2, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
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
    <div className="bg-card rounded-xl border border-border shadow-2xs overflow-hidden">
      <div className="p-4 border-b border-border bg-ink-100/50 dark:bg-ink-800/30 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-foreground flex items-center gap-2">
          <PhoneCall className="w-4 h-4 text-muted-foreground" />
          <span>{t.users.webphoneSummary}</span>
        </h2>
        {canEdit && (
          <button
            onClick={onEditToggle}
            className="px-2.5 py-1 text-xs font-semibold text-brand-700 dark:text-brand-400 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/40 dark:hover:bg-brand-900/60 border border-brand-200 dark:border-brand-800 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Edit2 className="w-3 h-3" />
            <span>{t.users.editWebphone}</span>
          </button>
        )}
      </div>

      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
        <div>
          <span className="block text-xs text-muted-foreground mb-1">{t.users.status}</span>
          {webphone?.enabled ? (
            <span className="inline-flex items-center gap-1 text-xs text-brand-700 bg-brand-50 border border-brand-200 dark:bg-brand-900/30 dark:border-brand-800 dark:text-brand-400 px-2 py-0.5 rounded-md font-medium">
              <CheckCircle2 className="w-3 h-3" />
              {t.users.enabledBadge}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-ink-100 border border-border dark:bg-ink-800 dark:border-border px-2 py-0.5 rounded-md font-medium">
              <XCircle className="w-3 h-3" />
              {t.users.disabledBadge}
            </span>
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

      <div className="p-3 bg-ink-100/80 dark:bg-ink-800/40 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
          {webphone?.passwordConfigured ? t.users.passwordConfigured : t.users.noPasswordConfigured}
        </span>
      </div>
    </div>
  );
}
