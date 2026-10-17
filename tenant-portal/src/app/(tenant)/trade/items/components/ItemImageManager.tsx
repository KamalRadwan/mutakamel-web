"use client";

import { useId, useRef } from "react";
import { Camera, Eye, Pencil, Trash2 } from "lucide-react";
import {
  Avatar,
  AvatarImage,
  Badge,
  Button,
  ConfirmActionModal,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  ImageUploadTile,
  Progress,
  cn,
  type ImageUploadTileHandle,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { tradeLocalizedName } from "../../trade-validation";
import { useItemImageManager } from "../hooks/useItemImageManager";
import type { Item } from "../item-contract";
import { itemImageRenditionSrc, type ItemImageChange } from "../item-image-contract";
import { ItemThumb } from "./ItemThumb";

interface ItemImageManagerProps {
  item: Item;
  onChanged: (change: ItemImageChange) => void;
  onStale: () => void;
  /** `md` is the 68 px editor tile; `lg` the 96 px detail header tile. */
  size: "md" | "lg";
}

const TILE_SIZE = { md: "size-17", lg: "size-24" } as const;
const ICON_SIZE = { md: "size-8", lg: "size-10" } as const;

/**
 * The image of an existing Item: thumbnail, replace, view larger and remove
 * (LLD 02b §19 "Avatar tile states" and "Edit flow").
 */
export function ItemImageManager({ item, onChanged, onStale, size }: ItemImageManagerProps) {
  const { t, lang } = useI18n();
  const copy = t.trade.itemImage;
  const image = useItemImageManager({ item, onChanged, onStale });
  const { canManage } = image;
  const tileRef = useRef<ImageUploadTileHandle>(null);
  const statusId = useId();
  const name = tradeLocalizedName(item.localizedNames, lang) || item.canonicalCode;
  const tileClass = cn(TILE_SIZE[size], "rounded-lg border-border bg-muted text-muted-foreground");

  const face = image.pending ? (
    <Avatar className={cn(tileClass, "border", image.isUploading && "opacity-60")}>
      <AvatarImage src={image.pending.previewUrl} alt="" className="object-contain" />
    </Avatar>
  ) : (
    <ItemThumb
      itemId={item.id}
      kind={item.itemKind}
      image={item.image}
      alt={canManage ? "" : name}
      className={tileClass}
      iconClassName={ICON_SIZE[size]}
    />
  );

  return (
    <div className="flex shrink-0 items-start gap-3">
      {canManage ? (
        <ImageUploadTile
          ref={tileRef}
          label={item.image ? copy.change : copy.add}
          {...image.tileScreening}
          onFileAdded={image.choose}
          disabled={image.isBusy}
          busy={image.isBusy}
          describedBy={statusId}
        >
          {face}
          <span
            className="absolute -bottom-1 -end-1 flex size-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-2xs"
            aria-hidden="true"
          >
            {item.image ? <Pencil className="size-3" /> : <Camera className="size-3" />}
          </span>
        </ImageUploadTile>
      ) : item.image ? (
        <Button
          variant="ghost"
          className="h-auto p-0"
          aria-label={copy.viewLarger}
          onClick={() => image.setPreviewOpen(true)}
        >
          {face}
        </Button>
      ) : (
        face
      )}

      <div className="flex min-w-0 flex-col gap-1.5">
        {image.pending ? (
          <>
            <Badge tone="caution" className="self-start">
              {copy.notSaved}
            </Badge>
            <div className="flex flex-wrap gap-1.5">
              <Button size="xs" variant="outline" onClick={() => void image.confirmPending()} loading={image.isUploading}>
                {copy.useImage}
              </Button>
              <Button size="xs" variant="ghost" onClick={image.cancelPending} disabled={image.isUploading}>
                {t.common.cancel}
              </Button>
            </div>
            {image.pending.lowResolution ? (
              <p className="max-w-prose text-xs text-muted-foreground">{copy.lowResolution}</p>
            ) : null}
          </>
        ) : canManage && item.image ? (
          <div className="flex flex-wrap gap-1.5">
            <Button size="xs" variant="ghost" onClick={() => tileRef.current?.openPicker()} disabled={image.isBusy}>
              {copy.replace}
            </Button>
            <Button size="xs" variant="ghost" onClick={() => image.setPreviewOpen(true)}>
              <Eye className="size-3.5" aria-hidden="true" />
              {copy.viewLarger}
            </Button>
            <Button size="xs" variant="ghost" onClick={image.openRemove} disabled={image.isBusy}>
              <Trash2 className="size-3.5 text-destructive" aria-hidden="true" />
              {copy.remove}
            </Button>
          </div>
        ) : null}

        {image.isUploading ? <Progress label={copy.uploading} className="w-24" /> : null}
        <p id={statusId} aria-live="polite" className="text-xs text-muted-foreground">
          {image.status}
        </p>
        {image.error ? (
          <p role="alert" className="max-w-prose text-xs text-destructive">
            {image.error}
          </p>
        ) : null}
      </div>

      {item.image ? (
        <Dialog open={image.isPreviewOpen} onOpenChange={image.setPreviewOpen}>
          <DialogContent size="lg" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>{copy.previewTitle}</DialogTitle>
            </DialogHeader>
            <Avatar className="aspect-square size-auto w-full rounded-md bg-muted">
              <AvatarImage
                src={itemImageRenditionSrc(item.id, item.image.id, "print")}
                alt={name}
                className="object-contain"
              />
            </Avatar>
          </DialogContent>
        </Dialog>
      ) : null}

      <ConfirmActionModal
        open={image.isRemoveOpen}
        onOpenChange={(open) => {
          if (!open) image.closeRemove();
        }}
        title={copy.removeTitle}
        description={copy.removeBody}
        confirmLabel={copy.remove}
        cancelLabel={t.common.cancel}
        onConfirm={() => void image.confirmRemove()}
        loading={image.isRemoving}
      />
    </div>
  );
}
