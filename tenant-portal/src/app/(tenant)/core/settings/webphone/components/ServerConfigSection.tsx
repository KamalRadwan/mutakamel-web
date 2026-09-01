"use client";

import { ServerCog } from "lucide-react";
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

/**
 * Saving lives in `PageHeader`, not here: it is the screen's single filled
 * action and `PageHeader` is the only place one may appear. This section keeps
 * the dirty notice and the config-scoped failure, both of which belong beside
 * the fields they describe.
 */
export function ServerConfigSection({
  state,
  describedBy,
}: {
  state: TenantWebphoneSettingsState;
  describedBy?: string;
}) {
  const copy = WEBPHONE_COPY[state.lang];
  const { form, fieldErrors, lang } = state;
  const disabled = !state.canUpdateConfig || state.mutation.phase === "PENDING";
  if (!form) return null;

  return (
    <SectionCard
      title={copy.serverSection}
      help={copy.serverSectionHelp}
      describedBy={describedBy}
      icon={<ServerCog className="size-4 text-muted-foreground" aria-hidden="true" />}
    >
      {state.hasUnsavedChanges ? (
        <p role="status" className="max-w-prose text-xs font-medium text-foreground">
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
