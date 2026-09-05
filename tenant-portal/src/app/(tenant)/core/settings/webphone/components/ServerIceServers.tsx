"use client";

import { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Badge, Button } from "@/design-system";
import { WEBPHONE_COPY, webphoneErrorText } from "../webphone-copy";
import type { TenantWebphoneSettingsState } from "../hooks/useTenantWebphoneSettings";
import {
  EMPTY_ICE_SERVER_DRAFT,
  iceServerDraftToDto,
  parseIceUrls,
  validateIceServerDraft,
  type IceServerDraft,
  type WebphoneIceServer,
  type WebphoneIceServerKind,
  type WebphoneServer,
} from "../webphone-contract";
import {
  InlineError,
  SecretField,
  SelectField,
  StateBadge,
  SwitchField,
  TextField,
} from "./WebphoneFields";

const KIND_OPTIONS: Array<{ value: WebphoneIceServerKind; label: string }> = [
  { value: "STUN", label: "STUN" },
  { value: "TURN", label: "TURN" },
];

/**
 * One server's ICE entries.
 *
 * Nested inside the server card rather than listed once for the whole scope: a
 * relay is only reachable from inside the network its SIP server lives in, so a
 * shared set would offer servers in other networks candidates that cannot work.
 */
export function ServerIceServers({
  server,
  state,
}: {
  server: WebphoneServer;
  state: TenantWebphoneSettingsState;
}) {
  const copy = WEBPHONE_COPY[state.lang];
  const [draft, setDraft] = useState<IceServerDraft>(EMPTY_ICE_SERVER_DRAFT);
  const [showDraftErrors, setShowDraftErrors] = useState(false);
  const [revealCredential, setRevealCredential] = useState(false);
  const pending = state.mutation.phase === "PENDING";
  const disabled = !state.canUpdateConfig || pending;
  const draftErrors = validateIceServerDraft(draft);
  const addTarget = `ice:new:${server.id}` as const;
  const addPending = pending && state.mutation.target === addTarget;

  const submitDraft = async () => {
    setShowDraftErrors(true);
    if (Object.keys(draftErrors).length > 0) return;
    // A new entry is appended after the ones already there, so nobody has to
    // invent a sort order to add a second STUN server.
    const sortOrder = server.iceServers.length
      ? server.iceServers[server.iceServers.length - 1].sortOrder + 1
      : 0;
    if (
      await state.createIceServer(server.id, iceServerDraftToDto(draft, sortOrder))
    ) {
      setDraft(EMPTY_ICE_SERVER_DRAFT);
      setShowDraftErrors(false);
      setRevealCredential(false);
    }
  };

  return (
    <section
      aria-label={`${copy.iceSection}: ${server.name}`}
      className="flex flex-col gap-3 rounded-lg border border-border p-4"
    >
      <div>
        <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {copy.iceSection}
        </h4>
        <p className="mt-1 max-w-prose text-xs text-muted-foreground">
          {copy.iceSectionHelp}
        </p>
      </div>

      {server.iceServers.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
          {copy.iceEmpty}
        </p>
      ) : (
        <ul className="space-y-3">
          {server.iceServers.map((iceServer) => (
            <li key={iceServer.id}>
              <IceServerRow
                iceServer={iceServer}
                serverId={server.id}
                state={state}
              />
            </li>
          ))}
        </ul>
      )}

      <form
        aria-label={`${copy.addIceServer}: ${server.name}`}
        onSubmit={(event) => {
          event.preventDefault();
          void submitDraft();
        }}
        className="grid gap-4 rounded-lg border border-dashed border-border p-3"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <SelectField<WebphoneIceServerKind>
            label={copy.iceKind}
            value={draft.kind}
            disabled={disabled}
            lang={state.lang}
            options={KIND_OPTIONS}
            onChange={(value) =>
              setDraft((current) => ({ ...current, kind: value }))
            }
          />
          <TextField
            label={copy.iceUrls}
            value={draft.urls}
            maxLength={2048}
            disabled={disabled}
            lang={state.lang}
            help={copy.iceUrlsHelp}
            placeholder="turn:turn.example.com:3478"
            error={showDraftErrors ? draftErrors.urls : undefined}
            onChange={(value) =>
              setDraft((current) => ({ ...current, urls: value }))
            }
          />
        </div>

        {draft.kind === "TURN" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <TextField
              label={copy.iceUsername}
              value={draft.username}
              maxLength={128}
              disabled={disabled}
              lang={state.lang}
              error={showDraftErrors ? draftErrors.username : undefined}
              onChange={(value) =>
                setDraft((current) => ({ ...current, username: value }))
              }
            />
            <SecretField
              label={copy.iceCredential}
              value={draft.credential}
              disabled={disabled}
              lang={state.lang}
              help={copy.iceCredentialKeepHelp}
              revealed={revealCredential}
              onToggleReveal={() => setRevealCredential((current) => !current)}
              showLabel={copy.showCredential}
              hideLabel={copy.hideCredential}
              error={showDraftErrors ? draftErrors.credential : undefined}
              onChange={(value) =>
                setDraft((current) => ({ ...current, credential: value }))
              }
            />
          </div>
        ) : null}

        <SwitchField
          label={copy.iceEnabledLabel}
          checked={draft.enabled}
          disabled={disabled}
          onChange={(checked) =>
            setDraft((current) => ({ ...current, enabled: checked }))
          }
        />

        {state.mutation.target === addTarget &&
        state.mutation.phase === "FAILED" ? (
          <InlineError
            code={state.mutation.errorCode}
            details={state.mutation.details}
            lang={state.lang}
            render={webphoneErrorText}
          />
        ) : null}

        <div>
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={disabled}
            loading={addPending}
          >
            {addPending ? null : <Plus className="size-4" aria-hidden="true" />}
            {addPending ? copy.adding : copy.addIceServer}
          </Button>
        </div>
      </form>
    </section>
  );
}

function IceServerRow({
  iceServer,
  serverId,
  state,
}: {
  iceServer: WebphoneIceServer;
  serverId: string;
  state: TenantWebphoneSettingsState;
}) {
  const copy = WEBPHONE_COPY[state.lang];
  const [draft, setDraft] = useState<IceServerDraft>({
    kind: iceServer.kind,
    urls: iceServer.urls.join(", "),
    username: iceServer.username ?? "",
    // Always empty: the stored credential is never returned, so there is
    // nothing to prefill and a blank submission keeps whatever is stored.
    credential: "",
    enabled: iceServer.enabled,
  });
  const [showErrors, setShowErrors] = useState(false);
  const [revealCredential, setRevealCredential] = useState(false);
  const errors = validateIceServerDraft(draft);
  const pending = state.mutation.phase === "PENDING";
  const disabled = !state.canUpdateConfig || pending;
  const target = `ice:${iceServer.id}` as const;
  const rowPending = pending && state.mutation.target === target;
  const dirty =
    draft.kind !== iceServer.kind ||
    draft.urls.trim() !== iceServer.urls.join(", ") ||
    draft.username.trim() !== (iceServer.username ?? "") ||
    draft.credential !== "";

  const save = async () => {
    setShowErrors(true);
    if (Object.keys(errors).length > 0) return;
    const username = draft.username.trim();
    const succeeded = await state.updateIceServer(serverId, iceServer.id, {
      kind: draft.kind,
      urls: parseIceUrls(draft.urls),
      username: username === "" ? null : username,
      ...(draft.credential ? { credential: draft.credential } : {}),
    });
    if (succeeded) {
      setDraft((current) => ({ ...current, credential: "" }));
      setRevealCredential(false);
    }
  };

  return (
    <article
      aria-label={`${copy.iceRegion}: ${iceServer.urls.join(", ")}`}
      className="grid gap-4 rounded-lg border border-border p-3"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <SelectField<WebphoneIceServerKind>
          label={copy.iceKind}
          value={draft.kind}
          disabled={disabled}
          lang={state.lang}
          options={KIND_OPTIONS}
          onChange={(value) => setDraft((current) => ({ ...current, kind: value }))}
        />
        <TextField
          label={copy.iceUrls}
          value={draft.urls}
          maxLength={2048}
          disabled={disabled}
          lang={state.lang}
          error={showErrors ? errors.urls : undefined}
          onChange={(value) => setDraft((current) => ({ ...current, urls: value }))}
        />
      </div>

      {draft.kind === "TURN" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <TextField
            label={copy.iceUsername}
            value={draft.username}
            maxLength={128}
            disabled={disabled}
            lang={state.lang}
            error={showErrors ? errors.username : undefined}
            onChange={(value) =>
              setDraft((current) => ({ ...current, username: value }))
            }
          />
          <SecretField
            label={copy.iceCredential}
            value={draft.credential}
            disabled={disabled}
            lang={state.lang}
            help={copy.iceCredentialKeepHelp}
            revealed={revealCredential}
            onToggleReveal={() => setRevealCredential((current) => !current)}
            showLabel={copy.showCredential}
            hideLabel={copy.hideCredential}
            error={showErrors ? errors.credential : undefined}
            onChange={(value) =>
              setDraft((current) => ({ ...current, credential: value }))
            }
          />
        </div>
      ) : null}

      {state.mutation.target === target && state.mutation.phase === "FAILED" ? (
        <InlineError
          code={state.mutation.errorCode}
          details={state.mutation.details}
          lang={state.lang}
          render={webphoneErrorText}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <StateBadge
          active={iceServer.enabled}
          activeLabel={copy.enabled}
          inactiveLabel={copy.disabled}
        />
        {iceServer.kind === "TURN" ? (
          <Badge tone={iceServer.credentialConfigured ? "positive" : "neutral"}>
            {copy.iceCredentialState}:{" "}
            {iceServer.credentialConfigured ? copy.configured : copy.notConfigured}
          </Badge>
        ) : null}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void save()}
          disabled={disabled || !dirty}
          loading={rowPending}
        >
          {rowPending ? null : <Save className="size-3.5" aria-hidden="true" />}
          {copy.save}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled}
          aria-label={iceServer.enabled ? copy.toggleIceOff : copy.toggleIceOn}
          onClick={() =>
            void state.updateIceServer(serverId, iceServer.id, {
              enabled: !iceServer.enabled,
            })
          }
        >
          {iceServer.enabled ? copy.disable : copy.enable}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={disabled}
          aria-label={`${copy.removeIceServer}: ${iceServer.urls.join(", ")}`}
          onClick={() => void state.deleteIceServer(serverId, iceServer.id)}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          {copy.remove}
        </Button>
      </div>
    </article>
  );
}
