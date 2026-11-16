"use client";

import { Download, FileDown, Printer } from "lucide-react";
import { Button, DetailSection, Field, PermissionGate, Progress, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { templatePreviewMessages } from "@/i18n/dictionaries/template-preview";
import { TEMPLATE_PREVIEW_PERMISSION } from "../../templates-contract";
import type { useTemplatePdfSession } from "../hooks/useTemplatePdfSession";

export function TemplatePdfSessionPanel({ session, publishedCopy, salesDraftDescriptorReady }: {
  session: ReturnType<typeof useTemplatePdfSession>;
  publishedCopy?: { version: string; refresh: string; stale: string };
  salesDraftDescriptorReady?: boolean;
}) {
  const { lang } = useI18n();
  const copy = templatePreviewMessages[lang];
  const locale = { ar: "ar-EG-u-nu-latn", en: "en-US" }[lang];
  const sampleLabels: Readonly<Record<string, string | undefined>> = copy.salesQuotationSamples;
  const active = ["preparing", "creating", "pending", "retrying", "checking"].includes(session.status);
  const materialError = ["failed", "unknown", "expired", "stale", "unavailable", "invalid", "popup"].includes(session.status);
  const salesDraft = salesDraftDescriptorReady !== undefined;
  const checking = session.status === "checking";
  const denied = session.status === "denied";
  const permissionGate = <PermissionGate require={TEMPLATE_PREVIEW_PERMISSION} denied>{null}</PermissionGate>;
  const permissionFeedback = salesDraft ? <div role="alert">{permissionGate}</div> : permissionGate;
  const showSessionControls = !salesDraft || (salesDraftDescriptorReady && !denied && session.status !== "preparing" && session.status !== "unsupported");
  const showRetryLabel = session.status !== "idle" && (publishedCopy || session.canCreate);
  let message = copy.states[session.status];
  if (publishedCopy) {
    if (session.status === "stale") message = publishedCopy.stale;
  } else {
    if (session.status === "idle" && !session.fixtures.length) {
      message = salesDraftDescriptorReady === false ? copy.draftFeedback.samplesUnavailable : copy.noFixture;
    }
    if (session.status === "preparing" && salesDraftDescriptorReady === false) message = copy.draftFeedback.preparing;
    if (session.status === "unsupported" && salesDraft) message = copy.draftFeedback.unsupported;
    if (session.status === "pending" || session.status === "stale" || session.status === "failed") {
      message = copy.draftFeedback[session.status];
    }
    if (session.status === "unavailable") {
      if (session.canResume) message = copy.draftFeedback.resumeUnavailable;
      else if (session.canRefresh) message = copy.draftFeedback.reloadUnavailable;
    }
  }
  return <DetailSection title={copy.title}>
    <div className="flex min-w-0 flex-col gap-4 print:hidden">
      {(!salesDraft || !denied) && <p className="text-sm text-muted-foreground">{publishedCopy?.version ?? copy.revision}: {new Intl.NumberFormat(locale).format(session.revision)}</p>}
      {denied ? permissionFeedback : <>
        {publishedCopy ? <p className="text-sm text-muted-foreground">{copy.fixture} <bdi>{session.fixtureKey}</bdi></p> : showSessionControls && <Field label={copy.fixture}>
          <Select value={session.fixtureKey} onValueChange={session.setFixture} disabled={!session.canChooseFixture || !session.fixtures.length}>
            <SelectTrigger className="w-full sm:max-w-sm" aria-label={copy.fixture}>
              <SelectValue placeholder={copy.fixture} />
            </SelectTrigger>
            <SelectContent>{session.fixtures.map(row => <SelectItem key={row.fixtureKey} value={row.fixtureKey}>
              {Object.hasOwn(sampleLabels, row.fixtureKey) ? sampleLabels[row.fixtureKey] : <bdi>{row.fixtureKey}</bdi>}
            </SelectItem>)}</SelectContent>
          </Select>
        </Field>}
        <div className="text-sm text-foreground">
          <p role="status">{!materialError && !(publishedCopy && session.status === "idle") && message}</p>
          {materialError && <p role="alert">{message}</p>}
        </div>
        {active && <Progress label={copy.title} valueText={message} aria-hidden={salesDraft && checking ? true : undefined} />}
        <div className="flex flex-wrap items-center gap-2 empty:hidden">
          {showSessionControls && session.status !== "stale" && <Button variant="outline" disabled={!session.canCreate} onClick={() => void session.start()}>
            <FileDown className="size-4" aria-hidden="true" />{showRetryLabel ? copy.retry : copy.create}
          </Button>}
          {session.status === "unknown" && <Button variant="outline" onClick={() => void session.recover()}>{copy.recover}</Button>}
          {session.canResume && <Button variant="outline" onClick={() => void session.resume()}>{copy.resume}</Button>}
          {session.canRefresh && <Button variant="outline" onClick={session.refresh}>{publishedCopy?.refresh ?? copy.refresh}</Button>}
          {["pending", "retrying"].includes(session.status) && <Button variant="outline" onClick={session.stop}>{copy.stop}</Button>}
          {session.job?.artifact && <Button variant="outline"
            aria-disabled={checking ? true : undefined}
            className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            onClick={() => { if (!checking) void session.download(); }}>
            <Download className="size-4" aria-hidden="true" />{copy.download}
          </Button>}
        </div>
        {session.attempts !== null && <p className="text-sm text-muted-foreground">{copy.attempt}: {new Intl.NumberFormat(locale).format(session.attempts)}</p>}
        {session.nextRetryAt && <p className="text-sm text-muted-foreground">{copy.nextRetry}: {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" }).format(new Date(session.nextRetryAt))}</p>}
        {session.job?.artifact && <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-2">
          <div className="min-w-0"><dt className="text-muted-foreground">{copy.filename}</dt><dd className="break-all" dir="ltr">{session.filename}</dd></div>
          <div><dt className="text-muted-foreground">{copy.pages}</dt><dd>{new Intl.NumberFormat(locale).format(session.job.artifact.pageCount)}</dd></div>
          <div><dt className="text-muted-foreground">{copy.expiry}</dt><dd>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" }).format(new Date(session.job.artifact.downloadUrlExpiresAt))}</dd></div>
        </dl>}
      </>}
      {showSessionControls && <>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={session.capabilities.nativePrint.state === "UNAVAILABLE"}><Printer className="size-4" aria-hidden="true" />{copy.print}</Button>
          <Button variant="outline" disabled={session.capabilities.receipt.state === "UNAVAILABLE"}>{copy.receipt}</Button>
          <Button variant="outline" disabled={session.capabilities.thumbnail.state === "UNAVAILABLE"}>{copy.thumbnail}</Button>
          <Button variant="outline" disabled={session.capabilities.serverCancel.state === "UNAVAILABLE"}>{copy.serverCancel}</Button>
          <Button variant="outline" disabled={session.capabilities.sourceSnapshot.state === "UNAVAILABLE"}>{copy.snapshot}</Button>
        </div>
        <p className="text-sm text-muted-foreground">{copy.boundaries}</p>
        <p className="text-sm text-muted-foreground">{copy.printHelp}</p>
      </>}
    </div>
  </DetailSection>;
}
