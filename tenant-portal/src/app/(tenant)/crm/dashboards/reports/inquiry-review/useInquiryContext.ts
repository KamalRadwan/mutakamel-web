"use client";

import { useEffect, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { inquiryPath, parseInquiryContext, type InquiryContext, type InquirySelection } from "./contract";

const READ_OPTIONS = { cache: "no-store", maxResponseBytes: 65_536, suppressForbiddenToast: true } as const;
type Outcome = { key: string; context: InquiryContext; error?: never } | { key: string; error: NormalizedApiError; context?: never };

export async function readInquiryContext(selection: InquirySelection, beforeRevision?: number, signal?: AbortSignal) {
  const response = await axiosClient.get<unknown>(inquiryPath(selection.id, beforeRevision), { ...READ_OPTIONS, signal });
  if (response.status !== 200) throw new Error("Unexpected inquiry context status.");
  return parseInquiryContext(response.data, selection, beforeRevision);
}

export function useInquiryContext(selection: InquirySelection | null, version: number | string, beforeRevision?: number) {
  const [outcome, setOutcome] = useState<Outcome>();
  const key = selection ? JSON.stringify([selection.id, selection.branchId, version, beforeRevision]) : null;
  useEffect(() => {
    if (!selection || !key) return;
    const controller = new AbortController();
    void readInquiryContext(selection, beforeRevision, controller.signal).then(
      context => { if (!controller.signal.aborted) setOutcome({ key, context }); },
      error => { if (!controller.signal.aborted) setOutcome({ key, error: normalizeApiError(error) }); },
    );
    return () => controller.abort();
  }, [selection, key, beforeRevision]);
  const current = outcome?.key === key ? outcome : undefined;
  return { context: current?.context, error: current?.error, loading: Boolean(key && !current) };
}
