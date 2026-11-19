// Not prerendered: an empty prerendered body is a zero-size LRU cache entry
// that Next rejects with an error on every refresh. See the tenant portal's copy.
export const dynamic = 'force-dynamic';

export function GET(): Response {
  return new Response(null, {
    status: 308,
    headers: {
      Location: '/icon.svg',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
