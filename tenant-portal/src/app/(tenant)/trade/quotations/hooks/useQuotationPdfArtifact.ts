"use client";

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { quotationRenderArtifactPath } from "../../documents/trade-pdf-contract";

export const QUOTATION_PDF_MAX_BYTES = 25 * 1024 * 1024;

interface QuotationPdfArtifactIdentity {
  jobId: string;
  checksum: string;
  sizeBytes: number;
}

/** Validate binary output before handing it to the browser's PDF reader. */
export async function validateQuotationPdf(blob: Blob, expected?: Pick<QuotationPdfArtifactIdentity, "sizeBytes" | "checksum">): Promise<void> {
  if (!blob.size || blob.size > QUOTATION_PDF_MAX_BYTES ||
    (expected && blob.size !== expected.sizeBytes) ||
    blob.type.split(";")[0] !== "application/pdf") throw new Error("INVALID_PDF");
  const signature = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...signature) !== "%PDF-") throw new Error("INVALID_PDF");
  if (expected && bytesToHex(sha256(new Uint8Array(await blob.arrayBuffer()))) !== expected.checksum) {
    throw new Error("INVALID_PDF");
  }
}

async function readVerifiedPdf(
  quotationId: string, artifact: QuotationPdfArtifactIdentity, headersKey: string,
  signal: AbortSignal, assertCurrent: () => void,
): Promise<Blob> {
  assertCurrent();
  const response = await axiosClient.get<Blob>(quotationRenderArtifactPath(quotationId, artifact.jobId), {
    responseType: "blob", expectedBinaryContentType: "application/pdf",
    headers: Object.fromEntries(JSON.parse(headersKey) as [string, string][]),
    signal, cache: "no-store", redirect: "error", requireExactResponseTarget: true, assertCurrent,
    maxBinaryResponseBytes: artifact.sizeBytes,
  });
  if (response.status !== 200) throw new Error("INVALID_PDF");
  assertCurrent();
  await validateQuotationPdf(response.data, artifact);
  assertCurrent();
  return response.data;
}

function readAccessError(error: unknown): NormalizedApiError | undefined {
  const failure = error instanceof Error && "response" in error ? normalizeApiError(error) : undefined;
  return failure && [401, 403, 404, 410].includes(failure.status) ? failure : undefined;
}

export function saveQuotationPdf(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  try {
    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export function useQuotationPdfArtifact(
  quotationId: string,
  artifact: QuotationPdfArtifactIdentity | null,
  headers: Record<string, string>,
  assertOwner: () => void,
) {
  const { jobId, checksum, sizeBytes } = artifact ?? {};
  const available = !!jobId && !!checksum && !!sizeBytes && sizeBytes <= QUOTATION_PDF_MAX_BYTES;
  const headersKey = JSON.stringify(Object.entries(headers).sort());
  const identity = useMemo(() => ({ quotationId, jobId, checksum, sizeBytes, headersKey, assertOwner }),
    [quotationId, jobId, checksum, sizeBytes, headersKey, assertOwner]);
  type Request = { identity: typeof identity; deferred?: boolean };
  const [request, setRequest] = useState<Request | null>(null);
  const [result, setResult] = useState<{ request: Request; url: string | null; accessError?: NormalizedApiError } | null>(null);
  const pendingDownload = useRef<AbortController | null>(null);
  const [downloadState, setDownloadState] = useState<{
    identity: typeof identity; busy: boolean; error?: true; accessError?: NormalizedApiError;
  } | null>(null);
  const currentDownload = downloadState?.identity === identity ? downloadState : null;
  const downloadAccessError = currentDownload?.accessError;
  const current = request?.identity === identity ? request : null;
  const loaded = current && result?.request === current ? result : null;
  const accessError = downloadAccessError ?? (result?.request.identity === identity ? result.accessError : undefined);

  useLayoutEffect(() => () => {
    pendingDownload.current?.abort();
    pendingDownload.current = null;
  }, [identity]);

  useLayoutEffect(() => {
    if (!current || current.deferred || downloadAccessError || !jobId || !checksum || !sizeBytes) return;
    const controller = new AbortController();
    const { signal } = controller;
    const assertCurrent = () => { signal.throwIfAborted(); assertOwner(); };
    let objectUrl: string | undefined;
    queueMicrotask(async () => {
      try {
        const blob = await readVerifiedPdf(quotationId, { jobId, checksum, sizeBytes }, headersKey, signal, assertCurrent);
        assertCurrent();
        objectUrl = URL.createObjectURL(blob);
        setResult({ request: current, url: objectUrl });
      } catch (error) {
        if (signal.aborted) return;
        setResult({ request: current, url: null, accessError: readAccessError(error) });
      }
    });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [current, quotationId, jobId, checksum, sizeBytes, headersKey, assertOwner, downloadAccessError]);

  const download = async (filename: string, confirm: () => Promise<boolean>) => {
    if (!artifact || !available || accessError || pendingDownload.current) return;
    const controller = new AbortController();
    const { signal } = controller;
    const assertCurrent = () => { signal.throwIfAborted(); assertOwner(); };
    pendingDownload.current = controller;
    try {
      assertCurrent();
      setDownloadState({ identity, busy: true });
      if (!await confirm()) return;
      const blob = await readVerifiedPdf(quotationId, artifact, headersKey, signal, assertCurrent);
      assertCurrent();
      saveQuotationPdf(blob, filename);
    } catch (error) {
      if (signal.aborted) return;
      const failure = readAccessError(error);
      if (failure) setResult(null);
      setDownloadState({ identity, busy: false, error: true, accessError: failure });
    } finally {
      if (pendingDownload.current === controller) pendingDownload.current = null;
      if (!signal.aborted) {
        setDownloadState((previous) => previous?.identity === identity && previous.busy ? null : previous);
      }
    }
  };

  return {
    open: current !== null,
    setOpen: (open: boolean) => {
      if (!open) setRequest(null);
      else if (available && !current) setRequest({ identity, deferred: !!accessError });
    },
    url: accessError ? null : loaded?.url ?? null,
    error: !!accessError || loaded?.url === null,
    loading: current !== null && !accessError && !loaded,
    ...(accessError ? { accessError } : {}),
    download,
    ...(currentDownload?.busy ? { downloadBusy: true } : {}),
    ...(currentDownload?.error && !accessError ? { downloadError: true } : {}),
    retry: () => {
      if (accessError) setResult((previous) => previous?.request.identity === identity ? null : previous);
      if (downloadAccessError) setDownloadState((previous) => previous?.identity === identity ? null : previous);
      setRequest((previous) => previous?.identity === identity ? { identity } : previous);
    },
  };
}
