"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { axiosClient, getApiRequestOutcome } from "@/lib/api/axiosClient";
import { generateUUIDv7 } from "@/lib/utils/uuid";
import { useI18n } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { useToast } from "@/components/ui/ToastContext";
import type { SuccessResponse } from "@/types/common";
import type { AdminUserProfile } from "@/app/(shell)/users/types";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import {
  isAmbiguousWriteOutcome,
  shouldRotateWriteCommandKey,
} from "@/shared/api/write-command-recovery";

interface ProfileWriteIntent {
  fingerprint: string;
  payload: {
    themeKey: string;
    language: string;
    extensions: Record<string, unknown>;
  };
  idempotencyKey: string;
  ambiguous: boolean;
}

export function useMyProfile() {
  const { lang, setLang } = useI18n();
  const copy = (lang === "ar" ? ar : en).profile;
  const toast = useToast();

  const [profile, setProfile] = useState<AdminUserProfile | null>(null);
  const [themeKey, setThemeKey] = useState<string>("dark");
  const [language, setLanguage] = useState<string>("en");
  const [tableDensity, setTableDensity] = useState<string>("compact");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [saveError, setSaveError] = useState<NormalizedApiError | null>(null);
  const profileIntentRef = useRef<ProfileWriteIntent | null>(null);

  const loadMyProfile = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setProfile(null);
    try {
      const res = await axiosClient.get<SuccessResponse<AdminUserProfile>>(
        "/api/admin/core/v1/users/me/profile",
      );
      const data = res.data.data;
      setProfile(data);
      if (data.themeKey) setThemeKey(data.themeKey);
      if (data.language) setLanguage(data.language);
      if (data.extensions?.tableDensity)
        setTableDensity(data.extensions.tableDensity as string);
    } catch (caught: unknown) {
      const normalized = normalizeApiError(caught);
      setLoadError(normalized);
      toast.error(copy.loadFailedTitle, copy.loadFailedDescription);
    } finally {
      setIsLoading(false);
    }
  }, [copy.loadFailedTitle, copy.loadFailedDescription, toast]);

  useEffect(() => {
    queueMicrotask(() => loadMyProfile());
  }, [loadMyProfile]);

  const hasChanges = useMemo(() => {
    if (!profile) return false;
    return (
      themeKey !== (profile.themeKey || "dark") ||
      language !== (profile.language || "en") ||
      tableDensity !== (profile.extensions?.tableDensity || "compact")
    );
  }, [profile, themeKey, language, tableDensity]);

  const saveProfile = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);

    try {
      const payload: ProfileWriteIntent["payload"] = {
        themeKey,
        language,
        extensions: {
          ...profile?.extensions,
          tableDensity,
        },
      };
      const fingerprint = JSON.stringify(payload);
      const current = profileIntentRef.current;
      if (current?.ambiguous && current.fingerprint !== fingerprint) {
        throw new Error("PENDING_PROFILE_WRITE_MUST_BE_RECONCILED");
      }
      const intent =
        current?.fingerprint === fingerprint
          ? current
          : {
              fingerprint,
              payload,
              idempotencyKey: generateUUIDv7(),
              ambiguous: false,
            };
      profileIntentRef.current = intent;

      const res = await axiosClient.patch<SuccessResponse<AdminUserProfile>>(
        "/api/admin/core/v1/users/me/profile",
        intent.payload,
        {
          headers: { "x-idempotency-key": intent.idempotencyKey },
          skipAutoIdempotency: true,
          replayAfterRefresh: true,
          cache: "no-store",
        },
      );

      const updated = res.data.data;
      profileIntentRef.current = null;
      setProfile(updated);

      if (language === "ar" || language === "en") {
        setLang(language);
      }

      toast.success(copy.savedTitle, copy.savedDescription);
    } catch (caught: unknown) {
      const normalized = normalizeApiError(caught);
      const current = profileIntentRef.current;
      const ambiguous =
        getApiRequestOutcome(caught) === "settled-before-session-change" ||
        isAmbiguousWriteOutcome(normalized) ||
        /(?:UPSTREAM|UNAVAILABLE|TIMEOUT)/u.test(normalized.errorCode);
      if (current && ambiguous) {
        profileIntentRef.current = { ...current, ambiguous: true };
        const confirmed = await loadProfileForReconciliation(current.payload);
        if (confirmed) {
          profileIntentRef.current = null;
          setProfile(confirmed);
          setSaveError(null);
          if (confirmed.language === "ar" || confirmed.language === "en") {
            setLang(confirmed.language);
          }
          return;
        }
      } else if (current && shouldRotateWriteCommandKey(normalized)) {
        profileIntentRef.current = null;
      }
      setSaveError(normalized);
      toast.error(copy.saveErrorTitle, copy.saveErrorDescription);
    } finally {
      setIsSaving(false);
    }
  };

  return {
    lang,
    profile,
    themeKey,
    setThemeKey,
    language,
    setLanguage,
    tableDensity,
    setTableDensity,
    isLoading,
    isSaving,
    loadError,
    saveError,
    hasChanges,
    saveProfile,
    reload: loadMyProfile,
  };
}

async function loadProfileForReconciliation(
  payload: ProfileWriteIntent["payload"],
): Promise<AdminUserProfile | null> {
  try {
    const response = await axiosClient.get<SuccessResponse<AdminUserProfile>>(
      "/api/admin/core/v1/users/me/profile",
      { cache: "no-store" },
    );
    const profile = response.data.data;
    return profile.themeKey === payload.themeKey &&
      profile.language === payload.language &&
      profile.extensions?.tableDensity === payload.extensions.tableDensity
      ? profile
      : null;
  } catch {
    return null;
  }
}
