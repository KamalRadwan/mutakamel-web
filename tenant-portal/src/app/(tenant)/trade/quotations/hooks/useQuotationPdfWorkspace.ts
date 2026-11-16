"use client";

import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient, getStoredTenantSessionMeta, TenantApiClientError } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { BRANCH_SCOPE_HEADER, COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import { can } from "@/lib/auth/permission-scope";
import { readLatestTenantAuthEvent, subscribeToTenantAuthEvents } from "@/lib/auth/sessionCoordinator";
import { generateUUIDv7, isUUIDv7 } from "@/lib/uuid";
import { tradeGet } from "../../trade-api";
import type { TradePdfJobState } from "../../documents/hooks/useTradePdfJob";
import { record, TRADE_ACTION_RESPONSE_BYTES, tradeInvalidResponse } from "../../documents/trade-document-contract";
import { tradeDocumentMessage } from "../../documents/trade-document-errors";
import {
  parseTradeRenderJob, TRADE_PDF_POLL_INTERVAL_MS, TRADE_PDF_POLL_LIMIT, TRADE_PDF_RESPONSE_BYTES,
  tradeRenderJobPath, tradeRenderPdfPath, type TradeRenderJob,
} from "../../documents/trade-pdf-contract";
import { QUOTATIONS_PATH, QUOTATION_PERMISSIONS, type QuotationDetail } from "../quotation-contract";
import type { QuotationTemplateChoice } from "../quotation-template-library";
import { QUOTATION_PDF_MAX_BYTES, saveQuotationPdf, useQuotationPdfArtifact, validateQuotationPdf } from "./useQuotationPdfArtifact";
import { useQuotationTemplateLibrary } from "./useQuotationTemplateLibrary";

type TemplateSelection = "default" | "explicit" | "built-in";
type TemplateErrorCopy = "defaultTemplateUnavailable" | "noEligibleDefaultTemplate" | "immutableTemplateIncompatible" | "generic";
type JobView = Pick<TradePdfJobState, "job" | "isPolling" | "pollError" | "isPollExhausted"> &
  Pick<TradePdfJobState["write"], "isWriting" | "writeError"> & {
    artifactBlocked: boolean;
    templateErrorCopy: TemplateErrorCopy | null;
    downloadedPdf: Blob | null;
  };
const EMPTY_JOB_VIEW: JobView = {
  job: null, isWriting: false, writeError: null,
  isPolling: false, pollError: null, isPollExhausted: false, artifactBlocked: false, templateErrorCopy: null, downloadedPdf: null,
};

export function useQuotationPdfWorkspace(quotation: QuotationDetail, headers: Record<string, string>, enabled: boolean, reopenJobId?: string) {
  const { t } = useI18n();
  const { user, realtimeAuthGeneration, readReadyProfileCommit } = useTenantAuth();
  const toast = useToast();
  const [locale, setLocale] = useState(t.quotationPdf.defaultLocale);
  const [timeZone, setTimeZone] = useState("Africa/Cairo");
  const target = { companyId: quotation.companyId, branchId: quotation.branchId };
  const actorId = user?.id;
  const canRead = !!actorId && !!realtimeAuthGeneration &&
    (user?.isTenantOwner === true || can(user, QUOTATION_PERMISSIONS.read, target));
  const scopeMatches = headers[COMPANY_SCOPE_HEADER] === quotation.companyId && headers[BRANCH_SCOPE_HEADER] === quotation.branchId;
  const revision = quotation.revisions.find((row) => row.id === quotation.currentRevisionId);
  const printable = !!revision && ["SENT", "ACCEPTED", "REJECTED"].includes(revision.status);
  const cancelled = revision?.status === "CANCELLED";
  const revisionId = quotation.currentRevisionId;
  const quotationId = quotation.id;
  const revisionSuffix = revision && revision.revisionNumber > 1 ? `-v${revision.revisionNumber}` : "";
  const numberedName = quotation.documentNumber ? quotation.documentNumber + revisionSuffix : "";
  const pdfFileName = /^[A-Za-z0-9_-]{1,124}$/u.test(numberedName)
    ? numberedName + ".pdf"
    : `${quotationId}-revision-${revisionId}.pdf`;
  const headersKey = JSON.stringify(Object.entries(headers).sort());
  const canReopen = !!reopenJobId && enabled && printable;
  const owner = useMemo(() => ({
    quotationId, revisionId, actorId, realtimeAuthGeneration, canRead, scopeMatches, reopenJobId,
    canReopen,
    headers: Object.fromEntries(JSON.parse(headersKey) as [string, string][]),
  }), [quotationId, revisionId, actorId, realtimeAuthGeneration, canRead, scopeMatches, reopenJobId, canReopen, headersKey]);
  const liveOwner = useRef<typeof owner | null>(null);
  const io = useRef<AbortController | null>(null);
  const [retired, setRetired] = useState<typeof owner | null>(null);
  const [view, setView] = useState<{ owner: typeof owner; state: JobView } | null>(null);
  const [, checkExpiry] = useState(0);
  const active = retired !== owner && canRead && scopeMatches;
  const eligible = enabled && printable && active;
  const state = active && view?.owner === owner ? view.state : EMPTY_JOB_VIEW;
  const downloadedPdf = eligible ? state.downloadedPdf : null;
  const cancelledJob = enabled && cancelled ? state.job : null;
  const update = (next: Partial<JobView>) => {
    setView((previous) => ({ owner, state: { ...(previous?.owner === owner ? previous.state : EMPTY_JOB_VIEW), ...next } }));
  };
  const retire = useCallback(() => {
    if (liveOwner.current !== owner) return;
    liveOwner.current = null;
    io.current?.abort();
    io.current = null;
    setRetired(owner);
  }, [owner]);

  useLayoutEffect(() => {
    if (!owner.canRead || !owner.scopeMatches) return;
    liveOwner.current = owner;
    const unsubscribe = subscribeToTenantAuthEvents((event) => {
      const same = owner.realtimeAuthGeneration === `tenant:${event.sessionId}:${owner.actorId}`;
      if (event.kind === "session-ended" ? same : !same) retire();
    });
    return () => {
      unsubscribe();
      liveOwner.current = null;
      io.current?.abort();
      io.current = null;
    };
  }, [owner, retire]);

  const assertOwner = useCallback(() => {
    if (liveOwner.current !== owner) throw new DOMException("Quotation PDF context changed.", "AbortError");
    const sessionId = getStoredTenantSessionMeta()?.sessionId;
    const event = readLatestTenantAuthEvent();
    if (!sessionId || owner.realtimeAuthGeneration !== `tenant:${sessionId}:${owner.actorId}` ||
      (event && (event.sessionId !== sessionId || event.kind === "session-ended"))) {
      retire();
      throw new DOMException("Quotation PDF context changed.", "AbortError");
    }
  }, [owner, retire]);
  const hasTemplateRead = user ? user.isTenantOwner === true || can(user, "templates.read", target) : null;
  const canReadLibrary = active && hasTemplateRead === true;
  const canPreview = canReadLibrary && (user?.isTenantOwner === true || can(user, "templates.preview", target));
  const [selection, setSelection] = useState<{ owner: typeof owner; choice: QuotationTemplateChoice | "BUILT_IN" } | null>(null);
  const libraryOwnerIsCurrent = useCallback(() => ownerIsCurrent(assertOwner), [assertOwner]);
  const libraryIdentity = actorId && realtimeAuthGeneration ? JSON.stringify([actorId, realtimeAuthGeneration]) : null;
  const library = useQuotationTemplateLibrary(
    { identity: libraryIdentity, quotationRevisionKey: JSON.stringify([quotation.id, revisionId]), isCurrent: libraryOwnerIsCurrent },
    quotation.companyId, quotation.branchId, locale, timeZone, hasTemplateRead, eligible,
  );
  const libraryReadable = canReadLibrary && library.error?.status !== 403;
  const canConfigureAssignments = () => libraryReadable && readReadyProfileCommit?.()?.user === user &&
    user?.accessibleBranchCompanies?.some(scope => scope.companyId === target.companyId && scope.branchId === target.branchId) &&
    can(user, "templates.assignments.manage", target);
  const showDefaultAssignmentSetup = Boolean(eligible && state.templateErrorCopy === "noEligibleDefaultTemplate" && canConfigureAssignments());
  const currentSelection = selection?.owner === owner ? selection.choice : null;
  const builtInSelected = currentSelection === "BUILT_IN";
  const selected = currentSelection !== "BUILT_IN" && libraryReadable ? currentSelection : null;
  if (selection && (selection.owner !== owner || (!builtInSelected && !libraryReadable))) setSelection(null);
  const job = useMemo(() => {
    if (!eligible || !state.job) return null;
    return state.artifactBlocked ? { ...state.job, artifact: null } : state.job;
  }, [eligible, state.artifactBlocked, state.job]);
  const artifact = job?.artifact;
  const viewer = useQuotationPdfArtifact(quotationId,
    job && artifact ? { jobId: job.renderJobId, checksum: artifact.checksum, sizeBytes: artifact.sizeBytes } : null,
    owner.headers, assertOwner);
  const expiresAt = artifact ? Date.parse(artifact.downloadExpiresAt) : 0;
  useLayoutEffect(() => {
    if (expiresAt <= Date.now()) return;
    const timer = setTimeout(() => checkExpiry((value) => value + 1), Math.min(expiresAt - Date.now() + 1, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [expiresAt]);

  const currentView = useRef<{
    eligible: boolean; cancelled: boolean; job: TradeRenderJob | null;
    cancelledJob: TradeRenderJob | null; configuration: object; showDefaultAssignmentSetup: boolean; downloadedPdf: Blob | null;
  } | null>(null);
  const configuration = useMemo(() => ({ owner, locale, timeZone, libraryReadable, selected, builtInSelected }),
    [owner, locale, timeZone, libraryReadable, selected, builtInSelected]);
  useLayoutEffect(() => {
    currentView.current = { eligible, cancelled, job, cancelledJob, configuration, showDefaultAssignmentSetup, downloadedPdf };
    return () => { currentView.current = null; };
  }, [eligible, cancelled, job, cancelledJob, configuration, showDefaultAssignmentSetup, downloadedPdf]);

  const monitor = async (accepted: TradeRenderJob | string, immediate: boolean, purpose: "status" | "download" | "settlement" = "status") => {
    if (io.current || !ownerIsCurrent(assertOwner)) return;
    const controller = new AbortController();
    const { signal } = controller;
    io.current = controller;
    const assertCurrent = () => { signal.throwIfAborted(); assertOwner(); };
    update({ isPolling: true, pollError: null, isPollExhausted: false });
    const jobId = typeof accepted === "string" ? accepted : accepted.renderJobId;
    let previous = typeof accepted === "string" ? null : accepted;
    try {
      const path = tradeRenderJobPath(QUOTATIONS_PATH, quotationId, jobId);
      for (let attempt = 0; attempt < TRADE_PDF_POLL_LIMIT; attempt += 1) {
        if (!immediate || attempt > 0) await waitForPoll(signal);
        assertCurrent();
        if (purpose !== "settlement" && currentView.current?.cancelled) return;
        const response = await tradeGet(path, { headers: owner.headers, signal, assertCurrent,
          redirect: "error", requireExactResponseTarget: true, maxResponseBytes: TRADE_PDF_RESPONSE_BYTES });
        assertCurrent();
        const metadataOnly = purpose === "settlement" || currentView.current?.cancelled;
        if (purpose === "download" && metadataOnly) return false;
        const payload = metadataOnly ? { ...record(response.data), artifact: null } : response.data;
        const next = readQuotationJob(payload, quotationId, revisionId, {
          templateVersionId: previous?.templateVersionId, templateId: previous?.templateDefinitionId,
        });
        // A scheduled retry may fail before it starts, but completion requires a newer attempt.
        if (response.status !== 200 || next.renderJobId !== jobId ||
          (!previous && next.status !== "COMPLETED") ||
          (previous && (next.attemptCount < previous.attemptCount ||
            (previous.status === "RETRYING" && next.status === "COMPLETED" &&
              next.attemptCount === previous.attemptCount) ||
            (isTerminal(previous) && previous.status !== next.status))) ||
          (!metadataOnly && next.status === "COMPLETED" && !next.artifact) ||
          (!metadataOnly && previous?.artifact && !sameArtifact(previous.artifact, next.artifact))) tradeInvalidResponse();
        update({ job: next, artifactBlocked: false });
        if (metadataOnly || isTerminal(next)) return true;
        previous = next;
      }
      update({ isPollExhausted: true });
    } catch (error) {
      if (!ownerIsCurrent(assertCurrent)) return;
      const pollError = normalizeApiError(error);
      // The protected artifact GET rechecks access and verifies the previously accepted artifact.
      if (purpose === "download" && !currentView.current?.cancelled && typeof accepted !== "string" &&
        accepted.status === "COMPLETED" && accepted.artifact &&
        error instanceof TenantApiClientError && error.provenance === "http" &&
        pollError.status === 503 && pollError.code === "TRADE.QUOTE.PDF_ARTIFACT_UNAVAILABLE") return true;
      update({ pollError, ...([401, 403, 404, 410].includes(pollError.status) ? { artifactBlocked: true } : {}) });
    } finally {
      if (io.current === controller) io.current = null;
      if (ownerIsCurrent(assertCurrent)) update({ isPolling: false });
    }
  };

  const reopen = useEffectEvent((jobId: string) => {
    if (state.job || io.current) return;
    void monitor(jobId, true);
  });
  useEffect(() => {
    if (!owner.canReopen || !owner.canRead || !owner.scopeMatches || !isUUIDv7(owner.reopenJobId)) return;
    reopen(owner.reopenJobId);
  }, [owner]);

  const locked = state.isWriting || state.isPolling;
  const download = () => {
    if (!revisionId || !currentView.current?.eligible || !ownerIsCurrent(assertOwner)) return;
    if (downloadedPdf && currentView.current.downloadedPdf === downloadedPdf) {
      saveQuotationPdf(downloadedPdf, pdfFileName);
      return;
    }
    if (!job?.artifact || currentView.current.job !== job) return;
    void viewer.download(pdfFileName, async () => {
      return await monitor(job, true, "download") === true && !currentView.current?.cancelled && ownerIsCurrent(assertOwner);
    });
  };
  const pdf: Pick<TradePdfJobState, "job" | "uiStatus" | "isPolling" | "pollError" | "isPollExhausted" | "refresh"> & {
    write: Pick<TradePdfJobState["write"], "isWriting" | "isBlocked" | "writeError">;
  } = {
    job, uiStatus: job?.status === "COMPLETED" ? expiresAt > Date.now() ? "SUCCEEDED" : "ARTIFACT_EXPIRED"
      : job?.status === "FAILED" || job?.failure?.terminal ? "FAILED"
      : job?.status === "RETRYING" ? "RUNNING" : job ? "QUEUED" : null,
    isPolling: state.isPolling, pollError: state.pollError, isPollExhausted: state.isPollExhausted,
    refresh: async () => {
      if (currentView.current?.cancelled) {
        if (cancelledJob && currentView.current.cancelledJob === cancelledJob && !isTerminal(cancelledJob)) {
          await monitor(cancelledJob, true, "settlement");
        }
        return;
      }
      if (state.job && currentView.current?.eligible && currentView.current.job === job) {
        const confirmed = await monitor(state.job, true);
        if (confirmed && viewer.accessError && ownerIsCurrent(assertOwner)) viewer.retry();
      } else if (!state.job && currentView.current?.eligible && isUUIDv7(reopenJobId)) {
        await monitor(reopenJobId, true);
      }
    },
    write: { isWriting: state.isWriting, isBlocked: state.isWriting, writeError: state.writeError },
  };
  function writeErrorMessage(error: NormalizedApiError, copy: TemplateErrorCopy | null, includeLibraryHelp = true) {
    const message = copy && copy !== "generic" ? t.quotationPdf[copy] : tradeDocumentMessage(error.code, t.tradeDocuments.errors);
    if (!copy || copy === "generic") return message;
    const guidance = copy === "immutableTemplateIncompatible" ? t.quotationPdf.templateVersionAdminHelp : t.quotationPdf.defaultTemplateAdminHelp;
    const libraryHelp = includeLibraryHelp && libraryReadable ? ` ${t.quotationPdf.templateLibraryCheck}` : "";
    const setupHelp = copy === "noEligibleDefaultTemplate" && canConfigureAssignments() ? "" : ` ${guidance}`;
    return `${message}${setupHelp}${libraryHelp}`;
  }
  return {
    t, locale, timeZone, selected, builtInSelected, revision, pdf, library, viewer, download, downloadedPdf, canReadLibrary, canPreview, locked, eligible,
    canChangeTemplate: libraryReadable,
    cancelledJobStatus: cancelledJob?.failure?.terminal ? "FAILED" : cancelledJob?.status,
    canCheckCancelledJob: !!cancelledJob && !isTerminal(cancelledJob),
    showDefaultAssignmentSetup,
    isDefaultAssignmentSetupCurrent: () => currentView.current?.configuration === configuration &&
      currentView.current.showDefaultAssignmentSetup && !io.current && canConfigureAssignments() && ownerIsCurrent(assertOwner),
    isTemplateFocusOwnerCurrent: libraryOwnerIsCurrent,
    statusActionKey: JSON.stringify([quotationId, revisionId, libraryIdentity, headersKey, reopenJobId]),
    writeErrorMessage: state.writeError ? writeErrorMessage(state.writeError, state.templateErrorCopy) : undefined,
    templateErrorReference: state.templateErrorCopy ? state.writeError?.correlationId : undefined,
    reason: !enabled || !scopeMatches ? t.quotationPdf.verifyDetails : !active ? t.quotationPdf.readDenied
      : !printable ? quotation.lifecycleStatus === "DRAFT" ? t.quotationPdf.savedDraftHint : t.quotationPdf.notPrintable : undefined,
    setLocale: (value: string) => {
      if (locked || io.current) return;
      if (value !== locale && state.templateErrorCopy === "noEligibleDefaultTemplate") {
        update({ writeError: null, templateErrorCopy: null });
      }
      setLocale(value);
      setSelection((current) => current?.choice === "BUILT_IN" ? current : null);
    },
    setTimeZone: (value: string) => { if (!locked && !io.current) setTimeZone(value); },
    choose: (choice: QuotationTemplateChoice | "BUILT_IN" | null) => {
      if (!currentView.current?.eligible || currentView.current.configuration !== configuration ||
        locked || io.current || !ownerIsCurrent(assertOwner)) return;
      if (choice === "BUILT_IN") {
        if (state.templateErrorCopy === "noEligibleDefaultTemplate") update({ writeError: null, templateErrorCopy: null });
        setSelection({ owner, choice });
        return;
      }
      const listed = choice && libraryReadable
        ? library.items.find((item) => item.templateId === choice.templateId && item.templateVersionId === choice.templateVersionId)
        : null;
      if (choice && (!listed || listed.locale !== locale || !isUUIDv7(listed.templateVersionId) || !isUUIDv7(listed.templateId))) return;
      if (listed && state.templateErrorCopy === "noEligibleDefaultTemplate") update({ writeError: null, templateErrorCopy: null });
      setSelection(listed ? { owner, choice: listed } : null);
      library.setOpen(false);
    },
    render: async () => {
      if (!eligible || !revision || locked || io.current || currentView.current?.configuration !== configuration ||
        !ownerIsCurrent(assertOwner)) return;
      const body = { revisionId: revision.id, purpose: "CUSTOMER_QUOTATION", locale, timeZone,
        ...(builtInSelected ? { templateChoice: "BUILT_IN" as const }
          : selected ? { templateVersionId: selected.templateVersionId } : {}) };
      const operation = t.quotationPdf.generate;
      const templateSelection = builtInSelected ? "built-in" : selected ? "explicit" : "default";
      const controller = new AbortController();
      const { signal } = controller;
      io.current = controller;
      const assertCurrent = () => { signal.throwIfAborted(); assertOwner(); };
      update({ ...EMPTY_JOB_VIEW, isWriting: true });
      try {
        const result = await axiosClient.post<Blob>(`${tradeRenderPdfPath(QUOTATIONS_PATH, quotationId)}/download`, body, {
          headers: { ...owner.headers, "x-idempotency-key": generateUUIDv7(), Accept: "application/pdf, application/json" },
          signal, assertCurrent, cache: "no-store", redirect: "error", requireExactResponseTarget: true,
          nonReplayable: true, responseType: "blob", expectedBinaryContentType: "application/pdf",
          maxBinaryResponseBytes: QUOTATION_PDF_MAX_BYTES, maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
        });
        assertCurrent();
        if (result.status !== 200 || !/^attachment(?:\s*;|\s*$)/i.test(result.headers.get("content-disposition") ?? "")) {
          tradeInvalidResponse();
        }
        await validateQuotationPdf(result.data);
        assertCurrent();
        if (!currentView.current?.eligible) return;
        saveQuotationPdf(result.data, pdfFileName);
        update({ downloadedPdf: result.data });
        toast.success(operation, t.quotationPdf.ready);
      } catch (error) {
        if (!ownerIsCurrent(assertCurrent)) return;
        const normalized = normalizeApiError(error);
        const templateErrorCopy = quotationTemplateErrorCopy(error, normalized, templateSelection);
        update({ writeError: normalized, templateErrorCopy });
        if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
          const message = writeErrorMessage(normalized, templateErrorCopy, false);
          if (templateErrorCopy) toast.errorFromApi(operation, { ...normalized, message });
          else if (message) toast.error(operation, message);
          else toast.errorFromApi(operation, normalized);
        }
      } finally {
        if (io.current === controller) io.current = null;
        if (ownerIsCurrent(assertCurrent)) update({ isWriting: false });
      }
    },
  };
}

function quotationTemplateErrorCopy(error: unknown, normalized: NormalizedApiError,
  selection: TemplateSelection | undefined): TemplateErrorCopy | null {
  if (!selection || normalized.status !== 422 || normalized.code !== "TRADE.QUOTE.PDF_TEMPLATE_INCOMPATIBLE" ||
    !(error instanceof TenantApiClientError)) return null;
  if (selection === "built-in") return "generic";

  // Read the response details so a malformed reason cannot be mistaken for an absent one.
  const details = record(error.response.data.details);
  if (!details || !Object.hasOwn(details, "reason")) return selection === "default" ? "defaultTemplateUnavailable" : "generic";
  const reason = details.reason;
  if (!Array.isArray(reason) || reason.length !== 1) return "generic";
  if (reason[0] === "no_eligible_default_assignment" && selection === "default") return "noEligibleDefaultTemplate";
  if (reason[0] === "immutable_template_incompatible") return "immutableTemplateIncompatible";
  return "generic";
}

function readQuotationJob(
  payload: unknown, quotationId: string, revisionId: string | null,
  expected: { templateVersionId?: string; templateId?: string },
) {
  const job = parseTradeRenderJob(payload);
  if (job.quotationId !== quotationId || job.quotationRevisionId !== revisionId ||
    !job.templateDefinitionId || !job.templateVersionId ||
    (expected.templateVersionId && job.templateVersionId !== expected.templateVersionId) ||
    (expected.templateId && job.templateDefinitionId !== expected.templateId) ||
    job.statusUrl !== tradeRenderJobPath(QUOTATIONS_PATH, quotationId, job.renderJobId) ||
    (job.artifact && (job.status !== "COMPLETED" || job.artifact.sizeBytes > QUOTATION_PDF_MAX_BYTES ||
      !/^[0-9a-f]{64}$/.test(job.artifact.checksum)))) tradeInvalidResponse();
  return job;
}

function isTerminal(job: TradeRenderJob) {
  return job.status === "COMPLETED" || job.status === "FAILED" || job.failure?.terminal === true;
}

function sameArtifact(expected: NonNullable<TradeRenderJob["artifact"]>, actual: TradeRenderJob["artifact"]) {
  return actual && expected.checksum === actual.checksum && expected.sizeBytes === actual.sizeBytes &&
    expected.completedAt === actual.completedAt && expected.pageCount === actual.pageCount;
}

function ownerIsCurrent(assertCurrent: () => void) {
  try { assertCurrent(); return true; } catch { return false; }
}

function waitForPoll(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, TRADE_PDF_POLL_INTERVAL_MS);
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}
