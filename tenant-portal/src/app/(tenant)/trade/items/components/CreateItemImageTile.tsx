"use client";

import { useId } from "react";
import { Camera, type LucideIcon } from "lucide-react";
import {
  Avatar,
  AvatarImage,
  Badge,
  Button,
  ImageUploadTile,
  Progress,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { useItemImageFile } from "../hooks/useItemImageFile";

interface CreateItemImageTileProps {
  /** The kind glyph shown while no image is picked. */
  icon: LucideIcon;
  /** The kind (or error) palette of the empty tile. */
  surfaceClassName: string;
  image: ReturnType<typeof useItemImageFile>;
  upload: {
    /** The Item was saved and its image was not. */
    failed: boolean;
    isUploading: boolean;
    error: string | null;
    status: string;
  };
  disabled: boolean;
}

/**
 * The New Item avatar tile (LLD 02b §19 "Avatar tile states"). Picking only
 * previews the image: nothing is sent until the Item is created.
 */
export function CreateItemImageTile({
  icon: KindIcon,
  surfaceClassName,
  image,
  upload,
  disabled,
}: CreateItemImageTileProps) {
  const { t } = useI18n();
  const copy = t.trade.itemImage;
  const statusId = useId();
  const pending = image.pending;
  const error = image.error ?? upload.error;

  return (
    <div className="flex flex-col items-center justify-center gap-1.5 text-center">
      <ImageUploadTile
        label={pending ? copy.change : copy.add}
        {...image.tileScreening}
        onFileAdded={(file) => void image.choose(file)}
        disabled={disabled}
        busy={upload.isUploading}
        describedBy={statusId}
      >
        <span
          className={cn(
            "flex size-17 items-center justify-center overflow-hidden rounded-lg border shadow-2xs transition-colors",
            pending ? "border-border bg-muted" : surfaceClassName,
            upload.isUploading && "opacity-60",
          )}
        >
          {pending ? (
            <Avatar className="size-full rounded-none">
              <AvatarImage src={pending.previewUrl} alt="" className="object-contain" />
            </Avatar>
          ) : (
            <KindIcon className="size-8 stroke-[1.75]" aria-hidden="true" />
          )}
        </span>
        <span
          className="absolute -bottom-1 -end-1 flex size-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-2xs"
          aria-hidden="true"
        >
          <Camera className="size-3" />
        </span>
      </ImageUploadTile>
      <span className="text-2xs font-semibold text-muted-foreground">{t.trade.itemAvatarLabel}</span>

      {pending ? (
        <>
          <Badge tone={upload.failed ? "negative" : "caution"}>
            {upload.failed ? copy.notUploaded : copy.notSaved}
          </Badge>
          <Button size="xs" variant="ghost" onClick={image.clear} disabled={disabled}>
            {upload.failed ? copy.discard : copy.remove}
          </Button>
        </>
      ) : (
        <>
          <span className="sr-only">{t.trade.itemTypeIcon}</span>
          <span className="sr-only">{t.trade.itemTypeGenerated}</span>
        </>
      )}

      {upload.isUploading ? <Progress label={copy.uploading} className="w-17" /> : null}
      <p id={statusId} aria-live="polite" className="text-2xs text-muted-foreground">
        {upload.status}
      </p>
      {error ? (
        <p role="alert" className="text-2xs text-destructive">
          {error}
        </p>
      ) : null}
      {pending?.lowResolution ? (
        <p className="text-2xs text-muted-foreground">{copy.lowResolution}</p>
      ) : null}
    </div>
  );
}
