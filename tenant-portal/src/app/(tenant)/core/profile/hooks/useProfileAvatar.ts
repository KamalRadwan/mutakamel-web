"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { notifyProfileAvatarChanged, useProfileAvatarImage } from "@/hooks/useProfileAvatarImage";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError } from "@/lib/api/errors";

// Core common/storage/party-image-upload.ts and the AVATARS bucket contract.
const MAX_BYTES = 2 * 1024 * 1024;
const MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];
const AVATAR_PATH = "/api/tenant/core/v1/profile/avatar";

export function useProfileAvatar() {
  const { user } = useTenantAuth();
  const { t } = useI18n();
  const copy = t.coreIdentity.profile;
  const toast = useToast();
  const src = useProfileAvatarImage(user?.id);
  const busy = useRef(false);
  const [pending, setPending] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState<string>();
  const [isDeleteOpen, setDeleteOpen] = useState(false);

  function imageStatusChanged(status: string) {
    setLoadedSrc(status === "loaded" ? src : undefined);
  }

  async function save(file?: File) {
    if (!user || busy.current) return;
    setError(null);
    setDenied(false);
    if (file && file.size > MAX_BYTES) { setError(copy.avatarTooLarge); return; }
    if (file && (!file.size || !MIME_TYPES.includes(file.type.toLowerCase()))) {
      setError(copy.avatarInvalid);
      return;
    }
    busy.current = true;
    setPending(file ? "upload" : "remove");
    try {
      const config = { nonReplayable: true, skipAutoIdempotency: true };
      const body = new FormData();
      if (file) body.append("file", file);
      const response = file
        ? await axiosClient.put<unknown>(AVATAR_PATH, body, config)
        : await axiosClient.delete<unknown>(AVATAR_PATH, config);
      if (response.status !== 204) throw new Error("INVALID_CORE_RESPONSE");
      notifyProfileAvatarChanged(user.id, !file);
      setLoadedSrc(undefined);
      setDeleteOpen(false);
      toast.success(file ? copy.avatarSaved : copy.avatarRemoved);
    } catch (caught) {
      const normalized = normalizeApiError(caught);
      if (normalized.status === 403) {
        setDenied(true);
        setDeleteOpen(false);
        return;
      }
      const message = normalized.status === 413 ? copy.avatarTooLarge
        : normalized.status === 415 || normalized.code === "PARTY_IMAGE_REQUIRED" ? copy.avatarInvalid
        : normalized.status === 404 ? copy.avatarUnavailable : copy.avatarFailed;
      setError(message);
      if (!toast.outcomeFromApi(normalized)) toast.errorFromApi(message, normalized);
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void save(file);
  }

  return {
    t, src, error, denied, pending, chooseFile, imageStatusChanged,
    initials: `${user?.firstName.charAt(0) ?? ""}${user?.lastName.charAt(0) ?? ""}`.toUpperCase(),
    disabled: !user || pending !== null,
    hasImage: Boolean(src && loadedSrc === src),
    accept: MIME_TYPES.join(","),
    isDeleteOpen,
    openDelete: () => setDeleteOpen(true),
    setDeleteOpen: (open: boolean) => { if (!busy.current) setDeleteOpen(open); },
    remove: () => void save(),
  };
}
