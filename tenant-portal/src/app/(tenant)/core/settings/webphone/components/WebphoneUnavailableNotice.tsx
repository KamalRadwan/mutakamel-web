"use client";

import { Clock, Lock, PauseCircle } from "lucide-react";
import { WEBPHONE_COPY } from "../webphone-copy";
import type { WebphoneEntitlement } from "../hooks/useTenantWebphoneSettings";

/**
 * Says, in words, why the screen is inert.
 *
 * The screen is shown rather than hidden so the capability stays discoverable,
 * which only works if the reason is stated. Colour carries none of that meaning:
 * the reason is a heading and a sentence inside a `role="status"` region, and
 * every section points at this element through `aria-describedby`.
 */
export function WebphoneUnavailableNotice({
  entitlement,
  lang,
  id,
}: {
  entitlement: Exclude<WebphoneEntitlement, "ACTIVE">;
  lang: "ar" | "en";
  id: string;
}) {
  const copy = WEBPHONE_COPY[lang];
  const reason = {
    NOT_PURCHASED: {
      title: copy.notPurchasedTitle,
      body: copy.notPurchasedBody,
      Icon: Lock,
      tone: "text-slate-500 dark:text-slate-400",
    },
    PROVISIONING_PENDING: {
      title: copy.provisioningPendingTitle,
      body: copy.provisioningPendingBody,
      Icon: Clock,
      tone: "text-blue-600 dark:text-blue-400",
    },
    SUSPENDED: {
      title: copy.suspendedTitle,
      body: copy.suspendedBody,
      Icon: PauseCircle,
      tone: "text-amber-600 dark:text-amber-400",
    },
  }[entitlement];
  const { Icon } = reason;

  return (
    <section
      id={id}
      role="status"
      aria-label={copy.unavailableHeading}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 size-5 shrink-0 ${reason.tone}`} aria-hidden="true" />
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {reason.title}
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-6 text-slate-600 dark:text-slate-400">
            {reason.body}
          </p>
          <p className="mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {copy.disabledControlsNote}
          </p>
        </div>
      </div>
    </section>
  );
}
