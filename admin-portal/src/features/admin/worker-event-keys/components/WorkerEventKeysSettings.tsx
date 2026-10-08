"use client";

import { KeyRound, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { adminCan, adminCanAll } from "@/lib/auth/rbac";
import { Badge, Button, ConfirmActionModal, PageHeader } from "@/design-system";
import { WORKER_KEY_COPY } from "../copy";

import { useWorkerEventKeys } from "../hooks/useWorkerEventKeys";

export function WorkerEventKeysSettings() {
  const { user, isLoading } = useAuth();
  const { lang } = useI18n();
  const canRead = adminCan(user, "admin.provisioning.publisher-keys.read");
  const canManage = adminCanAll(user, ["admin.provisioning.publisher-keys.manage", "admin.provisioning.critical"]);
  if (isLoading) return <p role="status">{WORKER_KEY_COPY[lang].loading}</p>;
  return <WorkerEventKeysContent key={`${user?.id}:${canRead}:${canManage}`} canRead={canRead} canManage={canManage} />;
}

function WorkerEventKeysContent({ canRead, canManage }: { canRead: boolean; canManage: boolean }) {
  const { lang, dir } = useI18n();
  const copy = WORKER_KEY_COPY[lang];
  const { errorRef, ...state } = useWorkerEventKeys(canRead, canManage);
  const code = state.mutationError?.errorCode;
  const failure = code === "WORKER_EVENT_VERIFICATION_KEY_CONFIG_MISMATCH" ? copy.mismatch
    : code === "WORKER_EVENT_VERIFICATION_TRUST_UNAVAILABLE" ? copy.unavailable
      : code?.includes("CONFLICT") ? copy.conflict : copy.failed;
  const confirmation = (locale: "ar" | "en") => {
    const text = WORKER_KEY_COPY[locale];
    const dto = state.intent?.dto;
    return `${text.issuer}: ${dto?.expectedIssuer ?? ""}\n${text.keyId}: ${dto?.expectedKeyId ?? ""}\n${text.fingerprint}: ${dto?.expectedPublicKeyFingerprint ?? ""}\n${text.slot}: ${dto?.trustSlot === "PREVIOUS" ? text.previousSlot : text.activeSlot}`;
  };

  return (
    <div dir={dir} className="space-y-3">
      <PageHeader title={copy.title} description={copy.description} />
      <p className="rounded-lg border border-border bg-muted p-3 text-xs leading-relaxed text-muted-foreground">{copy.scope}</p>
      <section aria-label={copy.registry} className="space-y-3 rounded-lg border border-border bg-card p-3 sm:p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="size-4" aria-hidden="true" />{copy.registry}</h2>
          {canRead && <Button variant="outline" size="sm" onClick={() => void state.refresh()} disabled={state.loading}>
            <RefreshCw className="size-4" aria-hidden="true" />{copy.refresh}
          </Button>}
        </div>
        {!canRead ? <p role="note" className="text-sm text-muted-foreground">{copy.forbidden}</p> : <>
          {state.loading && <p role="status" className="text-sm text-muted-foreground">{copy.loading}</p>}
          {state.loadError && <p role="alert" className="text-sm text-destructive-subtle-foreground">{state.loadError.httpStatus === 403 ? copy.forbidden : copy.loadFailed} <code dir="ltr">{state.loadError.errorCode}</code></p>}
          {!state.loading && !state.loadError && state.rows.length === 0 && <p role="status" className="rounded-md bg-warning-subtle p-3 text-sm text-warning-subtle-foreground">{copy.empty}</p>}
          {state.rows.map((row) => <article key={row.verificationKeyId} className="space-y-3 rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 dir="ltr" className="break-all font-mono text-sm font-semibold">{row.keyId}</h3>
              <Badge tone={row.status === "ACTIVE" ? "success" : row.status === "REVOKED" ? "danger" : "neutral"}>{copy.status[row.status]}</Badge>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-muted-foreground">{copy.issuer}</dt><dd dir="ltr" className="break-all">{row.issuer}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{copy.revision}</dt><dd>{row.revision} · {row.algorithm}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{copy.registered}</dt><dd><time dateTime={row.registeredAt}>{new Date(row.registeredAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}</time></dd></div>
              <div className="sm:col-span-3"><dt className="text-xs text-muted-foreground">{copy.fingerprint}</dt><dd dir="ltr" className="break-all font-mono text-xs">{row.publicKeyFingerprint}</dd></div>
            </dl>
          </article>)}
        </>}
      </section>

      {state.receipt && <p role="status" className="rounded-lg border border-success/30 bg-success-subtle p-3 text-sm text-success-subtle-foreground">{copy.success} <span dir="ltr" className="break-all font-mono">{state.receipt.keyId}</span></p>}
      {canRead && <section className="space-y-3 rounded-lg border border-border bg-card p-3 sm:p-3.5">
        <h2 className="text-sm font-semibold">{copy.activeSlot}</h2>
        <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">{copy.formHelp}</p>
        {state.configError && <p role="alert" className="text-sm text-destructive-subtle-foreground">{state.configError.httpStatus === 403 ? copy.forbidden : copy.unavailable} <code dir="ltr">{state.configError.errorCode}</code></p>}
        {state.currentKey && <dl className="grid gap-3 rounded-md bg-muted p-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-muted-foreground">{copy.issuer}</dt><dd dir="ltr" className="break-all">{state.currentKey.issuer}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{copy.keyId}</dt><dd dir="ltr" className="break-all font-mono">{state.currentKey.keyId} · {state.currentKey.algorithm}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">{copy.fingerprint}</dt><dd dir="ltr" className="break-all font-mono text-xs">{state.currentKey.publicKeyFingerprint}</dd></div>
        </dl>}
        <div ref={errorRef} tabIndex={-1} className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {state.mutationError && <div role="alert" className="space-y-1 rounded-md bg-destructive-subtle p-3 text-sm text-destructive-subtle-foreground">
            <p>{state.unknown ? copy.unknown : failure}</p>
            <p dir="ltr" className="break-all font-mono text-xs">{code}{state.mutationError.correlationId ? " · " + state.mutationError.correlationId : ""}</p>
          </div>}
        </div>
        {canManage ? <div className="flex justify-end"><Button variant="primary" loading={state.pending}
          disabled={state.pending || (!state.unknown && (state.loading || !!state.configError || !state.currentKey))}
          onClick={state.review}>{state.unknown ? copy.retry : copy.register}</Button></div>
          : <p className="text-sm text-muted-foreground">{copy.readonly}</p>}
      </section>}
      <ConfirmActionModal isOpen={state.confirmationOpen} onClose={state.closeConfirmation} onConfirm={state.confirm}
        titleEn={WORKER_KEY_COPY.en.confirmTitle} titleAr={WORKER_KEY_COPY.ar.confirmTitle}
        descriptionEn={confirmation("en")} descriptionAr={confirmation("ar")}
        confirmTextEn={WORKER_KEY_COPY.en.confirm} confirmTextAr={WORKER_KEY_COPY.ar.confirm}
        variant="warning" isLoading={state.pending} />
    </div>
  );
}
