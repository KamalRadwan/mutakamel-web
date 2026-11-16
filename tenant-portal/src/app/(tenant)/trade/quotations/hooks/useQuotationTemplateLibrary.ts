"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { fetchQuotationTemplates, previewQuotationTemplate, type QuotationTemplateChoice } from "../quotation-template-library";

interface QuotationTemplateAuthority {
  identity: string | null;
  quotationRevisionKey?: string;
  isCurrent: () => boolean;
}

export function useQuotationTemplateLibrary(
  { identity, quotationRevisionKey, isCurrent }: QuotationTemplateAuthority,
  companyId: string, branchId: string, locale: string, timeZone: string, canRead: boolean | null, enabled = true,
) {
  const [open, setOpen] = useState(false);
  const quotationRevision = useMemo(() => ({ key: quotationRevisionKey }), [quotationRevisionKey]);
  const [searchInput, setSearchInput] = useState<{ owner: typeof quotationRevision; value: string } | null>(null);
  const search = searchInput?.owner === quotationRevision ? searchInput.value : "";
  const setSearch = useCallback((value: string) => {
    if (isCurrent()) setSearchInput({ owner: quotationRevision, value });
  }, [isCurrent, quotationRevision]);
  const scopeKey = JSON.stringify([identity, companyId, branchId]);
  // Each committed read context gets a fresh identity, even if its scope is later revisited.
  const key = useMemo(() => ({ identity, quotationRevision, companyId, branchId, locale, search, canRead, enabled }),
    [identity, quotationRevision, companyId, branchId, locale, search, canRead, enabled]);
  const activeKey = useRef<typeof key | null>(null);
  const moreAbort = useRef<AbortController | null>(null);
  const sampleAbort = useRef<AbortController | null>(null);
  const [page, setPage] = useState<{ key: typeof key; items: QuotationTemplateChoice[]; cursor: string | null } | null>(null);
  const [pendingKey, setPendingKey] = useState<typeof key | null>(null);
  const [errorState, setErrorState] = useState<{ key: typeof key; error: NormalizedApiError } | null>(null);
  const [refusedScope, setRefusedScope] = useState<{ key: string; error: NormalizedApiError } | null>(null);
  const [reload, setReload] = useState(0);
  const [sample, setSample] = useState<{ key: typeof key; html: string } | null>(null);
  const [sampleLoadingKey, setSampleLoadingKey] = useState<typeof key | null>(null);
  const [sampleErrorKey, setSampleErrorKey] = useState<typeof key | null>(null);
  const sampleRequest = useRef(0);
  const refusal = refusedScope?.key === scopeKey ? refusedScope.error : null;
  // A confirmed loss of the grant ends this scope's refusal. A later grant needs a fresh server read.
  if (canRead === false && refusal) setRefusedScope(null);
  const available = identity !== null && canRead === true && enabled;
  const readable = available && !refusal;
  useLayoutEffect(() => {
    activeKey.current = readable ? key : null;
    return () => {
      activeKey.current = null;
      moreAbort.current?.abort();
      sampleAbort.current?.abort();
      sampleRequest.current += 1;
    };
  }, [key, readable]);

  const current = useCallback(() => activeKey.current === key && isCurrent(), [key, isCurrent]);
  const assertRequest = useCallback(() => {
    if (!current()) throw new DOMException("Quotation template authority changed.", "AbortError");
  }, [current]);

  const load = useCallback(async (next?: string, signal?: AbortSignal) => {
    if (!current() || signal?.aborted) return;
    setPendingKey(key); setErrorState(null);
    try {
      const result = await fetchQuotationTemplates(companyId, branchId, locale, search, next, signal, assertRequest);
      if (signal?.aborted || !current()) return;
      setPage((previous) => {
        const existing = next && previous?.key === key ? previous.items : [];
        return { key, items: [...existing, ...result.items.filter((item) => !existing.some((old) => old.templateVersionId === item.templateVersionId))], cursor: result.nextCursor };
      });
    } catch (cause) {
      if (!signal?.aborted && current()) {
        const error = normalizeApiError(cause);
        setErrorState({ key, error });
        if (error.status === 403) setRefusedScope({ key: scopeKey, error });
      }
    } finally { if (!signal?.aborted && current()) setPendingKey(null); }
  }, [companyId, branchId, locale, search, key, scopeKey, assertRequest, current]);

  useEffect(() => {
    if (!open || !readable) return;
    const controller = new AbortController();
    const timer = setTimeout(() => void load(undefined, controller.signal), 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, readable, load, reload]);

  const currentPage = readable && page?.key === key ? page : null;
  return { open, setOpen, search, setSearch, items: currentPage?.items ?? [], cursor: currentPage?.cursor ?? null,
    loading: readable && pendingKey === key, error: available ? refusal ?? (errorState?.key === key ? errorState.error : null) : null,
    sample: readable && sample?.key === key ? sample.html : null, sampleLoading: readable && sampleLoadingKey === key, sampleError: readable && sampleErrorKey === key,
    retry: () => { if (current()) setReload((value) => value + 1); },
    more: () => {
      if (!current() || !currentPage?.cursor || pendingKey === key) return;
      moreAbort.current?.abort();
      moreAbort.current = new AbortController();
      void load(currentPage.cursor, moreAbort.current.signal);
    },
    closeSample: () => {
      if (!current()) return;
      sampleRequest.current += 1;
      sampleAbort.current?.abort();
      setSample(null);
      setSampleLoadingKey(null);
    },
    preview: async (choice: QuotationTemplateChoice) => {
      if (!current()) return;
      const listed = currentPage?.items.find((item) => item.templateId === choice.templateId && item.templateVersionId === choice.templateVersionId);
      if (!listed?.canPreview) return;
      sampleAbort.current?.abort();
      const controller = new AbortController();
      sampleAbort.current = controller;
      const request = ++sampleRequest.current;
      const sampleIsCurrent = () => !controller.signal.aborted && request === sampleRequest.current && current();
      setSampleLoadingKey(key); setSampleErrorKey(null); setSample(null);
      try {
        const html = await previewQuotationTemplate(listed, locale, timeZone, controller.signal, assertRequest);
        if (sampleIsCurrent()) setSample({ key, html });
      } catch {
        if (sampleIsCurrent()) setSampleErrorKey(key);
      } finally {
        if (sampleIsCurrent()) setSampleLoadingKey(null);
      }
    },
  };
}
