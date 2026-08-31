"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  ACCESS_POLICY_BLOCKED_CODE,
  TEMPLATE_ASSIGNMENTS_PERMISSION,
  TEMPLATE_READ_PERMISSION,
} from "../../templates-contract";
import {
  ASSIGNMENT_CONFLICT_CODE,
  ASSIGNMENT_INCOMPATIBLE_CODE,
  ASSIGNMENT_SCOPE_INVALID_CODE,
  createTemplateAssignment,
  deleteTemplateAssignment,
  fetchTemplateAssignments,
  resolveTemplateAssignment,
  updateTemplateAssignment,
  type ResolvedAssignment,
  type TemplateAssignment,
} from "../../template-assignments-contract";
import { isExpiredCursor, useTemplateCursor } from "../../hooks/useTemplateCursor";

export interface AssignmentFormValues {
  versionId: string;
  adapterKey: string;
  documentType: string;
  outputChannel: string;
  locale: string;
  priority: string;
  isDefault: boolean;
  effectiveFrom: string;
  effectiveTo: string;
}

export const EMPTY_ASSIGNMENT_FORM: AssignmentFormValues = {
  versionId: "",
  adapterKey: "TRADE_QUOTATION_PRINT_V1",
  documentType: "QUOTATION",
  outputChannel: "PRINT",
  locale: "en-US",
  priority: "100",
  isDefault: false,
  effectiveFrom: "",
  effectiveTo: "",
};

function isoOrThrow(value: string, marker: string): string {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new Error(marker);
  return date.toISOString();
}

export function useTemplateAssignments() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const permissions = user?.permissions ?? [];
  const canRead = permissions.includes(TEMPLATE_READ_PERMISSION);
  const canManage = permissions.includes(TEMPLATE_ASSIGNMENTS_PERMISSION);
  const copy = t.coreOperations.templates;

  const cursor = useTemplateCursor();
  const [items, setItems] = useState<TemplateAssignment[]>([]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [isEntitlementBlocked, setIsEntitlementBlocked] = useState(false);
  const [editing, setEditing] = useState<TemplateAssignment | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TemplateAssignment | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [resolved, setResolved] = useState<ResolvedAssignment | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const activeCursor = cursor.cursor;
  const restart = cursor.restart;

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!canRead) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const page = await fetchTemplateAssignments(
          { scopeType: "TENANT", ...(activeCursor ? { cursor: activeCursor } : {}) },
          signal,
        );
        setItems(page.items);
        setHasNextPage(page.hasNextPage);
        setNextCursor(page.nextCursor);
        setIsEntitlementBlocked(false);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        const normalized = normalizeApiError(caught);
        if (normalized.code === ACCESS_POLICY_BLOCKED_CODE) {
          setIsEntitlementBlocked(true);
          return;
        }
        if (isExpiredCursor(normalized) && activeCursor) {
          restart(true);
          return;
        }
        setError(normalized);
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [canRead, activeCursor, restart],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load, reloadToken]);

  const reportWrite = useCallback(
    (error: unknown): void => {
      const reason = error instanceof Error ? error.message : "";
      if (reason === "ASSIGNMENT_FORM_FROM") {
        setFormError(copy.assignmentFromRequired);
        return;
      }
      if (reason === "ASSIGNMENT_FORM_TO") {
        setFormError(copy.assignmentToInvalid);
        return;
      }
      const normalized = normalizeApiError(error);
      if (normalized.status === 403) return;
      if (toast.outcomeFromApi(normalized)) return;
      // A PATCH revalidates compatibility, overlap, priority and scope, so an
      // edit can fail for a reason unrelated to the field that changed — the
      // message has to say which.
      if (normalized.code === ASSIGNMENT_CONFLICT_CODE) setFormError(copy.assignmentOverlap);
      else if (normalized.code === ASSIGNMENT_INCOMPATIBLE_CODE) {
        setFormError(copy.assignmentIncompatible);
      } else if (normalized.code === ASSIGNMENT_SCOPE_INVALID_CODE) {
        setFormError(copy.assignmentScopeInvalid);
      } else setFormError(copy.assignmentSaveFailed);
    },
    [toast, copy],
  );

  const submit = useCallback(
    async (values: AssignmentFormValues): Promise<boolean> => {
      if (!canManage || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const body: Record<string, unknown> = {
          versionId: values.versionId,
          adapterKey: values.adapterKey,
          documentType: values.documentType,
          outputChannel: values.outputChannel,
          locale: values.locale || null,
          scope: { type: "TENANT" },
          priority: Number(values.priority) || 0,
          isDefault: values.isDefault,
          effectiveFrom: isoOrThrow(values.effectiveFrom, "ASSIGNMENT_FORM_FROM"),
          effectiveTo: values.effectiveTo
            ? isoOrThrow(values.effectiveTo, "ASSIGNMENT_FORM_TO")
            : null,
        };
        if (editing) {
          await updateTemplateAssignment(
            editing.id,
            {
              versionId: body.versionId,
              priority: body.priority,
              isDefault: body.isDefault,
              effectiveFrom: body.effectiveFrom,
              effectiveTo: body.effectiveTo,
            },
            editing.etag,
          );
        } else {
          await createTemplateAssignment(body);
        }
        setEditing(null);
        setIsCreateOpen(false);
        toast.success(copy.savedTitle, copy.assignmentSaved);
        setReloadToken((token) => token + 1);
        return true;
      } catch (error) {
        reportWrite(error);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, isSubmitting, editing, toast, copy, reportWrite],
  );

  const remove = useCallback(async (): Promise<void> => {
    if (!deleting || !canManage || pendingId) return;
    setPendingId(deleting.id);
    try {
      await deleteTemplateAssignment(deleting.id, deleting.etag);
      toast.success(copy.savedTitle, copy.assignmentDeactivated);
      setReloadToken((token) => token + 1);
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
        toast.errorFromApi(copy.assignmentDeleteFailed, normalized);
      }
    } finally {
      setPendingId(null);
      setDeleting(null);
    }
  }, [deleting, canManage, pendingId, toast, copy]);

  /** The preview that keeps overlapping windows and priorities from being invisible. */
  const resolve = useCallback(
    async (selector: Record<string, unknown>): Promise<void> => {
      setIsResolving(true);
      try {
        setResolved(await resolveTemplateAssignment(selector));
      } catch (error) {
        const normalized = normalizeApiError(error);
        if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
          toast.errorFromApi(copy.resolveFailed, normalized);
        }
      } finally {
        setIsResolving(false);
      }
    },
    [toast, copy],
  );

  return {
    t,
    lang,
    canRead,
    canManage,
    items,
    isLoading: isLoading && canRead,
    error,
    isEntitlementBlocked,
    cursor,
    hasNextPage,
    editing,
    isCreateOpen,
    isSubmitting,
    formError,
    deleting,
    pendingId,
    resolved,
    isResolving,
    goNext: () => cursor.advance(nextCursor),
    goBack: cursor.goBack,
    openCreate: () => {
      setFormError(null);
      setIsCreateOpen(true);
    },
    closeCreate: () => {
      if (isSubmitting) return;
      setIsCreateOpen(false);
    },
    openEdit: (assignment: TemplateAssignment) => {
      setFormError(null);
      setEditing(assignment);
    },
    closeEdit: () => {
      if (isSubmitting) return;
      setEditing(null);
    },
    openDelete: (assignment: TemplateAssignment) => setDeleting(assignment),
    closeDelete: () => {
      if (pendingId) return;
      setDeleting(null);
    },
    submit,
    remove,
    resolve,
    reload: () => setReloadToken((token) => token + 1),
  };
}
