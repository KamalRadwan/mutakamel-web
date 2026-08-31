"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError } from "@/lib/api/errors";
import { deletePartyImage, uploadPartyImage } from "../../directory-api";
import {
  PARTY_IMAGE_INVALID_CODE,
  PARTY_IMAGE_MAX_BYTES,
  PARTY_IMAGE_REQUIRED_CODE,
  PARTY_IMAGE_TOO_LARGE_CODE,
  type Party,
} from "../../directory-contract";

type SetParty = (updater: (current: Party | null) => Party | null) => void;

/**
 * Party image upload, view and delete.
 *
 * The three failures are distinct and each needs a different next step, so they
 * never share a message: **400** `PARTY_IMAGE_REQUIRED` (no file part), **415**
 * `PARTY_IMAGE_INVALID` (the server sharp-decoded the bytes and refused them —
 * a file can be the right MIME and the right size and still land here), and
 * **413** `PARTY_IMAGE_TOO_LARGE`, which the server can also raise *after*
 * normalisation even when the uploaded file was under the cap.
 */
export function usePartyImage(party: Party | null, setParty: SetParty, canManage: boolean) {
  const { t } = useI18n();
  const toast = useToast();
  const copy = t.coreOperations.directory;

  const [isUploading, setIsUploading] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File): Promise<void> => {
      if (!party || !canManage || isUploading) return;
      setError(null);
      // Checked here as well as on the server so a 2 MB+ file never leaves the
      // browser; the server still re-checks after normalisation.
      if (file.size > PARTY_IMAGE_MAX_BYTES) {
        setError(copy.imageTooLarge);
        return;
      }
      setIsUploading(true);
      try {
        const updated = await uploadPartyImage(party.id, file);
        setParty(() => updated);
        toast.success(copy.savedTitle, copy.imageUploaded);
      } catch (caught) {
        const normalized = normalizeApiError(caught);
        if (normalized.status === 403) return;
        if (toast.outcomeFromApi(normalized)) return;
        setError(imageMessage(normalized.code, normalized.status, copy));
      } finally {
        setIsUploading(false);
      }
    },
    [party, canManage, isUploading, setParty, toast, copy],
  );

  const remove = useCallback(async (): Promise<void> => {
    if (!party || !canManage || isDeleting) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deletePartyImage(party.id);
      setParty((current) => (current ? { ...current, imageRevision: null } : current));
      toast.success(copy.savedTitle, copy.imageDeleted);
    } catch (caught) {
      const normalized = normalizeApiError(caught);
      if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
        toast.errorFromApi(copy.imageDeleteFailed, normalized);
      }
    } finally {
      setIsDeleting(false);
      setIsDeleteOpen(false);
    }
  }, [party, canManage, isDeleting, setParty, toast, copy]);

  return {
    isUploading,
    isDeleting,
    isDeleteOpen,
    error,
    clearError: () => setError(null),
    openDelete: () => setIsDeleteOpen(true),
    closeDelete: () => {
      if (isDeleting) return;
      setIsDeleteOpen(false);
    },
    upload,
    remove,
  };
}

type DirectoryCopy = ReturnType<typeof useI18n>["t"]["coreOperations"]["directory"];

function imageMessage(
  code: string | undefined,
  status: number,
  copy: DirectoryCopy,
): string {
  if (code === PARTY_IMAGE_REQUIRED_CODE || status === 400) return copy.imageRequired;
  if (code === PARTY_IMAGE_TOO_LARGE_CODE || status === 413) return copy.imageTooLarge;
  if (code === PARTY_IMAGE_INVALID_CODE || status === 415) return copy.imageInvalid;
  return copy.imageUploadFailed;
}
