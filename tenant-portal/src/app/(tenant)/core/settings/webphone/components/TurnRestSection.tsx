"use client";

import { KeyRound } from "lucide-react";
import { WEBPHONE_COPY } from "../webphone-copy";
import type { TenantWebphoneSettingsState } from "../hooks/useTenantWebphoneSettings";
import { SectionCard, SwitchField, TextField } from "./WebphoneFields";

/**
 * TURN REST minting: the toggle and TTL live on the server configuration, while
 * the URIs a minted credential is valid for are the enabled TURN entries. The
 * URIs are shown here read-only and edited in the ICE servers section, so one
 * TURN server is never described in two editable places.
 */
export function TurnRestSection({
  state,
  describedBy,
}: {
  state: TenantWebphoneSettingsState;
  describedBy?: string;
}) {
  const copy = WEBPHONE_COPY[state.lang];
  const { form, fieldErrors } = state;
  const disabled = !state.canUpdateConfig || state.mutation.phase === "PENDING";
  const turnUris = state.iceServers
    .filter((server) => server.kind === "TURN" && server.enabled)
    .flatMap((server) => server.urls);
  if (!form) return null;

  return (
    <SectionCard
      title={copy.turnRestSection}
      help={copy.turnRestSectionHelp}
      describedBy={describedBy}
      icon={<KeyRound className="size-4 text-muted-foreground" aria-hidden="true" />}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <SwitchField
          label={copy.turnRestEnabled}
          checked={form.turnRestEnabled}
          disabled={disabled}
          onChange={(checked) => state.updateField("turnRestEnabled", checked)}
        />
        <TextField
          label={copy.turnRestTtl}
          value={form.turnRestTtlSeconds}
          maxLength={6}
          inputMode="numeric"
          disabled={disabled}
          lang={state.lang}
          error={fieldErrors.turnRestTtlSeconds}
          onChange={(value) => state.updateField("turnRestTtlSeconds", value)}
        />
      </div>

      <div>
        <h3 className="text-xs font-medium text-foreground">{copy.turnRestUris}</h3>
        {turnUris.length ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {turnUris.map((uri) => (
              <li
                key={uri}
                dir="ltr"
                className="rounded-sm bg-muted px-2 py-1 font-mono text-xs text-foreground"
              >
                {uri}
              </li>
            ))}
          </ul>
        ) : (
          <p
            role={form.turnRestEnabled ? "alert" : undefined}
            className={`mt-2 max-w-prose text-xs ${
              form.turnRestEnabled ? "font-medium text-foreground" : "text-muted-foreground"
            }`}
          >
            {form.turnRestEnabled ? copy.turnRestNoUris : copy.iceEmpty}
          </p>
        )}
      </div>
    </SectionCard>
  );
}
