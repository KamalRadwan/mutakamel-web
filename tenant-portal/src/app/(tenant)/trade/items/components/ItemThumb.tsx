import { Avatar, AvatarFallback, AvatarImage, cn } from "@/design-system";
import { itemImageRenditionSrc, type ItemImageSummary } from "../item-image-contract";
import { ItemKindIcon } from "./ItemKindIcon";

interface ItemThumbProps {
  itemId: string;
  kind: string;
  image: ItemImageSummary | null;
  /** Empty when the Item name is next to the thumbnail; the name when it stands alone. */
  alt: string;
  /** The fixed box: size, radius and surface. */
  className?: string;
  iconClassName?: string;
}

/**
 * The `thumb` rendition in a fixed box (LLD 02b §19 "Thumbnails elsewhere").
 * The box never changes size, so a loading or missing image shifts nothing,
 * and the kind icon stays until the image has loaded — and for good when it
 * fails to load.
 */
export function ItemThumb({ itemId, kind, image, alt, className, iconClassName }: ItemThumbProps) {
  return (
    <Avatar className={cn("rounded-md border", className)}>
      {image ? (
        <AvatarImage
          src={itemImageRenditionSrc(itemId, image.id, "thumb")}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="bg-muted object-contain"
        />
      ) : null}
      <AvatarFallback className="rounded-none bg-transparent text-current">
        <ItemKindIcon kind={kind} className={iconClassName} />
      </AvatarFallback>
    </Avatar>
  );
}
