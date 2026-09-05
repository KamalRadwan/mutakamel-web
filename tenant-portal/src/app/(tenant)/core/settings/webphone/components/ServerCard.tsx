"use client";

import { useState } from "react";
import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Save,
  Settings2,
  Trash2,
} from "lucide-react";
import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  ConfirmActionModal,
} from "@/design-system";
import { WEBPHONE_COPY, webphoneErrorText } from "../webphone-copy";
import type { TenantWebphoneSettingsState } from "../hooks/useTenantWebphoneSettings";
import {
  buildServerPatch,
  serverToForm,
  validateServerForm,
  websocketProtocol,
  withWebsocketProtocol,
  type WebphoneIceTransportPolicy,
  type WebphoneServer,
  type WebphoneServerForm,
  type WebphoneTransport,
} from "../webphone-contract";
import {
  InlineError,
  SelectField,
  StateBadge,
  SwitchField,
  TextField,
} from "./WebphoneFields";
import { ServerIceServers } from "./ServerIceServers";

const PROTOCOL_OPTIONS: Array<{ value: WebphoneTransport; label: string }> = [
  { value: "wss", label: "wss" },
  { value: "ws", label: "ws" },
];

/**
 * One SIP server in the failover chain.
 *
 * The position is a badge, never a field: `priority` is contiguous and unique
 * per scope and is renumbered wholesale by the reorder endpoint, so an editable
 * number would offer a write the API cannot honour. Reordering is a drag, and
 * the move buttons beside the handle are the same operation for anyone who
 * cannot drag — the WCAG requirement the board's Move-to menu exists for.
 *
 * Only the basics stay open. The advanced fields are correct defaults for
 * almost every deployment, and a card that shows twenty inputs at rest buries
 * the three that identify the server.
 */
export function ServerCard({
  server,
  position,
  total,
  state,
  dragHandleProps,
}: {
  server: WebphoneServer;
  position: number;
  total: number;
  state: TenantWebphoneSettingsState;
  dragHandleProps: DraggableProvidedDragHandleProps | null;
}) {
  const copy = WEBPHONE_COPY[state.lang];
  const [form, setForm] = useState<WebphoneServerForm>(() => serverToForm(server));
  const [showErrors, setShowErrors] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [confirmingDeletion, setConfirmingDeletion] = useState(false);

  const errors = validateServerForm(form, server.iceServers);
  const patch = buildServerPatch(server, form);
  const dirty = Object.keys(patch).length > 0;
  const pending = state.mutation.phase === "PENDING";
  const disabled = !state.canUpdateConfig || pending;
  const target = `server:${server.id}` as const;
  const cardPending = pending && state.mutation.target === target;
  const orderPending = pending && state.mutation.target === "servers:order";

  const update = <K extends keyof WebphoneServerForm>(
    field: K,
    value: WebphoneServerForm[K],
  ) => setForm((current) => ({ ...current, [field]: value }));

  const save = async () => {
    setShowErrors(true);
    if (Object.keys(errors).length > 0) {
      // The relay rule is the one error that is not on a field the operator is
      // looking at, so open the advanced panel rather than failing silently.
      if (errors.iceTransportPolicy) setAdvancedOpen(true);
      return;
    }
    await state.updateServer(server.id, patch);
  };

  const confirmDeletion = async () => {
    if (await state.deleteServer(server.id)) setConfirmingDeletion(false);
  };

  return (
    <article
      aria-label={`${copy.serverRegion}: ${server.name}`}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          {...dragHandleProps}
          aria-label={`${copy.dragHandle}: ${server.name}`}
          className="text-muted-foreground"
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </span>
        <Badge tone="neutral" aria-label={`${copy.position} ${position}`}>
          {position}
        </Badge>
        <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-card-foreground">
          {server.name}
        </h3>
        <StateBadge
          active={server.enabled}
          activeLabel={copy.enabled}
          inactiveLabel={copy.disabled}
        />
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || orderPending || position === 1}
          aria-label={`${copy.moveEarlier}: ${server.name}`}
          onClick={() => void state.moveServer(position - 1, position - 2)}
        >
          <ChevronUp className="size-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || orderPending || position === total}
          aria-label={`${copy.moveLater}: ${server.name}`}
          onClick={() => void state.moveServer(position - 1, position)}
        >
          <ChevronDown className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TextField
          label={copy.serverName}
          value={form.name}
          maxLength={80}
          disabled={disabled}
          lang={state.lang}
          error={showErrors ? errors.name : undefined}
          onChange={(value) => update("name", value)}
        />
        <TextField
          label={copy.sipDomain}
          value={form.sipDomain}
          maxLength={253}
          disabled={disabled}
          lang={state.lang}
          placeholder="sip.example.com"
          error={showErrors ? errors.sipDomain : undefined}
          onChange={(value) => update("sipDomain", value)}
        />
        <TextField
          label={copy.websocketUrl}
          value={form.websocketUrl}
          maxLength={512}
          disabled={disabled}
          lang={state.lang}
          placeholder="wss://sip.example.com:8089/ws"
          error={showErrors ? errors.websocketUrl : undefined}
          onChange={(value) => update("websocketUrl", value)}
        />
        {/* There is no protocol field on either side of the API — this control
            rewrites the scheme of the URL above, which is where the transport
            is actually stated. */}
        <SelectField<WebphoneTransport>
          label={copy.serverProtocol}
          value={websocketProtocol(form.websocketUrl)}
          disabled={disabled}
          lang={state.lang}
          help={copy.serverProtocolHelp}
          options={PROTOCOL_OPTIONS}
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              websocketUrl: withWebsocketProtocol(current.websocketUrl, value),
            }))
          }
        />
      </div>

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger className="text-xs font-medium text-muted-foreground">
          <Settings2 className="size-4" aria-hidden="true" />
          {copy.advancedSettings}
          {advancedOpen ? (
            <ChevronUp className="size-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-4" aria-hidden="true" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3 flex flex-col gap-4 rounded-lg border border-border p-4">
            <p className="max-w-prose text-xs text-muted-foreground">
              {copy.advancedSettingsHelp}
            </p>

            <div className="grid gap-4 lg:grid-cols-2">
              <TextField
                label={copy.realm}
                value={form.realm}
                maxLength={253}
                disabled={disabled}
                lang={state.lang}
                error={showErrors ? errors.realm : undefined}
                onChange={(value) => update("realm", value)}
              />
              <TextField
                label={copy.outboundProxy}
                value={form.outboundProxy}
                maxLength={512}
                disabled={disabled}
                lang={state.lang}
                placeholder="sip:proxy.example.com"
                error={showErrors ? errors.outboundProxy : undefined}
                onChange={(value) => update("outboundProxy", value)}
              />
              <TextField
                label={copy.fromDomain}
                value={form.fromDomain}
                maxLength={253}
                disabled={disabled}
                lang={state.lang}
                error={showErrors ? errors.fromDomain : undefined}
                onChange={(value) => update("fromDomain", value)}
              />
              <TextField
                label={copy.registrarServer}
                value={form.registrarServer}
                maxLength={512}
                disabled={disabled}
                lang={state.lang}
                placeholder="sip:registrar.example.com"
                error={showErrors ? errors.registrarServer : undefined}
                onChange={(value) => update("registrarServer", value)}
              />
              <TextField
                label={copy.contactUri}
                value={form.contactUri}
                maxLength={512}
                disabled={disabled}
                lang={state.lang}
                error={showErrors ? errors.contactUri : undefined}
                onChange={(value) => update("contactUri", value)}
              />
              <TextField
                label={copy.registerExpires}
                value={form.registerExpires}
                maxLength={6}
                inputMode="numeric"
                disabled={disabled}
                lang={state.lang}
                error={showErrors ? errors.registerExpires : undefined}
                onChange={(value) => update("registerExpires", value)}
              />
              <TextField
                label={copy.defaultCallerId}
                value={form.defaultCallerId}
                maxLength={64}
                disabled={disabled}
                lang={state.lang}
                error={showErrors ? errors.defaultCallerId : undefined}
                onChange={(value) => update("defaultCallerId", value)}
              />
              <SelectField<WebphoneIceTransportPolicy>
                label={copy.iceTransportPolicy}
                value={form.iceTransportPolicy}
                disabled={disabled}
                lang={state.lang}
                error={showErrors ? errors.iceTransportPolicy : undefined}
                options={[
                  { value: "all", label: copy.iceTransportPolicyAll },
                  { value: "relay", label: copy.iceTransportPolicyRelay },
                ]}
                onChange={(value) => update("iceTransportPolicy", value)}
              />
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <SwitchField
                label={copy.sessionTimers}
                checked={form.sessionTimers}
                disabled={disabled}
                onChange={(checked) => update("sessionTimers", checked)}
              />
              <SwitchField
                label={copy.traceSip}
                checked={form.traceSip}
                disabled={disabled}
                onChange={(checked) => update("traceSip", checked)}
              />
              <SwitchField
                label={copy.allowInvalidTls}
                checked={form.allowInvalidTlsCertificate}
                disabled={disabled}
                help={copy.allowInvalidTlsHelp}
                onChange={(checked) =>
                  update("allowInvalidTlsCertificate", checked)
                }
              />
            </div>

            <div>
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {copy.failoverDefaults}
              </h4>
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                <TextField
                  label={copy.defaultTimeoutSeconds}
                  value={form.defaultTimeoutSeconds}
                  maxLength={3}
                  inputMode="numeric"
                  disabled={disabled}
                  lang={state.lang}
                  error={showErrors ? errors.defaultTimeoutSeconds : undefined}
                  onChange={(value) => update("defaultTimeoutSeconds", value)}
                />
                <TextField
                  label={copy.defaultMaxRetries}
                  value={form.defaultMaxRetries}
                  maxLength={2}
                  inputMode="numeric"
                  disabled={disabled}
                  lang={state.lang}
                  error={showErrors ? errors.defaultMaxRetries : undefined}
                  onChange={(value) => update("defaultMaxRetries", value)}
                />
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <ServerIceServers server={server} state={state} />

      {state.mutation.target === target && state.mutation.phase === "FAILED" ? (
        <InlineError
          code={state.mutation.errorCode}
          details={state.mutation.details}
          lang={state.lang}
          render={webphoneErrorText}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void save()}
          disabled={disabled || !dirty}
          loading={cardPending}
        >
          {cardPending ? null : <Save className="size-3.5" aria-hidden="true" />}
          {copy.save}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled}
          aria-label={server.enabled ? copy.toggleServerOff : copy.toggleServerOn}
          onClick={() =>
            void state.updateServer(server.id, { enabled: !server.enabled })
          }
        >
          {server.enabled ? copy.disable : copy.enable}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={disabled}
          aria-label={`${copy.removeServer}: ${server.name}`}
          onClick={() => setConfirmingDeletion(true)}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          {copy.remove}
        </Button>
      </div>

      {/* Removing a server takes its ICE entries with it and renumbers the rest
          of the chain, so it is confirmed rather than done on one click. */}
      <ConfirmActionModal
        open={confirmingDeletion}
        onOpenChange={(open) => setConfirmingDeletion(open)}
        title={copy.deleteServerTitle}
        description={copy.deleteServerMessage}
        confirmLabel={cardPending ? copy.deleting : copy.confirmDeleteServer}
        cancelLabel={copy.cancel}
        onConfirm={() => void confirmDeletion()}
        loading={cardPending}
      />
    </article>
  );
}
