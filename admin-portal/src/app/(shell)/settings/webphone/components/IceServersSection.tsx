"use client";

import { useState } from "react";
import { Loader2, Plus, Radio, Save, Trash2 } from "lucide-react";
import { WEBPHONE_COPY, webphoneErrorText } from "../webphone-copy";
import type { WebphoneSettingsState } from "../hooks/useWebphoneSettings";
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
  SwitchField,
  TextField,
} from "./WebphoneFields";

export function IceServersSection({ state }: { state: WebphoneSettingsState }) {
  const copy = WEBPHONE_COPY[state.lang];
  const [draft, setDraft] = useState<IceServerDraft>(EMPTY_ICE_SERVER_DRAFT);
  const [showDraftErrors, setShowDraftErrors] = useState(false);
  const [revealDraftCredential, setRevealDraftCredential] = useState(false);
  const pending = state.mutation.phase === "PENDING";
  const draftErrors = validateIceServerDraft(draft);

  const submitDraft = async () => {
    setShowDraftErrors(true);
    if (Object.keys(draftErrors).length > 0) return;
    if (await state.createIceServer(iceServerDraftToDto(draft))) {
      setDraft(EMPTY_ICE_SERVER_DRAFT);
      setShowDraftErrors(false);
      setRevealDraftCredential(false);
    }
  };

  return (
    <SectionCard
      title={copy.iceSection}
      help={copy.iceSectionHelp}
      icon={<Radio className="size-4 text-blue-500" aria-hidden="true" />}
    >
      {state.iceServers.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
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

      {state.canUpdate ? (
        <form
          method="post"
          aria-label={copy.addIceServer}
          onSubmit={(event) => {
            event.preventDefault();
            void submitDraft();
          }}
          className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950"
        >
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">
            {copy.addIceServer}
          </h3>
          <div className="grid gap-4 lg:grid-cols-3">
            <SelectField<WebphoneIceServerKind>
              label={copy.iceKind}
              value={draft.kind}
              disabled={pending}
              lang={state.lang}
              options={[
                { value: "STUN", label: "STUN" },
                { value: "TURN", label: "TURN" },
              ]}
              onChange={(value) =>
                setDraft((current) => ({ ...current, kind: value }))
              }
            />
            <TextField
              label={copy.iceUrls}
              value={draft.urls}
              maxLength={2048}
              disabled={pending}
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
              disabled={pending}
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
                disabled={pending}
                lang={state.lang}
                error={showDraftErrors ? draftErrors.username : undefined}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, username: value }))
                }
              />
              <SecretField
                label={copy.iceCredential}
                value={draft.credential}
                disabled={pending}
                lang={state.lang}
                help={copy.iceCredentialKeepHelp}
                revealed={revealDraftCredential}
                onToggleReveal={() =>
                  setRevealDraftCredential((current) => !current)
                }
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
            disabled={pending}
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
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-700 px-3.5 text-xs font-bold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending && state.mutation.target === "ice:new" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="size-4" aria-hidden="true" />
              )}
              {pending && state.mutation.target === "ice:new"
                ? copy.adding
                : copy.addIceServer}
            </button>
          </div>
        </form>
      ) : null}
    </SectionCard>
  );
}

function IceServerRow({
  server,
  state,
}: {
  server: WebphoneIceServer;
  state: WebphoneSettingsState;
}) {
  const copy = WEBPHONE_COPY[state.lang];
  const [draft, setDraft] = useState<IceServerDraft>({
    kind: server.kind,
    urls: server.urls.join(", "),
    username: server.username ?? "",
    // Always empty: the stored credential is never returned, so there is
    // nothing to prefill. A blank submission keeps whatever Core holds.
    credential: "",
    enabled: server.enabled,
    sortOrder: String(server.sortOrder),
  });
  const [showErrors, setShowErrors] = useState(false);
  const [revealCredential, setRevealCredential] = useState(false);
  const errors = validateIceServerDraft(draft);
  const pending = state.mutation.phase === "PENDING";
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
      // Blank means "keep the stored credential"; omitting the field entirely
      // is what tells Core not to touch it.
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
      className="grid gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700"
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <SelectField<WebphoneIceServerKind>
          label={copy.iceKind}
          value={draft.kind}
          disabled={!state.canUpdate || pending}
          lang={state.lang}
          options={[
            { value: "STUN", label: "STUN" },
            { value: "TURN", label: "TURN" },
          ]}
          onChange={(value) =>
            setDraft((current) => ({ ...current, kind: value }))
          }
        />
        <TextField
          label={copy.iceUrls}
          value={draft.urls}
          maxLength={2048}
          disabled={!state.canUpdate || pending}
          lang={state.lang}
          error={showErrors ? errors.urls : undefined}
          onChange={(value) =>
            setDraft((current) => ({ ...current, urls: value }))
          }
        />
        <TextField
          label={copy.sortOrder}
          value={draft.sortOrder}
          maxLength={4}
          inputMode="numeric"
          disabled={!state.canUpdate || pending}
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
            disabled={!state.canUpdate || pending}
            lang={state.lang}
            error={showErrors ? errors.username : undefined}
            onChange={(value) =>
              setDraft((current) => ({ ...current, username: value }))
            }
          />
          <SecretField
            label={copy.iceCredential}
            value={draft.credential}
            disabled={!state.canUpdate || pending}
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
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
            server.enabled
              ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
              : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          {server.enabled ? copy.enabled : copy.disabled}
        </span>
        {server.kind === "TURN" ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {copy.iceCredentialState}:{" "}
            {server.credentialConfigured ? copy.configured : copy.notConfigured}
          </span>
        ) : null}
        {state.canUpdate ? (
          <>
            <button
              type="button"
              onClick={() => void save()}
              disabled={pending || !dirty}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-800 dark:text-slate-200"
            >
              {rowPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-3.5" aria-hidden="true" />
              )}
              {copy.save}
            </button>
            <button
              type="button"
              onClick={() =>
                void state.updateIceServer(server.id, {
                  enabled: !server.enabled,
                })
              }
              disabled={pending}
              aria-label={server.enabled ? copy.toggleIceOff : copy.toggleIceOn}
              className="inline-flex min-h-9 items-center rounded-lg bg-slate-100 px-3 text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-800 dark:text-slate-200"
            >
              {server.enabled ? copy.disable : copy.enable}
            </button>
            <button
              type="button"
              onClick={() => void state.deleteIceServer(server.id)}
              disabled={pending}
              aria-label={`${copy.removeIceServer}: ${server.urls.join(", ")}`}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-rose-100 px-3 text-xs font-bold text-rose-800 hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-rose-950/50 dark:text-rose-200"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              {copy.remove}
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}
