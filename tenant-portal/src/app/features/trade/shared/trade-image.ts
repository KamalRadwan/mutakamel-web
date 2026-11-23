import { scopeFor, type TradeContext } from './trade-api';
import type { ItemImageSummary } from './trade-foundation.model';
import { tradeHttp } from './trade-http';

export type ItemImageRendition = 'thumb' | 'print';

// GET /api/tenant/trade/v1/items/:id/images/:imageId/:rendition (raw binary blob, OPTIONAL scope)
export async function itemImageRenditionUrl(
  itemId: string,
  image: Pick<ItemImageSummary, 'id'> | null,
  rendition: ItemImageRendition = 'thumb',
  ctx: TradeContext = {},
): Promise<string | null> {
  if (!image) {
    return null;
  }
  const scope = scopeFor(ctx, 'OPTIONAL');
  const blob = await tradeHttp().readBlob(
    `/items/${encodeURIComponent(itemId)}/images/${encodeURIComponent(image.id)}/${rendition}`,
    undefined,
    { scope },
  );
  return URL.createObjectURL(blob);
}

export function itemThumbUrl(
  itemId: string,
  image: ItemImageSummary | null,
  ctx: TradeContext = {},
): Promise<string | null> {
  return itemImageRenditionUrl(itemId, image, 'thumb', ctx);
}

export function releaseThumbUrl(url: string | null | undefined): void {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}
