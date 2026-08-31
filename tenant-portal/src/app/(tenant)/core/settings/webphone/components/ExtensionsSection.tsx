"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/design-system";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { WEBPHONE_COPY, webphoneErrorText } from "../webphone-copy";
import type { TenantWebphoneSettingsState } from "../hooks/useTenantWebphoneSettings";
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
  StateBadge,
  SwitchField,
  TextField,
} from "./WebphoneFields";

const TRANSPORT_OPTIONS: Array<{ value: WebphoneTransport; label: string }> = [
  { value: "wss", label: "wss" },
  { value: "ws", label: "ws" },
];

export function ExtensionsSection({
  state,
  describedBy,
}: {
  state: TenantWebphoneSettingsState;
  describedBy?: string;
}) {
  const copy = WEBPHONE_COPY[state.lang];
  const [draft, setDraft] = useState<ExtensionDraft>(EMPTY_EXTENSION_DRAFT);
  const [showDraftErrors, setShowDraftErrors] = useState(false);
  const [revealPassword, setRevealPassword] = useState(false);
  const [pendingDeletion, setPendingDeletion] =
    useState<WebphoneExtension | null>(null);
  const pending = state.mutation.phase === "PENDING";
  const disabled = !state.canManageExtensions || pending;
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
      describedBy={describedBy}
      icon={<Users className="size-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />}
    >
      {state.isSubscribed && !state.canManageExtensions ? (
        // Managing extensions is a separate permission from editing the SIP
        // configuration, so it gets its own explanation rather than leaving the
        // controls silently inert.
        <p
          role="note"
          className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
        >
          {copy.extensionsReadOnly}
        </p>
      ) : null}

      {state.extensions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
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

      <form
        aria-label={copy.addExtension}
        onSubmit={(event) => {
          event.preventDefault();
          void submitDraft();
        }}
        className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
      >
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
          {copy.addExtension}
        </h3>
        <div className="grid gap-4 lg:grid-cols-3">
          <TextField
            label={copy.ownerId}
            value={draft.ownerId}
            maxLength={64}
            disabled={disabled}
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
            disabled={disabled}
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
            disabled={disabled}
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
            disabled={disabled}
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
            disabled={disabled}
            lang={state.lang}
            error={showDraftErrors ? draftErrors.outboundCallerId : undefined}
            onChange={(value) =>
              setDraft((current) => ({ ...current, outboundCallerId: value }))
            }
          />
          <SelectField<WebphoneTransport>
            label={copy.transport}
            value={draft.transport}
            disabled={disabled}
            lang={state.lang}
            options={TRANSPORT_OPTIONS}
            onChange={(value) =>
              setDraft((current) => ({ ...current, transport: value }))
            }
          />
        </div>
        <SecretField
          label={copy.sipPassword}
          value={draft.sipPassword}
          disabled={disabled}
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
          disabled={disabled}
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
          <Button type="submit" variant="primary" size="sm" disabled={disabled}>
            {pending && state.mutation.target === "extension:new" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="size-4" aria-hidden="true" />
            )}
            {pending && state.mutation.target === "extension:new"
              ? copy.adding
              : copy.addExtension}
          </Button>
        </div>
      </form>

      <ConfirmModal
        isOpen={pendingDeletion !== null}
        onClose={() => setPendingDeletion(null)}
        onConfirm={() => void confirmDeletion()}
        title={copy.deleteExtensionTitle}
        message={copy.deleteExtensionMessage}
        confirmText={copy.confirmDelete}
        cancelText={copy.cancel}
        loadingText={copy.deleting}
        isSubmitting={pending}
        closeOnConfirm={false}
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
  state: TenantWebphoneSettingsState;
  onRequestDeletion: () => void;
}) {
  const copy = WEBPHONE_COPY[state.lang];
  const pending = state.mutation.phase === "PENDING";
  const disabled = !state.canManageExtensions || pending;
  const target = `extension:${extension.id}` as const;

  return (
    <article
      aria-label={`${copy.extensionRegion} ${extension.extension}`}
      className="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800"
    >
      <div className="flex flex-wrap items-center gap-2">
        <strong dir="ltr" className="text-sm">
          {extension.extension}
        </strong>
        <span dir="ltr" className="text-[11px] text-slate-500 dark:text-slate-400">
          {extension.sipUsername}
          {extension.displayName ? ` · ${extension.displayName}` : ""}
        </span>
      </div>
      <dl className="grid gap-2 text-[11px] sm:grid-cols-3">
        <div>
          <dt className="font-semibold text-slate-500">{copy.transport}</dt>
          <dd dir="ltr">{extension.transport}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">{copy.passwordState}</dt>
          <dd>
            {extension.passwordConfigured ? copy.configured : copy.notConfigured}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">{copy.outboundCallerId}</dt>
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
        <StateBadge
          active={extension.enabled}
          activeLabel={copy.enabled}
          inactiveLabel={copy.disabled}
        />
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled}
          aria-label={`${
            extension.enabled ? copy.toggleExtensionOff : copy.toggleExtensionOn
          }: ${extension.extension}`}
          onClick={() =>
            void state.updateExtension(extension.id, {
              enabled: !extension.enabled,
            })
          }
        >
          {pending && state.mutation.target === target ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : null}
          {extension.enabled ? copy.disable : copy.enable}
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={disabled}
          aria-label={`${copy.removeExtension}: ${extension.extension}`}
          onClick={onRequestDeletion}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          {copy.remove}
        </Button>
      </div>
    </article>
  );
}
