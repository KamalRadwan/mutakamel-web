"use client";

import { useState } from "react";
import { Loader2, Plus, Radio, Save, Trash2 } from "lucide-react";
import { Button } from "@/design-system";
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
} from "../webphone-contract";
import {
  InlineError,
  SecretField,
  SectionCard,
  SelectField,
  StateBadge,
  SwitchField,
  TextField,
} from "./WebphoneFields";

const KIND_OPTIONS: Array<{ value: WebphoneIceServerKind; label: string }> = [
  { value: "STUN", label: "STUN" },
  { value: "TURN", label: "TURN" },
];

export function IceServersSection({
  state,
  describedBy,
}: {
  state: TenantWebphoneSettingsState;
  describedBy?: string;
}) {
  const copy = WEBPHONE_COPY[state.lang];
  const [draft, setDraft] = useState<IceServerDraft>(EMPTY_ICE_SERVER_DRAFT);
  const [showDraftErrors, setShowDraftErrors] = useState(false);
  const [revealCredential, setRevealCredential] = useState(false);
  const pending = state.mutation.phase === "PENDING";
  const disabled = !state.canUpdateConfig || pending;
  const draftErrors = validateIceServerDraft(draft);

  const submitDraft = async () => {
    setShowDraftErrors(true);
    if (Object.keys(draftErrors).length > 0) return;
    if (await state.createIceServer(iceServerDraftToDto(draft))) {
      setDraft(EMPTY_ICE_SERVER_DRAFT);
      setShowDraftErrors(false);
      setRevealCredential(false);
    }
  };

  return (
    <SectionCard
      title={copy.iceSection}
      help={copy.iceSectionHelp}
      describedBy={describedBy}
      icon={<Radio className="size-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />}
    >
      {state.iceServers.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {copy.iceEmpty}
        </p>
      ) : (
        <ul className="space-y-3">
          {state.iceServers.map((server) => (
            <li key={server.id}>
              <IceServerRow server={server} state={state} />
            </li>
          ))}
        </ul>
      )}

      <form
        aria-label={copy.addIceServer}
        onSubmit={(event) => {
          event.preventDefault();
          void submitDraft();
        }}
        className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
      >
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
          {copy.addIceServer}
        </h3>
        <div className="grid gap-4 lg:grid-cols-3">
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
          <TextField
            label={copy.sortOrder}
            value={draft.sortOrder}
            maxLength={4}
            inputMode="numeric"
            disabled={disabled}
            lang={state.lang}
            error={showDraftErrors ? draftErrors.sortOrder : undefined}
            onChange={(value) =>
              setDraft((current) => ({ ...current, sortOrder: value }))
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

        {state.mutation.target === "ice:new" &&
        state.mutation.phase === "FAILED" ? (
          <InlineError
            code={state.mutation.errorCode}
            details={state.mutation.details}
            lang={state.lang}
            render={webphoneErrorText}
          />
        ) : null}

        <div>
          <Button type="submit" variant="primary" size="sm" disabled={disabled}>
            {pending && state.mutation.target === "ice:new" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="size-4" aria-hidden="true" />
            )}
            {pending && state.mutation.target === "ice:new"
              ? copy.adding
              : copy.addIceServer}
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

function IceServerRow({
  server,
  state,
}: {
  server: WebphoneIceServer;
  state: TenantWebphoneSettingsState;
}) {
  const copy = WEBPHONE_COPY[state.lang];
  const [draft, setDraft] = useState<IceServerDraft>({
    kind: server.kind,
    urls: server.urls.join(", "),
    username: server.username ?? "",
    // Always empty: the stored credential is never returned, so there is
    // nothing to prefill and a blank submission keeps whatever is stored.
    credential: "",
    enabled: server.enabled,
    sortOrder: String(server.sortOrder),
  });
  const [showErrors, setShowErrors] = useState(false);
  const [revealCredential, setRevealCredential] = useState(false);
  const errors = validateIceServerDraft(draft);
  const pending = state.mutation.phase === "PENDING";
  const disabled = !state.canUpdateConfig || pending;
  const target = `ice:${server.id}` as const;
  const rowPending = pending && state.mutation.target === target;
  const dirty =
    draft.kind !== server.kind ||
    draft.urls.trim() !== server.urls.join(", ") ||
    draft.username.trim() !== (server.username ?? "") ||
    draft.credential !== "" ||
    Number(draft.sortOrder) !== server.sortOrder;

  const save = async () => {
    setShowErrors(true);
    if (Object.keys(errors).length > 0) return;
    const username = draft.username.trim();
    const succeeded = await state.updateIceServer(server.id, {
      kind: draft.kind,
      urls: parseIceUrls(draft.urls),
      sortOrder: Number(draft.sortOrder),
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
      aria-label={`${copy.iceRegion}: ${server.urls.join(", ")}`}
      className="grid gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800"
    >
      <div className="grid gap-4 lg:grid-cols-3">
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
        <TextField
          label={copy.sortOrder}
          value={draft.sortOrder}
          maxLength={4}
          inputMode="numeric"
          disabled={disabled}
          lang={state.lang}
          error={showErrors ? errors.sortOrder : undefined}
          onChange={(value) =>
            setDraft((current) => ({ ...current, sortOrder: value }))
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
          active={server.enabled}
          activeLabel={copy.enabled}
          inactiveLabel={copy.disabled}
        />
        {server.kind === "TURN" ? (
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {copy.iceCredentialState}:{" "}
            {server.credentialConfigured ? copy.configured : copy.notConfigured}
          </span>
        ) : null}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void save()}
          disabled={disabled || !dirty}
        >
          {rowPending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-3.5" aria-hidden="true" />
          )}
          {copy.save}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled}
          aria-label={server.enabled ? copy.toggleIceOff : copy.toggleIceOn}
          onClick={() =>
            void state.updateIceServer(server.id, { enabled: !server.enabled })
          }
        >
          {server.enabled ? copy.disable : copy.enable}
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={disabled}
          aria-label={`${copy.removeIceServer}: ${server.urls.join(", ")}`}
          onClick={() => void state.deleteIceServer(server.id)}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          {copy.remove}
        </Button>
      </div>
    </article>
  );
}
