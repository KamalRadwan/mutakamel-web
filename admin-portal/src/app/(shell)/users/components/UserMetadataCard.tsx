"use client";

import { Clock, ShieldAlert, Calendar, Copy } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useToast } from "@/components/ui/ToastContext";
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
      toast.success(
        lang === "ar" ? "تم النسخ" : "Copied",
        lang === "ar" ? "تم نسخ معرف المستخدم." : "The user ID was copied.",
      );
    } catch {
      toast.error(
        lang === "ar" ? "فشل النسخ" : "Copy Failed",
        lang === "ar" ? "تعذر نسخ معرف المستخدم." : "The user ID could not be copied.",
      );
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-2xs overflow-hidden">
      <div className="p-4 border-b border-border bg-ink-100/50 dark:bg-ink-800/30 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-foreground flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span>{lang === "ar" ? "معلومات النظام والنشاط" : "System & Activity Metadata"}</span>
        </h2>
      </div>

      <div className="p-4 space-y-3.5 text-xs">
        <div className="flex items-center justify-between py-1 border-b border-border/50">
          <span className="text-muted-foreground">{t.users.lastLogin}</span>
          <span className="font-mono text-foreground flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
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
            <span className="font-mono px-2 py-0.5 rounded bg-ink-100 dark:bg-ink-800 text-foreground font-semibold text-xs">
              v{user.sessionVersion}
            </span>
          </div>
        )}

        {user.failedLoginAttempts !== undefined && user.failedLoginAttempts > 0 && (
          <div className="flex items-center justify-between py-1 border-b border-border/50">
            <span className="text-muted-foreground">{t.users.failedLoginAttempts}</span>
            <span className="font-mono px-2 py-0.5 rounded bg-danger-50 text-danger-700 dark:bg-danger-950/40 dark:text-danger-400 font-semibold text-xs flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" />
              {user.failedLoginAttempts}
            </span>
          </div>
        )}

        {user.lockedUntil && (
          <div className="flex items-center justify-between py-1 border-b border-border/50">
            <span className="text-muted-foreground">{t.users.lockedUntil}</span>
            <span className="font-mono text-danger-600 dark:text-danger-400 font-semibold text-xs">
              {formatDate(user.lockedUntil)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-muted-foreground">ID</span>
          <div className="flex items-center gap-1">
            <span className="font-mono text-xs text-muted-foreground truncate max-w-[140px]">
              {user.id}
            </span>
            <button
              onClick={copyId}
              className="p-1 text-muted-foreground hover:text-muted-foreground dark:hover:text-foreground rounded transition-colors cursor-pointer"
              title="Copy ID"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
