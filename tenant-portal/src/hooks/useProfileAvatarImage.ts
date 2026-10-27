"use client";

import { useEffect, useState } from "react";

const AVATAR_CHANGED = "tenant-profile-avatar-changed";

interface AvatarChange {
  userId: string;
  revision: string | null;
}

export function notifyProfileAvatarChanged(userId: string, removed: boolean) {
  window.dispatchEvent(new CustomEvent<AvatarChange>(AVATAR_CHANGED, {
    detail: { userId, revision: removed ? null : String(Date.now()) },
  }));
}

/** Cookie-authenticated images use the same origin as other Party images. */
export function useProfileAvatarImage(userId: string | undefined) {
  const [change, setChange] = useState<AvatarChange | null>(null);
  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<AvatarChange>).detail;
      if (detail.userId === userId) setChange(detail);
    };
    window.addEventListener(AVATAR_CHANGED, receive);
    return () => window.removeEventListener(AVATAR_CHANGED, receive);
  }, [userId]);

  const revision = change?.userId === userId ? change?.revision : "current";
  return userId && revision !== null
    ? `/api/tenant/core/v1/profile/avatar?v=${encodeURIComponent(`${userId}:${revision ?? "current"}`)}`
    : undefined;
}
