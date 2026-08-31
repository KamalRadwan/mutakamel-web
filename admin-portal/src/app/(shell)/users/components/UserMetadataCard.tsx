"use client";

import { Clock, ShieldAlert, Calendar, Copy } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useToast } from "@/components/ui/ToastContext";
import { Badge, Button } from "@/design-system";
import type { AdminUser } from "../types";

export function UserMetadataCard({ user }: { user: AdminUser }) {
  const { lang, t } = useI18n();
  const toast = useToast();

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return t.users.neverLoggedIn;
    try {
      return new Date(dateStr).toLocaleString(lang === "ar" ? "ar-EG" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return dateStr;
    }
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(user.id);
      toast.success(t.users.copiedTitle, t.users.copiedDesc);
    } catch {
      toast.error(t.users.copyFailedTitle, t.users.copyFailedDesc);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-muted p-4">
        <h2 className="text-xs font-semibold text-foreground flex items-center gap-2">
          <Calendar className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>{t.users.metadataCardTitle}</span>
        </h2>
      </div>

      <div className="p-4 space-y-3.5 text-xs">
        <div className="flex items-center justify-between py-1 border-b border-border/50">
          <span className="text-muted-foreground">{t.users.lastLogin}</span>
          <span className="font-mono text-foreground flex items-center gap-1.5">
            <Clock className="size-3.5 text-muted-foreground" aria-hidden="true" />
            {formatDate(user.lastLoginAt)}
          </span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-border/50">
          <span className="text-muted-foreground">{t.users.createdAt}</span>
          <span className="font-mono text-foreground">
            {formatDate(user.createdAt)}
          </span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-border/50">
          <span className="text-muted-foreground">{t.users.updatedAt}</span>
          <span className="font-mono text-foreground">
            {formatDate(user.updatedAt)}
          </span>
        </div>

        {user.sessionVersion !== undefined && (
          <div className="flex items-center justify-between py-1 border-b border-border/50">
            <span className="text-muted-foreground">{t.users.sessionVersion}</span>
            <Badge tone="neutral" className="font-mono normal-case tracking-normal">
              v{user.sessionVersion}
            </Badge>
          </div>
        )}

        {user.failedLoginAttempts !== undefined && user.failedLoginAttempts > 0 && (
          <div className="flex items-center justify-between py-1 border-b border-border/50">
            <span className="text-muted-foreground">{t.users.failedLoginAttempts}</span>
            <Badge tone="danger" className="font-mono normal-case tracking-normal">
              <ShieldAlert className="size-3" aria-hidden="true" />
              {user.failedLoginAttempts}
            </Badge>
          </div>
        )}

        {user.lockedUntil && (
          <div className="flex items-center justify-between py-1 border-b border-border/50">
            <span className="text-muted-foreground">{t.users.lockedUntil}</span>
            <span className="font-mono text-xs font-semibold text-destructive">
              {formatDate(user.lockedUntil)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-muted-foreground">{t.users.idLabel}</span>
          <div className="flex items-center gap-1">
            <span className="font-mono text-xs text-muted-foreground truncate max-w-[140px]">
              {user.id}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={copyId}
              aria-label={t.users.copyIdTitle}
              className="size-8 p-0 text-muted-foreground"
            >
              <Copy className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
