"use client";

import {
  Avatar, AvatarFallback, AvatarImage, Button, ConfirmActionModal, DetailSection, Field, Input, PermissionGate,
} from "@/design-system";
import { useProfileAvatar } from "../hooks/useProfileAvatar";

export function ProfileAvatar() {
  const screen = useProfileAvatar();
  const copy = screen.t.coreIdentity.profile;
  return (
    <DetailSection title={copy.avatarTitle} description={copy.avatarDescription}>
      <PermissionGate require={[]} denied={screen.denied}>
      <div className="flex flex-wrap items-center gap-4" aria-busy={screen.pending !== null}>
        <Avatar className="size-16">
          {screen.src ? <AvatarImage src={screen.src} alt={copy.avatarTitle}
            className="object-cover" onLoadingStatusChange={screen.imageStatusChanged} /> : null}
          <AvatarFallback>{screen.initials}</AvatarFallback>
        </Avatar>
        <Field label={copy.avatarUpload} hint={copy.avatarHint} error={screen.error ?? undefined}>
          <Input type="file" accept={screen.accept} disabled={screen.disabled} onChange={screen.chooseFile} />
        </Field>
        {screen.hasImage ? (
          <Button variant="outline" disabled={screen.disabled} onClick={screen.openDelete}>
            {copy.avatarRemove}
          </Button>
        ) : null}
        {screen.pending ? <p role="status" className="text-sm text-muted-foreground">{copy.avatarSaving}</p> : null}
      </div>
      <ConfirmActionModal open={screen.isDeleteOpen} onOpenChange={screen.setDeleteOpen}
        title={copy.avatarRemove} description={copy.avatarRemoveDescription}
        confirmLabel={screen.t.common.confirmDelete} cancelLabel={screen.t.common.cancel}
        onConfirm={screen.remove} loading={screen.pending === "remove"} />
      </PermissionGate>
    </DetailSection>
  );
}
