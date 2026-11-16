import type { RichSession } from "./rich-text-contract";

export interface RichTextInterlockSnapshot { readonly active: boolean; readonly nodeId: string | null; readonly dirty: boolean; readonly composing: boolean }
export interface RichTextLease {
  matches(session: RichSession): boolean;
  update(session: RichSession, value: { dirty: boolean; composing: boolean }): boolean;
  release(): boolean;
}
/** Editor-local coordination only: no authored document, persistence, selection or history. */
export function createRichTextHostInterlock() {
  let current: { token: number; owner: string; generation: number; nodeId: string } | null = null, sequence = 0;
  let snapshot: RichTextInterlockSnapshot = Object.freeze({ active: false, nodeId: null, dirty: false, composing: false });
  const listeners = new Set<() => void>();
  const publish = (value: RichTextInterlockSnapshot) => { snapshot = Object.freeze(value); listeners.forEach(listener => listener()); };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    acquire(session: RichSession): RichTextLease | null {
      if (current) return null;
      const token = ++sequence;
      current = { token, owner: session.owner, generation: session.generation, nodeId: session.nodeId };
      const matches = (candidate: RichSession) => current?.token === token && current.owner === candidate.owner && current.generation === candidate.generation && current.nodeId === candidate.nodeId;
      publish({ active: true, nodeId: session.nodeId, dirty: false, composing: false });
      return {
        matches,
        update(candidate, value) {
          if (!matches(candidate)) return false;
          if (snapshot.dirty !== value.dirty || snapshot.composing !== value.composing) publish({ ...snapshot, ...value });
          return true;
        },
        release() {
          if (current?.token !== token) return false;
          current = null; publish({ active: false, nodeId: null, dirty: false, composing: false }); return true;
        },
      };
    },
    /** Gate T13 navigation as well as mutations; canEdit alone does not gate its navigate(). */
    runExternal<T>(operation: () => T): { executed: false } | { executed: true; value: T } {
      return current ? { executed: false } : { executed: true, value: operation() };
    },
  };
}
