"use client";

import { useSearchParams } from "next/navigation";
import { Clock } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { isSessionEndingAuthCode } from "@/lib/auth/sessionErrors";
import { FenceScreen } from "../components/FenceScreen";

/**
 * The four terminal session reasons, mapped from the seven codes
 * `SESSION_ENDING_AUTH_CODES` carries in `src/lib/auth/sessionErrors.ts`.
 *
 * `SESSION_IDENTITY_INACTIVE` is deliberately absent: an inactive identity is
 * an account state, not an expired session, and it has its own screen at
 * `/account-suspended` (task 4.25).
 */
const REASON_KEY: Record<string, "idle" | "absolute" | "ended" | "security"> = {
  AUTH_SESSION_IDLE_EXPIRED: "idle",
  AUTH_SESSION_ABSOLUTE_EXPIRED: "absolute",
  AUTH_SESSION_ENDED: "ended",
  INVALID_REFRESH_TOKEN: "ended",
  AUTH_SECURITY_STALE: "security",
  AUTH_SESSION_STALE: "security",
};

export default function SessionExpiredPage() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const copy = t.coreIdentity.sessionExpired;

  // Validated against the transport's own code set before it is used as a key,
  // so a hand-edited query string cannot select an arbitrary message.
  const raw = searchParams.get("reason");
  const reasonKey = raw && isSessionEndingAuthCode(raw) ? REASON_KEY[raw] : undefined;

  return (
    <FenceScreen
      icon={Clock}
      tone="caution"
      title={copy.title}
      description={reasonKey ? copy.reasons[reasonKey] : copy.description}
      detail={
        reasonKey ? null : (
          <p className="text-xs text-muted-foreground">{copy.unknownReasonHint}</p>
        )
      }
      primaryAction={{ label: copy.signInAgain, href: "/login" }}
    />
  );
}
