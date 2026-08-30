"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
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
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import {
  Badge,
  Button,
  Checkbox,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Field,
  Input,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localeForLanguage } from "@/i18n/locale";
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
    <div className="mx-auto w-full max-w-[1500px] space-y-5">
      <PageHeader
        title={copy.title}
        status={
          view.canRead ? (
            <Badge tone="neutral">
              <Inbox className="size-3.5" aria-hidden="true" />
              {copy.unread}: {view.unreadCount}
            </Badge>
          ) : undefined
        }
      />
      {content}
    </div>
  );

  if (view.requestState === "LOADING") {
    return shell(<StatePanel icon={<Loader2 className="size-8 animate-spin motion-reduce:animate-none" />} title={copy.loading} />);
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
        <div role="status" className="rounded-lg border border-warning/30 bg-warning-subtle px-4 py-3 text-xs font-semibold text-warning-subtle-foreground">
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

      <section className="space-y-4 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Inbox className="size-4 text-info" aria-hidden="true" />{copy.inbox}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{view.page?.items.length ?? 0} {copy.all}</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label htmlFor="notification-unread-only" className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-foreground">
              <Checkbox id="notification-unread-only" checked={view.unreadOnly} onCheckedChange={(checked) => view.setUnreadOnly(checked === true)} />
              {copy.unreadOnly}
            </label>
            <Field id="notification-page-size" label={copy.pageSize} className="min-w-28">
              {({ id }) => (
                <Select value={String(view.limit)} onValueChange={(value) => view.setLimit(Number(value))}>
                  <SelectTrigger id={id}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NOTIFICATION_LIST_LIMITS.map((item) => <SelectItem key={item} value={String(item)}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Button type="button" variant="outline" onClick={view.refresh}><RefreshCw className="size-4" aria-hidden="true" />{copy.refresh}</Button>
          </div>
        </div>

        {view.canManage ? (
          <div className="flex flex-wrap gap-2 rounded-lg border border-primary/25 bg-selected/50 p-3">
            <Button disabled={pending || view.unreadCount === 0} type="button" variant="primary" onClick={() => void view.performBulkAction("read-all")}><CheckCheck className="size-4" aria-hidden="true" />{copy.readAll}</Button>
            <Button disabled={pending || view.unreadCount === 0} type="button" variant="outline" onClick={() => void view.performBulkAction("mark-all-read-compatibility")}>{copy.markAllReadLegacy}</Button>
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
          <Button type="button" variant="outline" disabled={view.isLoadingMore} onClick={() => void view.loadMore()} className="mx-auto">
            {view.isLoadingMore ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
            {copy.loadMore}
          </Button>
        ) : null}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="space-y-4 rounded-lg border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Settings2 className="size-4 text-info" aria-hidden="true" />{copy.preferences}</h2>
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
          ) : <p className="text-xs text-muted-foreground">{copy.noPreferences}</p>}
          {view.canManage ? (
            <form noValidate onSubmit={(event) => void submitPreference(event)} className="grid gap-3 border-t border-border pt-4">
              <h3 className="text-xs font-semibold text-foreground">{copy.configurePreference}</h3>
              <Field label={copy.notificationType} error={preferenceError(preferenceErrors.notificationType, copy)} id="notification-preference-type">
                {(field) => <Input {...field} value={preferenceDraft.notificationType} onChange={(event) => setPreferenceDraft((current) => ({ ...current, notificationType: event.target.value }))} maxLength={128} placeholder={copy.notificationTypePlaceholder} />}
              </Field>
              <div className="grid gap-2 sm:grid-cols-3">
                <Toggle label={copy.inApp} checked={preferenceDraft.inAppEnabled} onChange={(checked) => setPreferenceDraft((current) => ({ ...current, inAppEnabled: checked }))} />
                <Toggle label={copy.push} checked={preferenceDraft.pushEnabled} onChange={(checked) => setPreferenceDraft((current) => ({ ...current, pushEnabled: checked }))} />
                <Toggle label={copy.email} checked={preferenceDraft.emailEnabled} onChange={(checked) => setPreferenceDraft((current) => ({ ...current, emailEnabled: checked }))} />
              </div>
              <Field label={copy.quietHours} hint={copy.quietHoursHint} error={quietHoursError(preferenceErrors.quietHours, copy)} id="notification-quiet-hours">
                {(field) => <Textarea {...field} rows={4} value={preferenceDraft.quietHoursText} onChange={(event) => setPreferenceDraft((current) => ({ ...current, quietHoursText: event.target.value }))} className="resize-y font-mono" />}
              </Field>
              <Button type="submit" variant="primary" disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}{pending ? copy.saving : copy.savePreference}</Button>
            </form>
          ) : null}
        </section>

        <section className="space-y-4 rounded-lg border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Smartphone className="size-4 text-info" aria-hidden="true" />{copy.devices}</h2>
          {view.canManage ? (
            <form noValidate onSubmit={(event) => void submitDevice(event)} className="grid gap-3">
              <Field label={copy.provider} id="notification-device-provider">
                {({ id }) => (
                  <Select value={deviceDraft.provider} onValueChange={(provider) => setDeviceDraft((current) => ({ ...current, provider: provider as DeviceTokenDraft["provider"] }))}>
                    <SelectTrigger id={id}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="web-push">web-push</SelectItem>
                      <SelectItem value="fcm">fcm</SelectItem>
                      <SelectItem value="apns">apns</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </Field>
              <Field label={copy.deviceToken} hint={copy.tokenHint} error={deviceTokenError(deviceErrors.token, copy)} id="notification-device-token">
                {(field) => <Textarea {...field} rows={3} value={deviceDraft.token} onChange={(event) => setDeviceDraft((current) => ({ ...current, token: event.target.value }))} maxLength={4096} autoComplete="off" spellCheck={false} className="resize-y font-mono" />}
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={copy.deviceId} error={deviceErrors.deviceId ? copy.validation.deviceIdTooLong : undefined} id="notification-device-id">{(field) => <Input {...field} value={deviceDraft.deviceId} onChange={(event) => setDeviceDraft((current) => ({ ...current, deviceId: event.target.value }))} maxLength={128} />}</Field>
                <Field label={copy.platform} error={deviceErrors.platform ? copy.validation.platformTooLong : undefined} id="notification-device-platform">{(field) => <Input {...field} value={deviceDraft.platform} onChange={(event) => setDeviceDraft((current) => ({ ...current, platform: event.target.value }))} maxLength={32} />}</Field>
              </div>
              <Toggle label={copy.enabled} checked={deviceDraft.enabled} onChange={(enabled) => setDeviceDraft((current) => ({ ...current, enabled }))} />
              <Button type="submit" variant="primary" disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}{pending ? copy.registering : copy.register}</Button>
            </form>
          ) : null}
          {view.deviceReceipt ? (
            <dl className="grid gap-2 rounded-lg border border-success/30 bg-success-subtle p-3 text-xs text-success-subtle-foreground">
              <Evidence label={copy.receipt} value={view.deviceReceipt.id} mono />
              <Evidence label={copy.tokenHash} value={view.deviceReceipt.tokenHash} mono />
            </dl>
          ) : null}
          {view.canManage ? (
            <div className="grid gap-2 border-t border-border pt-4">
              <Field label={copy.tokenId} error={revokeIdError ? copy.validation.uuid : undefined} id="notification-revoke-id">
                {(field) => <Input {...field} value={revokeId} onChange={(event) => { setRevokeId(event.target.value); setRevokeIdError(false); }} autoComplete="off" spellCheck={false} className="font-mono" />}
              </Field>
              <Button type="button" variant="destructive" disabled={pending} onClick={requestRevoke}><Trash2 className="size-4" aria-hidden="true" />{pending ? copy.revoking : copy.revoke}</Button>
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
    <article className={`rounded-lg border p-4 ${notification.readAt ? "border-border bg-muted/60" : "border-s-4 border-primary/40 bg-selected/40"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {!notification.readAt ? <Badge tone="info">{copy.unread}</Badge> : null}
            <h3 className="text-sm font-semibold text-foreground">{notification.title}</h3>
            <Badge tone="neutral">{notification.priority}</Badge>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-foreground">{notification.body}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{copy.source}: {notification.sourceApp}</span><span>{copy.type}: {notification.notificationType}</span><span>{formatDate(notification.createdAt, lang)}</span>
          </div>
        </div>
        {url ? <Button asChild variant="outline" size="sm" className="size-9 shrink-0 p-0"><Link href={url} aria-label={copy.open}><ExternalLink className="size-4" aria-hidden="true" /></Link></Button> : null}
      </div>
      {canManage ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
          <Button disabled={pending || Boolean(notification.readAt)} type="button" variant="outline" size="sm" onClick={() => onAction("read")}><Check className="size-3.5" aria-hidden="true" />{copy.markRead}</Button>
          <Button disabled={pending || Boolean(notification.acknowledgedAt)} type="button" variant="outline" size="sm" onClick={() => onAction("acknowledge")}><CheckCheck className="size-3.5" aria-hidden="true" />{copy.acknowledge}</Button>
          <Button disabled={pending} type="button" variant="ghost" size="sm" onClick={() => onDismiss(false)} className="text-destructive hover:bg-destructive-subtle hover:text-destructive-subtle-foreground"><Trash2 className="size-3.5" aria-hidden="true" />{copy.dismiss}</Button>
          <Collapsible className="basis-full sm:basis-auto">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" size="sm">{copy.compatibility}<ChevronDown className="size-3.5" aria-hidden="true" /></Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 flex flex-wrap gap-2 rounded-lg border border-warning/30 bg-warning-subtle p-2 motion-reduce:transition-none">
              <Button disabled={pending || Boolean(notification.acknowledgedAt)} type="button" variant="outline" size="sm" onClick={() => onAction("ack-compatibility")}>{copy.acknowledgeLegacy}</Button>
              <Button disabled={pending} type="button" variant="ghost" size="sm" onClick={() => onDismiss(true)} className="text-destructive hover:bg-destructive-subtle hover:text-destructive-subtle-foreground">{copy.dismissLegacy}</Button>
            </CollapsibleContent>
          </Collapsible>
        </div>
      ) : null}
    </article>
  );
}

function PreferenceRow({ preference, copy, onEdit }: { preference: NotificationPreference; copy: NotificationsCopy; onEdit: () => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-xs"><div><p className="font-mono font-semibold text-foreground">{preference.notificationType}</p><p className="mt-1 text-xs text-muted-foreground">{copy.inApp}: {yesNo(preference.inAppEnabled, copy)} · {copy.push}: {yesNo(preference.pushEnabled, copy)} · {copy.email}: {yesNo(preference.emailEnabled, copy)}</p></div><Button type="button" variant="outline" size="sm" onClick={onEdit}>{copy.edit}</Button></div>;
}

function RuntimePanel({ config, copy }: { config: ReturnType<typeof useAdminNotifications>["config"]; copy: NotificationsCopy }) {
  if (!config) return null;
  const metrics = [
    [copy.runtimeEnabled, config.enabled], [copy.inAppEnabled, config.inAppEnabled], [copy.realtimeEnabled, config.realtimeEnabled], [copy.pushEnabled, config.pushEnabled], [copy.emailEnabled, config.emailEnabled],
  ] as const;
  return <section className="space-y-3 rounded-lg border border-border bg-card p-4"><h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><MessageSquare className="size-4 text-info" aria-hidden="true" />{copy.runtime}</h2><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{metrics.map(([label, value]) => <div key={label} className="rounded-lg border border-border p-3"><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className={`mt-1 text-xs font-semibold ${value ? "text-success" : "text-muted-foreground"}`}>{yesNo(value, copy)}</p></div>)}</div><dl className="grid gap-2 text-xs sm:grid-cols-3"><Evidence label={copy.runtimeProvider} value={config.provider} /><Evidence label={copy.polling} value={`${config.pollIntervalMs} ms`} /><Evidence label={copy.previewLimit} value={String(config.previewLimit)} /></dl>{!config.pushEnabled ? <p className="rounded-md bg-warning-subtle px-3 py-2 text-xs text-warning-subtle-foreground">{copy.firebaseUnavailable}</p> : null}</section>;
}

function ActionBanner({ status, copy, updated, onClose, onRetry }: { status: NotificationActionStatus; copy: NotificationsCopy; updated: number | null; onClose: () => void; onRetry: () => void }) {
  if (status.state === "IDLE") return null;
  const success = status.state === "SUCCESS";
  const pending = status.state === "PENDING";
  const title = actionTitle(status, copy);
  return <section role={success || pending ? "status" : "alert"} aria-live="polite" className={`rounded-lg border p-3 text-xs ${success ? "border-success/30 bg-success-subtle text-success-subtle-foreground" : pending ? "border-border bg-muted text-foreground" : "border-destructive/30 bg-destructive-subtle text-destructive-subtle-foreground"}`}><div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 font-semibold">{pending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : success ? <Check className="size-4" aria-hidden="true" /> : <AlertTriangle className="size-4" aria-hidden="true" />}{title}</p>{updated !== null ? <p className="mt-1">{copy.updated}: {updated}</p> : null}{status.error ? <dl className="mt-2 grid gap-1"><Evidence label={copy.errorCode} value={status.error.errorCode} mono />{status.error.correlationId ? <Evidence label={copy.correlation} value={status.error.correlationId} mono /> : null}</dl> : null}</div>{!pending ? <Button type="button" variant="ghost" size="sm" onClick={onClose}>{copy.close}</Button> : null}</div>{status.state === "UNAVAILABLE" || status.state === "CONFLICT" ? <Button type="button" variant="outline" size="sm" onClick={onRetry} className="mt-2"><RefreshCw className="size-3.5" aria-hidden="true" />{copy.retry}</Button> : null}</section>;
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

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const id = useId();
  return <div className="flex min-h-10 items-center gap-3 rounded-lg border border-input bg-card px-3"><Switch id={id} checked={checked} onCheckedChange={onChange} /><label htmlFor={id} className="min-w-0 flex-1 cursor-pointer text-xs font-semibold text-foreground">{label}</label></div>;
}

function Evidence({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div><dt className="text-xs font-semibold opacity-70">{label}</dt><dd className={`mt-0.5 break-all ${mono ? "font-mono" : "font-semibold"}`}>{value}</dd></div>; }
function StatePanel({ icon, title, detail, action, tone = "neutral", compact = false }: { icon: ReactNode; title: string; detail?: string; action?: ReactNode; tone?: "neutral" | "danger"; compact?: boolean }) { return <section role={tone === "danger" ? "alert" : "status"} className={`flex ${compact ? "min-h-32" : "min-h-64"} flex-col items-center justify-center rounded-lg border p-6 text-center ${tone === "danger" ? "border-destructive/30 bg-destructive-subtle text-destructive-subtle-foreground" : "border-border bg-card text-muted-foreground"}`}><span className="mb-3 opacity-70" aria-hidden="true">{icon}</span><h2 className="text-sm font-semibold">{title}</h2>{detail ? <p className="mt-2 max-w-3xl break-all text-xs leading-5 opacity-80">{detail}</p> : null}{action ? <div className="mt-4">{action}</div> : null}</section>; }
function RetryButton({ label, onClick }: { label: string; onClick: () => void }) { return <Button type="button" variant="primary" onClick={onClick}><RefreshCw className="size-4" aria-hidden="true" />{label}</Button>; }
function formatDate(value: string, lang: "ar" | "en"): string { try { return new Intl.DateTimeFormat(localeForLanguage(lang), { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); } catch { return value; } }
function yesNo(value: boolean, copy: NotificationsCopy): string { return value ? copy.enabledValue : copy.disabledValue; }
function errorDetail(error: { errorCode: string; message: string; correlationId?: string } | null, copy: NotificationsCopy): string | undefined { if (!error) return undefined; return [error.message, `${copy.errorCode}: ${error.errorCode}`, error.correlationId ? `${copy.correlation}: ${error.correlationId}` : null].filter(Boolean).join(" · "); }
function preferenceError(value: PreferenceValidationErrors["notificationType"], copy: NotificationsCopy) { return value === "required" ? copy.validation.required : value === "tooLong" ? copy.validation.typeTooLong : undefined; }
function quietHoursError(value: PreferenceValidationErrors["quietHours"], copy: NotificationsCopy) { return value === "invalidJson" ? copy.validation.invalidJson : value === "objectRequired" ? copy.validation.objectRequired : undefined; }
function deviceTokenError(value: DeviceTokenValidationErrors["token"], copy: NotificationsCopy) { return value === "required" ? copy.validation.required : value === "tooLong" ? copy.validation.tokenTooLong : undefined; }
