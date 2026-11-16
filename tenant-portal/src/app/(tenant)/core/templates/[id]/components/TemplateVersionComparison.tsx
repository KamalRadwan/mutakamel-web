"use client";

import { Button, DegradedBanner, Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger, ErrorState, PermissionGate, Skeleton } from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import type { TemplateConflictCopy } from "@/i18n/dictionaries/template-conflict";
import type { TemplateVersion } from "../../template-lifecycle-contract";
import { TEMPLATE_READ_PERMISSION } from "../../templates-contract";
import { useTemplateVersionComparison, type TemplateVersionComparisonInput } from "../hooks/useTemplateVersionComparison";

export function TemplateVersionComparison(props: TemplateVersionComparisonInput & { copy: TemplateConflictCopy; locale: string; language: "ar" | "en" }) {
  const { copy, locale, language, authority } = props;
  const { open, available, result, onOpenChange, retry } = useTemplateVersionComparison(props);
  if (!authority.readable) return null;
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogTrigger asChild><Button variant="outline" disabled={!available}>{copy.versions.compare}</Button></DialogTrigger>
    <DialogContent size="2xl" className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-auto">
      <DialogTitle className="pe-10">{copy.versions.compare}</DialogTitle>
      <DialogDescription>{copy.versions.help}</DialogDescription>
      {open && <>
        {result.state === "loading" && <div role="status"><span className="sr-only">{copy.loading}</span><Skeleton className="h-24" aria-busy="true" /></div>}
        {result.state === "unavailable" && <DegradedBanner message={copy.versions.unavailable} />}
        {result.state === "denied" && <PermissionGate require={TEMPLATE_READ_PERMISSION} denied>{null}</PermissionGate>}
        {result.state === "failed" && <ErrorState title={copy.failed} retryLabel={copy.retry} onRetry={retry} />}
        {result.state === "ready" && <>
          <p role="status" className="text-sm">{result.sameContentChecksum ? copy.versions.sameChecksum : copy.versions.differentChecksum}</p>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <VersionMetadata version={result.left} copy={copy} locale={locale} language={language} label={copy.versions.first} />
            <VersionMetadata version={result.right} copy={copy} locale={locale} language={language} label={copy.versions.second} />
          </div>
          <DegradedBanner message={copy.versions.bodyUnavailable} />
        </>}
        <Button variant="outline" className="justify-self-end" onClick={() => onOpenChange(false)}>{copy.close}</Button>
      </>}
    </DialogContent>
  </Dialog>;
}

function VersionMetadata({ version, copy, locale, language, label }: {
  version: TemplateVersion; copy: TemplateConflictCopy; locale: string; language: "ar" | "en"; label: string;
}) {
  return <section className="grid min-w-0 gap-2 rounded-md border border-border p-3">
    <h3 className="font-medium">{label} · {copy.versions.version} <bdi>{new Intl.NumberFormat(locale).format(version.versionNumber)}</bdi></h3>
    <dl className="grid gap-3 text-sm">
      <div><dt className="text-muted-foreground">{copy.versions.published}</dt><dd>{formatDateTime(version.publishedAt, language)}</dd></div>
      <div><dt className="text-muted-foreground">{copy.versions.note}</dt><dd className="whitespace-pre-wrap break-words">{version.changeNote || copy.versions.noNote}</dd></div>
      <div><dt className="text-muted-foreground">{copy.versions.checksum}</dt><dd className="break-all"><bdi dir="ltr">{version.templateContentChecksum}</bdi></dd></div>
    </dl>
  </section>;
}
