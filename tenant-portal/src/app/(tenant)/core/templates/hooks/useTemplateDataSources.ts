"use client";

import { useEffect, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { fetchTemplateDataSources } from "../template-data-sources-api";
import type { TemplateSourceMetadata } from "../template-source-metadata";
import type { TemplateScope } from "../templates-contract";
import { templateRequestFence } from "./useTemplateAuthority";

export function useTemplateDataSources(
  isOpen: boolean,
  scope: TemplateScope | null,
  authority: string,
  isCurrent?: () => boolean,
) {
  const key = JSON.stringify([isOpen, authority, scope?.type, scope?.companyId, scope?.branchId]);
  const [read, setRead] = useState<{ key: string; items: TemplateSourceMetadata[]; error: NormalizedApiError | null } | null>(null);
  const scopeType = scope?.type;
  const companyId = scope?.companyId;
  const branchId = scope?.branchId;
  useEffect(() => {
    if (!isOpen || !scopeType) return;
    const controller = new AbortController();
    const current = () => !controller.signal.aborted && (isCurrent?.() ?? true);
    if (!current()) return;
    void fetchTemplateDataSources({ type: scopeType, companyId, branchId }, controller.signal,
      isCurrent ? templateRequestFence(current) : undefined).then(
      items => { if (current()) setRead({ key, items, error: null }); },
      error => {
        if (current()) {
          setRead({ key, items: [], error: normalizeApiError(error) });
        }
      },
    );
    return () => controller.abort();
  }, [isOpen, scopeType, companyId, branchId, key, isCurrent]);
  const current = read?.key === key ? read : null;
  return { items: current?.items ?? [], error: current?.error ?? null, isLoading: isOpen && !!scope && !current };
}
