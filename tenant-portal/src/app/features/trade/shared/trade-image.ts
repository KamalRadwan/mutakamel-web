import type { ItemImageSummary } from './trade-foundation.model';

function hashIndex(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return (hash % 10) + 1;
}

function readToken(varName: string): string {
  if (typeof document === 'undefined') {
    return 'currentColor';
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value || 'currentColor';
}

export async function itemThumbUrl(itemId: string, image: ItemImageSummary | null): Promise<string | null> {
  if (!image) {
    return null;
  }

  // Real API: GET /api/tenant/trade/v1/items/{itemId}/images/{image.id}/thumb as a blob with auth headers -> URL.createObjectURL(blob)
  const bg = readToken(`--chart-${hashIndex(itemId)}`);
  const fg = readToken('--on-icon');

  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">',
    `<rect width="256" height="256" rx="32" fill="${bg}"/>`,
    `<rect x="64" y="64" width="128" height="128" rx="20" fill="${fg}" opacity="0.35"/>`,
    `<circle cx="128" cy="128" r="32" fill="${fg}" opacity="0.35"/>`,
    '</svg>',
  ].join('');

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function releaseThumbUrl(url: string | null | undefined): void {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}
