"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError } from "@/lib/api/errors";
import {
  resolveTemplateAssignment,
  SALES_QUOTATION_SELECTOR,
  type AssignmentScope,
  type AssignmentSelector,
  type ResolvedAssignment,
} from "../../template-assignments-contract";
import { templateRequestFence } from "../../hooks/useTemplateAuthority";

export function useAssignmentResolution(scope: AssignmentScope, locale: string, isCurrent: () => boolean) {
  const { t } = useI18n();
  const toast = useToast();
  const [selector, setSelector] = useState<Omit<AssignmentSelector, "scope">>({ ...SALES_QUOTATION_SELECTOR, locale });
  const [resolved, setResolved] = useState<ResolvedAssignment | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const request = useRef<AbortController | null>(null);

  useLayoutEffect(() => () => {
    request.current?.abort();
  }, []);

  const clearResolution = useCallback(() => {
    request.current?.abort();
    setResolved(null);
    setIsResolving(false);
  }, []);

  async function resolve() {
    if (!isCurrent()) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const current = () => !controller.signal.aborted && isCurrent();
    setResolved(null);
    setIsResolving(true);
    try {
      const result = await resolveTemplateAssignment(
        { ...selector, scope }, controller.signal, templateRequestFence(current),
      );
      if (current()) setResolved(result);
    } catch (error) {
      if (!current()) return;
      const normalized = normalizeApiError(error);
      if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
        toast.errorFromApi(t.coreOperations.templates.resolveFailed, normalized);
      }
    } finally {
      if (current()) setIsResolving(false);
    }
  }

  return {
    selector, resolved, isResolving, resolve, clearResolution,
    changeSelector: (patch: Partial<Omit<AssignmentSelector, "scope">>) => {
      clearResolution();
      setSelector(current => ({ ...current, ...patch }));
    },
  };
}
