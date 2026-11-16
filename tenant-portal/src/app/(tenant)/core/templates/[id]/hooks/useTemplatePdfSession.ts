"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTenantAuth, type TenantProfileCommit } from "@/context/AuthContext";
import { getStoredTenantSessionMeta } from "@/lib/api/axiosClient";
import { normalizeApiError } from "@/lib/api/errors";
import { requiresSameKeyRecovery } from "@/lib/api/outcomes";
import { can } from "@/lib/auth/permission-scope";
import { subscribeToTenantAuthEvents, subscribeToTenantAuthLifecycle } from "@/lib/auth/sessionCoordinator";
import { generateUUIDv7 } from "@/lib/uuid";
import type { TemplateDataSchema, TemplateDraftDocument } from "../../template-design-api";
import type { PreviewRequest } from "../../template-lifecycle-api";
import { createPinnedPdfPreview, fetchPinnedPdfArtifact, readPinnedPdfPreview } from "../../template-preview-session-api";
import { assertPdfJobProgress, type AcceptedPdfPreview, type PdfPreviewJob, type PreviewPdfPin, type PreviewVersionPin } from "../../template-preview-session-contract";
import { TEMPLATE_PREVIEW_PERMISSION, type TemplateDetail } from "../../templates-contract";
import { classifyPreviewFailure, currentPreviewCapabilities, supportsCurrentPdfPreview, supportsPublishedPdfPreview, type PreviewPreparationFailure } from "../../template-preview-availability";
import type { DraftPdfRecovery } from "./useDraftPdfRecovery";

const POLL_MS = 2_000;
const MAX_POLLS = 60;
const POLL_WINDOW_MS = POLL_MS * MAX_POLLS;
type Status = "idle" | "creating" | "pending" | "retrying" | "completed" | "failed" | "paused" | "stopped" |
  "unknown" | "expired" | "stale" | "denied" | "unavailable" | "blocked" | "invalid" | "popup" | "checking" | "unsupported" | "preparing";
interface Flight {
  owner: object; key: string; request: PreviewRequest; pin: PreviewPdfPin;
  accepted: AcceptedPdfPreview | null; job: PdfPreviewJob | null; count: number; generation: number;
}
type AcceptedFlight = Omit<Flight, "key" | "request" | "pin" | "accepted"> & {
  accepted: AcceptedPdfPreview;
  resumeProfile?: TenantProfileCommit;
};
interface View { owner: object; status: Status; job: PdfPreviewJob | null; accepted: AcceptedPdfPreview | null }
export interface TemplatePdfSessionInput {
  template: TemplateDetail; draft: Pick<TemplateDraftDocument, "templateId" | "draftId" | "revision"> | null;
  schema: Pick<TemplateDataSchema, "syntheticFixtures"> | null;
  canPreview: boolean; blocked: boolean;
  /** T01 supplies its current owner + ready-draft predicate; do not pass a constant. */
  current: () => boolean;
  /** Parent owns discard/reload safety, including any unsaved changes. */
  reload: () => void;
  /** Recovery is offered only when the host can restore focus after reload. */
  reloadInvalidPreparation?: () => void;
  preparation?: "preparing" | PreviewPreparationFailure;
  /** Actual host lifetime, separate from backend source/revision identity. */
  lifetime?: object;
  draftPdfRecovery?: DraftPdfRecovery;
  /** Retires only this client session's I/O; this is not a server cancel command. */
  subscribeRetirement?: (retire: () => void) => () => void;
}

interface PublishedPdfSessionInput extends Omit<TemplatePdfSessionInput, "draft" | "schema" | "draftPdfRecovery"> {
  version: PreviewVersionPin;
  fixture: { fixtureKey: string; locale: string; fixtureChecksum: string };
}

const noSnapshot = () => null;
const noSubscription = () => () => undefined;

export function useTemplatePdfSession(input: TemplatePdfSessionInput | PublishedPdfSessionInput) {
  const { template, canPreview, blocked, preparation, lifetime, subscribeRetirement } = input;
  const published = "version" in input ? input : null;
  const draft = "draft" in input ? input.draft : null;
  const { authState, user, realtimeAuthGeneration, readProfileCommit,
    readReadyProfileCommit, subscribeProfileReadiness } = useTenantAuth();
  const recovery = "draftPdfRecovery" in input && template.dataSourceKey === "TRADE_QUOTATION_PRINT_V1"
    ? input.draftPdfRecovery : undefined;
  const ready = useSyncExternalStore(recovery ? subscribeProfileReadiness : noSubscription,
    recovery ? readReadyProfileCommit : noSnapshot, noSnapshot);
  const suspended = useSyncExternalStore(recovery?.subscribe ?? noSubscription, recovery?.read ?? noSnapshot, noSnapshot);
  const { type: scopeType, companyId, branchId } = template.scope;
  const target = useMemo(() => scopeType === "TENANT" ? { tenantWide: true } : {
    companyId, ...(scopeType === "BRANCH" ? { branchId } : {}),
  }, [scopeType, companyId, branchId]);
  const allowed = canPreview && authState === "AUTHENTICATED" && can(user, TEMPLATE_PREVIEW_PERMISSION, target);
  const supported = published ? supportsPublishedPdfPreview(template) : supportsCurrentPdfPreview(template);
  const fixtures = "schema" in input ? input.schema?.syntheticFixtures.filter(row => row.locale === template.locale) ?? [] : [input.fixture];
  const [selectedFixture, setFixture] = useState("");
  const pinReady = published ? published.version.templateId === template.id && published.fixture.locale === template.locale
    : !!draft && draft.templateId === template.id && draft.draftId === template.currentDraft.draftId &&
    draft.revision === template.currentDraft.revision;
  const sourceIdentity = published ? ["VERSION", published.version.versionId, published.version.versionNumber,
    published.version.templateContentChecksum, published.version.compiledArtifactChecksum, published.fixture.fixtureChecksum]
    : ["DRAFT", template.currentDraft.draftId, template.currentDraft.revision, template.currentDraft.contentChecksum, draft?.draftId, draft?.revision];
  const scope = JSON.stringify([realtimeAuthGeneration, user?.id, template.id, template.scope.type,
    template.scope.companyId, template.scope.branchId, template.documentType, template.outputChannel,
    template.dataSourceKey, template.layoutMode, template.locale, template.direction]);
  const source = JSON.stringify([template.currentDraft.draftId, template.currentDraft.revision,
    template.currentDraft.contentChecksum, template.currentDraft.etag]);
  const fixtureReady = suspended && fixtures.some(row => row.fixtureKey === suspended.fixtureKey);
  const wrongSource = suspended && (suspended.scope !== scope ||
    (draft && (draft.draftId !== suspended.accepted.draftId || draft.revision !== suspended.accepted.draftRevision)) ||
    (!preparation && pinReady && (suspended.source !== source || !fixtureReady)));
  const held = suspended && !wrongSource ? suspended : null;
  const preferredFixture = held?.fixtureKey ?? selectedFixture;
  const fixtureKey = fixtures.some(row => row.fixtureKey === preferredFixture) ? preferredFixture : fixtures[0]?.fixtureKey ?? "";
  const reauthorized = held !== null && ready !== null && ready.sequence > held.profileSequence &&
    ready.user === user && can(ready.user, TEMPLATE_PREVIEW_PERMISSION, target);
  const ownerKey = JSON.stringify([template.id, template.dataSourceKey, template.outputChannel, template.layoutMode, template.locale,
    template.scope, sourceIdentity, fixtureKey, authState, user?.id, realtimeAuthGeneration, allowed, supported, blocked, pinReady, preparation]);
  const owner = useMemo(() => ({ key: ownerKey, lifetime, subscribeRetirement }), [ownerKey, lifetime, subscribeRetirement]);
  const live = useRef<object | null>(null);
  const inputRef = useRef(input);
  const flight = useRef<Flight | AcceptedFlight | null>(null);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollDeadline = useRef<ReturnType<typeof setTimeout> | null>(null);
  const io = useRef<AbortController | null>(null);
  const closeDownload = useRef<(() => void) | null>(null);
  const [view, setView] = useState<View | null>(null);
  const halt = useCallback(() => {
    if (flight.current) flight.current.generation += 1;
    if (timer.current !== null) clearTimeout(timer.current);
    if (pollDeadline.current !== null) clearTimeout(pollDeadline.current);
    timer.current = null;
    pollDeadline.current = null;
    io.current?.abort(); io.current = null; busy.current = false;
    closeDownload.current?.();
  }, []);
  const suspend = useCallback((run: Flight | AcceptedFlight) => {
    if (!recovery || !run.accepted || !("draftId" in run.accepted) || run.job?.status === "FAILED" || flight.current !== run) return;
    const sessionId = getStoredTenantSessionMeta()?.sessionId;
    const profile = readProfileCommit();
    if (!sessionId || !profile || profile.user.id !== user?.id ||
      realtimeAuthGeneration !== `tenant:${sessionId}:${user.id}`) return;
    recovery.suspend({ scope, source, fixtureKey, profileSequence: profile.sequence,
      accepted: run.accepted, previousStatus: run.job,
      expiresAt: Date.parse(run.job?.artifact?.downloadUrlExpiresAt ?? run.accepted.expiresAt) });
  }, [recovery, readProfileCommit, user?.id, realtimeAuthGeneration, scope, source, fixtureKey]);
  useLayoutEffect(() => {
    if (wrongSource) recovery?.clear();
  }, [wrongSource, recovery]);
  useLayoutEffect(() => { inputRef.current = input; });
  useLayoutEffect(() => {
    live.current = owner; flight.current = null;
    let subscribed = true;
    const retire = (status: "denied" | "stale") => {
      if (!subscribed || (status === "stale" && live.current !== owner)) return;
      live.current = null;
      halt();
      flight.current = null;
      setView({ owner, status, job: null, accepted: null });
    };
    const unsubscribe = subscribeToTenantAuthEvents(event => {
      const same = realtimeAuthGeneration === `tenant:${event.sessionId}:${user?.id}`;
      if (event.kind === "session-ended" ? same : !same) retire("denied");
    });
    const unsubscribeHost = owner.subscribeRetirement?.(() => retire("stale"));
    return () => {
      subscribed = false;
      live.current = null;
      halt();
      flight.current = null;
      unsubscribe();
      unsubscribeHost?.();
    };
  }, [owner, halt, realtimeAuthGeneration, user?.id]);
  useLayoutEffect(() => {
    if (!recovery) return;
    const fence = () => {
      const run = flight.current;
      if (!run?.accepted || live.current !== owner) return;
      suspend(run);
      // Let the initiating 401 transport enter its shared cookie refresh before aborting this port's wait.
      queueMicrotask(() => {
        if (live.current !== owner || flight.current !== run) return;
        halt();
        flight.current = null;
        setView(null);
      });
    };
    const stopLifecycle = subscribeToTenantAuthLifecycle(({ state }) => {
      if (state === "STALE" || state === "REFRESHING") fence();
    });
    const stopReadiness = subscribeProfileReadiness(() => {
      const profile = readReadyProfileCommit();
      const run = flight.current;
      if (!profile || profile.user.id !== user?.id || !can(profile.user, TEMPLATE_PREVIEW_PERMISSION, target) ||
        (run && "resumeProfile" in run && run.resumeProfile && profile !== run.resumeProfile)) fence();
    });
    return () => { stopLifecycle(); stopReadiness(); };
  }, [recovery, owner, suspend, halt, subscribeProfileReadiness, readReadyProfileCommit, user?.id, target]);
  const current = useCallback(() => live.current === owner && allowed && supported && !blocked && !preparation && pinReady && inputRef.current.current() &&
    Boolean(user?.id && getStoredTenantSessionMeta()?.sessionId) &&
    realtimeAuthGeneration === `tenant:${getStoredTenantSessionMeta()?.sessionId}:${user?.id}`,
  [owner, allowed, supported, blocked, preparation, pinReady, user?.id, realtimeAuthGeneration]);
  const ensureCurrent = useCallback(() => {
    if (current()) return true;
    if (live.current === owner) {
      halt(); live.current = null; flight.current = null;
      setView({ owner, status: "denied", job: null, accepted: null });
    }
    return false;
  }, [current, halt, owner]);
  const publish = useCallback((run: Flight | AcceptedFlight, status: Status) => {
    if (current() && flight.current === run) setView({ owner, status,
      job: "resumeProfile" in run && run.resumeProfile ? null : run.job, accepted: run.accepted });
  }, [current, owner]);
  const observe = useCallback(async (run: Flight | AcceptedFlight): Promise<PdfPreviewJob | null> => {
    if (!ensureCurrent() || flight.current !== run || !run.accepted) return null;
    const profileCurrent = () => !("resumeProfile" in run && run.resumeProfile) || readReadyProfileCommit() === run.resumeProfile;
    if (!profileCurrent()) return null;
    const controller = new AbortController(); io.current = controller;
    let job: PdfPreviewJob;
    try { job = await readPinnedPdfPreview(run.accepted, controller.signal); }
    catch (error) { if (controller.signal.aborted || !ensureCurrent()) return null; throw error; }
    finally { if (io.current === controller) io.current = null; }
    if (controller.signal.aborted || flight.current !== run || !ensureCurrent() || !profileCurrent()) return null;
    assertPdfJobProgress(run.job, job);
    run.job = job;
    if ("resumeProfile" in run) run.resumeProfile = undefined;
    return job;
  }, [ensureCurrent, readReadyProfileCommit]);
  const poll = useCallback(async (run: Flight | AcceptedFlight) => {
    const generation = run.generation;
    const stillPolling = () => flight.current === run && generation === run.generation;
    const finish = (status: Status) => {
      if (status === "denied") suspend(run);
      halt();
      publish(run, status);
    };
    // A slow status read must not extend the monitoring window or publish after it pauses.
    pollDeadline.current = setTimeout(() => {
      if (stillPolling() && ensureCurrent()) finish("paused");
    }, POLL_WINDOW_MS);
    const step = async () => {
      if (!stillPolling() || !ensureCurrent()) return;
      busy.current = true;
      try {
        const job = await observe(run);
        if (!job || !stillPolling()) return;
        if (job.status === "COMPLETED") { finish(Date.parse(job.artifact!.downloadUrlExpiresAt) > Date.now() ? "completed" : "expired"); return; }
        if (job.status === "FAILED") { finish("failed"); return; }
        run.count += 1;
        if (run.count >= MAX_POLLS) { finish("paused"); return; }
        publish(run, job.status === "RETRYING" ? "retrying" : "pending");
        timer.current = setTimeout(() => { void step(); }, POLL_MS);
      } catch (error) { if (stillPolling()) finish(classifyPreviewFailure(error)); }
      finally { if (stillPolling()) busy.current = false; }
    };
    await step();
  }, [ensureCurrent, halt, observe, publish, suspend]);
  const submit = useCallback(async (run: Flight) => {
    if (!ensureCurrent() || busy.current) return;
    busy.current = true; publish(run, "creating");
    const controller = new AbortController(); io.current = controller;
    try {
      const accepted = await createPinnedPdfPreview(run.pin, run.request, run.key, controller.signal);
      if (!ensureCurrent() || flight.current !== run || controller.signal.aborted) return;
      run.accepted = accepted;
      publish(run, "pending"); busy.current = false;
      await poll(run);
    } catch (error) {
      if (controller.signal.aborted || flight.current !== run || !ensureCurrent()) return;
      const status = classifyPreviewFailure(error);
      const normalized = normalizeApiError(error);
      const rejected = [400, 404, 409, 422].includes(normalized.status) && !requiresSameKeyRecovery(normalized);
      // An invalid/lost create response can follow a committed job. Retain the exact key/body for explicit reconciliation.
      publish(run, ["denied", "expired", "stale"].includes(status) ? status : normalized.status === 404 ? "unavailable" : rejected ? "failed" : "unknown");
    } finally {
      if (io.current === controller) {
        io.current = null;
        busy.current = false;
      }
    }
  }, [ensureCurrent, publish, poll]);
  const visible = view?.owner === owner ? view : null;
  const status: Status = !allowed ? "denied" : !supported ? "unsupported" : blocked ? "blocked" :
    held && !reauthorized ? "denied" : preparation ?? (!pinReady ? "stale" : held ? "unavailable" : visible?.status ?? "idle");
  const canResumeHeld = !!held && reauthorized && held.expiresAt > Date.now() && allowed && supported &&
    pinReady && !blocked && !preparation;
  const canCreate = fixtureKey.length > 0 && allowed && supported && pinReady && !blocked && !preparation &&
    ["idle", "failed", "expired", "invalid"].includes(status);
  const versionPin = published?.version;
  const start = useCallback(async () => {
    if (!canCreate || !ensureCurrent() || busy.current) return;
    halt();
    const pin: PreviewPdfPin = versionPin ?? { templateId: template.id, draftId: template.currentDraft.draftId,
      draftRevision: template.currentDraft.revision, templateContentChecksum: template.currentDraft.contentChecksum };
    const source: PreviewRequest["source"] = "versionId" in pin ? { kind: "VERSION", versionId: pin.versionId }
      : { kind: "DRAFT", draftRevision: pin.draftRevision };
    const run: Flight = { owner, key: generateUUIDv7(), pin, count: 0, generation: 0, accepted: null, job: null,
      request: { source, fixtureKey, locale: template.locale, timeZone: "Africa/Cairo" } };
    flight.current = run; await submit(run);
  }, [canCreate, ensureCurrent, fixtureKey, halt, template, owner, submit, versionPin]);
  const recover = useCallback(async () => {
    const run = flight.current;
    if (run?.owner === owner && "request" in run && !run.accepted && status === "unknown") await submit(run);
  }, [owner, status, submit]);
  const resume = useCallback(async () => {
    if (held) {
      if (!canResumeHeld || !ready || recovery?.read() !== held ||
        held.expiresAt <= Date.now() || readReadyProfileCommit() !== ready || !ensureCurrent() || busy.current) return;
      halt();
      const run: AcceptedFlight = { owner, accepted: held.accepted, job: held.previousStatus,
        count: 0, generation: 0, resumeProfile: ready };
      flight.current = run;
      setFixture(held.fixtureKey);
      recovery.clear();
      publish(run, "pending");
      await poll(run);
      return;
    }
    const run = flight.current;
    if (!ensureCurrent() || busy.current || run?.owner !== owner || !run.accepted ||
      !["stopped", "paused", "unavailable"].includes(status)) return;
    halt(); run.count = 0; publish(run, run.job?.status === "RETRYING" ? "retrying" : "pending"); await poll(run);
  }, [owner, status, held, ready, canResumeHeld, recovery, readReadyProfileCommit, ensureCurrent, halt, publish, poll]);
  const stop = useCallback(() => {
    const run = flight.current;
    if (!ensureCurrent() || run?.owner !== owner || !["pending", "retrying"].includes(status)) return;
    halt(); publish(run, "stopped");
  }, [ensureCurrent, owner, status, halt, publish]);
  const download = useCallback(async () => {
    const run = flight.current;
    const job = run?.job;
    if (!ensureCurrent() || busy.current || run?.owner !== owner || !job?.artifact || !["completed", "popup"].includes(status)) return;
    const expiresAt = Date.parse(job.artifact.downloadUrlExpiresAt);
    if (expiresAt <= Date.now()) { publish(run, "expired"); return; }
    const opened = window.open("about:blank", "_blank");
    if (!opened) { publish(run, "popup"); return; }
    opened.opener = null;
    const close = () => {
      if (closeDownload.current !== close) return;
      closeDownload.current = null;
      opened.close();
    };
    closeDownload.current = close;
    const controller = new AbortController();
    const assertCurrent = () => {
      if (!ensureCurrent() || flight.current !== run || run.job !== job) throw new DOMException("Preview changed", "AbortError");
    };
    io.current = controller;
    busy.current = true; publish(run, "checking");
    try {
      const blob = await fetchPinnedPdfArtifact(job, controller.signal, assertCurrent);
      if (controller.signal.aborted || !ensureCurrent() || flight.current !== run || run.job !== job) return;
      if (Date.now() >= expiresAt) { publish(run, "expired"); return; }
      if (!opened.closed) savePreviewPdf(blob, `template-preview-${job.renderJobId}.pdf`);
      publish(run, "completed");
    } catch (error) {
      if (!controller.signal.aborted && ensureCurrent()) {
        const failure = classifyPreviewFailure(error);
        if (failure === "denied") suspend(run);
        publish(run, failure);
      }
    } finally {
      if (io.current === controller) io.current = null;
      close();
      if (current() && flight.current === run) busy.current = false;
    }
  }, [current, ensureCurrent, owner, status, publish, suspend]);
  useLayoutEffect(() => {
    const artifact = visible?.job?.artifact;
    if (!artifact || !["completed", "popup"].includes(status)) return;
    const run = flight.current;
    if (!run) return;
    // Bounded wakeups also handle wall-clock changes; every action independently checks expiry.
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    const expire = () => {
      const remaining = Date.parse(artifact.downloadUrlExpiresAt) - Date.now();
      if (remaining <= 0) publish(run, "expired");
      else expiryTimer = setTimeout(expire, Math.min(remaining, 30_000));
    };
    expire();
    return () => clearTimeout(expiryTimer);
  }, [visible?.job?.artifact, status, publish]);
  const reloadInvalid = status === "invalid" && preparation === "invalid" ? input.reloadInvalidPreparation : undefined;
  const output = ["completed", "popup", "checking"].includes(status) ? visible?.job ?? null : null;
  const metadataVisible = !held && !["denied", "invalid", "stale", "expired", "blocked", "unsupported", "preparing"].includes(status);
  return { status, fixtures, fixtureKey, setFixture, start, recover, resume, stop, download, job: output,
    capabilities: currentPreviewCapabilities,
    refresh: reloadInvalid ?? input.reload,
    revision: versionPin?.versionNumber ?? template.currentDraft.revision,
    // Infrastructure prerequisites can retry before any numbered render attempt. Zero is real metadata, not missing progress.
    attempts: metadataVisible ? visible?.job?.attemptCount ?? null : null,
    nextRetryAt: metadataVisible && ["pending", "retrying", "paused", "stopped", "unavailable"].includes(status)
      ? visible?.job?.nextRetryAt ?? null : null,
    filename: output ? `template-preview-${output.renderJobId}.pdf` : null,
    canCreate,
    canResume: canResumeHeld || (!held && !!visible?.accepted && ["paused", "stopped", "unavailable"].includes(status)),
    canRefresh: !!reloadInvalid || status === "stale" || (status === "unavailable" && !visible?.accepted && !canResumeHeld),
    canChooseFixture: !published && ["idle", "failed", "expired", "invalid"].includes(status),
  };
}

function savePreviewPdf(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  try {
    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    // Browsers need a task to consume the object URL after the click.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
