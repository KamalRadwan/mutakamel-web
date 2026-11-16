export interface DesignerInteractionTicket { readonly bridgeKey: string; readonly generation: number }
export interface DesignerInteractionParticipant {
  read(): "active" | "inactive" | "unavailable";
  cancel(): void;
}
type Kind = "canonical" | "model" | "pan" | "pointer";
const same = (a: DesignerInteractionTicket | null, b: DesignerInteractionTicket) => !!a && a.bridgeKey === b.bridgeKey && a.generation === b.generation;

/** Owns cancellation registrations only, never authored state or history. */
export function createDesignerInteractionExit(ticket: DesignerInteractionTicket, current: () => DesignerInteractionTicket | null) {
  let sequence = 0;
  const owners = new Map<Kind, { token: number; port: DesignerInteractionParticipant }>();
  let pointerMount: { token: number; present: boolean } | null = null;
  let modelMount: { token: number; present: boolean } | null = null;
  const required = (): Kind[] | null => pointerMount && modelMount ? ["canonical", ...(modelMount.present ? ["model" as const] : []), "pan", ...(pointerMount.present ? ["pointer" as const] : [])] : null;
  const readable = () => same(current(), ticket);
  return {
    ticket,
    register(kind: Kind, port: DesignerInteractionParticipant) {
      const token = ++sequence;
      owners.set(kind, { token, port });
      if (kind === "model") modelMount = { token, present: true };
      return () => {
        if (owners.get(kind)?.token !== token) return;
        if ((kind === "model" || kind === "pointer") && readable()) port.cancel();
        const inactive = port.read() === "inactive";
        owners.delete(kind);
        if (kind === "model" && modelMount?.token === token) modelMount = inactive ? { token, present: false } : null;
      };
    },
    /** The unqualified renderer has no model controller; its real owner declares absence. */
    declareModelMount(present: false) {
      const token = ++sequence; modelMount = { token, present };
      return () => { /* This actual render owner has no controller to retain. */ };
    },
    /** Called by the actual render owner, not a guessed inactive fallback. */
    declarePointerMount(present: boolean) {
      const token = ++sequence; pointerMount = { token, present };
      return () => {
        if (pointerMount?.token !== token) return;
        const pointer = owners.get("pointer")?.port;
        if (readable()) pointer?.cancel();
        pointerMount = !present || (pointer && pointer.read() === "inactive") ? { token, present: false } : null;
      };
    },
    hasActive() {
      if (!readable()) return false;
      return [...owners.values()].some(owner => owner.port.read() === "active");
    },
    cancelAllCurrent(expected: DesignerInteractionTicket): boolean {
      if (!same(expected, ticket) || !readable()) return false;
      const kinds = required();
      if (!kinds || kinds.some(kind => !owners.has(kind) || owners.get(kind)!.port.read() === "unavailable")) return false;
      // Pointer/library first, then the shared model/canonical gesture, then pan.
      for (const kind of ["pointer", "model", "canonical", "pan"] as const) {
        if (!kinds.includes(kind)) continue;
        if (!readable()) return false;
        owners.get(kind)!.port.cancel();
      }
      return readable() && kinds.every(kind => owners.get(kind)?.port.read() === "inactive");
    },
  };
}
export type DesignerInteractionExit = ReturnType<typeof createDesignerInteractionExit>;
