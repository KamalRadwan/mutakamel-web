import { useEffect, useState, useSyncExternalStore } from "react";
import { createDesignerLocalSessions } from "../../designer-local-sessions";

export function useDesignerLocalSessions(ownerKey: string, generation: number) {
  const [stored, setStored] = useState(() => ({ sessions: createDesignerLocalSessions(ownerKey), generation, epoch: 0 }));
  let current = stored;
  if (stored.sessions.ownerKey !== ownerKey || stored.generation !== generation) {
    current = { sessions: createDesignerLocalSessions(ownerKey), generation, epoch: stored.epoch + 1 };
    setStored(current);
  }
  const sessions = current.sessions;
  const pending = useSyncExternalStore(sessions.subscribe, sessions.getSnapshot, sessions.getSnapshot);
  useEffect(() => () => sessions.dispose(), [sessions]);
  return { sessions, pending, epoch: current.epoch,
    discard() { sessions.dispose(); setStored({ sessions: createDesignerLocalSessions(ownerKey), generation, epoch: current.epoch + 1 }); },
  };
}
