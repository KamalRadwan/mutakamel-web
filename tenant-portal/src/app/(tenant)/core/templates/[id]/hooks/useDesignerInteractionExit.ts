import { useState } from "react";
import { createDesignerInteractionExit, type DesignerInteractionTicket } from "../../designer-interaction-exit";

export function useDesignerInteractionExit(ticket: DesignerInteractionTicket, current: () => DesignerInteractionTicket | null) {
  const [stored, setStored] = useState(() => createDesignerInteractionExit(ticket, current));
  if (stored.ticket.bridgeKey !== ticket.bridgeKey || stored.ticket.generation !== ticket.generation) {
    const next = createDesignerInteractionExit(ticket, current); setStored(next); return next;
  }
  return stored;
}
