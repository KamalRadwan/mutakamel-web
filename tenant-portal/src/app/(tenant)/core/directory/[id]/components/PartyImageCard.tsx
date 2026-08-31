"use client";

import { Trash2, Upload } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  ConfirmActionModal,
  DetailSection,
  Field,
  Input,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  PARTY_IMAGE_MIME_TYPES,
  partyImageSrc,
  type Party,
} from "../../directory-contract";
import { usePartyImage } from "../hooks/usePartyImage";

interface PartyImageCardProps {
  party: Party;
  setParty: (updater: (current: Party | null) => Party | null) => void;
  canManage: boolean;
}

export function PartyImageCard({ party, setParty, canManage }: PartyImageCardProps) {
  const { t } = useI18n();
  const copy = t.coreOperations.directory;
  const image = usePartyImage(party, setParty, canManage);
  const initials = party.displayName.slice(0, 2).toUpperCase();

  return (
    <DetailSection
      title={party.imageKind === "LOGO" ? copy.imageLogoTitle : copy.imagePhotoTitle}
      description={copy.imageDescription}
      action={
        canManage && party.imageRevision ? (
          <Button variant="outline" size="sm" onClick={image.openDelete} disabled={image.isDeleting}>
            <Trash2 className="size-4 text-destructive" aria-hidden="true" />
            {t.common.delete}
          </Button>
        ) : null
      }
    >
      <div className="flex flex-wrap items-center gap-4">
        <Avatar className="size-16 rounded-md">
          {party.imageRevision ? (
            <AvatarImage src={partyImageSrc(party)} alt={party.displayName} />
          ) : null}
          <AvatarFallback className="rounded-md">{initials}</AvatarFallback>
        </Avatar>

        {canManage ? (
          <Field
            label={copy.imageUploadLabel}
            hint={copy.imageConstraint}
            error={image.error ?? undefined}
          >
            <Input
              type="file"
              accept={PARTY_IMAGE_MIME_TYPES.join(",")}
              disabled={image.isUploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                // The input keeps the chosen name after a rejected upload, so
                // clearing it is what lets the same file be retried.
                event.target.value = "";
                image.clearError();
                if (file) void image.upload(file);
              }}
            />
          </Field>
        ) : (
          <span className="text-sm text-muted-foreground">{copy.imageReadOnly}</span>
        )}

        {image.isUploading ? (
          <span className="flex items-center gap-2 text-sm text-muted-foreground" aria-busy="true">
            <Upload className="size-4 animate-pulse" aria-hidden="true" />
            {copy.imageUploading}
          </span>
        ) : null}
      </div>

      <ConfirmActionModal
        open={image.isDeleteOpen}
        onOpenChange={(open) => {
          if (!open) image.closeDelete();
        }}
        title={copy.imageDeleteTitle}
        description={copy.imageDeleteDescription}
        confirmLabel={t.common.confirmDelete}
        cancelLabel={t.common.cancel}
        onConfirm={() => void image.remove()}
        loading={image.isDeleting}
      />
    </DetailSection>
  );
}
