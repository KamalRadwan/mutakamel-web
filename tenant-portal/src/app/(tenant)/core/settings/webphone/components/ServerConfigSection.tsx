"use client";

import { Loader2, Save, ServerCog } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { WEBPHONE_COPY, webphoneErrorText } from "../webphone-copy";
import type { TenantWebphoneSettingsState } from "../hooks/useTenantWebphoneSettings";
import type { WebphoneIceTransportPolicy } from "../webphone-contract";
import {
  InlineError,
  SectionCard,
  SelectField,
  SwitchField,
  TextField,
} from "./WebphoneFields";

export function ServerConfigSection({
  state,
  describedBy,
  onSave,
}: {
  state: TenantWebphoneSettingsState;
  describedBy?: string;
  onSave: () => void;
}) {
  const copy = WEBPHONE_COPY[state.lang];
  const { form, fieldErrors, lang } = state;
  const pending = state.mutation.phase === "PENDING";
  const disabled = !state.canUpdateConfig || pending;
  const savePending = pending && state.mutation.target === "config";
  if (!form) return null;

  return (
    <SectionCard
      title={copy.serverSection}
      help={copy.serverSectionHelp}
      describedBy={describedBy}
      icon={<ServerCog className="size-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />}
      actions={
        <Button
          variant="primary"
          size="sm"
          onClick={onSave}
          disabled={disabled || !state.hasUnsavedChanges}
        >
          {savePending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          {savePending ? copy.saving : copy.save}
        </Button>
      }
    >
      {state.hasUnsavedChanges ? (
        <p
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {copy.unsavedChanges}
        </p>
      ) : null}

      {state.mutation.target === "config" && state.mutation.phase === "FAILED" ? (
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
