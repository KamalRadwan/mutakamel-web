"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  fetchTemplateVersion,
  fetchTemplateVersions,
  publishTemplate,
  restoreTemplateVersion,
  retireTemplateVersion,
  validateTemplateDraft,
} from "../../template-lifecycle-api";
import type {
  TemplateValidationRun,
  TemplateVersion,
} from "../../template-lifecycle-contract";
import type { TemplateDetail } from "../../templates-contract";
import type { TemplateGrants } from "./useTemplateDetail";

/**
 * Validation, publish and versions.
 *
 * Publishing pins **three** things separately — the definition revision in
 * `If-Match`, the draft revision in the body, and a passed validation run for
 * that exact draft revision. All three are surfaced before the button enables,
 * because a publish button that fails on click is what this design prevents.
 */
export function useTemplateRelease(
  template: TemplateDetail | null,
  grants: TemplateGrants,
  onReload: () => void,
) {
  const { t } = useI18n();
  const toast = useToast();
  const copy = t.coreOperations.templates;

  const [run, setRun] = useState<TemplateValidationRun | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [versionsError, setVersionsError] = useState<NormalizedApiError | null>(null);
  const [isLoadingVersions, setIsLoadingVersions] = useState(true);
  const [pendingVersionId, setPendingVersionId] = useState<string | null>(null);
  const [selected, setSelected] = useState<TemplateVersion | null>(null);
  const [isLoadingSelected, setIsLoadingSelected] = useState(false);
  const [restoring, setRestoring] = useState<TemplateVersion | null>(null);
  const [retiring, setRetiring] = useState<TemplateVersion | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const templateId = template?.id ?? null;
  const draftRevision = template?.currentDraft.revision ?? null;

  useEffect(() => {
    if (!templateId || !grants.canRead) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      void (async () => {
        setIsLoadingVersions(true);
        setVersionsError(null);
        try {
          const page = await fetchTemplateVersions(templateId, { signal: controller.signal });
          setVersions(page.items);
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setVersionsError(normalizeApiError(error));
        } finally {
          if (!controller.signal.aborted) setIsLoadingVersions(false);
        }
      })();
    });
    return () => controller.abort();
  }, [templateId, grants.canRead, reloadToken]);

  const report = useCallback(
    (error: unknown, title: string): void => {
      const normalized = normalizeApiError(error);
      if (normalized.status === 403) return;
      if (toast.outcomeFromApi(normalized)) return;
      toast.errorFromApi(title, normalized);
    },
    [toast],
  );

  /**
   * The list projection omits the compiler and validation-run identifiers; the
   * detail route is what carries them, so "view" is a real read rather than a
   * re-render of the row already on screen.
   */
  const openVersion = useCallback(
    async (version: TemplateVersion): Promise<void> => {
      if (!template) return;
      setSelected(version);
      setIsLoadingSelected(true);
      try {
        setSelected(await fetchTemplateVersion(template.id, version.id));
      } catch (error) {
        report(error, copy.versionsLoadFailed);
      } finally {
        setIsLoadingSelected(false);
      }
    },
    [template, copy, report],
  );

  const validate = useCallback(async (): Promise<void> => {
    if (!template || !grants.canUpdate || isValidating) return;
    setIsValidating(true);
    try {
      // Exactly two renderer targets, chosen by the definition's output channel.
      const rendererTargets =
        template.outputChannel === "EMAIL" ? ["EMAIL_HTML", "EMAIL_TEXT"] : ["HTML", "PDF"];
      const result = await validateTemplateDraft(
        template.id,
        { draftRevision: template.currentDraft.revision, rendererTargets },
        template.currentDraft.etag,
      );
      setRun(result);
      toast.success(copy.savedTitle, result.status === "PASSED" ? copy.validationPassed : copy.validationFailed);
      onReload();
    } catch (error) {
      report(error, copy.validationRunFailed);
    } finally {
      setIsValidating(false);
    }
  }, [template, grants.canUpdate, isValidating, toast, copy, onReload, report]);

  /** The run is only usable while it still names the current draft revision. */
  const isRunCurrent =
    run !== null && draftRevision !== null && run.draftRevision === draftRevision;
  const canPublish =
    grants.canPublish &&
    template !== null &&
    template.lifecycleStatus === "ACTIVE" &&
    isRunCurrent &&
    run?.status === "PASSED";

  const publish = useCallback(
    async (changeNote: string): Promise<void> => {
      if (!template || !run || !canPublish || isPublishing) return;
      setIsPublishing(true);
      try {
        await publishTemplate(
          template.id,
          {
            definitionRevision: template.definitionRevision,
            draftRevision: template.currentDraft.revision,
            validationRunId: run.id,
            ...(changeNote.trim() ? { changeNote: changeNote.trim() } : {}),
            setAsDefinitionPublished: true,
          },
          template.etag,
        );
        toast.success(copy.savedTitle, copy.published);
        setRun(null);
        setReloadToken((token) => token + 1);
        onReload();
      } catch (error) {
        report(error, copy.publishFailed);
      } finally {
        setIsPublishing(false);
      }
    },
    [template, run, canPublish, isPublishing, toast, copy, onReload, report],
  );

  const restoreVersion = useCallback(
    async (reason: string): Promise<void> => {
      if (!template || !restoring || !grants.canRestore || pendingVersionId) return;
      setPendingVersionId(restoring.id);
      try {
        await restoreTemplateVersion(
          template.id,
          restoring.id,
          { reason, discardCurrentDraft: true },
          template.currentDraft.etag,
        );
        toast.success(copy.savedTitle, copy.versionRestored);
        onReload();
      } catch (error) {
        report(error, copy.versionRestoreFailed);
      } finally {
        setPendingVersionId(null);
        setRestoring(null);
      }
    },
    [template, restoring, grants.canRestore, pendingVersionId, toast, copy, onReload, report],
  );

  const retireVersion = useCallback(async (): Promise<void> => {
    if (!template || !retiring || !grants.canPublish || pendingVersionId) return;
    setPendingVersionId(retiring.id);
    try {
      // `If-Match` here is the DEFINITION revision, not the version's own.
      await retireTemplateVersion(template.id, retiring.id, template.etag);
      toast.success(copy.savedTitle, copy.versionRetired);
      setReloadToken((token) => token + 1);
      onReload();
    } catch (error) {
      report(error, copy.versionRetireFailed);
    } finally {
      setPendingVersionId(null);
      setRetiring(null);
    }
  }, [template, retiring, grants.canPublish, pendingVersionId, toast, copy, onReload, report]);

  return {
    run,
    isRunCurrent,
    canPublish,
    isValidating,
    isPublishing,
    versions,
    versionsError,
    isLoadingVersions,
    pendingVersionId,
    selected,
    isLoadingSelected,
    restoring,
    retiring,
    openVersion: (version: TemplateVersion) => void openVersion(version),
    closeVersion: () => setSelected(null),
    openRestore: (version: TemplateVersion) => setRestoring(version),
    closeRestore: () => setRestoring(null),
    openRetire: (version: TemplateVersion) => setRetiring(version),
    closeRetire: () => setRetiring(null),
    validate,
    publish,
    restoreVersion,
    retireVersion,
    reloadVersions: () => setReloadToken((token) => token + 1),
  };
}
