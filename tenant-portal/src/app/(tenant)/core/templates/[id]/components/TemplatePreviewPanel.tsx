"use client";

import { Eye, FileDown } from "lucide-react";
import {
  AsyncJobState,
  Button,
  DetailSection,
  Field,
  Input,
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { TemplateDetail } from "../../templates-contract";
import type { useTemplatePreview } from "../hooks/useTemplatePreview";

/**
 * HTML and email render synchronously from a **pinned** draft revision; PDF is
 * a 202 job that is polled and whose artifact expires.
 *
 * The rendered HTML is shown as text rather than injected into the page: it is
 * server-composed markup for a document, not for this application's DOM, and
 * nothing here may execute it.
 */
export function TemplatePreviewPanel({
  template,
  preview,
}: {
  template: TemplateDetail;
  preview: ReturnType<typeof useTemplatePreview>;
}) {
  const { t } = useI18n();
  const copy = t.coreOperations.templates;
  const isEmail = template.outputChannel === "EMAIL";

  return (
    <DetailSection title={copy.previewTitle} description={copy.previewDescription}>
      <div className="flex flex-col gap-4">
        <Field label={copy.fixtureKey} hint={copy.fixtureKeyHint} required>
          <Input
            dir="ltr"
            value={preview.fixtureKey}
            onChange={(event) => preview.setFixtureKey(event.target.value)}
            disabled={preview.isRendering}
          />
        </Field>

        <span className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void preview.render()}
            disabled={preview.fixtureKey.trim().length === 0}
            loading={preview.isRendering}
          >
            <Eye className="size-4" aria-hidden="true" />
            {isEmail ? copy.previewEmail : copy.previewHtml}
          </Button>
          {!isEmail ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void preview.requestPdf()}
              disabled={preview.fixtureKey.trim().length === 0}
            >
              <FileDown className="size-4" aria-hidden="true" />
              {copy.previewPdf}
            </Button>
          ) : null}
          <span className="text-xs text-muted-foreground">
            {formatTemplate(copy.previewPinned, {
              revision: String(template.currentDraft.revision),
            })}
          </span>
        </span>

        {preview.email ? (
          <div className="flex flex-col gap-3">
            <Field label={copy.emailSubject} readOnly>
              <Input value={preview.email.subject} readOnly dir="auto" />
            </Field>
            <Field label={copy.emailText} readOnly>
              <Textarea value={preview.email.text} readOnly rows={8} dir="auto" />
            </Field>
            <Field label={copy.emailHtml} hint={copy.renderedMarkupHint} readOnly>
              <Textarea value={preview.email.html} readOnly rows={10} dir="ltr" />
            </Field>
          </div>
        ) : null}

        {preview.html ? (
          <Field label={copy.htmlOutput} hint={copy.renderedMarkupHint} readOnly>
            <Textarea value={preview.html.html} readOnly rows={12} dir="ltr" />
          </Field>
        ) : null}

        {preview.jobStatus ? (
          <AsyncJobState
            status={preview.jobStatus}
            operation={copy.pdfJobOperation}
            detail={preview.failureCode ?? undefined}
            onDownload={
              preview.artifactHref
                ? () => window.open(preview.artifactHref ?? "", "_blank", "noopener,noreferrer")
                : undefined
            }
            onRetry={() => void preview.requestPdf()}
            labels={{
              queued: copy.jobQueued,
              running: copy.jobRunning,
              succeeded: copy.jobSucceeded,
              failed: copy.jobFailed,
              artifactExpired: copy.jobArtifactExpired,
              download: copy.jobDownload,
              retry: t.common.retry,
              cancel: t.common.cancel,
            }}
          />
        ) : null}
      </div>
    </DetailSection>
  );
}
