"use client";

import { useCallback, useLayoutEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import {
  fetchQuotationAssignmentTemplates,
  fetchQuotationAssignmentVersions,
  isSalesQuotationSelector,
  type AssignmentScope,
  type AssignmentTemplateChoice,
  type TemplateAssignment,
} from "../../template-assignments-contract";
import { ASSIGNMENT_FORM_DEFAULTS, assignmentLocale, assignmentLocalTime, type AssignmentFormValues } from "./useTemplateAssignments";
import { templateRequestFence } from "../../hooks/useTemplateAuthority";
import { isExpiredCursor, useTemplateCursor } from "../../hooks/useTemplateCursor";
import type { TemplateCursorPage } from "../../templates-contract";

type PageReader<T> = (cursor: string | undefined, signal: AbortSignal, assertCurrent: () => void) => Promise<TemplateCursorPage<T>>;

function useChoicePage<T>(key: string | null, read: PageReader<T>, isCurrent: () => boolean) {
  const cursor = useTemplateCursor();
  const { cursor: token, restart } = cursor;
  const [retry, setRetry] = useState(0);
  const [response, setResponse] = useState<{
    key: string;
    token: string | undefined;
    retry: number;
    page?: TemplateCursorPage<T>;
    error?: NormalizedApiError;
  } | null>(null);

  useLayoutEffect(() => {
    if (key === null) return;
    const controller = new AbortController();
    const current = () => !controller.signal.aborted && isCurrent();
    const assertCurrent = templateRequestFence(current);
    queueMicrotask(async () => {
      if (!current()) return;
      try {
        const page = await read(token, controller.signal, assertCurrent);
        if (current()) setResponse({ key, token, retry, page });
      } catch (error) {
        if (!current()) return;
        const normalized = normalizeApiError(error);
        if (token && isExpiredCursor(normalized)) restart(true);
        else setResponse({ key, token, retry, error: normalized });
      }
    });
    return () => controller.abort();
  }, [key, token, read, isCurrent, retry, restart]);

  const ready = response?.key === key && response.token === token && response.retry === retry ? response : null;
  const nextCursor = ready?.page?.nextCursor;
  return {
    items: ready?.page?.items ?? [],
    isLoading: key !== null && !ready,
    error: ready?.error,
    canGoBack: cursor.canGoBack,
    canGoNext: Boolean(nextCursor),
    wasReset: cursor.wasReset,
    goBack: cursor.goBack,
    goNext: () => cursor.advance(nextCursor ?? null),
    reload: () => setRetry(value => value + 1),
    reset: () => {
      restart(false);
      setRetry(value => value + 1);
    },
  };
}

export function useAssignmentDrawer(
  assignment: TemplateAssignment | null,
  scope: AssignmentScope,
  isCurrent: () => boolean,
) {
  const { lang } = useI18n();
  const [initial] = useState<AssignmentFormValues>(() => assignment
    ? {
        versionId: assignment.versionId,
        adapterKey: assignment.adapterKey,
        documentType: assignment.documentType,
        outputChannel: assignment.outputChannel,
        locale: assignment.locale ?? "",
        priority: String(assignment.priority),
        isDefault: assignment.isDefault,
        effectiveFrom: assignmentLocalTime(assignment.effectiveFrom),
        effectiveTo: assignmentLocalTime(assignment.effectiveTo),
      }
    : { ...ASSIGNMENT_FORM_DEFAULTS, locale: assignmentLocale(lang) });
  const [values, setValues] = useState(initial);
  const [template, setTemplate] = useState<AssignmentTemplateChoice | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<{ id: string; versionNumber: number } | null>(assignment
    ? { id: assignment.versionId, versionNumber: assignment.versionNumber }
    : null);
  const sales = isSalesQuotationSelector(values);
  const definitionId = assignment?.definitionId ?? template?.id;
  const versionLocale = template?.locale ?? values.locale;
  const readTemplates = useCallback((cursor: string | undefined, signal: AbortSignal, assertCurrent: () => void) =>
    fetchQuotationAssignmentTemplates(scope, values.locale, cursor, signal, assertCurrent), [scope, values.locale]);
  const readVersions = useCallback((cursor: string | undefined, signal: AbortSignal, assertCurrent: () => void) => {
    if (!definitionId) throw new Error("A template definition is required to load its versions.");
    return fetchQuotationAssignmentVersions(definitionId, versionLocale, cursor, signal, assertCurrent);
  }, [definitionId, versionLocale]);
  const templates = useChoicePage(sales && !assignment ? values.locale : null, readTemplates, isCurrent);
  const versions = useChoicePage(sales && definitionId ? definitionId : null, readVersions, isCurrent);

  const change = (patch: Partial<AssignmentFormValues>) =>
    setValues(current => ({ ...current, ...patch }));

  const changeSelector = (patch: Partial<Pick<AssignmentFormValues, "documentType" | "outputChannel" | "adapterKey" | "locale">>) => {
    const next = { ...values, ...patch };
    if (isSalesQuotationSelector(next) || sales) {
      setTemplate(null);
      setSelectedVersion(null);
      templates.reset();
      versions.reset();
      next.versionId = "";
    }
    setValues(next);
  };

  return {
    values, sales, template, selectedVersion, templates, versions, change, changeSelector,
    selectedPin: sales && definitionId && selectedVersion
      ? { definitionId, versionNumber: selectedVersion.versionNumber }
      : undefined,
    isDirty: JSON.stringify(values) !== JSON.stringify(initial),
    canSubmit: isUUIDv7(values.versionId) && (!sales ||
      (selectedVersion?.id === values.versionId && !versions.error && !templates.error)),
    selectTemplate: (id: string) => {
      const choice = templates.items.find(item => item.id === id);
      if (!choice || choice.id === template?.id) return;
      setTemplate(choice);
      setSelectedVersion(null);
      change({ versionId: "" });
      versions.reset();
    },
    selectVersion: (id: string) => {
      const choice = versions.items.find(item => item.id === id);
      if (!choice) return;
      setSelectedVersion(choice);
      change({ versionId: choice.id });
    },
  };
}
