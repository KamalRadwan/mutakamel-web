"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { buildInquiryCommand, canReview, inquiryPath, referenceIdentity, validateInquiryReceipt,
  type InquiryCommand, type InquirySelection, type ReviewMode } from "./contract";
import { readInquiryContext, useInquiryContext } from "./useInquiryContext";

interface PendingReview {
  leadId: string;
  command: InquiryCommand;
  previousIdentityId: string | null;
}

export function useInquiryReview(actorId: string, canMutate: boolean) {
  const [source, setSource] = useState<InquirySelection | null>(null);
  const [reference, setReference] = useState<InquirySelection | null>(null);
  const [mode, setMode] = useState<ReviewMode | null>(null);
  const [before, setBefore] = useState<number>();
  const [version, setVersion] = useState(0);
  const [referenceVersion, setReferenceVersion] = useState(0);
  const [error, setError] = useState<NormalizedApiError>();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState<PendingReview>();
  const writing = useRef(false);
  const active = useRef(false);
  useLayoutEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  const sourceRead = useInquiryContext(source, version, before);
  const referenceRead = useInquiryContext(mode === "LINK" ? reference : null, `${version}:${referenceVersion}`);
  const context = sourceRead.context;
  const target = referenceIdentity(context, referenceRead.context);
  const locked = busy || Boolean(pending);
  const denied = sourceRead.error?.status === 403 || referenceRead.error?.status === 403 || error?.status === 403;
  const canSave = canMutate && !locked && !denied && canReview(context) && Boolean(mode && (mode === "NEW" || target));
  const reload = () => {
    setError(undefined);
    setBefore(undefined);
    setVersion(value => value + 1);
  };

  async function submit(replay?: PendingReview) {
    if (writing.current || !canMutate || (!replay && !canSave)) return;
    writing.current = true;
    setBusy(true);
    setError(undefined);
    setSaved(false);
    let request = replay;
    let sent = false;
    try {
      if (!request && source && context && mode) {
        if (mode === "LINK" && reference) {
          const freshReference = await readInquiryContext(reference);
          if (!active.current) return;
          if (!target || referenceIdentity(context, freshReference) !== target) {
            reload();
            setError({ status: 409, code: "REFERENCE_CHANGED" });
            return;
          }
        }
        request = { leadId: source.id, command: buildInquiryCommand(context, mode, target),
          previousIdentityId: context.current?.identityId ?? null };
      }
      if (!request || !active.current) return;
      sent = true;
      const response = await axiosClient.post<unknown>(inquiryPath(request.leadId), request.command, {
        cache: "no-store", maxResponseBytes: 65_536, nonReplayable: true, skipAutoIdempotency: true, suppressForbiddenToast: true,
      });
      if (!active.current) return;
      if (response.status !== 200) throw new Error("Unexpected inquiry decision status.");
      validateInquiryReceipt(response.data, request.leadId, actorId.toLowerCase(), request.command, request.previousIdentityId);
      setPending(undefined);
      setSaved(true);
      setMode(null);
      setReference(null);
      reload();
    } catch (caught) {
      if (!active.current) return;
      const failure = normalizeApiError(caught);
      const ambiguous = sent && (failure.status === 0 || failure.status === 408 || failure.status >= 500);
      if (request && (replay || ambiguous)) setPending(request);
      reload();
      setError(failure);
    } finally {
      writing.current = false;
      if (active.current) setBusy(false);
    }
  }

  return {
    source, reference, mode, before, sourceRead, referenceRead, target, error, busy, locked, denied, canSave,
    pending: Boolean(pending), saved: saved && !sourceRead.loading,
    chooseSource: (next: InquirySelection | null) => {
      if (locked) return;
      setSource(next); setReference(null); setMode(null); setSaved(false); reload();
    },
    chooseReference: (next: InquirySelection | null) => {
      if (locked) return;
      setReference(next); setError(undefined); setReferenceVersion(value => value + 1);
    },
    chooseMode: (next: ReviewMode) => {
      if (locked) return;
      setMode(next); setReference(null); setSaved(false); setError(undefined);
      setReferenceVersion(value => value + 1);
    },
    historyPage: (next?: number) => {
      if (!locked) { setBefore(next); setVersion(value => value + 1); }
    },
    reload,
    save: () => submit(),
    reconcile: () => pending && submit(pending),
  };
}
