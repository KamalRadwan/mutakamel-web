import { createRichTextHostInterlock, type RichTextLease } from "./[id]/rich-text/rich-text-host-interlock";
import type { RichSession } from "./[id]/rich-text/rich-text-contract";

/** Local form leases contain no authored document and never create history. */
export function createDesignerLocalSessions(ownerKey: string) {
  let sequence = 0, pending = false;
  const leases = new Map<string, { token: number; dirty: boolean }>();
  const latest = new Map<string, number>();
  const listeners = new Set<() => void>();
  const richText = createRichTextHostInterlock();
  let richLease: RichTextLease | null = null;
  const publish = () => {
    const next = richText.getSnapshot().active || [...leases.values()].some(lease => lease.dirty);
    if (pending === next) return;
    pending = next; listeners.forEach(listener => listener());
  };
  richText.subscribe(publish);
  return {
    ownerKey, richText,
    openRichText(session: RichSession) {
      if (session.owner !== ownerKey) return null;
      const lease = richText.acquire(session);
      if (lease) richLease = lease;
      return lease;
    },
    closeRichText() { richLease?.release(); richLease = null; },
    dispose() { richLease?.release(); richLease = null; leases.clear(); publish(); },
    getSnapshot: () => pending,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    has(kind?: string) { return kind === "richText" ? richText.getSnapshot().active : kind ? leases.get(kind)?.dirty === true : pending; },
    hasOther(kind: string) { return (kind !== "richText" && richText.getSnapshot().active) || [...leases.entries()].some(([key, lease]) => key !== kind && lease.dirty); },
    reporter(kind: string) {
      const token = ++sequence;
      latest.set(kind, token);
      leases.set(kind, { token, dirty: false }); publish();
      return {
        report(owner: string, dirty: boolean) {
          if (owner !== ownerKey || latest.get(kind) !== token) return;
          leases.set(kind, { token, dirty }); publish();
        },
        dispose() { if (leases.get(kind)?.token === token) { leases.delete(kind); publish(); } },
      };
    },
  };
}
export type DesignerLocalSessions = ReturnType<typeof createDesignerLocalSessions>;
