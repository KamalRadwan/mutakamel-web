"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { can } from "@/lib/auth/permission-scope";
import { generateUUIDv7, isUUIDv7 } from "@/lib/uuid";
import {
  ACCESS_POLICY_BLOCKED_CODE,
  TEMPLATE_ASSIGNMENTS_PERMISSION,
  TEMPLATE_READ_PERMISSION,
} from "../../templates-contract";
import {
  ASSIGNMENT_CONFLICT_CODE,
  ASSIGNMENT_INCOMPATIBLE_CODE,
  ASSIGNMENT_PRIORITY_MAX,
  ASSIGNMENT_SCOPE_INVALID_CODE,
  SALES_QUOTATION_SELECTOR,
  createTemplateAssignment,
  fetchTemplateAssignments,
  updateTemplateAssignment,
  type AssignmentScope,
  type AssignmentUpdate,
  type TemplateAssignment,
} from "../../template-assignments-contract";
import { isExpiredCursor, useTemplateCursor } from "../../hooks/useTemplateCursor";
import { templateRequestFence } from "../../hooks/useTemplateAuthority";
import { assignmentPermissionTarget } from "./useAssignmentScope";
import { useAssignmentResolution } from "./useAssignmentResolution";
import { useAssignmentDeactivation } from "./useAssignmentDeactivation";

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

export type AssignmentVersionPin = Pick<TemplateAssignment, "definitionId" | "versionNumber">;

export const ASSIGNMENT_FORM_DEFAULTS: AssignmentFormValues = {
  versionId: "",
  ...SALES_QUOTATION_SELECTOR,
  locale: "",
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

export function useTemplateAssignments(
  scope: AssignmentScope,
  authority: string,
  readAuthority: () => string | null,
) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { readReadyProfileCommit } = useTenantAuth();
  const currentScope = useRef(false);
  const writing = useRef(false);
  const saveIntent = useRef<{ fingerprint: string; key: string } | null>(null);
  const hasPermission = useCallback(
    (permission: string) => readAuthority() === authority &&
      can(readReadyProfileCommit()?.user, permission, assignmentPermissionTarget(scope)),
    [scope, authority, readAuthority, readReadyProfileCommit],
  );
  const canRead = hasPermission(TEMPLATE_READ_PERMISSION);
  const canManage = hasPermission(TEMPLATE_ASSIGNMENTS_PERMISSION);
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
  const [reloadToken, setReloadToken] = useState(0);

  const activeCursor = cursor.cursor;
  const restart = cursor.restart;
  const isCurrent = useCallback(() => currentScope.current && hasPermission(TEMPLATE_READ_PERMISSION), [hasPermission]);
  const canWrite = useCallback(() => isCurrent() && hasPermission(TEMPLATE_ASSIGNMENTS_PERMISSION), [isCurrent, hasPermission]);
  const { clearResolution, ...resolution } = useAssignmentResolution(scope, assignmentLocale(lang), isCurrent);
  const deactivation = useAssignmentDeactivation(canWrite, writing, () => {
    clearResolution();
    setReloadToken((token) => token + 1);
  });

  const load = useCallback(
    async (signal: AbortSignal): Promise<void> => {
      if (!isCurrent()) return;
      const current = () => !signal.aborted && isCurrent();
      setIsLoading(true);
      setError(null);
      try {
        const page = await fetchTemplateAssignments(
          { scope, cursor: activeCursor }, signal, templateRequestFence(current),
        );
        if (!current()) return;
        setItems(page.items);
        setHasNextPage(page.hasNextPage);
        setNextCursor(page.nextCursor);
        setIsEntitlementBlocked(false);
      } catch (caught) {
        if (!current() || (caught instanceof DOMException && caught.name === "AbortError")) return;
        setItems([]);
        setNextCursor(null);
        setHasNextPage(false);
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
        if (current()) setIsLoading(false);
      }
    },
    [isCurrent, scope, activeCursor, restart],
  );

  useLayoutEffect(() => {
    currentScope.current = true;
    return () => {
      currentScope.current = false;
    };
  }, []);

  useLayoutEffect(() => {
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
    async (values: AssignmentFormValues, selectedPin?: AssignmentVersionPin): Promise<boolean> => {
      if (!canWrite() || writing.current) return false;
      writing.current = true;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const priority = Number(values.priority);
        if (!isUUIDv7(values.versionId)) {
          setFormError(copy.assignmentIncompatible);
          return false;
        }
        if (!/^\d+$/u.test(values.priority) || priority > ASSIGNMENT_PRIORITY_MAX) {
          setFormError(copy.assignmentPriorityHint);
          return false;
        }
        const update = {
          priority,
          isDefault: values.isDefault,
          effectiveFrom: isoOrThrow(values.effectiveFrom, "ASSIGNMENT_FORM_FROM"),
          effectiveTo: values.effectiveTo
            ? isoOrThrow(values.effectiveTo, "ASSIGNMENT_FORM_TO")
            : null,
        };
        if (editing) {
          if (values.effectiveFrom === assignmentLocalTime(editing.effectiveFrom)) update.effectiveFrom = editing.effectiveFrom;
          if (values.effectiveTo === assignmentLocalTime(editing.effectiveTo)) update.effectiveTo = editing.effectiveTo;
        }
        const { versionId, adapterKey, documentType, outputChannel, locale } = values;
        const patch: AssignmentUpdate = editing && versionId !== editing.versionId ? { ...update, versionId } : update;
        const create = { ...update, versionId, adapterKey, documentType, outputChannel, locale: locale || null, scope };
        const fingerprint = JSON.stringify(editing ? [editing.id, editing.etag, patch] : create);
        if (saveIntent.current?.fingerprint !== fingerprint) {
          saveIntent.current = { fingerprint, key: generateUUIDv7() };
        }
        const { key } = saveIntent.current;
        const assertCurrent = templateRequestFence(canWrite);
        const saved = editing
          ? await updateTemplateAssignment(editing, patch, key, assertCurrent)
          : await createTemplateAssignment(create, key, assertCurrent);
        if (!canWrite()) return false;
        if (selectedPin && (saved.definitionId !== selectedPin.definitionId ||
            saved.versionNumber !== selectedPin.versionNumber)) {
          setFormError(copy.assignmentSaveFailed);
          return false;
        }
        saveIntent.current = null;
        setEditing(null);
        setIsCreateOpen(false);
        clearResolution();
        toast.success(copy.savedTitle, copy.assignmentSaved);
        setReloadToken((token) => token + 1);
        return true;
      } catch (error) {
        if (canWrite()) reportWrite(error);
        return false;
      } finally {
        writing.current = false;
        if (currentScope.current) setIsSubmitting(false);
      }
    },
    [canWrite, scope, editing, toast, copy, reportWrite, clearResolution],
  );

  return {
    t,
    lang,
    canWrite,
    canManage: canRead && canManage && !isLoading && !error && !isEntitlementBlocked,
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
    ...deactivation,
    ...resolution,
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
    submit,
    reload: () => {
      clearResolution();
      setReloadToken((token) => token + 1);
    },
  };
}

export function assignmentLocalTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

const assignmentLocales = { ar: "ar-EG", en: "en-US" } as const;

export function assignmentLocale(lang: keyof typeof assignmentLocales) {
  return assignmentLocales[lang];
}
