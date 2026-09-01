"use client";

import { Clock, Lock, PauseCircle } from "lucide-react";
import { Card } from "@/design-system";
import { WEBPHONE_COPY } from "../webphone-copy";
import type { WebphoneEntitlement } from "../hooks/useTenantWebphoneSettings";

/**
 * Says, in words, why the screen is inert.
 *
 * The screen is shown rather than hidden so the capability stays discoverable,
 * which only works if the reason is stated. Colour carries none of that meaning:
 * the reason is a heading and a sentence inside a `role="status"` region, and
 * every section points at this element through `aria-describedby`. The icon is
 * decorative and takes the same muted tone in all three cases — tinting it per
 * reason would put meaning in a hue that no screen reader reads and that a
 * colour-blind user cannot separate.
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
    },
    PROVISIONING_PENDING: {
      title: copy.provisioningPendingTitle,
      body: copy.provisioningPendingBody,
      Icon: Clock,
    },
    SUSPENDED: {
      title: copy.suspendedTitle,
      body: copy.suspendedBody,
      Icon: PauseCircle,
    },
  }[entitlement];
  const { Icon } = reason;

  return (
    <Card id={id} role="status" aria-label={copy.unavailableHeading} className="p-4">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-medium text-card-foreground">{reason.title}</h2>
          <p className="mt-1 max-w-prose text-xs text-muted-foreground">{reason.body}</p>
          <p className="mt-2 max-w-prose text-xs font-medium text-foreground">
            {copy.disabledControlsNote}
          </p>
        </div>
      </div>
    </Card>
  );
}
