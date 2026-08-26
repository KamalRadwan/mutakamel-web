"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Archive } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { Button, Card, Checkbox, Field, Input, Textarea } from "@/design-system";
import { useReleaseDetail } from "../hooks/use-release-detail";
import {
  formatDate,
  JsonEvidence,
  RELEASE_COPY,
  RefreshReleaseButton,
  ReleaseFieldError,
  ReleaseMutationNotice,
  ReleasePageFrame,
  ReleaseSnapshotMeta,
  ReleaseStatePanel,
  StatusBadge,
  type ReleaseCopy,
} from "./release-shared";

export function ReleaseDetailScreen({ releaseId }: { releaseId: string }) {
  const { lang, dir } = useI18n();
  const copy = RELEASE_COPY[lang];
  const detail = useReleaseDetail(releaseId);
  return (
    <ReleasePageFrame dir={dir}>
      <Button asChild variant="ghost" className="w-fit">
        <Link href="/provisioning/releases">
          {dir === "rtl" ? <ArrowRight className="size-4" aria-hidden="true" /> : <ArrowLeft className="size-4" aria-hidden="true" />}
          {copy.back}
        </Link>
      </Button>
      <ReleaseBody detail={detail} copy={copy} lang={lang} />
    </ReleasePageFrame>
  );
}

function ReleaseBody({ detail, copy, lang }: { detail: ReturnType<typeof useReleaseDetail>; copy: ReleaseCopy; lang: "ar" | "en" }) {
  if (detail.state === "LOADING") return <ReleaseStatePanel kind="loading" title={copy.loading} copy={copy} />;
  if (detail.state === "FORBIDDEN") return <ReleaseStatePanel kind="forbidden" title={copy.forbidden} detail={copy.readPermission} copy={copy} />;
  if (detail.state === "NOT_FOUND") return <ReleaseStatePanel kind="notFound" title={copy.notFound} detail={detail.error?.message} correlationId={detail.error?.correlationId} copy={copy} />;
  if (detail.state === "UNAVAILABLE") {
    return (
      <ReleaseStatePanel kind="unavailable" title={copy.unavailable} detail={detail.error?.message} correlationId={detail.error?.correlationId} copy={copy} action={<RefreshReleaseButton label={copy.retry} onClick={detail.refresh} />} />
    );
  }
  if (detail.state === "ERROR" || !detail.snapshot) {
    return (
      <ReleaseStatePanel kind="error" title={copy.error} detail={detail.error?.message} correlationId={detail.error?.correlationId} copy={copy} action={<RefreshReleaseButton label={copy.retry} onClick={detail.refresh} />} />
    );
  }
  const release = detail.snapshot.data;
  const pending = detail.mutation.phase === "PENDING";
  return (
    <div className="space-y-4" aria-busy={pending || detail.isRefreshing}>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 dir="ltr" className="font-mono text-xl font-semibold text-foreground">{release.releaseVersion}</h1>
              <StatusBadge status={release.status} />
            </div>
            <code dir="ltr" className="mt-2 block break-all text-start text-xs text-muted-foreground">{release.releaseId}</code>
          </div>
          <RefreshReleaseButton label={copy.refresh} onClick={detail.refresh} pending={detail.isRefreshing} />
        </div>
      </Card>

      <ReleaseMutationNotice mutation={detail.mutation} copy={copy} />

      <div className="grid gap-4 xl:grid-cols-3">
        <EvidenceCard title={copy.lifecycleEvidence}>
          <Evidence label={copy.publishedAt} value={formatDate(release.publishedAt, lang)} />
          <Evidence label={copy.retiredAt} value={formatDate(release.retiredAt, lang)} />
          <Evidence label={copy.retirementReason} value={release.retirementReasonCode ?? "—"} mono />
        </EvidenceCard>
        <EvidenceCard title={copy.manifestEvidence}>
          <Evidence label={copy.componentId} value={release.componentId} mono />
          <Evidence label={copy.manifestVersion} value={String(release.manifestVersion)} mono />
          <Evidence label={copy.contractVersion} value={String(release.contractVersion)} mono />
          <Evidence label={copy.manifestChecksumLabel} value={release.manifestChecksum} mono />
        </EvidenceCard>
        <EvidenceCard title={copy.signatureEvidence}>
          <Evidence label={copy.publicationSource} value={release.publicationSource} mono />
          <Evidence label={copy.publisherKeyId} value={release.publisherKeyId ?? "—"} mono />
          <Evidence label={copy.signatureAlgorithm} value={release.signatureAlgorithm ?? "—"} mono />
          <Evidence label={copy.signedPayloadDigest} value={release.signedPayloadDigest ?? "—"} mono />
        </EvidenceCard>
      </div>

      <Card className="space-y-3 p-5">
        <p className="text-sm text-muted-foreground">{copy.disclosurePolicy}</p>
        <div className="grid gap-3 xl:grid-cols-2">
          <JsonEvidence title={copy.manifestPayload} value={release.manifestPayload} />
          <JsonEvidence title={copy.compatibility} value={release.compatibility} />
        </div>
        {release.signatureBase64 ? (
          <Field label={copy.signatureBase64}>
            {(fieldProps) => (
              <Textarea {...fieldProps} readOnly dir="ltr" rows={4} value={release.signatureBase64 ?? ""} className="bg-ink-950 font-mono text-xs text-ink-100" />
            )}
          </Field>
        ) : null}
      </Card>

      {release.status === "PUBLISHED" ? <RetireForm detail={detail} copy={copy} /> : null}
      <ReleaseSnapshotMeta snapshot={detail.snapshot} copy={copy} lang={lang} />
    </div>
  );
}

function RetireForm({ detail, copy }: { detail: ReturnType<typeof useReleaseDetail>; copy: ReleaseCopy }) {
  const pending = detail.mutation.phase === "PENDING";
  if (!detail.permissions.canRetireCritical) {
    return <ReleaseStatePanel kind="forbidden" title={copy.commandForbidden} detail="admin.provisioning.releases.retire + admin.provisioning.critical" copy={copy} />;
  }
  return (
    <Card className="border-danger-300 bg-danger-50 p-5 dark:border-danger-900 dark:bg-danger-950/20">
      <form
        aria-label={copy.retireTitle}
        onSubmit={(event) => {
          event.preventDefault();
          void detail.retire();
        }}
        className="space-y-4"
      >
        <div>
          <h2 className="text-lg font-semibold text-foreground">{copy.retireTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{copy.retireHelp}</p>
        </div>
        <Field label={copy.retirementReason} className="max-w-2xl">
          {(fieldProps) => (
            <Input
              id={fieldProps.id}
              aria-describedby={detail.retireErrors.reasonCode ? "retirement-reason-error" : undefined}
              dir="ltr"
              value={detail.retireDraft.reasonCode}
              maxLength={96}
              invalid={Boolean(detail.retireErrors.reasonCode)}
              onChange={(event) => detail.updateRetireDraft("reasonCode", event.target.value)}
              className="font-mono"
            />
          )}
        </Field>
        <ReleaseFieldError id="retirement-reason-error" code={detail.retireErrors.reasonCode} copy={copy} />
        <label className="flex items-start gap-3 rounded-lg border border-danger-300 bg-card/60 p-3 text-sm font-semibold text-foreground dark:border-danger-900">
          <Checkbox
            checked={detail.retireDraft.confirmed}
            onCheckedChange={(next) => detail.updateRetireDraft("confirmed", next === true)}
            className="mt-1"
          />
          <span>{copy.retireConfirm}</span>
        </label>
        <ReleaseFieldError id="retirement-confirm-error" code={detail.retireErrors.confirmed} copy={copy} />
        <Button type="submit" variant="destructive" disabled={!detail.canRetire || pending} loading={pending}>
          <Archive className="size-4" aria-hidden="true" />
          {pending ? copy.retiring : copy.retire}
        </Button>
      </form>
    </Card>
  );
}

function EvidenceCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <h2 className="font-semibold text-foreground">{title}</h2>
      <dl className="mt-3 grid gap-2">{children}</dl>
    </Card>
  );
}

function Evidence({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg bg-ink-100 px-3 py-2 dark:bg-ink-900">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd dir={mono ? "ltr" : undefined} className={`mt-1 break-all text-sm font-semibold text-foreground ${mono ? "text-start font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
