/**
 * RFC 6901 JSON Pointer helpers for validation issue `jsonPointer` values.
 * The backend emits "" for the document root and "/a/b/0" paths, with "~" escaped
 * as "~0" and "/" as "~1" inside a segment; pointers are at most 500 characters.
 */
export const JSON_POINTER_MAX_LENGTH = 500;

export function encodeJsonPointerSegment(segment: string | number): string {
  return String(segment).replace(/~/g, '~0').replace(/\//g, '~1');
}

export function decodeJsonPointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

export function toJsonPointer(segments: readonly (string | number)[]): string {
  return segments.map((segment) => `/${encodeJsonPointerSegment(segment)}`).join('');
}

/** Decoded segments of a pointer, or null when it is not a valid RFC 6901 pointer. */
export function parseJsonPointer(pointer: string | null | undefined): string[] | null {
  if (pointer === null || pointer === undefined) return null;
  if (pointer === '') return [];
  if (!pointer.startsWith('/') || pointer.length > JSON_POINTER_MAX_LENGTH) return null;
  const raw = pointer.slice(1).split('/');
  if (raw.some((segment) => /~(?![01])/.test(segment))) return null;
  return raw.map(decodeJsonPointerSegment);
}

/** Node id from a "/nodes/<id>/..." pointer (segment unescaped), else null. */
export function nodeIdFromJsonPointer(pointer: string | null | undefined): string | null {
  const segments = parseJsonPointer(pointer);
  if (!segments || segments.length < 2 || segments[0] !== 'nodes' || segments[1] === '') return null;
  return segments[1];
}
