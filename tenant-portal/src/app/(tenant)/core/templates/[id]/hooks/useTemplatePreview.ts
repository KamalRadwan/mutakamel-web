"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/design-system";
import type { AsyncJobStatus } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError } from "@/lib/api/errors";
import {
  fetchPreviewJob,
  previewArtifactHref,
  previewTemplateEmail,
  previewTemplateHtml,
  requestPdfPreview,
  type PreviewRequest,
} from "../../template-lifecycle-api";
import {
  ARTIFACT_EXPIRED_CODE,
  type TemplateEmailPreview,
  type TemplateHtmlPreview,
  type TemplatePreviewJob,
} from "../../template-lifecycle-contract";
import type { TemplateDetail } from "../../templates-contract";

const POLL_INTERVAL_MS = 2_000;
/** A bound, so a stuck job cannot poll forever. */
const MAX_POLLS = 60;

/**
 * Preview: two synchronous renders and one asynchronous job.
 *
 * HTML and email answer **200** from a pinned source — a draft revision or a
 * published version, never "whatever is current". PDF answers **202**; the job
 * is polled and the artifact fetched separately, and because the artifact
 * **expires**, "succeeded but the download is gone" is a real fifth state
 * alongside queued / running / succeeded / failed.
 */
export function useTemplatePreview(template: TemplateDetail | null, canPreview: boolean) {
  const { t } = useI18n();
  const toast = useToast();
  const copy = t.coreOperations.templates;

  const [html, setHtml] = useState<TemplateHtmlPreview | null>(null);
  const [email, setEmail] = useState<TemplateEmailPreview | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [job, setJob] = useState<TemplatePreviewJob | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [artifactExpired, setArtifactExpired] = useState(false);
  const [pollFailed, setPollFailed] = useState(false);
  const [fixtureKey, setFixtureKey] = useState("");
  const pollCount = useRef(0);

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const buildRequest = useCallback((): PreviewRequest | null => {
    if (!template || !fixtureKey.trim()) return null;
    return {
      // Pinned to the exact draft revision on screen.
      source: { kind: "DRAFT", draftRevision: template.currentDraft.revision },
      fixtureKey: fixtureKey.trim(),
      locale: template.locale,
      timeZone,
    };
  }, [template, fixtureKey, timeZone]);

  const report = useCallback(
    (error: unknown, title: string): void => {
      const normalized = normalizeApiError(error);
      if (normalized.status === 403) return;
      if (toast.outcomeFromApi(normalized)) return;
      if (normalized.code === ARTIFACT_EXPIRED_CODE) {
        setArtifactExpired(true);
        return;
      }
      toast.errorFromApi(title, normalized);
    },
    [toast],
  );

  const render = useCallback(async (): Promise<void> => {
    const request = buildRequest();
    if (!template || !canPreview || !request || isRendering) return;
    setIsRendering(true);
    setHtml(null);
    setEmail(null);
    try {
      if (template.outputChannel === "EMAIL") {
        setEmail(await previewTemplateEmail(template.id, request));
      } else {
        setHtml(await previewTemplateHtml(template.id, request));
      }
    } catch (error) {
      report(error, copy.previewFailed);
    } finally {
      setIsRendering(false);
    }
  }, [buildRequest, template, canPreview, isRendering, copy, report]);

  const requestPdf = useCallback(async (): Promise<void> => {
    const request = buildRequest();
    if (!template || !canPreview || !request) return;
    setArtifactExpired(false);
    setPollFailed(false);
    setJob(null);
    pollCount.current = 0;
    try {
      setJobId(await requestPdfPreview(template.id, request));
    } catch (error) {
      report(error, copy.pdfRequestFailed);
    }
  }, [buildRequest, template, canPreview, copy, report]);

  // Only `jobId` may appear here. `toast` is a fresh object on every render, so
  // a poll effect that depended on it would restart the polling loop on every
  // render — the failure is reported through state instead.
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      try {
        const next = await fetchPreviewJob(jobId);
        if (cancelled) return;
        setJob(next);
        if (next.status === "PENDING" || next.status === "RETRYING") {
          pollCount.current += 1;
          if (pollCount.current < MAX_POLLS) {
            window.setTimeout(() => void poll(), POLL_INTERVAL_MS);
          }
        }
      } catch (error) {
        if (cancelled) return;
        // A 410 here is the artifact having expired between completion and the
        // read — the fifth state, not a failure of the render.
        const normalized = normalizeApiError(error);
        if (normalized.code === ARTIFACT_EXPIRED_CODE) setArtifactExpired(true);
        else setPollFailed(true);
      }
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const jobStatus: AsyncJobStatus | null = artifactExpired
    ? "ARTIFACT_EXPIRED"
    : pollFailed
      ? "FAILED"
      : job === null
      ? jobId
        ? "QUEUED"
        : null
      : job.status === "COMPLETED"
        ? job.artifact
          ? "SUCCEEDED"
          : "ARTIFACT_EXPIRED"
        : job.status === "FAILED"
          ? "FAILED"
          : job.status === "RETRYING"
            ? "RUNNING"
            : "QUEUED";

  return {
    html,
    email,
    job,
    jobStatus,
    isRendering,
    fixtureKey,
    setFixtureKey,
    render,
    requestPdf,
    artifactHref: jobId && job?.artifact ? previewArtifactHref(jobId) : null,
    failureCode: job?.failureCode ?? (pollFailed ? copy.pdfPollFailed : null),
  };
}
