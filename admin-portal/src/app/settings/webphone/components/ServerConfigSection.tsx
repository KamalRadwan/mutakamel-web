"use client";

import { Loader2, Save, ServerCog } from "lucide-react";
import { WEBPHONE_COPY, webphoneErrorText } from "../webphone-copy";
import type { WebphoneSettingsState } from "../hooks/useWebphoneSettings";
import {
  InlineError,
  SectionCard,
  SelectField,
  SwitchField,
  TextField,
} from "./WebphoneFields";
import type { WebphoneIceTransportPolicy } from "../webphone-contract";

export function ServerConfigSection({
  state,
  onSave,
}: {
  state: WebphoneSettingsState;
  onSave: () => void;
}) {
  const copy = WEBPHONE_COPY[state.lang];
  const { form, fieldErrors, lang } = state;
  const pending = state.mutation.phase === "PENDING";
  const disabled = !state.canUpdate || pending;
  const savePending = pending && state.mutation.target === "config";
  if (!form) return null;

  return (
    <SectionCard
      title={copy.serverSection}
      help={copy.serverSectionHelp}
      icon={<ServerCog className="size-4 text-blue-500" aria-hidden="true" />}
      actions={
        state.canUpdate ? (
          <button
            type="button"
            onClick={onSave}
            disabled={!state.hasUnsavedChanges || pending}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-700 px-3.5 text-xs font-bold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {savePending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            {savePending ? copy.saving : copy.save}
          </button>
        ) : null
      }
    >
      {state.hasUnsavedChanges ? (
        <p
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-bold text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
        >
          {copy.unsavedChanges}
        </p>
      ) : null}

      {state.mutation.target === "config" &&
      state.mutation.phase === "FAILED" ? (
        <InlineError
          code={state.mutation.errorCode}
          details={state.mutation.details}
          lang={lang}
          render={webphoneErrorText}
        />
      ) : null}

      <SwitchField
        label={copy.enabledLabel}
        checked={form.enabled}
        disabled={disabled}
        help={copy.serverSectionHelp}
        onChange={(checked) => state.updateField("enabled", checked)}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <TextField
          label={copy.sipDomain}
          value={form.sipDomain}
          maxLength={253}
          disabled={disabled}
          error={fieldErrors.sipDomain}
          lang={lang}
          placeholder="sip.example.com"
          onChange={(value) => state.updateField("sipDomain", value)}
        />
        <TextField
          label={copy.realm}
          value={form.realm}
          maxLength={253}
          disabled={disabled}
          error={fieldErrors.realm}
          lang={lang}
          onChange={(value) => state.updateField("realm", value)}
        />
        <TextField
          label={copy.outboundProxy}
          value={form.outboundProxy}
          maxLength={512}
          disabled={disabled}
          error={fieldErrors.outboundProxy}
          lang={lang}
          placeholder="sip:proxy.example.com"
          onChange={(value) => state.updateField("outboundProxy", value)}
        />
        <TextField
          label={copy.fromDomain}
          value={form.fromDomain}
          maxLength={253}
          disabled={disabled}
          error={fieldErrors.fromDomain}
          lang={lang}
          onChange={(value) => state.updateField("fromDomain", value)}
        />
        <TextField
          label={copy.registrarServer}
          value={form.registrarServer}
          maxLength={512}
          disabled={disabled}
          error={fieldErrors.registrarServer}
          lang={lang}
          placeholder="sip:registrar.example.com"
          onChange={(value) => state.updateField("registrarServer", value)}
        />
        <TextField
          label={copy.contactUri}
          value={form.contactUri}
          maxLength={512}
          disabled={disabled}
          error={fieldErrors.contactUri}
          lang={lang}
          onChange={(value) => state.updateField("contactUri", value)}
        />
        <TextField
          label={copy.registerExpires}
          value={form.registerExpires}
          maxLength={6}
          inputMode="numeric"
          disabled={disabled}
          error={fieldErrors.registerExpires}
          lang={lang}
          onChange={(value) => state.updateField("registerExpires", value)}
        />
        <TextField
          label={copy.defaultCallerId}
          value={form.defaultCallerId}
          maxLength={64}
          disabled={disabled}
          error={fieldErrors.defaultCallerId}
          lang={lang}
          onChange={(value) => state.updateField("defaultCallerId", value)}
        />
        <SelectField<WebphoneIceTransportPolicy>
          label={copy.iceTransportPolicy}
          value={form.iceTransportPolicy}
          disabled={disabled}
          lang={lang}
          options={[
            { value: "all", label: copy.iceTransportPolicyAll },
            { value: "relay", label: copy.iceTransportPolicyRelay },
          ]}
          onChange={(value) => state.updateField("iceTransportPolicy", value)}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <SwitchField
          label={copy.sessionTimers}
          checked={form.sessionTimers}
          disabled={disabled}
          onChange={(checked) => state.updateField("sessionTimers", checked)}
        />
        <SwitchField
          label={copy.traceSip}
          checked={form.traceSip}
          disabled={disabled}
          onChange={(checked) => state.updateField("traceSip", checked)}
        />
        <SwitchField
          label={copy.allowInvalidTls}
          checked={form.allowInvalidTlsCertificate}
          disabled={disabled}
          help={copy.allowInvalidTlsHelp}
          onChange={(checked) =>
            state.updateField("allowInvalidTlsCertificate", checked)
          }
        />
      </div>
    </SectionCard>
  );
}
