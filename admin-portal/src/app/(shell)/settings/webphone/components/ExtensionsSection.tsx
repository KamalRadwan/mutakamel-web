"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2, Users } from "lucide-react";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { WEBPHONE_COPY, webphoneErrorText } from "../webphone-copy";
import type { WebphoneSettingsState } from "../hooks/useWebphoneSettings";
import {
  EMPTY_EXTENSION_DRAFT,
  extensionDraftToDto,
  validateExtensionDraft,
  type ExtensionDraft,
  type WebphoneExtension,
  type WebphoneTransport,
} from "../webphone-contract";
import {
  InlineError,
  SecretField,
  SectionCard,
  SelectField,
  SwitchField,
  TextField,
} from "./WebphoneFields";
import { SeatCounter } from "./SeatCounter";

export function ExtensionsSection({ state }: { state: WebphoneSettingsState }) {
  const copy = WEBPHONE_COPY[state.lang];
  const [draft, setDraft] = useState<ExtensionDraft>(EMPTY_EXTENSION_DRAFT);
  const [showDraftErrors, setShowDraftErrors] = useState(false);
  const [revealPassword, setRevealPassword] = useState(false);
  const [pendingDeletion, setPendingDeletion] =
    useState<WebphoneExtension | null>(null);
  const pending = state.mutation.phase === "PENDING";
  const draftErrors = validateExtensionDraft(draft);

  const submitDraft = async () => {
    setShowDraftErrors(true);
    if (Object.keys(draftErrors).length > 0) return;
    if (await state.createExtension(extensionDraftToDto(draft))) {
      setDraft(EMPTY_EXTENSION_DRAFT);
      setShowDraftErrors(false);
      setRevealPassword(false);
    }
  };

  const confirmDeletion = async () => {
    if (!pendingDeletion) return;
    if (await state.deleteExtension(pendingDeletion.id)) {
      setPendingDeletion(null);
    }
  };

  return (
    <SectionCard
      title={copy.extensionsSection}
      help={copy.extensionsSectionHelp}
      icon={<Users className="size-4 text-blue-500" aria-hidden="true" />}
    >
      <FleetSeatUsage state={state} />

      {state.extensions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {copy.extensionsEmpty}
        </p>
      ) : (
        <ul className="space-y-3">
          {state.extensions.map((extension) => (
            <li key={extension.id}>
              <ExtensionRow
                extension={extension}
                state={state}
                onRequestDeletion={() => setPendingDeletion(extension)}
              />
            </li>
          ))}
        </ul>
      )}

      {state.canUpdate ? (
        <form
          aria-label={copy.addExtension}
          onSubmit={(event) => {
            event.preventDefault();
            void submitDraft();
          }}
          className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950"
        >
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">
            {copy.addExtension}
          </h3>
          <div className="grid gap-4 lg:grid-cols-3">
            <TextField
              label={copy.ownerId}
              value={draft.ownerId}
              maxLength={64}
              disabled={pending}
              lang={state.lang}
              error={showDraftErrors ? draftErrors.ownerId : undefined}
              onChange={(value) =>
                setDraft((current) => ({ ...current, ownerId: value }))
              }
            />
            <TextField
              label={copy.extension}
              value={draft.extension}
              maxLength={32}
              disabled={pending}
              lang={state.lang}
              error={showDraftErrors ? draftErrors.extension : undefined}
              onChange={(value) =>
                setDraft((current) => ({ ...current, extension: value }))
              }
            />
            <TextField
              label={copy.sipUsername}
              value={draft.sipUsername}
              maxLength={120}
              disabled={pending}
              lang={state.lang}
              error={showDraftErrors ? draftErrors.sipUsername : undefined}
              onChange={(value) =>
                setDraft((current) => ({ ...current, sipUsername: value }))
              }
            />
            <TextField
              label={copy.displayName}
              value={draft.displayName}
              maxLength={120}
              disabled={pending}
              lang={state.lang}
              error={showDraftErrors ? draftErrors.displayName : undefined}
              onChange={(value) =>
                setDraft((current) => ({ ...current, displayName: value }))
              }
            />
            <TextField
              label={copy.outboundCallerId}
              value={draft.outboundCallerId}
              maxLength={64}
              disabled={pending}
              lang={state.lang}
              error={showDraftErrors ? draftErrors.outboundCallerId : undefined}
              onChange={(value) =>
                setDraft((current) => ({ ...current, outboundCallerId: value }))
              }
            />
            <SelectField<WebphoneTransport>
              label={copy.transport}
              value={draft.transport}
              disabled={pending}
              lang={state.lang}
              options={[
                { value: "wss", label: "wss" },
                { value: "ws", label: "ws" },
              ]}
              onChange={(value) =>
                setDraft((current) => ({ ...current, transport: value }))
              }
            />
          </div>
          <SecretField
            label={copy.sipPassword}
            value={draft.sipPassword}
            disabled={pending}
            lang={state.lang}
            help={copy.sipPasswordKeepHelp}
            revealed={revealPassword}
            onToggleReveal={() => setRevealPassword((current) => !current)}
            showLabel={copy.showPassword}
            hideLabel={copy.hidePassword}
            error={showDraftErrors ? draftErrors.sipPassword : undefined}
            onChange={(value) =>
              setDraft((current) => ({ ...current, sipPassword: value }))
            }
          />
          <SwitchField
            label={copy.extensionEnabledLabel}
            checked={draft.enabled}
            disabled={pending}
            onChange={(checked) =>
              setDraft((current) => ({ ...current, enabled: checked }))
            }
          />

          {state.mutation.target === "extension:new" &&
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
              {pending && state.mutation.target === "extension:new" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="size-4" aria-hidden="true" />
              )}
              {pending && state.mutation.target === "extension:new"
                ? copy.adding
                : copy.addExtension}
            </button>
          </div>
        </form>
      ) : null}

      <DestructiveActionModal
        isOpen={pendingDeletion !== null}
        onClose={() => setPendingDeletion(null)}
        onConfirm={() => void confirmDeletion()}
        title={copy.deleteExtensionTitle}
        description={copy.deleteExtensionDescription}
        targetName={pendingDeletion?.extension ?? ""}
        actionType="delete"
        requireNameTyping={false}
        isSubmitting={pending}
        confirmLabel={copy.confirmDelete}
        submittingLabel={copy.deleting}
      />
    </SectionCard>
  );
}

function ExtensionRow({
  extension,
  state,
  onRequestDeletion,
}: {
  extension: WebphoneExtension;
  state: WebphoneSettingsState;
  onRequestDeletion: () => void;
}) {
  const copy = WEBPHONE_COPY[state.lang];
  const pending = state.mutation.phase === "PENDING";
  const target = `extension:${extension.id}` as const;

  return (
    <article
      aria-label={`${copy.extensionRegion} ${extension.extension}`}
      className="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"
    >
      <div className="flex flex-wrap items-center gap-2">
        <strong dir="ltr" className="text-sm">
          {extension.extension}
        </strong>
        <span dir="ltr" className="text-xs text-slate-500 dark:text-slate-400">
          {extension.sipUsername}
          {extension.displayName ? ` · ${extension.displayName}` : ""}
        </span>
      </div>
      <dl className="grid gap-2 text-[11px] sm:grid-cols-3">
        <div>
          <dt className="font-bold text-slate-500">{copy.transport}</dt>
          <dd dir="ltr">{extension.transport}</dd>
        </div>
        <div>
          <dt className="font-bold text-slate-500">{copy.passwordState}</dt>
          <dd>
            {extension.passwordConfigured ? copy.configured : copy.notConfigured}
          </dd>
        </div>
        <div>
          <dt className="font-bold text-slate-500">{copy.outboundCallerId}</dt>
          <dd dir="ltr">{extension.outboundCallerId ?? "—"}</dd>
        </div>
      </dl>

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
            extension.enabled
              ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
              : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          {extension.enabled ? copy.enabled : copy.disabled}
        </span>
        {state.canUpdate ? (
          <>
            <button
              type="button"
              onClick={() =>
                void state.updateExtension(extension.id, {
                  enabled: !extension.enabled,
                })
              }
              disabled={pending}
              aria-label={`${
                extension.enabled
                  ? copy.toggleExtensionOff
                  : copy.toggleExtensionOn
              }: ${extension.extension}`}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-800 dark:text-slate-200"
            >
              {pending && state.mutation.target === target ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : null}
              {extension.enabled ? copy.disable : copy.enable}
            </button>
            <button
              type="button"
              onClick={onRequestDeletion}
              disabled={pending}
              aria-label={`${copy.removeExtension}: ${extension.extension}`}
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

function FleetSeatUsage({ state }: { state: WebphoneSettingsState }) {
  const copy = WEBPHONE_COPY[state.lang];
  return (
    <section
      aria-label={copy.seatsSection}
      className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
    >
      <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">
        {copy.seatsSection}
      </h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {copy.seatsSectionHelp}
      </p>
      {state.fleetSeats.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          {copy.seatsEmpty}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {state.fleetSeats.map((row) => (
            <li key={row.tenantId}>
              <SeatCounter
                lang={state.lang}
                seats={row}
                heading={row.tenantName}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
