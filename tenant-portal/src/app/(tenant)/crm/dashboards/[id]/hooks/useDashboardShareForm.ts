"use client";
import { useState } from "react";
import type { ShareAccessLevel, ShareTarget } from "../../share-contract";
export function useDashboardShareForm(targets: ShareTarget[], onShare: (input: { subjectType: ShareTarget["type"]; subjectId: string; accessLevel: ShareAccessLevel; expiresAt: string }) => Promise<boolean>, blocked: boolean) {
  const [selected, setSelected] = useState<ShareTarget>(); const [accessLevel, setAccessLevel] = useState<ShareAccessLevel>("VIEW");
  const [expiresAt, setExpiresAt] = useState<Date>(); const [invalidExpiry, setInvalidExpiry] = useState(false);
  return { selected, accessLevel, expiresAt, invalidExpiry, dirty: !!selected || !!expiresAt || accessLevel !== "VIEW",
    select: (id: string | undefined) => setSelected(targets.find((target) => target.id === id)),
    setAccessLevel, changeExpiry: (value: Date | undefined) => { setInvalidExpiry(false); setExpiresAt(value); },
    submit: () => { if (!selected || blocked) return; if (expiresAt && expiresAt.getTime() <= Date.now()) { setInvalidExpiry(true); return; }
      void onShare({ subjectType: selected.type, subjectId: selected.id, accessLevel, expiresAt: expiresAt?.toISOString() ?? "" }).then((ok) => { if (ok) { setSelected(undefined); setExpiresAt(undefined); } }); } };
}
