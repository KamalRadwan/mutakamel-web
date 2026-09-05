"use client";

import { Phone } from "lucide-react";
import { SettingsResourceBoundary } from "../components/SettingsResourceBoundary";
import { useWebphoneSettings } from "./hooks/useWebphoneSettings";
import { WEBPHONE_COPY } from "./webphone-copy";
import { ServersSection } from "./components/ServersSection";

/**
 * The admin WebPhone screen is the SIP server chain and nothing else.
 *
 * A user's extension is a tenant concern edited from that user's page, so it is
 * deliberately absent here — one place per thing, and the place is the one that
 * already knows which user is being changed.
 */
export default function WebphoneSettingsPage() {
  const state = useWebphoneSettings();
  const copy = WEBPHONE_COPY[state.lang];

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-border bg-card p-5 shadow-2xs">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Phone
            className="size-5 text-info"
            aria-hidden="true"
          />
          {copy.title}
        </h1>
      </header>

      <SettingsResourceBoundary
        state={state.loadState}
        error={state.loadError}
        lang={state.lang}
        onRetry={() => void state.refetch()}
      >
        {!state.canUpdate ? (
          <p
            role="note"
            className="rounded-xl border border-border bg-muted p-3 text-sm text-foreground"
          >
            {copy.readOnly}
          </p>
        ) : null}

        <ServersSection state={state} />
      </SettingsResourceBoundary>
    </div>
  );
}
