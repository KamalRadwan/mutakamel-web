"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  ChevronDown,
  ExternalLink,
  Inbox,
  Loader2,
  MessageSquare,
  RefreshCw,
  Save,
  Send,
  Settings2,
  ShieldAlert,
  Smartphone,
  Trash2,
  Wifi,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { useI18n } from "@/i18n/I18nContext";
import {
  buildDeviceTokenCommand,
  buildPreferenceCommand,
  isCanonicalUuidV7,
  NOTIFICATION_LIST_LIMITS,
  safeNotificationActionUrl,
  type DeviceTokenDraft,
  type DeviceTokenValidationErrors,
  type PreferenceDraft,
  type PreferenceValidationErrors,
} from "./contracts";
import { getNotificationsCopy, type NotificationsCopy } from "./copy";
import type {
  AdminNotification,
  NotificationActionStatus,
  NotificationPreference,
} from "./types";
import { useAdminNotifications } from "./useAdminNotifications";

const INITIAL_PREFERENCE: PreferenceDraft = {
  notificationType: "",
  inAppEnabled: true,
  pushEnabled: false,
  emailEnabled: false,
  quietHoursText: "{}",
};

const INITIAL_DEVICE: DeviceTokenDraft = {
  provider: "web-push",
  token: "",
  deviceId: "",
  platform: "web",
  enabled: true,
};

type Confirmation =
  | { kind: "dismiss"; id: string; compatibility: boolean }
  | { kind: "revoke"; id: string };

export function AdminNotificationsScreen() {
  const { lang } = useI18n();
  const copy = getNotificationsCopy(lang);
  const view = useAdminNotifications();
  const [preferenceDraft, setPreferenceDraft] = useState<PreferenceDraft>(INITIAL_PREFERENCE);
  const [preferenceErrors, setPreferenceErrors] = useState<PreferenceValidationErrors>({});
  const [deviceDraft, setDeviceDraft] = useState<DeviceTokenDraft>(INITIAL_DEVICE);
  const [deviceErrors, setDeviceErrors] = useState<DeviceTokenValidationErrors>({});
  const [revokeId, setRevokeId] = useState("");
  const [revokeIdError, setRevokeIdError] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const pending = view.actionStatus.state === "PENDING";
  const shell = (content: ReactNode) => (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-canvas dark:text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-[1500px] space-y-5 px-3 py-5 sm:px-6">
        <header className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-950 to-blue-950 p-5 text-white shadow-sm dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                <Bell className="size-5 text-cyan-300" aria-hidden="true" />
                {copy.title}
              </h1>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-300">{copy.description}</p>
            </div>
            {view.canRead ? (
              <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold">
                <Inbox className="size-4 text-cyan-300" aria-hidden="true" />
                {copy.unread}: {view.unreadCount}
              </div>
            ) : null}
          </div>
        </header>
        {content}
      </main>
    </div>
  );

  if (view.requestState === "LOADING") {
    return shell(<StatePanel icon={<Loader2 className="size-8 animate-spin" />} title={copy.loading} />);
  }
  if (view.requestState === "FORBIDDEN") {
    return shell(<StatePanel tone="danger" icon={<ShieldAlert className="size-8" />} title={copy.forbidden} detail={copy.readPermission} />);
  }
  if (view.requestState === "UNAVAILABLE") {
    return shell(<StatePanel tone="danger" icon={<Wifi className="size-8" />} title={copy.unavailable} detail={errorDetail(view.loadError, copy)} action={<RetryButton label={copy.retry} onClick={view.refresh} />} />);
  }
  if (view.requestState === "ERROR") {
    const detail = view.loadError?.errorCode === "NOTIFICATION_CONTRACT_INVALID"
      ? copy.contractDrift
      : errorDetail(view.loadError, copy);
    return shell(<StatePanel tone="danger" icon={<AlertTriangle className="size-8" />} title={copy.error} detail={detail} action={<RetryButton label={copy.retry} onClick={view.refresh} />} />);
  }

  const submitPreference = async (event: FormEvent) => {
    event.preventDefault();
    const built = buildPreferenceCommand(preferenceDraft);
    setPreferenceErrors(built.errors);
    if (!built.command) return;
    await view.savePreference(built.command);
  };

  const submitDevice = async (event: FormEvent) => {
    event.preventDefault();
    const built = buildDeviceTokenCommand(deviceDraft);
    setDeviceErrors(built.errors);
    if (!built.command) return;
    const receipt = await view.registerDevice(built.command);
    if (receipt) {
      setDeviceDraft((current) => ({ ...current, token: "" }));
      setRevokeId(receipt.id);
    }
  };

  const requestRevoke = () => {
    const normalized = revokeId.trim().toLowerCase();
    const invalid = !isCanonicalUuidV7(normalized);
    setRevokeIdError(invalid);
    if (!invalid) setConfirmation({ kind: "revoke", id: normalized });
  };

  const confirmDestructiveAction = () => {
    const current = confirmation;
    setConfirmation(null);
    if (!current) return;
    if (current.kind === "revoke") {
      void view.revokeDevice(current.id);
    } else {
      void view.performItemAction(
        current.id,
        current.compatibility ? "dismiss-post-compatibility" : "dismiss",
      );
    }
  };

  return shell(
    <>
      {!view.canManage ? (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          {copy.managePermission}
        </div>
      ) : null}
      <ActionBanner
        copy={copy}
        status={view.actionStatus}
        updated={view.lastUpdatedCount}
        onClose={view.clearActionStatus}
        onRetry={() => void view.retryLastAction()}
      />

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold"><Inbox className="size-4 text-blue-600" aria-hidden="true" />{copy.inbox}</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{view.page?.items.length ?? 0} {copy.all}</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold dark:border-slate-700">
              <input type="checkbox" checked={view.unreadOnly} onChange={(event) => view.setUnreadOnly(event.target.checked)} />
              {copy.unreadOnly}
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              {copy.pageSize}
              <select value={view.limit} onChange={(event) => view.setLimit(Number(event.target.value))} className={inputClass}>
                {NOTIFICATION_LIST_LIMITS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <button type="button" onClick={view.refresh} className={secondaryButton}><RefreshCw className="size-4" aria-hidden="true" />{copy.refresh}</button>
          </div>
        </div>

        {view.canManage ? (
          <div className="flex flex-wrap gap-2 rounded-xl border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-950 dark:bg-blue-950/20">
            <button disabled={pending || view.unreadCount === 0} type="button" onClick={() => void view.performBulkAction("read-all")} className={primaryButton}><CheckCheck className="size-4" aria-hidden="true" />{copy.readAll}</button>
            <button disabled={pending || view.unreadCount === 0} type="button" onClick={() => void view.performBulkAction("mark-all-read-compatibility")} className={secondaryButton}>{copy.markAllReadLegacy}</button>
          </div>
        ) : null}

        {view.page?.items.length ? (
          <div className="grid gap-3">
            {view.page.items.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                copy={copy}
                lang={lang}
                canManage={view.canManage}
                pending={pending}
                onAction={(action) => void view.performItemAction(notification.id, action)}
                onDismiss={(compatibility) => setConfirmation({ kind: "dismiss", id: notification.id, compatibility })}
              />
            ))}
          </div>
        ) : (
          <StatePanel icon={<BellOff className="size-8" />} title={copy.empty} compact />
        )}
        {view.page?.hasNext ? (
          <button type="button" disabled={view.isLoadingMore} onClick={() => void view.loadMore()} className={`${secondaryButton} mx-auto`}>
            {view.isLoadingMore ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
            {copy.loadMore}
          </button>
        ) : null}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Settings2 className="size-4 text-violet-600" aria-hidden="true" />{copy.preferences}</h2>
          {view.preferences.length ? (
            <div className="grid gap-2">
              {view.preferences.map((preference) => (
                <PreferenceRow key={preference.notificationType} preference={preference} copy={copy} onEdit={() => {
                  setPreferenceDraft({
                    notificationType: preference.notificationType,
                    inAppEnabled: preference.inAppEnabled,
                    pushEnabled: preference.pushEnabled,
                    emailEnabled: preference.emailEnabled,
                    quietHoursText: JSON.stringify(preference.quietHours, null, 2),
                  });
                  setPreferenceErrors({});
                }} />
              ))}
            </div>
          ) : <p className="text-xs text-slate-500 dark:text-slate-400">{copy.noPreferences}</p>}
          {view.canManage ? (
            <form noValidate onSubmit={(event) => void submitPreference(event)} className="grid gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <h3 className="text-xs font-semibold">{copy.configurePreference}</h3>
              <Field label={copy.notificationType} error={preferenceError(preferenceErrors.notificationType, copy)} id="notification-preference-type">
                <input id="notification-preference-type" value={preferenceDraft.notificationType} onChange={(event) => setPreferenceDraft((current) => ({ ...current, notificationType: event.target.value }))} maxLength={128} placeholder={copy.notificationTypePlaceholder} aria-invalid={Boolean(preferenceErrors.notificationType)} className={inputClass} />
              </Field>
              <div className="grid gap-2 sm:grid-cols-3">
                <Toggle label={copy.inApp} checked={preferenceDraft.inAppEnabled} onChange={(checked) => setPreferenceDraft((current) => ({ ...current, inAppEnabled: checked }))} />
                <Toggle label={copy.push} checked={preferenceDraft.pushEnabled} onChange={(checked) => setPreferenceDraft((current) => ({ ...current, pushEnabled: checked }))} />
                <Toggle label={copy.email} checked={preferenceDraft.emailEnabled} onChange={(checked) => setPreferenceDraft((current) => ({ ...current, emailEnabled: checked }))} />
              </div>
              <Field label={copy.quietHours} hint={copy.quietHoursHint} error={quietHoursError(preferenceErrors.quietHours, copy)} id="notification-quiet-hours">
                <textarea id="notification-quiet-hours" rows={4} value={preferenceDraft.quietHoursText} onChange={(event) => setPreferenceDraft((current) => ({ ...current, quietHoursText: event.target.value }))} aria-invalid={Boolean(preferenceErrors.quietHours)} className={`${inputClass} resize-y font-mono`} />
              </Field>
              <button type="submit" disabled={pending} className={primaryButton}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{pending ? copy.saving : copy.savePreference}</button>
            </form>
          ) : null}
        </section>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Smartphone className="size-4 text-emerald-600" aria-hidden="true" />{copy.devices}</h2>
          {view.canManage ? (
            <form noValidate onSubmit={(event) => void submitDevice(event)} className="grid gap-3">
              <Field label={copy.provider} id="notification-device-provider">
                <select id="notification-device-provider" value={deviceDraft.provider} onChange={(event) => setDeviceDraft((current) => ({ ...current, provider: event.target.value as DeviceTokenDraft["provider"] }))} className={inputClass}>
                  <option value="web-push">web-push</option><option value="fcm">fcm</option><option value="apns">apns</option>
                </select>
              </Field>
              <Field label={copy.deviceToken} hint={copy.tokenHint} error={deviceTokenError(deviceErrors.token, copy)} id="notification-device-token">
                <textarea id="notification-device-token" rows={3} value={deviceDraft.token} onChange={(event) => setDeviceDraft((current) => ({ ...current, token: event.target.value }))} maxLength={4096} autoComplete="off" spellCheck={false} aria-invalid={Boolean(deviceErrors.token)} className={`${inputClass} resize-y font-mono`} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={copy.deviceId} error={deviceErrors.deviceId ? copy.validation.deviceIdTooLong : undefined} id="notification-device-id"><input id="notification-device-id" value={deviceDraft.deviceId} onChange={(event) => setDeviceDraft((current) => ({ ...current, deviceId: event.target.value }))} maxLength={128} className={inputClass} /></Field>
                <Field label={copy.platform} error={deviceErrors.platform ? copy.validation.platformTooLong : undefined} id="notification-device-platform"><input id="notification-device-platform" value={deviceDraft.platform} onChange={(event) => setDeviceDraft((current) => ({ ...current, platform: event.target.value }))} maxLength={32} className={inputClass} /></Field>
              </div>
              <Toggle label={copy.enabled} checked={deviceDraft.enabled} onChange={(enabled) => setDeviceDraft((current) => ({ ...current, enabled }))} />
              <button type="submit" disabled={pending} className={primaryButton}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}{pending ? copy.registering : copy.register}</button>
            </form>
          ) : null}
          {view.deviceReceipt ? (
            <dl className="grid gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs dark:border-emerald-900 dark:bg-emerald-950/20">
              <Evidence label={copy.receipt} value={view.deviceReceipt.id} mono />
              <Evidence label={copy.tokenHash} value={view.deviceReceipt.tokenHash} mono />
            </dl>
          ) : null}
          {view.canManage ? (
            <div className="grid gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Field label={copy.tokenId} error={revokeIdError ? copy.validation.uuid : undefined} id="notification-revoke-id">
                <input id="notification-revoke-id" value={revokeId} onChange={(event) => { setRevokeId(event.target.value); setRevokeIdError(false); }} autoComplete="off" spellCheck={false} aria-invalid={revokeIdError} className={`${inputClass} font-mono`} />
              </Field>
              <button type="button" disabled={pending} onClick={requestRevoke} className={dangerButton}><Trash2 className="size-4" />{pending ? copy.revoking : copy.revoke}</button>
            </div>
          ) : null}
        </section>
      </div>

      <RuntimePanel config={view.config} copy={copy} />

      <DestructiveActionModal
        isOpen={confirmation !== null}
        onClose={() => setConfirmation(null)}
        onConfirm={confirmDestructiveAction}
        title={confirmation?.kind === "revoke" ? copy.revokeConfirmTitle : copy.dismissConfirmTitle}
        description={confirmation?.kind === "revoke" ? copy.revokeConfirmDescription : copy.dismissConfirmDescription}
        targetName={confirmation?.id ?? ""}
        actionType="delete"
        requireNameTyping={false}
        isSubmitting={pending}
        confirmLabel={copy.confirm}
        submittingLabel={copy.pending}
      />
    </>,
  );
}

function NotificationCard({ notification, copy, lang, canManage, pending, onAction, onDismiss }: {
  notification: AdminNotification;
  copy: NotificationsCopy;
  lang: "ar" | "en";
  canManage: boolean;
  pending: boolean;
  onAction: (action: "read" | "acknowledge" | "ack-compatibility") => void;
  onDismiss: (compatibility: boolean) => void;
}) {
  const url = safeNotificationActionUrl(notification.actionUrl);
  return (
    <article className={`rounded-xl border p-4 ${notification.readAt ? "border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-950/30" : "border-blue-200 bg-blue-50/40 dark:border-blue-900 dark:bg-blue-950/20"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {!notification.readAt ? <span className="size-2 rounded-full bg-blue-600" aria-label={copy.unread} /> : null}
            <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-100">{notification.title}</h3>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold dark:bg-slate-800">{notification.priority}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600 dark:text-slate-300">{notification.body}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span>{copy.source}: {notification.sourceApp}</span><span>{copy.type}: {notification.notificationType}</span><span>{formatDate(notification.createdAt, lang)}</span>
          </div>
        </div>
        {url ? <Link href={url} className={iconButton} aria-label={copy.open}><ExternalLink className="size-4" /></Link> : null}
      </div>
      {canManage ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
          <button disabled={pending || Boolean(notification.readAt)} type="button" onClick={() => onAction("read")} className={smallButton}><Check className="size-3.5" />{copy.markRead}</button>
          <button disabled={pending || Boolean(notification.acknowledgedAt)} type="button" onClick={() => onAction("acknowledge")} className={smallButton}><CheckCheck className="size-3.5" />{copy.acknowledge}</button>
          <button disabled={pending} type="button" onClick={() => onDismiss(false)} className={smallDangerButton}><Trash2 className="size-3.5" />{copy.dismiss}</button>
          <details className="relative">
            <summary className={`${smallButton} cursor-pointer list-none`}>{copy.compatibility}</summary>
            <div className="mt-2 flex flex-wrap gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 dark:border-amber-900 dark:bg-amber-950/20">
              <button disabled={pending || Boolean(notification.acknowledgedAt)} type="button" onClick={() => onAction("ack-compatibility")} className={smallButton}>{copy.acknowledgeLegacy}</button>
              <button disabled={pending} type="button" onClick={() => onDismiss(true)} className={smallDangerButton}>{copy.dismissLegacy}</button>
            </div>
          </details>
        </div>
      ) : null}
    </article>
  );
}

function PreferenceRow({ preference, copy, onEdit }: { preference: NotificationPreference; copy: NotificationsCopy; onEdit: () => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800"><div><p className="font-mono font-semibold">{preference.notificationType}</p><p className="mt-1 text-xs text-slate-500">{copy.inApp}: {yesNo(preference.inAppEnabled)} · {copy.push}: {yesNo(preference.pushEnabled)} · {copy.email}: {yesNo(preference.emailEnabled)}</p></div><button type="button" onClick={onEdit} className={smallButton}>{copy.edit}</button></div>;
}

function RuntimePanel({ config, copy }: { config: ReturnType<typeof useAdminNotifications>["config"]; copy: NotificationsCopy }) {
  if (!config) return null;
  const metrics = [
    [copy.runtimeEnabled, config.enabled], [copy.inAppEnabled, config.inAppEnabled], [copy.realtimeEnabled, config.realtimeEnabled], [copy.pushEnabled, config.pushEnabled], [copy.emailEnabled, config.emailEnabled],
  ] as const;
  return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="flex items-center gap-2 text-sm font-semibold"><MessageSquare className="size-4 text-cyan-600" />{copy.runtime}</h2><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{metrics.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"><p className="text-xs font-semibold text-slate-500">{label}</p><p className={`mt-1 text-xs font-semibold ${value ? "text-emerald-600" : "text-slate-400"}`}>{yesNo(value)}</p></div>)}</div><dl className="grid gap-2 text-xs sm:grid-cols-3"><Evidence label={copy.runtimeProvider} value={config.provider} /><Evidence label={copy.polling} value={`${config.pollIntervalMs} ms`} /><Evidence label={copy.previewLimit} value={String(config.previewLimit)} /></dl>{!config.pushEnabled ? <p className="text-xs text-amber-700 dark:text-amber-300">{copy.firebaseUnavailable}</p> : null}</section>;
}

function ActionBanner({ status, copy, updated, onClose, onRetry }: { status: NotificationActionStatus; copy: NotificationsCopy; updated: number | null; onClose: () => void; onRetry: () => void }) {
  if (status.state === "IDLE") return null;
  const success = status.state === "SUCCESS";
  const pending = status.state === "PENDING";
  const title = actionTitle(status, copy);
  return <section role={success || pending ? "status" : "alert"} aria-live="polite" className={`rounded-xl border p-3 text-xs ${success ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200" : pending ? "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-200" : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-200"}`}><div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 font-semibold">{pending ? <Loader2 className="size-4 animate-spin" /> : success ? <Check className="size-4" /> : <AlertTriangle className="size-4" />}{title}</p>{updated !== null ? <p className="mt-1">{copy.updated}: {updated}</p> : null}{status.error ? <dl className="mt-2 grid gap-1"><Evidence label={copy.errorCode} value={status.error.errorCode} mono />{status.error.correlationId ? <Evidence label={copy.correlation} value={status.error.correlationId} mono /> : null}</dl> : null}</div>{!pending ? <button type="button" onClick={onClose} className={smallButton}>{copy.close}</button> : null}</div>{status.state === "UNAVAILABLE" || status.state === "CONFLICT" ? <button type="button" onClick={onRetry} className={`${smallButton} mt-2`}><RefreshCw className="size-3.5" />{copy.retry}</button> : null}</section>;
}

function actionTitle(status: NotificationActionStatus, copy: NotificationsCopy): string {
  if (status.state === "PENDING") return copy.pending;
  if (status.state === "SUCCESS") {
    if (status.messageKey === "preferenceSaved") return copy.preferenceSaved;
    if (status.messageKey === "deviceRegistered") return copy.deviceRegistered;
    if (status.messageKey === "deviceRevoked") return copy.deviceRevoked;
    if (status.messageKey === "bulkCompleted") return copy.bulkCompleted;
    return copy.actionSucceeded;
  }
  if (status.state === "VALIDATION") return copy.validationTitle;
  if (status.state === "CONFLICT") return copy.conflictTitle;
  if (status.state === "STALE") return copy.staleTitle;
  if (status.state === "FORBIDDEN") return copy.actionForbidden;
  if (status.state === "UNAVAILABLE") return copy.actionUnavailable;
  return copy.actionError;
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return <div className="grid gap-1"><label htmlFor={id} className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</label>{children}{hint ? <p className="text-xs leading-4 text-slate-500">{hint}</p> : null}{error ? <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-300">{error}</p> : null}</div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold dark:border-slate-700"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}

function Evidence({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div><dt className="text-xs font-semibold opacity-70">{label}</dt><dd className={`mt-0.5 break-all ${mono ? "font-mono" : "font-semibold"}`}>{value}</dd></div>; }
function StatePanel({ icon, title, detail, action, tone = "neutral", compact = false }: { icon: ReactNode; title: string; detail?: string; action?: ReactNode; tone?: "neutral" | "danger"; compact?: boolean }) { return <section role={tone === "danger" ? "alert" : "status"} className={`flex ${compact ? "min-h-32" : "min-h-64"} flex-col items-center justify-center rounded-xl border p-6 text-center ${tone === "danger" ? "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-200" : "border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"}`}><span className="mb-3 opacity-70">{icon}</span><h2 className="text-sm font-semibold">{title}</h2>{detail ? <p className="mt-2 max-w-3xl break-all text-xs leading-5 opacity-80">{detail}</p> : null}{action ? <div className="mt-4">{action}</div> : null}</section>; }
function RetryButton({ label, onClick }: { label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={primaryButton}><RefreshCw className="size-4" />{label}</button>; }
function formatDate(value: string, lang: "ar" | "en"): string { try { return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); } catch { return value; } }
function yesNo(value: boolean): string { return value ? "✓" : "—"; }
function errorDetail(error: { errorCode: string; message: string; correlationId?: string } | null, copy: NotificationsCopy): string | undefined { if (!error) return undefined; return [error.message, `${copy.errorCode}: ${error.errorCode}`, error.correlationId ? `${copy.correlation}: ${error.correlationId}` : null].filter(Boolean).join(" · "); }
function preferenceError(value: PreferenceValidationErrors["notificationType"], copy: NotificationsCopy) { return value === "required" ? copy.validation.required : value === "tooLong" ? copy.validation.typeTooLong : undefined; }
function quietHoursError(value: PreferenceValidationErrors["quietHours"], copy: NotificationsCopy) { return value === "invalidJson" ? copy.validation.invalidJson : value === "objectRequired" ? copy.validation.objectRequired : undefined; }
function deviceTokenError(value: DeviceTokenValidationErrors["token"], copy: NotificationsCopy) { return value === "required" ? copy.validation.required : value === "tooLong" ? copy.validation.tokenTooLong : undefined; }

const inputClass = "min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const primaryButton = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40";
const secondaryButton = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";
const dangerButton = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40";
const smallButton = "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";
const smallDangerButton = "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/30";
const iconButton = "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-blue-600 hover:bg-blue-50 dark:border-slate-700 dark:text-blue-300 dark:hover:bg-blue-950/30";
