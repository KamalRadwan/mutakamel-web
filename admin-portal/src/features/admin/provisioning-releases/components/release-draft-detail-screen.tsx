"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, FileKey2, Save } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { Button, Card, Checkbox, Field, Input, Textarea } from "@/design-system";
import { useReleaseDraftDetail } from "../hooks/use-release-draft-detail";
import { ReleaseDefinitionFields } from "./release-definition-form";
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

export function ReleaseDraftDetailScreen({ draftId }: { draftId: string }) {
  const { lang, dir } = useI18n();
  const copy = RELEASE_COPY[lang];
  const detail = useReleaseDraftDetail(draftId);
  return (
    <ReleasePageFrame dir={dir}>
      <Button asChild variant="ghost" className="w-fit">
        <Link href="/provisioning/releases">
          {dir === "rtl" ? <ArrowRight className="size-4" aria-hidden="true" /> : <ArrowLeft className="size-4" aria-hidden="true" />}
          {copy.back}
        </Link>
      </Button>
      <DraftBody detail={detail} copy={copy} lang={lang} />
    </ReleasePageFrame>
  );
}

function DraftBody({ detail, copy, lang }: { detail: ReturnType<typeof useReleaseDraftDetail>; copy: ReleaseCopy; lang: "ar" | "en" }) {
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
  const draft = detail.snapshot.data;
  const pending = detail.mutation.phase === "PENDING";
  return (
    <div className="space-y-4" aria-busy={pending || detail.isRefreshing}>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 dir="ltr" className="font-mono text-xl font-semibold text-start text-foreground">{draft.releaseVersion}</h1>
              <StatusBadge status={draft.status} />
            </div>
            <code dir="ltr" className="mt-2 block break-all text-start text-xs text-muted-foreground">{draft.draftId}</code>
          </div>
          <RefreshReleaseButton label={copy.refresh} onClick={detail.refresh} pending={detail.isRefreshing} />
        </div>
      </Card>

      <ReleaseMutationNotice mutation={detail.mutation} copy={copy} />

      {detail.published ? (
        <Card className="border-success/30 bg-success-subtle p-4 text-success-subtle-foreground">
          <section role="status">
            <h2 className="font-semibold">{copy.published}</h2>
            <Button asChild variant="primary" className="mt-3">
              <Link href={`/provisioning/releases/${detail.published.data.releaseId}`}>{copy.viewPublished}</Link>
            </Button>
          </section>
        </Card>
      ) : null}

      <EvidenceGrid draft={draft} copy={copy} lang={lang} />

      {detail.canEdit ? (
        <Card className="p-5">
          <form
            aria-label={copy.definition}
            onSubmit={(event) => {
              event.preventDefault();
              void detail.saveDraft();
            }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-foreground">{copy.definition}</h2>
            <p className="text-sm leading-6 text-muted-foreground">{copy.disclosurePolicy}</p>
            <ReleaseDefinitionFields value={detail.definition} errors={detail.definitionErrors} copy={copy} onChange={detail.updateDefinition} disabled={pending} />
            <div className="flex justify-end">
              <Button type="submit" variant="primary" disabled={pending} loading={pending && detail.mutation.name === "UPDATE"}>
                <Save className="size-4" aria-hidden="true" />
                {pending && detail.mutation.name === "UPDATE" ? copy.saving : copy.saveDraft}
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <ManifestEvidence draft={draft} copy={copy} />
      )}

      {draft.status === "DRAFT" && detail.permissions.canManageDrafts ? <ValidationForm detail={detail} copy={copy} /> : null}
      {draft.status === "VALIDATED" ? <PublishForm detail={detail} copy={copy} /> : null}
      {draft.status === "PUBLISHED" && draft.publishedReleaseId ? (
        <Button asChild variant="primary" className="w-fit">
          <Link href={`/provisioning/releases/${draft.publishedReleaseId}`}>{copy.viewPublished}</Link>
        </Button>
      ) : null}
      <ReleaseSnapshotMeta snapshot={detail.snapshot} copy={copy} lang={lang} />
    </div>
  );
}

function ValidationForm({ detail, copy }: { detail: ReturnType<typeof useReleaseDraftDetail>; copy: ReleaseCopy }) {
  const pending = detail.mutation.phase === "PENDING";
  return (
    <Card className="border-border bg-muted p-5">
      <form
        aria-label={copy.validationTitle}
        onSubmit={(event) => {
          event.preventDefault();
          void detail.validateDraft();
        }}
        className="space-y-4"
      >
        <div>
          <h2 className="text-lg font-semibold text-foreground">{copy.validationTitle}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy.validationHelp}</p>
        </div>
        {detail.definitionDirty ? (
          <p role="alert" className="rounded-lg border border-warning/30 bg-warning-subtle p-3 text-sm font-semibold text-warning-subtle-foreground">
            {copy.unsavedDefinition}
          </p>
        ) : null}
        <Field label={copy.publisherKeyId} className="max-w-2xl">
          {(fieldProps) => (
            <Input
              id={fieldProps.id}
              aria-describedby={detail.validationErrors.publisherKeyId ? "publisher-key-id-error" : undefined}
              dir="ltr"
              value={detail.publisherKeyId}
              invalid={Boolean(detail.validationErrors.publisherKeyId)}
              onChange={(event) => detail.setPublisherKeyId(event.target.value)}
              className="font-mono"
            />
          )}
        </Field>
        <ReleaseFieldError id="publisher-key-id-error" code={detail.validationErrors.publisherKeyId} copy={copy} />
        <Button type="submit" variant="primary" disabled={!detail.canValidate || pending} loading={pending && detail.mutation.name === "VALIDATE"}>
          <CheckCircle2 className="size-4" aria-hidden="true" />
          {pending && detail.mutation.name === "VALIDATE" ? copy.validating : copy.validate}
        </Button>
      </form>
    </Card>
  );
}

function PublishForm({ detail, copy }: { detail: ReturnType<typeof useReleaseDraftDetail>; copy: ReleaseCopy }) {
  const pending = detail.mutation.phase === "PENDING";
  return (
    <Card className="space-y-4 border-warning/30 bg-warning-subtle p-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{copy.publishTitle}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy.publishHelp}</p>
      </div>
      <SigningPayload detail={detail} copy={copy} />
      {detail.definitionDirty ? (
        <p role="alert" className="rounded-lg border border-warning/40 bg-card/70 p-3 text-sm font-semibold text-warning-subtle-foreground">
          {copy.unsavedDefinition}
        </p>
      ) : null}
      {!detail.permissions.canPublishCritical ? (
        <ReleaseStatePanel kind="forbidden" title={copy.commandForbidden} detail="admin.provisioning.releases.publish + admin.provisioning.critical" copy={copy} />
      ) : (
        <form
          aria-label={copy.publishTitle}
          onSubmit={(event) => {
            event.preventDefault();
            void detail.publish();
          }}
          className="space-y-4"
        >
          <Field label={copy.signatureBase64}>
            {(fieldProps) => (
              <Textarea
                id={fieldProps.id}
                aria-describedby={detail.publishErrors.signatureBase64 ? "release-signature-error" : undefined}
                dir="ltr"
                spellCheck={false}
                rows={4}
                value={detail.publishDraft.signatureBase64}
                invalid={Boolean(detail.publishErrors.signatureBase64)}
                onChange={(event) => detail.updatePublishDraft("signatureBase64", event.target.value)}
                className="font-mono text-xs"
              />
            )}
          </Field>
          <ReleaseFieldError id="release-signature-error" code={detail.publishErrors.signatureBase64} copy={copy} />
          <label className="flex items-start gap-3 rounded-lg border border-warning/30 bg-card/60 p-3 text-sm font-semibold text-foreground">
            <Checkbox
              checked={detail.publishDraft.confirmed}
              onCheckedChange={(next) => detail.updatePublishDraft("confirmed", next === true)}
              className="mt-1"
            />
            <span>{copy.publishConfirm}</span>
          </label>
          <ReleaseFieldError id="publish-confirm-error" code={detail.publishErrors.confirmed} copy={copy} />
          <Button type="submit" variant="primary" disabled={!detail.canPublish || pending} loading={pending && detail.mutation.name === "PUBLISH"}>
            <FileKey2 className="size-4" aria-hidden="true" />
            {pending && detail.mutation.name === "PUBLISH" ? copy.publishing : copy.publish}
          </Button>
        </form>
      )}
    </Card>
  );
}

function SigningPayload({ detail, copy }: { detail: ReturnType<typeof useReleaseDraftDetail>; copy: ReleaseCopy }) {
  if (detail.signingEvidence.phase === "CHECKING") return <p role="status" className="text-sm text-foreground">{copy.payloadChecking}</p>;
  if (detail.signingEvidence.phase === "UNAVAILABLE") return <p role="alert" className="text-sm font-semibold text-destructive-subtle-foreground">{copy.payloadUnavailable}</p>;
  if (detail.signingEvidence.phase === "MISMATCH") return <p role="alert" className="text-sm font-semibold text-destructive-subtle-foreground">{copy.payloadMismatch}</p>;
  if (detail.signingEvidence.phase !== "VERIFIED") return null;
  return (
    <Field label={copy.payloadBase64}>
      {(fieldProps) => (
        <Textarea {...fieldProps} readOnly dir="ltr" rows={6} value={detail.signingEvidence.payloadBase64 ?? ""} className="bg-muted font-mono text-xs text-foreground" />
      )}
    </Field>
  );
}

function EvidenceGrid({ draft, copy, lang }: { draft: NonNullable<ReturnType<typeof useReleaseDraftDetail>["snapshot"]>["data"]; copy: ReleaseCopy; lang: "ar" | "en" }) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <EvidenceCard title={copy.lifecycleEvidence}>
        <Evidence label={copy.revision} value={String(draft.revision)} />
        <Evidence label={copy.createdAt} value={formatDate(draft.createdAt, lang)} />
        <Evidence label={copy.updatedAt} value={formatDate(draft.updatedAt, lang)} />
        <Evidence label={copy.validatedAt} value={formatDate(draft.validatedAt, lang)} />
      </EvidenceCard>
      <EvidenceCard title={copy.manifestEvidence}>
        <Evidence label={copy.componentId} value={draft.componentId} mono />
        <Evidence label={copy.manifestChecksumLabel} value={draft.manifestChecksum} mono />
        <Evidence label={copy.schemaChecksum} value={draft.schemaChecksum ?? "—"} mono />
      </EvidenceCard>
      <EvidenceCard title={copy.signatureEvidence}>
        <Evidence label={copy.publisherKeyId} value={draft.publisherKeyId ?? "—"} mono />
        <Evidence label={copy.signingDigest} value={draft.signingDigest ?? "—"} mono />
        <Evidence label={copy.publishedReleaseId} value={draft.publishedReleaseId ?? "—"} mono />
      </EvidenceCard>
    </div>
  );
}

function ManifestEvidence({ draft, copy }: { draft: NonNullable<ReturnType<typeof useReleaseDraftDetail>["snapshot"]>["data"]; copy: ReleaseCopy }) {
  return (
    <Card className="space-y-3 p-5">
      <p className="text-sm text-muted-foreground">{copy.disclosurePolicy}</p>
      <div className="grid gap-3 xl:grid-cols-2">
        <JsonEvidence title={copy.manifestPayload} value={draft.manifestPayload} />
        <JsonEvidence title={copy.compatibility} value={draft.compatibility} />
      </div>
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
    <div className="rounded-lg bg-muted px-3 py-2">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd dir={mono ? "ltr" : undefined} className={`mt-1 break-all text-sm font-semibold text-foreground ${mono ? "text-start font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
