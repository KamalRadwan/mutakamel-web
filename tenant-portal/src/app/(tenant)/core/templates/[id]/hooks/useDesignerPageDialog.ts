import { useEffect, useState } from "react";
import type { DesignerLocalSessions } from "../../designer-local-sessions";

/** Conservative session fence until T13 publishes field-level local-state events. */
export function useDesignerPageDialog(sessions: DesignerLocalSessions) {
  const [reporter] = useState(() => sessions.reporter("pages"));
  const [open, setOpen] = useState(false), [confirmClose, setConfirmClose] = useState(false);
  useEffect(() => () => reporter.dispose(), [reporter]);
  const close = () => { reporter.report(sessions.ownerKey, false); setConfirmClose(false); setOpen(false); };
  return { open, confirmClose, close, keepEditing: () => setConfirmClose(false),
    change(next: boolean) {
      if (!next && open) { setConfirmClose(true); return; }
      reporter.report(sessions.ownerKey, next); setOpen(next); setConfirmClose(false);
    },
  };
}
