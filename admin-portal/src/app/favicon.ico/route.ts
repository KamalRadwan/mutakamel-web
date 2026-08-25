export function GET(): Response {
  return new Response(null, {
    status: 308,
    headers: {
      Location: '/icon.svg',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
