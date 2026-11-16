"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTenantAuth, type TenantProfileCommit } from "@/context/AuthContext";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { getStoredTenantSessionMeta } from "@/lib/api/axiosClient";
import { createWriteAttempt, IDEMPOTENCY_KEY_HEADER, type WriteAttempt } from "@/lib/api/idempotent-write";
import { resolveOrganizationScope } from "@/lib/api/organization-scope";
import { requiresSameKeyRecovery } from "@/lib/api/outcomes";
import { corePostResponse } from "../../../core-api";
import { invalidCoreResponse, record } from "../../../contracts/core-page";
import {
  fetchTemplateVersion,
  fetchTemplateVersions,
  publishTemplate,
  restoreTemplateVersion,
  retireTemplateVersion,
  validateTemplateDraft,
} from "../../template-lifecycle-api";
import {
  parseValidationRun,
  parseTemplateVersion,
  STALE_REVISION_CODE,
  type TemplateValidationRun,
  type TemplateVersion,
} from "../../template-lifecycle-contract";
import { templatePath, type TemplateCursorPage, type TemplateDetail } from "../../templates-contract";
import { InvalidVersionRestoreReply, readTemplateResponse, TEMPLATE_DRAFT_RESPONSE_LIMIT_BYTES } from "../../template-wire";
import type { TemplateGrants } from "./useTemplateDetail";
import { isExpiredCursor, useTemplateCursor } from "../../hooks/useTemplateCursor";
import { useTemplateVersionDetail } from "./useTemplateVersionDetail";
import type { VersionAuthority } from "./useTemplateVersionAuthority";
import { hasSalesDraftTyping, salesDraftEditorOwnerKey, subscribeSalesDraftTyping } from "./sales-draft-typing-storage";
import { clearSalesPublishScope, isSalesPublishAttemptCurrent, retainSalesPublishAttempt,
  salesPublishRecoveryKey, salesPublishRecoveryScope } from "./sales-publish-recovery";

type ReleaseAction = "validate" | "publish";
type SalesPublishReceipt = Omit<PublishedReceipt, "profile"> & { replayed: boolean };
const VERIFIED_PRINT_DOCUMENT_TYPES: readonly TemplateDetail["documentType"][] = [
  "PURCHASE_QUOTATION", "PURCHASE_ORDER", "SALES_ORDER", "INVOICE", "CONTRACT",
];
type PublishedReceipt = {
  templateId: string;
  definitionRevision: number;
  version: TemplateVersion;
  direction: "LTR" | "RTL";
  profile: TenantProfileCommit;
};
const noReadyProfile = () => null;
const noRetainedTyping = () => false;

function requiresTemplateCommandRecovery(failure: NormalizedApiError) {
  return requiresSameKeyRecovery(failure) || failure.code === "CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT" ||
    failure.code === "RESPONSE_TARGET_UNCONFIRMED";
}

function assertReleaseResponseTarget(response: Awaited<ReturnType<typeof corePostResponse>>, path: string) {
  const target = response.request;
  if (response.provenance !== "http" || !target?.origin || target.method !== "POST" ||
    target.endpoint !== path || target.redirected !== false || target.finalUrl !== `${target.origin}${path}`) {
    invalidCoreResponse();
  }
}

async function validateSalesQuotation(
  template: TemplateDetail,
  body: Parameters<typeof validateTemplateDraft>[1],
  attempt: WriteAttempt,
  assertCurrent: () => void,
  issueMessage: (code: string) => string,
): Promise<TemplateValidationRun> {
  const path = `${templatePath(template.id)}/validate` as const;
  const draft = template.currentDraft;
  const scope = resolveOrganizationScope("OPTIONAL_COMPANY_BRANCH", {
    companyId: template.scope.companyId ?? null,
    branchId: template.scope.branchId ?? null,
  });
  if (!scope.ok) invalidCoreResponse();
  const response = await corePostResponse(path, body, {
    headers: { ...scope.headers, "If-Match": draft.etag, [IDEMPOTENCY_KEY_HEADER]: attempt.idempotencyKey },
    nonReplayable: true, redirect: "error", requireExactResponseTarget: true, assertCurrent,
    maxResponseBytes: 400_000,
  });
  assertCurrent();
  assertReleaseResponseTarget(response, path);
  const envelope = record(response.data);
  const receipt = record(readTemplateResponse(response, [200]));
  const targets = receipt?.rendererTargets;
  if (envelope?.success !== true || !Object.hasOwn(envelope, "data") || !receipt ||
    receipt.templateId !== template.id || receipt.draftId !== draft.draftId ||
    receipt.draftRevision !== body.draftRevision || receipt.candidateChecksum !== draft.contentChecksum ||
    receipt.dataSourceKey !== template.dataSourceKey || !Array.isArray(receipt.issues) ||
    !Array.isArray(targets) || targets.length !== body.rendererTargets.length ||
    !body.rendererTargets.every((target, index) => targets[index] === target)) invalidCoreResponse();

  // Core validation issues carry message keys, while the panel reads display text.
  const issues = receipt.issues.map(value => {
    const issue = record(value);
    if (!issue || typeof issue.code !== "string" ||
      (typeof issue.message !== "string" && typeof issue.messageKey !== "string")) invalidCoreResponse();
    return { ...issue, message: typeof issue.message === "string" ? issue.message : issueMessage(issue.code) };
  });
  return parseValidationRun({ ...receipt, issues });
}

async function publishSalesQuotation(
  template: TemplateDetail,
  body: Parameters<typeof publishTemplate>[1],
  attempt: WriteAttempt,
  assertCurrent: () => void,
  assertPublishCurrent: () => void,
): Promise<SalesPublishReceipt> {
  const path = `${templatePath(template.id)}/publish` as const;
  const response = await corePostResponse(path, body, {
    headers: { "If-Match": template.currentDraft.etag, [IDEMPOTENCY_KEY_HEADER]: attempt.idempotencyKey },
    nonReplayable: true,
    redirect: "error", requireExactResponseTarget: true, assertCurrent: assertPublishCurrent,
    maxResponseBytes: TEMPLATE_DRAFT_RESPONSE_LIMIT_BYTES,
  });
  assertCurrent();
  assertReleaseResponseTarget(response, path);
  const envelope = record(response.data);
  if (envelope?.success !== true || !Object.hasOwn(envelope, "data") ||
    ["version", "definitionRevision", "definitionEtag", "consumedDraftRevision", "draftEtag"].some(key => Object.hasOwn(envelope, key))) {
    invalidCoreResponse();
  }
  const receipt = record(readTemplateResponse(response, [201]));
  const definitionRevision = body.definitionRevision + 1;
  const responseEtag = response.headers.get("etag");
  if (!receipt || receipt.definitionRevision !== definitionRevision || receipt.definitionEtag !== `"${definitionRevision}"` ||
    (responseEtag !== null && responseEtag !== receipt.definitionEtag) ||
    receipt.consumedDraftRevision !== body.draftRevision || receipt.draftEtag !== `"${body.draftRevision + 1}"`) {
    invalidCoreResponse();
  }

  const wire = record(receipt.version);
  const document = record(wire?.editorDocument);
  const version = parseTemplateVersion(wire);
  const direction = wire?.direction;
  const documentDirection = document?.direction;
  if (wire?.templateDefinitionId !== template.id ||
    response.headers.get("location") !== `${templatePath(template.id)}/versions/${version.id}` ||
    version.id === template.currentPublishedVersion?.versionId ||
    version.lifecycleStatus !== "PUBLISHED" || wire.retiredAt !== null || version.validationRunId !== body.validationRunId ||
    !version.compilerVersion ||
    wire.changeNote !== (body.changeNote ?? null) ||
    version.templateContentChecksum !== template.currentDraft.contentChecksum ||
    !/^[a-f0-9]{64}$/u.test(version.templateContentChecksum) || version.locale !== template.locale ||
    version.dataSourceKey !== template.dataSourceKey || wire.documentType !== template.documentType ||
    wire.outputChannel !== template.outputChannel || wire.layoutMode !== template.layoutMode ||
    !document || typeof wire.editorSchemaVersion !== "number" || !Number.isSafeInteger(wire.editorSchemaVersion) ||
    wire.editorSchemaVersion < 1 || document.schemaVersion !== wire.editorSchemaVersion || document.locale !== version.locale ||
    document.dataSourceKey !== version.dataSourceKey || document.documentType !== wire.documentType ||
    document.outputChannel !== wire.outputChannel || document.layoutMode !== wire.layoutMode ||
    (direction !== "LTR" && direction !== "RTL") ||
    (documentDirection !== "AUTO" && documentDirection !== "LTR" && documentDirection !== "RTL")) invalidCoreResponse();

  const [{ canonicalJson, resolveTemplateTextDirection }, { sha256 }] = await Promise.all([
    import("@mutakamel/template-schema/browser-safe"),
    import("@noble/hashes/sha2.js"),
  ]);
  assertCurrent();
  const checksum = Array.from(sha256(new TextEncoder().encode(canonicalJson(document))),
    byte => byte.toString(16).padStart(2, "0")).join("");
  // Restoring a historical version can give the saved draft its own direction.
  if (checksum !== version.templateContentChecksum || direction !== resolveTemplateTextDirection(documentDirection, template.locale)) {
    invalidCoreResponse();
  }
  return {
    templateId: template.id, definitionRevision, version, direction,
    replayed: response.headers.get("idempotency-replayed") === "true",
  };
}

function matchesPublishedVersion(version: TemplateVersion, receipt: Pick<PublishedReceipt, "version">) {
  const published = receipt.version;
  return version.id === published.id && version.versionNumber === published.versionNumber &&
    version.publishedAt === published.publishedAt && version.locale === published.locale &&
    version.dataSourceKey === published.dataSourceKey && version.templateContentChecksum === published.templateContentChecksum;
}

async function verifySalesPublishReadback(template: TemplateDetail, receipt: SalesPublishReceipt, assertCurrent: () => void) {
  const scope = resolveOrganizationScope("OPTIONAL_COMPANY_BRANCH", {
    companyId: template.scope.companyId ?? null,
    branchId: template.scope.branchId ?? null,
  });
  if (!scope.ok) invalidCoreResponse();
  const version = await fetchTemplateVersion(template.id, receipt.version.id, undefined, {
    selected: receipt.version, scope: { headers: scope.headers, locale: template.locale }, assertCurrent,
  });
  assertCurrent();
  const published = receipt.version;
  if (!matchesPublishedVersion(version, receipt) || version.lifecycleStatus !== published.lifecycleStatus ||
    version.retiredAt !== published.retiredAt || version.changeNote !== published.changeNote ||
    version.validationRunId !== published.validationRunId || version.compilerVersion !== published.compilerVersion ||
    version.rendererTargets.length !== published.rendererTargets.length ||
    !version.rendererTargets.every((target, index) => target === published.rendererTargets[index])) invalidCoreResponse();
}

function createHistoryAccess(versionOwner: VersionAuthority) {
  let active = false;
  let denied = false;
  const listeners = new Set<() => void>();
  const retire = () => {
    listeners.forEach(listener => listener());
    listeners.clear();
  };
  const owner: VersionAuthority = {
    key: versionOwner.key,
    scope: versionOwner.scope,
    isCurrent: () => active && !denied && versionOwner.isCurrent(),
    onRetire(listener) {
      if (!owner.isCurrent()) {
        listener();
        return () => {};
      }
      listeners.add(listener);
      const unsubscribe = versionOwner.onRetire(listener);
      return () => {
        unsubscribe();
        listeners.delete(listener);
      };
    },
  };
  return {
    owner,
    activate() {
      active = true;
      return () => { active = false; retire(); };
    },
    deny() {
      denied = true;
      retire();
    },
  };
}

/**
 * Validation, publish and versions.
 *
 * Publishing pins **three** things separately — the definition revision in
 * the body, the draft revision in both `If-Match` and the body, and a passed
 * validation run for that exact draft revision. All three are surfaced before
 * the button enables, because a publish button that fails on click is what
 * this design prevents.
 */
export function useTemplateRelease(
  template: TemplateDetail | null,
  grants: TemplateGrants,
  onReload: () => void,
  versionOwner: VersionAuthority | null,
) {
  const { t } = useI18n();
  const toast = useToast();
  const { authState, user, realtimeAuthGeneration, readReadyProfileCommit, subscribeProfileReadiness } = useTenantAuth();
  const profile = useSyncExternalStore(subscribeProfileReadiness, readReadyProfileCommit, noReadyProfile);
  const actorId = user?.id;
  const releaseAuthority = useMemo(() => ({ profile, actorId, generation: realtimeAuthGeneration }),
    [profile, actorId, realtimeAuthGeneration]);
  const readRetainedTyping = useCallback(() => {
    if (!template || template.dataSourceKey !== "TRADE_QUOTATION_PRINT_V1" || authState !== "AUTHENTICATED" ||
      !user?.id || !realtimeAuthGeneration) return false;
    const session = getStoredTenantSessionMeta();
    return session?.authorizationVersion !== undefined && realtimeAuthGeneration === `tenant:${session.sessionId}:${user.id}` &&
      hasSalesDraftTyping(template, authState, user.id, realtimeAuthGeneration, session.authorizationVersion);
  }, [template, authState, user?.id, realtimeAuthGeneration]);
  const hasUnsavedTyping = useSyncExternalStore(subscribeSalesDraftTyping, readRetainedTyping, noRetainedTyping);
  const copy = t.coreOperations.templates;
  const pagination = useTemplateCursor();
  const { cursor, restart } = pagination;
  const access = useMemo(() => versionOwner && grants.canRead ? createHistoryAccess(versionOwner) : null,
    [versionOwner, grants.canRead]);
  const historyOwner = access?.owner ?? null;
  useLayoutEffect(() => access?.activate(), [access]);

  const [validation, setValidation] = useState<{
    run: TemplateValidationRun;
    authority: typeof releaseAuthority;
    templateId: string;
    salesTarget: string | null;
  } | null>(null);
  const [history, setHistory] = useState<{
    templateId: string | null;
    owner: VersionAuthority | null;
    page: TemplateCursorPage<TemplateVersion> | null;
  }>({ templateId: template?.id ?? null, owner: historyOwner, page: null });
  const [versionsError, setVersionsError] = useState<NormalizedApiError | null>(null);
  const [isLoadingVersions, setIsLoadingVersions] = useState(true);
  const [pendingVersionId, setPendingVersionId] = useState<string | null>(null);
  const [restoreSelection, setRestoreSelection] = useState<{ version: TemplateVersion; scope: typeof commandScope } | null>(null);
  const [retiring, setRetiring] = useState<TemplateVersion | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const listRequest = useRef<AbortController | null>(null);
  const reload = useCallback(() => {
    listRequest.current?.abort();
    setReloadToken(token => token + 1);
  }, []);

  const templateId = template?.id ?? null;
  const versionSelection = useTemplateVersionDetail(templateId, versionsError?.status === 403 ? null : historyOwner);
  const draft = template?.currentDraft;
  const definitionRevision = template?.definitionRevision;
  const { openVersion } = versionSelection;
  const [publishedReceipt, setPublishedReceipt] = useState<PublishedReceipt | null>(null);
  const autoOpen = useRef<{ receipt: PublishedReceipt; openedWith: VersionAuthority | null } | null>(null);
  const salesTarget = template?.dataSourceKey === "TRADE_QUOTATION_PRINT_V1" ? JSON.stringify([
    template.id, template.scope.type, template.scope.companyId, template.scope.branchId,
    template.dataSourceKey, template.outputChannel, template.locale,
    template.currentDraft.draftId, template.currentDraft.revision, template.currentDraft.etag, template.currentDraft.contentChecksum,
  ]) : null;
  const commandScope = useMemo(() => [
    templateId, definitionRevision, template?.lifecycleStatus, template?.direction, draft?.draftId, draft?.revision, draft?.etag,
    draft?.contentChecksum, grants.canRead, grants.canUpdate, grants.canPublish, releaseAuthority, versionOwner, salesTarget,
  ] as const, [templateId, definitionRevision, template?.lifecycleStatus, template?.direction, draft?.draftId, draft?.revision, draft?.etag,
    draft?.contentChecksum, grants.canRead, grants.canUpdate, grants.canPublish, releaseAuthority, versionOwner, salesTarget]);
  const [rejectedValidationDraft, setRejectedValidationDraft] = useState<{ templateId: string; revision: number } | null>(null);
  const validationNeedsReload = salesTarget !== null && draft !== undefined &&
    rejectedValidationDraft?.templateId === templateId && draft.revision <= rejectedValidationDraft.revision;
  const restoring = restoreSelection?.scope === commandScope ? restoreSelection.version : null;
  const writeScope = useMemo(() => ({ commandScope, validation }), [commandScope, validation]);
  const activeScope = useRef<typeof writeScope | null>(null);
  const [write, setWrite] = useState<{ scope: typeof writeScope; action: ReleaseAction } | null>(null);
  const writeRequest = useRef<typeof write>(null);
  const validationAttempt = useRef<WriteAttempt | null>(null);
  const publishAttempts = useRef(new Map<string, { attempt: WriteAttempt; receipt?: SalesPublishReceipt }>());
  useLayoutEffect(() => () => { validationAttempt.current = null; }, [commandScope]);
  useLayoutEffect(() => {
    const attempts = publishAttempts.current;
    activeScope.current = writeScope;
    return () => {
      activeScope.current = null;
      writeRequest.current = null;
      attempts.clear();
    };
  }, [writeScope]);

  if (history.templateId !== templateId || history.owner !== historyOwner) {
    restart(false);
    setHistory({ templateId, owner: historyOwner, page: null });
    setIsLoadingVersions(true);
    setVersionsError(null);
    setPendingVersionId(null);
    setRestoreSelection(null);
    setRetiring(null);
  }

  useEffect(() => {
    if (!templateId || !access?.owner.isCurrent()) return;
    const { owner } = access;
    const controller = new AbortController();
    listRequest.current = controller;
    const stop = owner.onRetire(() => controller.abort());
    const isCurrent = () => !controller.signal.aborted && owner.isCurrent();
    queueMicrotask(() => {
      if (!isCurrent()) return;
      void (async () => {
        setIsLoadingVersions(true);
        setVersionsError(null);
        try {
          const page = await fetchTemplateVersions(templateId, { cursor, signal: controller.signal, scope: owner.scope });
          if (isCurrent()) setHistory((current) => current.owner === owner ? { ...current, page } : current);
        } catch (error) {
          if (!isCurrent()) return;
          const normalized = normalizeApiError(error);
          if (normalized.status === 403) {
            // Retire the live binding before React replaces handlers or closes the detail.
            access.deny();
            restart(false);
            setHistory((current) => current.owner === owner ? { ...current, page: null } : current);
            setPendingVersionId(null);
            setRestoreSelection(null);
            setRetiring(null);
            setVersionsError(normalized);
            setIsLoadingVersions(false);
            return;
          }
          if (cursor && isExpiredCursor(normalized)) restart(true);
          else setVersionsError(normalized);
        } finally {
          if (isCurrent()) setIsLoadingVersions(false);
        }
      })();
    });
    return () => {
      stop();
      controller.abort();
      if (listRequest.current === controller) listRequest.current = null;
    };
  }, [templateId, cursor, restart, reloadToken, access]);

  const historyCurrent = historyOwner !== null && history.owner === historyOwner && history.templateId === templateId;
  const receipt = publishedReceipt && publishedReceipt.templateId === templateId && publishedReceipt.profile === profile
    ? publishedReceipt
    : null;

  useEffect(() => {
    const selection = autoOpen.current;
    if (!receipt || !selection || selection.receipt !== receipt) return;
    if (!historyOwner?.isCurrent() || readReadyProfileCommit() !== receipt.profile) {
      autoOpen.current = null;
      return;
    }
    if (selection.openedWith === historyOwner || definitionRevision === undefined ||
      definitionRevision < receipt.definitionRevision || !historyCurrent || cursor || !history.page) return;

    // A direction edit advances the definition and the draft. The immutable
    // version in the receipt can still be read under the new history authority.
    const row = history.page.items.find(version => matchesPublishedVersion(version, receipt));
    if (!row) return;
    selection.openedWith = historyOwner;
    void openVersion(row, undefined, receipt.version);
  }, [receipt, definitionRevision, cursor, historyCurrent, history.page, historyOwner, openVersion, readReadyProfileCommit]);

  const changeVersionPage = (direction: "previous" | "next") => {
    if (!historyCurrent || !historyOwner?.isCurrent() || isLoadingVersions || pendingVersionId !== null) return;
    const nextCursor = history.page?.hasNextPage ? history.page.nextCursor : null;
    if (direction === "next" ? !nextCursor : !pagination.canGoBack) return;
    listRequest.current?.abort();
    if (direction === "next") pagination.advance(nextCursor);
    else pagination.goBack();
    setHistory({ ...history, page: null });
    setIsLoadingVersions(true);
    setVersionsError(null);
  };

  const report = useCallback(
    (error: unknown, title: string): void => {
      const normalized = normalizeApiError(error);
      if (normalized.status === 403) return;
      if (toast.outcomeFromApi(normalized)) return;
      toast.errorFromApi(title, normalized);
    },
    [toast],
  );

  const run = validation && validation.templateId === templateId && validation.authority === releaseAuthority
    ? validation.run
    : null;
  const isRunCurrent = run !== null && draft !== undefined &&
    run.draftId === draft.draftId && run.draftRevision === draft.revision && validation?.salesTarget === salesTarget;
  const verifyPrintPublication = template !== null && VERIFIED_PRINT_DOCUMENT_TYPES.includes(template.documentType);
  const canPublish = grants.canRead && grants.canPublish && template?.lifecycleStatus === "ACTIVE" &&
    (!verifyPrintPublication || (versionOwner !== null && template.outputChannel === "PRINT")) &&
    isRunCurrent && run?.status === "PASSED" && !hasUnsavedTyping;

  const performWrite = async (action: ReleaseAction,
    execute: (isCurrent: () => boolean, assertCurrent: () => void) => Promise<void>) => {
    if (activeScope.current !== writeScope || writeRequest.current || !grants.canRead || !profile ||
      profile.user?.id !== actorId || readReadyProfileCommit() !== profile || (versionOwner && !versionOwner.isCurrent())) return;
    const request = { scope: writeScope, action };
    writeRequest.current = request;
    setWrite(request);
    const isCurrent = () => writeRequest.current === request &&
      readReadyProfileCommit() === profile && (!versionOwner || versionOwner.isCurrent());
    const assertCurrent = () => {
      if (!isCurrent()) throw new DOMException("Template release authority changed.", "AbortError");
    };
    try {
      await execute(isCurrent, assertCurrent);
    } catch (error) {
      if (!isCurrent()) return;
      if (action === "publish" && salesTarget) {
        const failure = normalizeApiError(error);
        if ((failure.status === 409 || failure.status === 422) && failure.code === "CORE.TEMPLATE.PUBLISH.VALIDATION_STALE") {
          activeScope.current = null;
          setValidation(null);
          toast.errorFromApi(copy.publishFailed, { ...failure, message: t.coreOperations.errors[failure.code] });
          return;
        }
      }
      report(error, action === "validate" ? copy.validationRunFailed : copy.publishFailed);
    } finally {
      if (writeRequest.current === request) {
        writeRequest.current = null;
        setWrite(null);
      }
    }
  };

  const validate = async (): Promise<void> => {
    const pendingAttempt = validationAttempt.current;
    if (!template || !profile || !grants.canUpdate || validationNeedsReload) return;
    await performWrite("validate", async (isCurrent, assertCurrent) => {
      const rendererTargets =
        template.outputChannel === "EMAIL" ? ["EMAIL_HTML", "EMAIL_TEXT"] : ["HTML", "PDF"];
      const body = { draftRevision: template.currentDraft.revision, rendererTargets };
      let result: TemplateValidationRun;
      if (salesTarget) {
        const attempt = pendingAttempt ?? createWriteAttempt();
        try {
          result = await validateSalesQuotation(template, body, attempt, assertCurrent,
            code => t.coreOperations.errors[code] ?? copy.validationFailed);
        } catch (error) {
          if (isCurrent()) {
            const failure = normalizeApiError(error);
            if (requiresTemplateCommandRecovery(failure)) validationAttempt.current = attempt;
            if (validation && (failure.status === 401 || failure.status === 403 || failure.status === 404 ||
              failure.code === STALE_REVISION_CODE)) {
              // The current denial invalidates publish evidence but cannot settle an earlier lost response.
              activeScope.current = null;
              setValidation(null);
            }
            if (failure.code === STALE_REVISION_CODE) {
              // A definite rejection follows the revision across authority changes. Pending attempts still replay.
              if (failure.status === 409 && !validationAttempt.current) {
                activeScope.current = null;
                setRejectedValidationDraft({ templateId: template.id, revision: body.draftRevision });
              }
              onReload();
            }
          }
          throw error;
        }
      } else {
        result = await validateTemplateDraft(template.id, body, template.currentDraft.etag);
      }
      if (!isCurrent()) return;
      validationAttempt.current = null;
      activeScope.current = null;
      setValidation({ run: result, authority: releaseAuthority, templateId: template.id, salesTarget });
      toast.success(copy.savedTitle, result.status === "PASSED" ? copy.validationPassed : copy.validationFailed);
      onReload();
    });
  };

  const publish = async (changeNote: string): Promise<void> => {
    if (!template || !profile || !run || !canPublish || readRetainedTyping()) return;
    const publishFenced = new DOMException("The quotation publication authority changed.", "AbortError");
    const recoveryUnconfirmed = new DOMException("The quotation publication recovery could not be confirmed.", "AbortError");
    await performWrite("publish", async (isCurrent, assertCurrent) => {
      const note = (salesTarget ? changeNote.normalize("NFC") : changeNote).trim();
      const body = {
        definitionRevision: template.definitionRevision,
        draftRevision: template.currentDraft.revision,
        validationRunId: run.id,
        ...(note ? { changeNote: note } : {}),
        setAsDefinitionPublished: true as const,
      };
      let result: Awaited<ReturnType<typeof publishSalesQuotation>> | undefined;
      if (salesTarget) {
        // The write scope pins the route, ETag, validation run and session.
        // Core and Gateway also fingerprint the note, so a changed note needs its own key.
        const attempts = publishAttempts.current;
        const session = getStoredTenantSessionMeta();
        const recoveryScope = authState === "AUTHENTICATED" && user?.id && session?.authorizationVersion !== undefined &&
          realtimeAuthGeneration === `tenant:${session.sessionId}:${user.id}`
          ? salesPublishRecoveryScope(JSON.stringify([salesDraftEditorOwnerKey(template, authState, user.id, realtimeAuthGeneration, true),
            session.authorizationVersion]), salesTarget, body.definitionRevision)
          : null;
        const recoveryKey = recoveryScope && salesPublishRecoveryKey(recoveryScope, template.currentDraft.etag, body);
        const pending = attempts.get(note);
        const createAttempt = () => pending?.attempt ?? createWriteAttempt();
        const attempt = recoveryKey ? retainSalesPublishAttempt(recoveryKey, createAttempt) : createAttempt();
        const requirePublishReadback = () => {
          attempts.delete(note);
          reload();
          onReload();
          toast.errorFromApi(copy.publishOutcomeUnconfirmed, { status: 409, message: copy.publishRecoveryExpired });
        };
        if (!attempt) {
          requirePublishReadback();
          return;
        }
        const assertPublishCurrent = () => {
          assertCurrent();
          if (readRetainedTyping()) throw publishFenced;
          if (recoveryKey) {
            const currentSession = getStoredTenantSessionMeta();
            if (currentSession?.sessionId !== session?.sessionId ||
              currentSession?.authorizationVersion !== session?.authorizationVersion) throw publishFenced;
            if (!isSalesPublishAttemptCurrent(recoveryKey, attempt)) throw recoveryUnconfirmed;
          }
        };
        try {
          result = pending?.attempt.idempotencyKey === attempt.idempotencyKey ? pending.receipt : undefined;
          result ??= await publishSalesQuotation(template, body, attempt, assertCurrent, assertPublishCurrent);
          assertPublishCurrent();
          if (result.replayed) {
            // A replay receipt can be kept with the exact key while its readback is unavailable.
            attempts.set(note, { attempt, receipt: result });
            try {
              await verifySalesPublishReadback(template, result, assertPublishCurrent);
              assertPublishCurrent();
            } catch {
              assertPublishCurrent();
              toast.errorFromApi(copy.publishOutcomeUnconfirmed, { status: 502, message: copy.versionsLoadFailed });
              return;
            }
          }
        } catch (error) {
          if (error === recoveryUnconfirmed) {
            if (isCurrent()) requirePublishReadback();
            return;
          }
          if (error === publishFenced) {
            // Keep the key in case the transport checked authority after Core received the request.
            if (isCurrent()) attempts.set(note, { attempt, receipt: result?.replayed ? result : undefined });
            return;
          }
          // A rejected retry can stop at Gateway before Core can return the stored receipt.
          if (isCurrent()) {
            const failure = normalizeApiError(error);
            if (requiresTemplateCommandRecovery(failure)) attempts.set(note, { attempt });
            if (recoveryKey && (failure.code === STALE_REVISION_CODE || failure.code === "CORE.TEMPLATE.IDEMPOTENCY.MISMATCH" ||
              failure.code === "GW.IDEM.MISMATCH")) {
              // Preserve a different note's unresolved command while retiring this attempt.
              attempts.delete(note);
              if (failure.code === STALE_REVISION_CODE) {
                activeScope.current = null;
                setValidation(null);
                onReload();
              }
            }
          }
          throw error;
        }
        if (recoveryScope) clearSalesPublishScope(recoveryScope);
      } else {
        await publishTemplate(template.id, body, template.currentDraft.etag, verifyPrintPublication && versionOwner ? {
          scope: versionOwner.scope,
          dataSourceKey: template.dataSourceKey,
          currentVersionId: template.currentPublishedVersion?.versionId ?? null,
          assertCurrent,
        } : undefined);
      }
      if (!isCurrent()) return;
      validationAttempt.current = null;
      activeScope.current = null;
      toast.success(copy.savedTitle, copy.published);
      setValidation(null);
      if (result && historyOwner?.isCurrent()) {
        const admittedReceipt = { ...result, profile };
        autoOpen.current = { receipt: admittedReceipt, openedWith: null };
        setPublishedReceipt(admittedReceipt);
        restart(false);
      }
      reload();
      onReload();
    });
  };

  const restoreVersion = useCallback(
    async (reason: string): Promise<void> => {
      const isCurrent = () => activeScope.current?.commandScope === commandScope && historyOwner?.isCurrent();
      if (!template || !restoring || !grants.canRestore || pendingVersionId || !isCurrent()) return;
      setPendingVersionId(restoring.id);
      try {
        const replayed = await restoreTemplateVersion(
          template.id,
          restoring.id,
          { reason, discardCurrentDraft: true },
          {
            draftId: template.currentDraft.draftId,
            revision: template.currentDraft.revision,
            etag: template.currentDraft.etag,
            assertCurrent() {
              if (!isCurrent()) throw new DOMException("Template restore authority changed.", "AbortError");
            },
          },
        );
        if (isCurrent()) {
          if (replayed) toast.info(copy.versionRestoreReplayTitle, copy.versionRestoreReplayLoading);
          else toast.success(copy.savedTitle, copy.versionRestored);
          onReload();
        }
      } catch (error) {
        if (isCurrent()) {
          if (error instanceof InvalidVersionRestoreReply) {
            toast.errorFromApi(copy.versionRestoreFailed, {
              status: 0, message: copy.invalidLifecycleReply, correlationId: error.correlationId,
            });
          } else report(error, copy.versionRestoreFailed);
        }
      } finally {
        if (historyOwner?.isCurrent()) {
          setPendingVersionId(null);
          setRestoreSelection(current => current === restoreSelection ? null : current);
        }
      }
    },
    [template, restoring, restoreSelection, commandScope, grants.canRestore, pendingVersionId, toast, copy, onReload, report, historyOwner],
  );

  const retireVersion = useCallback(async (): Promise<void> => {
    if (!template || !retiring || !grants.canPublish || pendingVersionId || !historyOwner?.isCurrent()) return;
    setPendingVersionId(retiring.id);
    try {
      // `If-Match` here is the DEFINITION revision, not the version's own.
      await retireTemplateVersion(template.id, retiring.id, template.etag);
      if (historyOwner.isCurrent()) {
        toast.success(copy.savedTitle, copy.versionRetired);
        reload();
        onReload();
      }
    } catch (error) {
      if (historyOwner.isCurrent()) report(error, copy.versionRetireFailed);
    } finally {
      if (historyOwner.isCurrent()) {
        setPendingVersionId(null);
        setRetiring(null);
      }
    }
  }, [template, retiring, grants.canPublish, pendingVersionId, toast, copy, onReload, report, historyOwner, reload]);

  const detail = versionSelection.versionDetail;
  const versionDetail = receipt && detail?.state === "ready" && matchesPublishedVersion(detail.version, receipt) &&
    detail.version.validationRunId === receipt.version.validationRunId
    ? { ...detail, version: { ...detail.version, direction: receipt.direction } }
    : detail;

  return {
    run,
    isRunCurrent,
    canPublish,
    hasUnsavedTyping,
    validationNeedsReload,
    reloadValidationDraft: onReload,
    isValidating: write?.scope === writeScope && write.action === "validate",
    isPublishing: write?.scope === writeScope && write.action === "publish",
    versions: historyCurrent ? history.page?.items ?? [] : [],
    hasPreviousVersionPage: historyCurrent && pagination.canGoBack,
    hasNextVersionPage: historyCurrent && Boolean(history.page?.hasNextPage && history.page.nextCursor),
    versionCursorWasReset: historyCurrent && pagination.wasReset,
    previousVersionPage: () => changeVersionPage("previous"),
    nextVersionPage: () => changeVersionPage("next"),
    versionsError: historyCurrent ? versionsError : null,
    isLoadingVersions: !historyCurrent || isLoadingVersions,
    pendingVersionId,
    ...versionSelection,
    versionDetail,
    openVersion: (row: TemplateVersion, origin?: HTMLButtonElement) => {
      if (historyOwner?.isCurrent()) autoOpen.current = null;
      const publication = receipt && matchesPublishedVersion(row, receipt) ? receipt.version : undefined;
      return openVersion(row, origin, publication);
    },
    closeVersion: () => {
      if (historyOwner?.isCurrent()) autoOpen.current = null;
      versionSelection.closeVersion();
    },
    restoring,
    retiring,
    openRestore: (version: TemplateVersion) => {
      if (historyOwner?.isCurrent() && activeScope.current?.commandScope === commandScope) {
        setRestoreSelection({ version, scope: commandScope });
      }
    },
    closeRestore: () => { if (historyOwner?.isCurrent()) setRestoreSelection(null); },
    openRetire: (version: TemplateVersion) => { if (historyOwner?.isCurrent()) setRetiring(version); },
    closeRetire: () => { if (historyOwner?.isCurrent()) setRetiring(null); },
    validate,
    publish,
    restoreVersion,
    retireVersion,
    reloadVersions: () => { if (historyOwner?.isCurrent()) reload(); },
  };
}
