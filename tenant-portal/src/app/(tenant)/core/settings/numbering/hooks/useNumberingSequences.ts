"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { formatTemplate } from "@/lib/format/template";
import { coreGet, corePatch, corePost } from "../../../core-api";
import { companyLabel } from "../../company-options";
import { useCompanyOptions } from "../../hooks/useCompanyOptions";
import {
  COMPANY_INVALID_CODE,
  NUMBERING_PAGE_SIZE,
  NUMBERING_PATH,
  SEQUENCE_CODE_TAKEN_CODE,
  SEQUENCE_VALUE_INVALID_CODE,
  buildCreateNumberingRequest,
  buildUpdateNumberingRequest,
  numberingListPath,
  numberingPath,
  parseNumberingSequencesResponse,
  type NumberingFormValues,
  type NumberingSequence,
  NUMBERING_SORT_FIELDS,
  type NumberingSortField,
} from "../numbering-contract";

const LIST_RESPONSE_LIMIT_BYTES = 400_000;
const ROW_RESPONSE_LIMIT_BYTES = 20_000;

/** What a rejected write needs to name in its message, from the caller's side. */
interface NumberingWriteScope {
  companyId: string | null;
  /** The server's current counter, when a loaded row supplies one. */
  nextValue: string | null;
}

export function useNumberingSequences() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const canManage = user?.permissions.includes("numbering.manage") ?? false;
  const companies = useCompanyOptions();

  const [items, setItems] = useState<NumberingSequence[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [companyFilter, setCompanyFilter] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [sort, setSortState] = useState<{ id: NumberingSortField; direction: "asc" | "desc" }>({
    id: "code",
    direction: "asc",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<NumberingSequence | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setIsLoading(true);
      setQueryError(null);
      try {
        const result = await coreGet(
          numberingListPath(
            page,
            companyFilter,
            search.trim(),
            sort.id,
            sort.direction === "asc" ? "ASC" : "DESC",
          ),
          {
            signal,
            maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES,
          },
        );
        const parsed = parseNumberingSequencesResponse(result.data);
        setItems(parsed.items);
        setTotal(parsed.total);
        setHasLoaded(true);
      } catch (error) {
        if (isAbortError(error)) return;
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [page, companyFilter, search, sort],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const reportWriteError = useCallback(
    (error: unknown, failureTitle: string, context: NumberingWriteScope): void => {
      const normalized = normalizeApiError(error);
      // The transport already toasts a 403 — a second would double-fire.
      if (normalized.status === 403) return;
      if (toast.outcomeFromApi(normalized)) return;
      if (normalized.code === SEQUENCE_VALUE_INVALID_CODE) {
        // "It cannot go backward" is useless without the number it may not go
        // below, and only the loaded row knows that value.
        toast.error(
          failureTitle,
          formatTemplate(t.coreSettings.numberingValueBackward, {
            current: context.nextValue ?? "",
          }),
        );
        return;
      }
      if (normalized.code === SEQUENCE_CODE_TAKEN_CODE) {
        toast.error(
          failureTitle,
          formatTemplate(t.coreSettings.numberingCodeTaken, {
            company: companyLabel(
              companies,
              context.companyId,
              t.coreSettings.numberingTenantWide,
            ),
          }),
        );
        return;
      }
      if (normalized.code === COMPANY_INVALID_CODE) {
        toast.error(failureTitle, t.coreSettings.numberingCompanyInvalid);
        return;
      }
      toast.errorFromApi(failureTitle, normalized);
    },
    [toast, t, companies],
  );

  const create = useCallback(
    async (values: NumberingFormValues): Promise<boolean> => {
      if (!canManage || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const request = buildCreateNumberingRequest(values);
        await corePost(NUMBERING_PATH, request, { maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES });
        setCreateOpen(false);
        toast.success(t.coreSettings.savedTitle, t.coreSettings.numberingCreated);
        await load();
        return true;
      } catch (error) {
        const message = formMessage(error, t);
        if (message) {
          setFormError(message);
          return false;
        }
        reportWriteError(error, t.coreSettings.numberingCreateFailed, {
          companyId: values.companyId,
          nextValue: null,
        });
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, isSubmitting, reportWriteError, toast, t, load],
  );

  const update = useCallback(
    async (values: NumberingFormValues): Promise<boolean> => {
      if (!canManage || !editing || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const request = buildUpdateNumberingRequest(editing, values);
        if (Object.keys(request).length === 0) {
          setEditing(null);
          return true;
        }
        await corePatch(numberingPath(editing.id), request, {
          maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
        });
        setEditing(null);
        toast.success(t.coreSettings.savedTitle, t.coreSettings.numberingUpdated);
        await load();
        return true;
      } catch (error) {
        const message = formMessage(error, t, editing);
        if (message) {
          setFormError(message);
          return false;
        }
        reportWriteError(error, t.coreSettings.numberingUpdateFailed, editing);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, editing, isSubmitting, reportWriteError, toast, t, load],
  );

  const setSort = useCallback((next: { id: string; direction: "asc" | "desc" }) => {
    const field = NUMBERING_SORT_FIELDS.find((allowed) => allowed === next.id);
    if (!field) return;
    setSortState({ id: field, direction: next.direction });
    setPage(1);
  }, []);

  return {
    sort,
    setSort,
    t,
    lang,
    canManage,
    companies,
    items,
    pageInfo: { page, limit: NUMBERING_PAGE_SIZE, total },
    companyFilter,
    search,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    isSubmitting,
    queryError,
    formError,
    createOpen,
    editing,
    setPage,
    setCompanyFilter: (next: string | undefined) => {
      setPage(1);
      setCompanyFilter(next);
    },
    setSearch: (next: string) => {
      setPage(1);
      setSearch(next);
    },
    openCreate: () => {
      setFormError(null);
      setCreateOpen(true);
    },
    closeCreate: () => {
      if (isSubmitting) return;
      setFormError(null);
      setCreateOpen(false);
    },
    openEdit: (sequence: NumberingSequence) => {
      setFormError(null);
      setEditing(sequence);
    },
    closeEdit: () => {
      if (isSubmitting) return;
      setFormError(null);
      setEditing(null);
    },
    create,
    update,
    reload: () => load(),
  };
}

type Dictionary = ReturnType<typeof useI18n>["t"];

/** Client-side form stops, raised before any request leaves. */
function formMessage(
  error: unknown,
  t: Dictionary,
  current?: NumberingSequence,
): string | null {
  const reason = error instanceof Error ? error.message : "";
  if (reason === "NUMBERING_FORM_CODE") return t.coreSettings.numberingFormCode;
  if (reason === "NUMBERING_FORM_PREFIX") return t.coreSettings.numberingFormPrefix;
  if (reason === "NUMBERING_FORM_PADDING") return t.coreSettings.numberingFormPadding;
  if (reason === "NUMBERING_FORM_VALUE") return t.coreSettings.numberingFormValue;
  if (reason === "NUMBERING_FORM_COMPANY") return t.coreSettings.numberingFormCompany;
  if (reason === "NUMBERING_FORM_BACKWARD") {
    return formatTemplate(t.coreSettings.numberingValueBackward, {
      current: current?.nextValue ?? "",
    });
  }
  return null;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
