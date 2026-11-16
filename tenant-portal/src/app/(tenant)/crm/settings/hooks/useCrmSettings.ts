"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useAuthScopeKey } from "@/hooks/useAuthScopeKey";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TenantApiClientError, axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { useCrmErrorText } from "../../shared/hooks/useCrmErrorText";
import { buildCrmSettingsPatch, editableSettings, parseCrmSettingsResponse, rebaseSettingsDraft, settingsDirty,
  type CrmSettings, type EditableCrmSettings } from "../settings-contract";
import { validateSettings } from "../settings-validation";
export { buildCrmSettingsPatch, parseCrmSettingsResponse } from "../settings-contract";
export type { CrmSettings, EditableCrmSettings } from "../settings-contract";

const SETTINGS_PATH = "/api/tenant/crm/v1/settings";
const config = { cache: "no-store", maxResponseBytes: 256 * 1024 } as const;
async function readSettings(signal?: AbortSignal): Promise<CrmSettings> {
  return parseCrmSettingsResponse((await axiosClient.get<unknown>(SETTINGS_PATH, { ...config, signal })).data);
}

export function useCrmSettings() {
  const { t } = useI18n();
  const crmErrorText = useCrmErrorText();
  const toast = useToast();
  const { user } = useTenantAuth();
  const access = useAccessMode();
  const scope = useAuthScopeKey(user);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const [settings, setSettings] = useState<CrmSettings | null>(null);
  const [draft, setDraft] = useState<EditableCrmSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [hasRetentionConflict, setHasRetentionConflict] = useState(false);
  const [needsReview, setNeedsReview] = useState(false);
  const [reviewReady, setReviewReady] = useState(false);
  const [writeForbidden, setWriteForbidden] = useState(false);
  const [telephonyOpen, setTelephonyOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const pending = useRef(false);
  const reads = useRef(0);
  const mounted = useRef(true);
  const sameScope = loadedScope === scope;
  const visibleSettings = sameScope ? settings : null;
  const visibleDraft = sameScope ? draft : null;
  const canManage = Boolean(sameScope && user?.permissions.includes("crm.settings.manage") && access.canMutate && !writeForbidden);
  const live = useRef({ scope, settings: visibleSettings, draft: visibleDraft, canManage, hasRetentionConflict, needsReview });
  const copy = useRef({ t, crmErrorText, toast });
  useLayoutEffect(() => {
    live.current = { scope, settings: visibleSettings, draft: visibleDraft, canManage, hasRetentionConflict, needsReview };
    copy.current = { t, crmErrorText, toast };
  });
  const invalidateReads = useCallback(() => { ++reads.current; }, []);
  const apply = useCallback((next: CrmSettings, preserve: boolean) => {
    const previous = live.current.settings;
    setLoadedScope(live.current.scope);
    setSettings(next);
    setDraft((current) => preserve && current && previous ? rebaseSettingsDraft(previous, next, current) : editableSettings(next));
  }, []);
  const fetchSettings = useCallback(async (signal?: AbortSignal, preserveDraft = false) => {
    if (pending.current) return false;
    const request = ++reads.current;
    const startedScope = live.current.scope;
    const current = () => mounted.current && request === reads.current && startedScope === live.current.scope && !signal?.aborted;
    setIsLoading(true); setError(null); setQueryError(null);
    try {
      const next = await readSettings(signal);
      if (!current()) return false;
      apply(next, preserveDraft); setHasRetentionConflict(false); setWriteForbidden(false);
      if (live.current.needsReview) setReviewReady(true);
      return true;
    } catch (caught) {
      if (!current()) return false;
      if (!preserveDraft) { setSettings(null); setDraft(null); }
      const failure = normalizeApiError(caught);
      setQueryError({ status: failure.status, code: failure.code });
      setError(caught instanceof TenantApiClientError ? copy.current.crmErrorText({ status: failure.status, code: failure.code }) : copy.current.t.crmSettings.loadFailed);
      return false;
    } finally { if (current()) setIsLoading(false); }
  }, [apply]);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      pending.current = false;
      setLoadedScope(scope);
      setSettings(null); setDraft(null); setNeedsReview(false); setReviewReady(false);
      setWriteForbidden(false); setHasRetentionConflict(false); setIsSaving(false); setTelephonyOpen(false);
      void fetchSettings(controller.signal);
    });
    return () => { controller.abort(); mounted.current = false; invalidateReads(); };
  }, [scope, fetchSettings, invalidateReads]);

  const errors = validateSettings(visibleDraft, t.crmSettings);
  const isDirty = settingsDirty(visibleSettings, visibleDraft);
  const resetDraft = () => {
    if (pending.current || !live.current.settings || live.current.needsReview) return;
    setDraft(editableSettings(live.current.settings)); setSubmitted(false);
  };
  const saveSettings = async (): Promise<boolean> => {
    const start = live.current;
    if (!start.settings || !start.draft || pending.current || isLoading || start.hasRetentionConflict || start.needsReview) return false;
    if (!start.canManage) { setError(t.crmSettings.manageForbidden); return false; }
    setSubmitted(true);
    if (Object.keys(validateSettings(start.draft, t.crmSettings)).length) { setError(t.crmSettings.validationSummary); return false; }
    const patch = buildCrmSettingsPatch(start.settings, start.draft);
    if (!Object.keys(patch).length) return true;
    pending.current = true;
    const generation = ++reads.current;
    const current = () => mounted.current && start.scope === live.current.scope && generation === reads.current;
    setIsSaving(true); setError(null);
    try {
      const response = await axiosClient.put<unknown>(SETTINGS_PATH, patch, { ...config, nonReplayable: true, skipAutoIdempotency: true });
      const next = parseCrmSettingsResponse(response.data);
      if (!current()) return false;
      apply(next, false); setSubmitted(false); copy.current.toast.success(copy.current.t.crmSettings.saved);
      return true;
    } catch (caught) {
      if (!current()) return false;
      const failure = normalizeApiError(caught);
      if (failure.status === 409 && failure.code === "CRM_OUTBOUND_EMAIL_RETENTION_POLICY_STALE") {
        live.current = { ...live.current, hasRetentionConflict: true };
        setHasRetentionConflict(true); return false;
      }
      if (failure.status === 403) { live.current = { ...live.current, canManage: false }; setWriteForbidden(true); }
      if (!(caught instanceof TenantApiClientError) || failure.status <= 0 || failure.status >= 500) {
        live.current = { ...live.current, needsReview: true };
        setNeedsReview(true); setReviewReady(false);
        try { const next = await readSettings(); if (current()) { apply(next, true); setReviewReady(true); } }
        catch { /* Unknown writes stay fenced until a validated current state is available. */ }
        if (current()) setError(copy.current.t.crmSettings.saveFailed);
      } else { setError(copy.current.crmErrorText({ status: failure.status, code: failure.code })); copy.current.toast.outcomeFromApi(failure); }
      return false;
    } finally { if (current()) { pending.current = false; setIsSaving(false); } }
  };
  const acknowledgeReview = () => {
    if (!reviewReady || pending.current || isLoading) return;
    setNeedsReview(false); setReviewReady(false); setError(null);
  };
  return { settings: visibleSettings, draft: visibleDraft, setDraft, isLoading: !sameScope || isLoading,
    isSaving: sameScope && isSaving, isDirty, canManage, error: sameScope ? error : null,
    queryError: sameScope ? queryError : null, hasRetentionConflict: sameScope && hasRetentionConflict,
    needsReview: sameScope && needsReview, reviewReady: sameScope && reviewReady, acknowledgeReview, submitted, errors,
    telephonyOpen: sameScope && telephonyOpen, setTelephonyOpen, reloadRetentionPolicy: () => fetchSettings(undefined, true),
    fetchSettings, resetDraft, saveSettings };
}
