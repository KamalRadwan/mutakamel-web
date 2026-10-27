"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { useToast } from "../../feedback/useToast";

export function useUserMenuLogout(logout: () => Promise<void>) {
  const { t } = useI18n();
  const toast = useToast();
  const pending = useRef(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  async function handleLogout() {
    // State alone cannot fence two activations before React renders again.
    if (pending.current) return;
    pending.current = true;
    setIsLoggingOut(true);
    try {
      await logout();
    } catch {
      toast.warning(t.common.signOutFailed, t.common.signOutFailedDescription, 0, {
        label: t.common.retrySignOut,
        onClick: () => void handleLogout(),
      });
    } finally {
      pending.current = false;
      setIsLoggingOut(false);
      // Release the modal menu so the toast's retry action is reachable.
      setIsMenuOpen(false);
    }
  }

  function handleLogoutSelect(event: Event) {
    event.preventDefault();
    void handleLogout();
  }

  return { isLoggingOut, isMenuOpen, setIsMenuOpen, handleLogout, handleLogoutSelect };
}
