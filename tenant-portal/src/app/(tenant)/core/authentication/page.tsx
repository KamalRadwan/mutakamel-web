"use client";

import { useState } from "react";
import { Laptop, Loader2, RefreshCw, ShieldOff } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  useAuthenticationManagement,
  type AuthSessionItem,
} from "./hooks/useAuthenticationManagement";

export default function AuthenticationManagementPage() {
  const { lang, items, isLoading, error, revokingId, reload, revoke } =
    useAuthenticationManagement();
  const [pendingSession, setPendingSession] = useState<AuthSessionItem | null>(null);
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const isConfirming = pendingSession?.id === revokingId;

  const closeConfirmation = () => {
    if (!isConfirming) setPendingSession(null);
  };

  const confirmRevocation = async () => {
    if (!pendingSession || isConfirming) return;
    if (await revoke(pendingSession)) setPendingSession(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={lang === "ar" ? "جلسات تسجيل الدخول" : "Sign-in sessions"}
        subtitle={
          lang === "ar"
            ? "راجع المتصفحات والأجهزة المرتبطة بحسابك وألغِ أي جلسة لا تعرفها."
            : "Review the browsers and devices signed in to your account and revoke any you do not recognize."
        }
      >
        <Button variant="outline" onClick={() => void reload()} disabled={isLoading}>
          <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
          {lang === "ar" ? "تحديث" : "Refresh"}
        </Button>
      </PageHeader>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {lang === "ar"
            ? "تعذر تحميل الجلسات أو إلغاؤها. حاول مرة أخرى."
            : "The sessions could not be loaded or revoked. Try again."}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-slate-400 dark:border-slate-800 dark:bg-slate-900">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              lang={lang}
              locale={locale}
              isRevoking={revokingId === session.id}
              disabled={revokingId !== null}
              onRevoke={() => setPendingSession(session)}
            />
          ))}
          {items.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              {lang === "ar" ? "لا توجد جلسات متاحة." : "No sessions available."}
            </div>
          )}
        </div>
      )}
      <ConfirmModal
        isOpen={pendingSession !== null}
        onClose={closeConfirmation}
        onConfirm={() => void confirmRevocation()}
        title={pendingSession?.current
          ? lang === "ar" ? "إنهاء الجلسة الحالية؟" : "End the current session?"
          : lang === "ar" ? "إلغاء جلسة تسجيل الدخول؟" : "Revoke this sign-in session?"}
        message={pendingSession?.current
          ? lang === "ar"
            ? "سيتم تسجيل خروج هذا المتصفح فورًا مع بقاء الجلسات الأخرى دون تغيير."
            : "This browser will be signed out immediately. Other sessions remain active."
          : lang === "ar"
            ? "سيفقد هذا المتصفح أو الجهاز إمكانية الوصول فورًا."
            : "That browser or device will lose access immediately."}
        confirmText={pendingSession?.current
          ? lang === "ar" ? "إنهاء هذه الجلسة" : "End this session"
          : lang === "ar" ? "إلغاء الجلسة" : "Revoke session"}
        cancelText={lang === "ar" ? "إلغاء" : "Cancel"}
        loadingText={lang === "ar" ? "جارٍ الإلغاء..." : "Revoking..."}
        isSubmitting={isConfirming}
        closeOnConfirm={false}
      />
    </div>
  );
}

function SessionCard({
  session,
  lang,
  locale,
  isRevoking,
  disabled,
  onRevoke,
}: {
  session: AuthSessionItem;
  lang: "ar" | "en";
  locale: string;
  isRevoking: boolean;
  disabled: boolean;
  onRevoke: () => void;
}) {
  const lastUsed =
    session.lastUserActivityAt ??
    session.lastAccessIssuedAt ??
    session.lastRefreshAt ??
    session.createdAt;
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
          <Laptop className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {session.deviceLabel ?? session.clientId}
            </h2>
            {session.current && (
              <Badge variant="success">
                {lang === "ar" ? "الجلسة الحالية" : "Current"}
              </Badge>
            )}
            {session.endedAt && (
              <Badge variant="danger">
                {lang === "ar" ? "منتهية" : "Ended"}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {lang === "ar" ? "آخر استخدام" : "Last used"}: {formatDate(lastUsed, locale)}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {lang === "ar" ? "مرات التحديث" : "Refreshes"}: {session.refreshUseCount}
            {" · "}
            {lang === "ar" ? "إصدارات الوصول" : "Access issuances"}: {session.accessIssueCount}
          </p>
          <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
            {session.clientId} · {session.clientType}
          </p>
        </div>
      </div>
      {!session.endedAt && (
        <Button variant="danger" onClick={onRevoke} disabled={disabled}>
          {isRevoking ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ShieldOff className="size-4" />
          )}
          {session.current
            ? lang === "ar" ? "إنهاء هذه الجلسة" : "End this session"
            : lang === "ar" ? "إلغاء الجلسة" : "Revoke session"}
        </Button>
      )}
    </article>
  );
}

function formatDate(value: string, locale: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}
