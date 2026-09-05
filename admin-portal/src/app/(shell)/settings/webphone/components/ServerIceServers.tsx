"use client";

import { useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Badge, Button } from "@/design-system";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
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
  type WebphoneServer,
} from "../webphone-contract";
import {
  ActionBar,
  FieldGroup,
  FieldRow,
  InlineError,
  SaveStatus,
  SecretField,
  SelectField,
  SwitchField,
  TextField,
} from "./WebphoneFields";

/**
 * The STUN and TURN entries of one server, nested inside its Advanced panel.
 *
 * They live with their server rather than in a shared list because relay-only
 * transport is decided per server: an entry only helps the server that owns it,
 * so showing them apart would invite an operator to read another server's TURN
 * as cover for this one.
 *
 * ## When the server's ICE master switch is off
 *
 * The list stays rendered, readable and editable, and says in words that none
 * of it is in use. Three things it deliberately does NOT do:
 *
 * - hide the entries — the switch above is put back from this very screen, and
 *   an operator cannot decide to restore a set they cannot see;
 * - disable the controls — an entry can legitimately be corrected while ICE is
 *   parked, and a greyed-out field with no sentence attached is exactly the
 *   ambiguity that made an earlier version of this screen unreadable;
 * - touch each entry's own switch — those record which relays the operator
 *   parked individually, and overwriting them would make switching ICE back on
 *   restore something other than what was there.
 *
 * The dimming is a second signal, never the only one.
 */
export function ServerIceServers({
  server,
  state,
}: {
  server: WebphoneServer;
  state: WebphoneSettingsState;
}) {
  const copy = WEBPHONE_COPY[state.lang];
  const [pendingDeletion, setPendingDeletion] =
    useState<WebphoneIceServer | null>(null);
  const pending = state.mutation.phase === "PENDING";

  const confirmDeletion = async () => {
    if (!pendingDeletion) return;
    if (await state.deleteIceServer(server.id, pendingDeletion.id)) {
      setPendingDeletion(null);
    }
  };

  return (
    <div
      role="group"
      aria-label={`${copy.iceSection}: ${server.name}`}
      className="grid gap-3"
    >
      {server.iceEnabled ? null : (
        <p
          role="status"
          className="rounded-md border border-warning/30 bg-warning-subtle p-3 text-xs leading-5 font-medium text-warning-subtle-foreground"
        >
          {copy.serverIceOffNotice}
        </p>
      )}

      {server.iceServers.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
          {copy.iceEmpty}
        </p>
      ) : (
        // Dimmed as a second signal only. The sentence above is the first one,
        // and the entries stay fully operable underneath it.
        <ul className={`grid gap-3 ${server.iceEnabled ? "" : "opacity-70"}`}>
          {server.iceServers.map((ice) => (
            <li key={ice.id}>
              <IceServerRow
                ice={ice}
                server={server}
                state={state}
                onRequestDeletion={() => setPendingDeletion(ice)}
              />
            </li>
          ))}
        </ul>
      )}

      {state.canUpdate ? (
        <AddIceServerForm server={server} state={state} />
      ) : null}

      <DestructiveActionModal
        isOpen={pendingDeletion !== null}
        onClose={() => setPendingDeletion(null)}
        onConfirm={() => void confirmDeletion()}
        title={copy.deleteIceTitle}
        description={copy.deleteIceDescription}
        targetName={pendingDeletion?.urls.join(", ") ?? ""}
        actionType="delete"
        requireNameTyping={false}
        isSubmitting={pending}
        confirmLabel={copy.confirmDeleteIce}
        submittingLabel={copy.deleting}
      />
    </div>
  );
}

/**
 * One ICE entry, with two save rules and no ambiguity about which is which.
 *
 * The switch writes on change, like the failover order does; the typed fields
 * wait for Save, because saving a URL list per keystroke would send a stream of
 * invalid ones. Each half states its own rule in its own help text and reports
 * its own outcome, so neither is left to be inferred from the presence of a
 * button somewhere nearby.
 */
function IceServerRow({
  ice,
  server,
  state,
  onRequestDeletion,
}: {
  ice: WebphoneIceServer;
  server: WebphoneServer;
  state: WebphoneSettingsState;
  onRequestDeletion: () => void;
}) {
  const copy = WEBPHONE_COPY[state.lang];
  const [draft, setDraft] = useState<Omit<IceServerDraft, "enabled">>({
    kind: ice.kind,
    urls: ice.urls.join(", "),
    username: ice.username ?? "",
    // Always empty: the stored credential is never returned, so there is
    // nothing to prefill. A blank submission keeps whatever Core holds.
    credential: "",
  });
  const [showErrors, setShowErrors] = useState(false);
  const [revealCredential, setRevealCredential] = useState(false);
  const errors = validateIceServerDraft(
    { ...draft, enabled: ice.enabled },
    ice.credentialConfigured,
  );
  const pending = state.mutation.phase === "PENDING";
  const disabled = !state.canUpdate || pending;

  const saveTarget = `ice:${ice.id}` as const;
  const toggleTarget = `ice:enabled:${ice.id}` as const;
  const savePending = pending && state.mutation.target === saveTarget;
  const saveSucceeded =
    state.mutation.phase === "SUCCEEDED" && state.mutation.target === saveTarget;
  const togglePending = pending && state.mutation.target === toggleTarget;
  const toggleSucceeded =
    state.mutation.phase === "SUCCEEDED" &&
    state.mutation.target === toggleTarget;
  const failedTarget =
    state.mutation.phase === "FAILED" &&
    (state.mutation.target === saveTarget ||
      state.mutation.target === toggleTarget);

  const dirty =
    draft.kind !== ice.kind ||
    draft.urls.trim() !== ice.urls.join(", ") ||
    draft.username.trim() !== (ice.username ?? "") ||
    draft.credential !== "";

  const save = async () => {
    setShowErrors(true);
    if (Object.keys(errors).length > 0) return;
    const username = draft.username.trim();
    const succeeded = await state.updateIceServer(server.id, ice.id, {
      kind: draft.kind,
      urls: parseIceUrls(draft.urls),
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
      aria-label={`${copy.iceRegion}: ${ice.urls.join(", ")}`}
      className="grid gap-3 rounded-lg border border-border bg-card p-3"
    >
      <header className="flex flex-wrap items-center gap-2">
        <Badge tone="info">{ice.kind}</Badge>
        <span dir="ltr" className="font-mono text-xs text-muted-foreground">
          {ice.urls.join(", ")}
        </span>
      </header>

      <SwitchField
        label={copy.iceEnabledLabel}
        checked={ice.enabled}
        disabled={disabled}
        help={copy.savesInstantly}
        onChange={(checked) =>
          void state.setIceServerEnabled(server.id, ice.id, checked)
        }
        status={
          <SaveStatus
            pending={togglePending}
            saved={toggleSucceeded}
            savingLabel={copy.saving}
            savedLabel={copy.saved}
          />
        }
      />

      <FieldGroup title={copy.iceEntryFields} help={copy.savesOnSave}>
        <FieldRow>
          <SelectField<WebphoneIceServerKind>
            label={copy.iceKind}
            value={draft.kind}
            disabled={disabled}
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
            disabled={disabled}
            lang={state.lang}
            help={copy.iceUrlsHelp}
            error={showErrors ? errors.urls : undefined}
            onChange={(value) =>
              setDraft((current) => ({ ...current, urls: value }))
            }
          />
        </FieldRow>

        {draft.kind === "TURN" ? (
          <FieldRow>
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
              writeOnlyLabel={copy.writeOnly}
              storedLabel={{
                text: `${copy.iceCredentialState}: ${
                  ice.credentialConfigured ? copy.configured : copy.notConfigured
                }`,
                stored: ice.credentialConfigured,
              }}
              error={showErrors ? errors.credential : undefined}
              onChange={(value) =>
                setDraft((current) => ({ ...current, credential: value }))
              }
            />
          </FieldRow>
        ) : null}
      </FieldGroup>

      {failedTarget ? (
        <InlineError
          code={state.mutation.errorCode}
          details={state.mutation.details}
          lang={state.lang}
          render={webphoneErrorText}
        />
      ) : null}

      {state.canUpdate ? (
        <ActionBar
          primary={
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => void save()}
              disabled={pending || !dirty}
            >
              {savePending ? (
                <Loader2
                  className="size-3.5 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <Save className="size-3.5" aria-hidden="true" />
              )}
              {copy.save}
            </Button>
          }
          status={
            <SaveStatus
              pending={savePending}
              saved={saveSucceeded}
              savingLabel={copy.saving}
              savedLabel={copy.saved}
            />
          }
          destructive={
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onRequestDeletion}
              disabled={pending}
              aria-label={`${copy.removeIceServer}: ${ice.urls.join(", ")}`}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              {copy.remove}
            </Button>
          }
        />
      ) : null}
    </article>
  );
}

function AddIceServerForm({
  server,
  state,
}: {
  server: WebphoneServer;
  state: WebphoneSettingsState;
}) {
  const copy = WEBPHONE_COPY[state.lang];
  const [draft, setDraft] = useState<IceServerDraft>(EMPTY_ICE_SERVER_DRAFT);
  const [showErrors, setShowErrors] = useState(false);
  const [revealCredential, setRevealCredential] = useState(false);
  const errors = validateIceServerDraft(draft);
  const pending = state.mutation.phase === "PENDING";
  const target = `ice:new:${server.id}` as const;
  const adding = pending && state.mutation.target === target;
  const added =
    state.mutation.phase === "SUCCEEDED" && state.mutation.target === target;

  const submit = async () => {
    setShowErrors(true);
    if (Object.keys(errors).length > 0) return;
    const created = await state.createIceServer(
      server.id,
      iceServerDraftToDto(draft, server.iceServers.length),
    );
    if (created) {
      setDraft(EMPTY_ICE_SERVER_DRAFT);
      setShowErrors(false);
      setRevealCredential(false);
    }
  };

  return (
    <form
      method="post"
      aria-label={`${copy.addIceServer}: ${server.name}`}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="grid gap-3 rounded-lg border border-dashed border-border p-3"
    >
      <FieldGroup title={copy.addIceServer}>
        <FieldRow>
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
            error={showErrors ? errors.urls : undefined}
            onChange={(value) =>
              setDraft((current) => ({ ...current, urls: value }))
            }
          />
        </FieldRow>

        {draft.kind === "TURN" ? (
          <FieldRow>
            <TextField
              label={copy.iceUsername}
              value={draft.username}
              maxLength={128}
              disabled={pending}
              lang={state.lang}
              error={showErrors ? errors.username : undefined}
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
              revealed={revealCredential}
              onToggleReveal={() => setRevealCredential((current) => !current)}
              showLabel={copy.showCredential}
              hideLabel={copy.hideCredential}
              writeOnlyLabel={copy.writeOnly}
              error={showErrors ? errors.credential : undefined}
              onChange={(value) =>
                setDraft((current) => ({ ...current, credential: value }))
              }
            />
          </FieldRow>
        ) : null}

        {/* There is deliberately no "enabled" switch here. It carried the same
            label as the switch on a saved entry and sat directly beneath the
            entry list, so operators read it as belonging to the entry above,
            unchecked it, and watched nothing happen — which is exactly what it
            was supposed to do, and exactly the wrong thing to appear to do.
            That misread survived a help line added to explain the difference,
            because a create form cannot be told apart from a row of saved
            entries by wording alone. New entries are added enabled
            (`EMPTY_ICE_SERVER_DRAFT`), and the entry's own switch — which
            writes immediately — is the single place that value ever changes.
            Adding a deliberately-disabled entry now costs one extra click;
            not knowing which control you are holding cost more. */}
      </FieldGroup>

      {state.mutation.target === target && state.mutation.phase === "FAILED" ? (
        <InlineError
          code={state.mutation.errorCode}
          details={state.mutation.details}
          lang={state.lang}
          render={webphoneErrorText}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          {adding ? (
            <Loader2
              className="size-3.5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <Plus className="size-3.5" aria-hidden="true" />
          )}
          {adding ? copy.adding : copy.addIceServer}
        </Button>
        <SaveStatus
          pending={adding}
          saved={added}
          savingLabel={copy.adding}
          savedLabel={copy.added}
        />
      </div>
    </form>
  );
}
