"use client";

import { useRef, useState, type RefObject } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError } from "@/lib/api/errors";
import { requiresSameKeyRecovery } from "@/lib/api/outcomes";
import { generateUUIDv7 } from "@/lib/uuid";
import { templateRequestFence } from "../../hooks/useTemplateAuthority";
import {
  assignmentScopeKey,
  deleteTemplateAssignment,
  fetchTemplateAssignment,
  isSalesQuotationSelector,
  type TemplateAssignment,
} from "../../template-assignments-contract";
import { STALE_REVISION_CODE } from "../../template-lifecycle-contract";

function sameTarget(previous: TemplateAssignment, current: TemplateAssignment) {
  return previous.id === current.id && previous.definitionId === current.definitionId &&
    previous.versionId === current.versionId && previous.versionNumber === current.versionNumber &&
    previous.documentType === current.documentType && previous.outputChannel === current.outputChannel &&
    previous.adapterKey === current.adapterKey && previous.locale === current.locale &&
    previous.priority === current.priority && previous.isDefault === current.isDefault &&
    previous.effectiveFrom === current.effectiveFrom && previous.effectiveTo === current.effectiveTo &&
    assignmentScopeKey(previous.scope) === assignmentScopeKey(current.scope);
}

export function useAssignmentDeactivation(
  canWrite: () => boolean,
  writingRef: RefObject<boolean>,
  onRefresh: () => void,
) {
  const { t } = useI18n();
  const copy = t.coreOperations.templates;
  const toast = useToast();
  const [deleting, setDeleting] = useState<TemplateAssignment | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deleteOutcome, setDeleteOutcome] = useState<"uncertain" | "conflict" | "check" | null>(null);
  const attempt = useRef<{ target: TemplateAssignment; key: string } | null>(null);

  function reset() {
    attempt.current = null;
    setDeleteOutcome(null);
    setDeleting(null);
  }

  function openDelete(target: TemplateAssignment) {
    if (writingRef.current || !canWrite() || deleteOutcome === "conflict") return;
    const original = attempt.current?.target;
    if (!original || original.etag !== target.etag || !sameTarget(original, target)) reset();
    setDeleting(target);
  }

  function closeDelete() {
    if (writingRef.current) return;
    if (deleteOutcome === "conflict") onRefresh();
    if (attempt.current) setDeleting(null);
    else reset();
  }

  async function remove() {
    if (!deleting || !canWrite() || writingRef.current) return;
    if (deleteOutcome === "conflict") {
      reset();
      onRefresh();
      return;
    }

    const recoverable = isSalesQuotationSelector(deleting);
    const retry = attempt.current !== null;
    const original = attempt.current ?? { target: deleting, key: generateUUIDv7() };
    attempt.current = original;
    const { target, key } = original;
    const current = () => attempt.current === original && canWrite();
    const assertCurrent = templateRequestFence(current);
    writingRef.current = true;
    setPendingId(target.id);

    const confirm = () => {
      reset();
      onRefresh();
      toast.success(copy.savedTitle, copy.assignmentDeactivated);
    };
    const conflict = () => {
      attempt.current = null;
      setDeleteOutcome("conflict");
    };
    const readTarget = async () => {
      const row = await fetchTemplateAssignment(target.id, assertCurrent);
      assertCurrent();
      if (!sameTarget(target, row)) return "changed";
      if (row.status === "INACTIVE" &&
          row.revision === target.revision + (target.status === "ACTIVE" ? 1 : 0)) return "inactive";
      return row.status === target.status && row.etag === target.etag ? "unchanged" : "changed";
    };

    try {
      if (retry) {
        const observed = await readTarget();
        if (observed === "inactive") return confirm();
        if (observed === "changed") return conflict();
        if (deleteOutcome === "check") return;
      }
      const replayed = await deleteTemplateAssignment(target.id, target.etag, key, assertCurrent);
      assertCurrent();
      if (!retry || replayed) return confirm();

      setDeleteOutcome("check");
      const observed = await readTarget();
      if (observed === "inactive") return confirm();
      if (observed === "changed") return conflict();
    } catch (error) {
      if (!current()) return;
      const problem = normalizeApiError(error);
      if (recoverable && (requiresSameKeyRecovery(problem) || problem.code === "CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT" ||
          (retry && problem.status === 429))) {
        setDeleteOutcome(outcome => outcome === "check" ? outcome : "uncertain");
      } else if (recoverable && (problem.code === STALE_REVISION_CODE ||
          problem.code === "CORE.TEMPLATE.IDEMPOTENCY.MISMATCH" || problem.code === "GW.IDEM.MISMATCH" ||
          [404, 409, 412].includes(problem.status))) {
        if (retry && (problem.code === STALE_REVISION_CODE || problem.status === 412)) {
          try {
            if (await readTarget() === "inactive") return confirm();
          } catch {
            if (!current()) return;
          }
        }
        conflict();
      } else {
        reset();
        if (problem.status !== 403 && !toast.outcomeFromApi(problem)) toast.errorFromApi(copy.assignmentDeleteFailed, problem);
      }
    } finally {
      writingRef.current = false;
      if (canWrite()) setPendingId(null);
    }
  }

  return { deleting, pendingId, deleteOutcome, openDelete, closeDelete, remove };
}
