"use client";

import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { invalidCoreResponse } from "../../../contracts/core-page";
import { fetchTemplateVersion } from "../../template-lifecycle-api";
import type { TemplateVersion } from "../../template-lifecycle-contract";
import type { VersionAuthority } from "./useTemplateVersionAuthority";

type VersionDetail = { owner: VersionAuthority; templateId: string; row: TemplateVersion } & (
  | { state: "pending" }
  | { state: "ready"; version: TemplateVersion }
  | { state: "failed"; error: NormalizedApiError }
);

export function useTemplateVersionDetail(templateId: string | null, owner: VersionAuthority | null) {
  const [state, setState] = useState<VersionDetail | null>(null);
  const request = useRef<AbortController | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const versionDetailRef = useRef<HTMLDivElement>(null);
  const versionHistoryRef = useRef<HTMLElement>(null);
  const versionDetailId = useId();
  const registerVersionDetail = useCallback((node: HTMLDivElement | null) => { versionDetailRef.current = node; }, []);
  const registerVersionHistory = useCallback((node: HTMLElement | null) => { versionHistoryRef.current = node; }, []);
  const versionDetail = state && state.owner === owner && state.templateId === templateId ? state : null;
  const abortSelection = useCallback(() => {
    request.current?.abort();
    request.current = null;
    trigger.current = null;
  }, []);

  useLayoutEffect(() => {
    const stop = owner?.onRetire(abortSelection);
    return () => {
      stop?.();
      abortSelection();
    };
  }, [owner, templateId, abortSelection]);

  useLayoutEffect(() => {
    const origin = trigger.current;
    if (versionDetail && versionDetail.state !== "pending" && origin?.ownerDocument.activeElement === origin) {
      versionDetailRef.current?.focus();
    }
  }, [versionDetail]);

  async function openVersion(
    row: TemplateVersion,
    origin?: HTMLButtonElement,
    publication?: Pick<TemplateVersion, "validationRunId" | "compilerVersion">,
  ) {
    if (!templateId || !owner?.isCurrent()) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    if (origin) trigger.current = origin;
    else {
      const detail = versionDetailRef.current;
      if (detail?.contains(detail.ownerDocument.activeElement)) detail.focus();
    }
    setState({ owner, templateId, row, state: "pending" });
    try {
      const assertCurrent = () => {
        controller.signal.throwIfAborted();
        if (request.current !== controller || !owner.isCurrent()) throw new Error("Version selection changed.");
      };
      const version = await fetchTemplateVersion(templateId, row.id, controller.signal, {
        selected: row, scope: owner.scope, assertCurrent,
      });
      assertCurrent();
      if (publication && (version.validationRunId !== publication.validationRunId ||
        version.compilerVersion !== publication.compilerVersion)) invalidCoreResponse();
      setState({ owner, templateId, row, state: "ready", version });
    } catch (error) {
      if (request.current === controller && !controller.signal.aborted && owner.isCurrent()) setState({ owner, templateId, row, state: "failed", error: normalizeApiError(error) });
    }
  }

  function closeVersion() {
    if (!owner?.isCurrent()) return;
    const origin = trigger.current;
    const detail = versionDetailRef.current;
    const restoreFocus = detail?.contains(detail.ownerDocument.activeElement);
    abortSelection();
    setState(null);
    if (restoreFocus) {
      if (origin?.isConnected && !origin.disabled) origin.focus();
      else versionHistoryRef.current?.focus();
    }
  }

  return { versionDetail, registerVersionDetail, registerVersionHistory, versionDetailId, canOpenVersion: Boolean(templateId && owner),
    openVersion, closeVersion };
}
