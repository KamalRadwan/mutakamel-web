"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { can } from "@/lib/auth/permission-scope";
import {
  deleteTemplate,
  fetchTemplate,
  setTemplateLifecycle,
  updateTemplate,
} from "../../templates-api";
import {
  ACCESS_POLICY_BLOCKED_CODE,
  TEMPLATE_ARCHIVE_PERMISSION,
  TEMPLATE_ASSIGNMENTS_PERMISSION,
  TEMPLATE_ASSETS_PERMISSION,
  TEMPLATE_PREVIEW_PERMISSION,
  TEMPLATE_PUBLISH_PERMISSION,
  TEMPLATE_READ_PERMISSION,
  TEMPLATE_RESTORE_PERMISSION,
  TEMPLATE_UPDATE_PERMISSION,
  type TemplateDetail,
} from "../../templates-contract";
import { STALE_REVISION_CODE } from "../../template-lifecycle-contract";

export interface TemplateGrants {
  canRead: boolean;
  canUpdate: boolean;
  canPublish: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canPreview: boolean;
  canManageAssets: boolean;
  canManageAssignments: boolean;
}

/**
 * One template definition: metadata, lifecycle and the revisions every other
 * write on this screen has to pin.
 */
export function useTemplateDetail(templateId: string) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const permissions = user?.permissions ?? [];
  const copy = t.coreOperations.templates;
  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const latestTemplate = useRef<TemplateDetail | null>(null);
  const commitTemplate = useCallback((next: TemplateDetail) => {
    latestTemplate.current = next;
    setTemplate(next);
  }, []);
  const target = template?.scope.type === "BRANCH"
    ? { branchId: template.scope.branchId, companyId: template.scope.companyId }
    : { companyId: template?.scope.type === "COMPANY" ? template.scope.companyId : null };
  const permitted = (key: string) => !!template && can(user, key, target);

  const grants: TemplateGrants = {
    canRead: permissions.includes(TEMPLATE_READ_PERMISSION),
    canUpdate: permitted(TEMPLATE_UPDATE_PERMISSION),
    canPublish: permitted(TEMPLATE_PUBLISH_PERMISSION),
    canArchive: permitted(TEMPLATE_ARCHIVE_PERMISSION),
    canRestore: permitted(TEMPLATE_RESTORE_PERMISSION),
    canPreview: permitted(TEMPLATE_PREVIEW_PERMISSION),
    canManageAssets: permitted(TEMPLATE_ASSETS_PERMISSION),
    canManageAssignments: permitted(TEMPLATE_ASSIGNMENTS_PERMISSION),
  };

  const lifecycleAuthority = useMemo(
    () => ({ templateId: templateId.toLowerCase(), actorId: user?.id, realtimeAuthGeneration, canArchive: grants.canArchive }),
    [templateId, user?.id, realtimeAuthGeneration, grants.canArchive],
  );
  const activeLifecycleAuthority = useRef<typeof lifecycleAuthority | null>(null);
  useLayoutEffect(() => {
    activeLifecycleAuthority.current = lifecycleAuthority;
    return () => { activeLifecycleAuthority.current = null; };
  }, [lifecycleAuthority]);

  const [isLoading, setIsLoading] = useState(true);
  const [isMissing, setIsMissing] = useState(false);
  const [isEntitlementBlocked, setIsEntitlementBlocked] = useState(false);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [hasConflict, setHasConflict] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!grants.canRead) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setLoadError(null);
      setIsMissing(false);
      try {
        commitTemplate(await fetchTemplate(templateId, signal));
        setIsEntitlementBlocked(false);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const normalized = normalizeApiError(error);
        if (normalized.code === ACCESS_POLICY_BLOCKED_CODE) setIsEntitlementBlocked(true);
        else if (normalized.status === 404) setIsMissing(true);
        else setLoadError(normalized);
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [grants.canRead, templateId, commitTemplate],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load, reloadToken]);

  const report = useCallback(
    (error: unknown, title: string): void => {
      const normalized = normalizeApiError(error);
      if (normalized.status === 403) return;
      if (toast.outcomeFromApi(normalized)) return;
      // A stale revision means the definition moved: refetch and let the user
      // decide against the value that is actually stored.
      if (normalized.code === STALE_REVISION_CODE || normalized.status === 409) {
        setHasConflict(true);
        return;
      }
      toast.errorFromApi(title, normalized);
    },
    [toast],
  );

  const saveMetadata = useCallback(
    async (patch: Record<string, unknown>): Promise<boolean> => {
      if (!template || !grants.canUpdate || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        commitTemplate(await updateTemplate(template.id, patch, template.etag));
        setIsEditOpen(false);
        toast.success(copy.savedTitle, copy.updated);
        return true;
      } catch (error) {
        report(error, copy.updateFailed);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [template, grants.canUpdate, isSubmitting, toast, copy, report, commitTemplate],
  );

  const changeLifecycle = useCallback(
    async (action: "archive" | "restore"): Promise<void> => {
      if (!template || template.id !== lifecycleAuthority.templateId || !lifecycleAuthority.canArchive || pendingAction) return;
      const matchesTarget = (detail: TemplateDetail): boolean =>
        detail.id === template.id &&
        detail.scope.type === template.scope.type &&
        detail.scope.companyId === template.scope.companyId &&
        detail.scope.branchId === template.scope.branchId;
      const currentDefinition = () => {
        const current = latestTemplate.current;
        return activeLifecycleAuthority.current === lifecycleAuthority && current && matchesTarget(current) &&
          current.definitionRevision === template.definitionRevision && current.etag === template.etag ? current : null;
      };
      if (!currentDefinition()) return;
      const failureTitle = action === "archive" ? copy.archiveFailed : copy.restoreFailed;
      setPendingAction(action);
      try {
        const { correlationId, ...reply } = await setTemplateLifecycle(template.id, action, template.etag);
        const current = currentDefinition();
        if (!current) return;
        const expectedStatus = action === "archive" ? "ARCHIVED" : "ACTIVE";
        if (!matchesTarget(reply) || reply.lifecycleStatus !== expectedStatus ||
          reply.definitionRevision < current.definitionRevision) {
          toast.errorFromApi(failureTitle, { status: 0, message: copy.invalidLifecycleReply, correlationId });
          return;
        }
        const preserveDraft = current.currentDraft.draftId === reply.currentDraft.draftId &&
          current.currentDraft.revision > reply.currentDraft.revision;
        commitTemplate(preserveDraft ? { ...reply, draft: current.draft, currentDraft: current.currentDraft } : reply);
        toast.success(copy.savedTitle, action === "archive" ? copy.archived : copy.restored);
      } catch (error) {
        if (currentDefinition()) report(error, failureTitle);
      } finally {
        setPendingAction(null);
      }
    },
    [template, lifecycleAuthority, pendingAction, toast, copy, report, commitTemplate],
  );

  const remove = useCallback(async (): Promise<void> => {
    if (!template || !grants.canArchive || pendingAction) return;
    setPendingAction("delete");
    try {
      await deleteTemplate(template.id, template.etag);
      toast.success(copy.savedTitle, copy.deleted);
      router.push(TENANT_ROUTES.coreTemplates);
    } catch (error) {
      report(error, copy.deleteFailed);
    } finally {
      setPendingAction(null);
    }
  }, [template, grants.canArchive, pendingAction, toast, copy, router, report]);

  return {
    t,
    lang,
    grants,
    template,
    isLoading: isLoading && grants.canRead,
    isMissing,
    isEntitlementBlocked,
    loadError,
    isEditOpen,
    isSubmitting,
    formError,
    pendingAction,
    hasConflict,
    openEdit: () => {
      if (!grants.canUpdate) return;
      setFormError(null);
      setIsEditOpen(true);
    },
    closeEdit: () => {
      if (isSubmitting) return;
      setIsEditOpen(false);
    },
    resolveConflict: () => {
      setHasConflict(false);
      setReloadToken((token) => token + 1);
    },
    dismissConflict: () => setHasConflict(false),
    saveMetadata,
    changeLifecycle,
    remove,
    reload: () => setReloadToken((token) => token + 1),
  };
}
