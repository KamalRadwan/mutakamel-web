import { describe, expect, it } from 'vitest';
import { nodeIdFromJsonPointer, parseJsonPointer, toJsonPointer } from './json-pointer';

describe('json-pointer (RFC 6901)', () => {
  it('builds pointers with ~0 and ~1 escapes', () => {
    expect(toJsonPointer([])).toBe('');
    expect(toJsonPointer(['nodes', 3, 'props', 'title'])).toBe('/nodes/3/props/title');
    expect(toJsonPointer(['blocks', 'segments', 0, 'binding'])).toBe('/blocks/segments/0/binding');
    expect(toJsonPointer(['nodes', 'a/b~c'])).toBe('/nodes/a~1b~0c');
  });

  it('parses the root, paths and escapes, rejecting invalid pointers', () => {
    expect(parseJsonPointer('')).toEqual([]);
    expect(parseJsonPointer('/nodes/a~1b~0c/layout')).toEqual(['nodes', 'a/b~c', 'layout']);
    expect(parseJsonPointer('$.nodes[3]')).toBeNull();
    expect(parseJsonPointer('/bad~2escape')).toBeNull();
    expect(parseJsonPointer('/' + 'x'.repeat(500))).toBeNull();
  });

  it('takes the unescaped node id from /nodes/<id>/...', () => {
    expect(nodeIdFromJsonPointer('/nodes/n-1/layout')).toBe('n-1');
    expect(nodeIdFromJsonPointer('/nodes/a~1b~0c')).toBe('a/b~c');
    expect(nodeIdFromJsonPointer('/email/subject')).toBeNull();
    expect(nodeIdFromJsonPointer('')).toBeNull();
    expect(nodeIdFromJsonPointer('/nodes')).toBeNull();
  });
});
