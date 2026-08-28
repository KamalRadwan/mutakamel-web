"use client";

import { KeyRound } from "lucide-react";
import { WEBPHONE_COPY } from "../webphone-copy";
import type { WebphoneSettingsState } from "../hooks/useWebphoneSettings";
import { SectionCard, SwitchField, TextField } from "./WebphoneFields";

/**
 * TURN REST minting: the toggle and TTL live on the server configuration, while
 * the URIs a minted credential is valid for are the enabled TURN entries. The
 * URIs are therefore shown here read-only and edited in the ICE servers
 * section, so one TURN server is never described in two editable places.
 */
export function TurnRestSection({ state }: { state: WebphoneSettingsState }) {
  const copy = WEBPHONE_COPY[state.lang];
  const { form, fieldErrors } = state;
  const disabled = !state.canUpdate || state.mutation.phase === "PENDING";
  const turnUris = state.iceServers
    .filter((server) => server.kind === "TURN" && server.enabled)
    .flatMap((server) => server.urls);
  if (!form) return null;

  return (
    <SectionCard
      title={copy.turnRestSection}
      help={copy.turnRestSectionHelp}
      icon={<KeyRound className="size-4 text-amber-500" aria-hidden="true" />}
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
        <h3 className="text-xs font-bold">{copy.turnRestUris}</h3>
        {turnUris.length ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {turnUris.map((uri) => (
              <li
                key={uri}
                dir="ltr"
                className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {uri}
              </li>
            ))}
          </ul>
        ) : (
          <p
            role={form.turnRestEnabled ? "alert" : undefined}
            className={`mt-2 text-xs font-bold ${
              form.turnRestEnabled
                ? "text-amber-700 dark:text-amber-300"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {form.turnRestEnabled ? copy.turnRestNoUris : copy.iceEmpty}
          </p>
        )}
      </div>
    </SectionCard>
  );
}
