"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Loader2,
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
} from "@/design-system";
import { WEBPHONE_COPY, webphoneErrorText } from "../webphone-copy";
import type { WebphoneSettingsState } from "../hooks/useWebphoneSettings";
import type { OrderableList } from "../hooks/useOrderableList";
import {
  buildServerPatch,
  serverToForm,
  validateServerForm,
  websocketProtocol,
  withWebsocketProtocol,
  type WebphoneIceTransportPolicy,
  type WebphoneProtocol,
  type WebphoneServer,
  type WebphoneServerForm,
} from "../webphone-contract";
import {
  ActionBar,
  FieldGroup,
  FieldRow,
  InlineError,
  SaveStatus,
  SelectField,
  SwitchField,
  TextField,
} from "./WebphoneFields";
import { ServerIceServers } from "./ServerIceServers";

/**
 * One server in the failover chain.
 *
 * Three things are always visible: where the server sits in the chain, whether
 * it is on, and the three fields that decide whether a browser can reach it.
 * Everything else — SIP identity, registration, media and ICE, diagnostics,
 * failover budget — is behind Advanced, grouped rather than piled, because an
 * operator who is adding a server touches none of it.
 *
 * The order badge is never an input: position is changed by moving the card, so
 * there is no second place to disagree with the list.
 */
export function ServerCard({
  server,
  position,
  total,
  state,
  orderable,
  onMoveUp,
  onMoveDown,
  onRequestDeletion,
}: {
  server: WebphoneServer;
  position: number;
  total: number;
  state: WebphoneSettingsState;
  orderable: OrderableList;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRequestDeletion: () => void;
}) {
  const copy = WEBPHONE_COPY[state.lang];
  const [form, setForm] = useState<WebphoneServerForm>(() =>
    serverToForm(server),
  );
  const [showErrors, setShowErrors] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const pending = state.mutation.phase === "PENDING";
  const disabled = !state.canUpdate || pending;
  const target = `server:${server.id}` as const;
  const toggleTarget = `server:enabled:${server.id}` as const;
  const iceToggleTarget = `server:ice-enabled:${server.id}` as const;
  const rowPending = pending && state.mutation.target === target;
  const rowSaved =
    state.mutation.phase === "SUCCEEDED" && state.mutation.target === target;
  const togglePending = pending && state.mutation.target === toggleTarget;
  const toggleSucceeded =
    state.mutation.phase === "SUCCEEDED" &&
    state.mutation.target === toggleTarget;
  const iceTogglePending = pending && state.mutation.target === iceToggleTarget;
  const iceToggleSucceeded =
    state.mutation.phase === "SUCCEEDED" &&
    state.mutation.target === iceToggleTarget;
  // The master switch is not part of the form — it writes on change — so its
  // stored value is what the transport-policy rule is judged against.
  const errors = validateServerForm(form, server.iceServers, server.iceEnabled);
  // `enabled` is written by its own switch the moment it changes, so it is not
  // part of what Save carries — otherwise one value would have two owners.
  const patch = buildServerPatch(server, { ...form, enabled: server.enabled });
  const dirty = Object.keys(patch).length > 0;
  const isDragging = orderable.draggingId === server.id;
  const isDropTarget =
    orderable.dropTargetId === server.id && orderable.draggingId !== server.id;

  const update = <K extends keyof WebphoneServerForm>(
    field: K,
    value: WebphoneServerForm[K],
  ) => setForm((current) => ({ ...current, [field]: value }));

  const save = async () => {
    setShowErrors(true);
    // A relay-only server with no enabled TURN entry is refused here rather
    // than sent: the failure is knowable from what is already on screen.
    if (Object.keys(errors).length > 0) {
      setAdvancedOpen(true);
      return;
    }
    if (!dirty) return;
    await state.updateServer(server.id, patch);
  };

  return (
    <article
      aria-label={`${copy.serverRegion} ${position}: ${server.name}`}
      className={`grid gap-4 rounded-xl border bg-card p-4 ${
        isDropTarget ? "border-info" : "border-border"
      } ${isDragging ? "opacity-50" : ""}`}
    >
      <header className="flex flex-wrap items-center gap-2">
        {state.canUpdate ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            aria-label={`${copy.dragHandle}: ${server.name}`}
            className="cursor-grab px-1 text-muted-foreground"
            disabled={pending}
            {...orderable.handleProps(server.id)}
          >
            <GripVertical className="size-4" aria-hidden="true" />
          </Button>
        ) : null}

        <Badge tone="info" aria-label={`${copy.orderPosition}: ${position}`}>
          {position}
        </Badge>
        <strong className="text-sm">{server.name}</strong>
        <span dir="ltr" className="text-xs text-muted-foreground">
          {server.sipDomain}
        </span>
        <Badge tone={server.enabled ? "success" : "neutral"}>
          {server.enabled ? copy.enabled : copy.disabled}
        </Badge>

        {state.canUpdate ? (
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={onMoveUp}
              disabled={pending || position === 1}
              aria-label={`${copy.moveUp}: ${server.name}`}
            >
              <ChevronUp className="size-3.5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={onMoveDown}
              disabled={pending || position === total}
              aria-label={`${copy.moveDown}: ${server.name}`}
            >
              <ChevronDown className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        ) : null}
      </header>

      <SwitchField
        label={copy.serverEnabledLabel}
        checked={server.enabled}
        disabled={disabled}
        help={copy.savesInstantly}
        onChange={(checked) => void state.setServerEnabled(server.id, checked)}
        status={
          <SaveStatus
            pending={togglePending}
            saved={toggleSucceeded}
            savingLabel={copy.saving}
            savedLabel={copy.saved}
          />
        }
      />

      <FieldGroup title={copy.basicSection} help={copy.basicSectionHelp}>
        <FieldRow>
          <TextField
            label={copy.serverName}
            value={form.name}
            maxLength={64}
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
          <SelectField<WebphoneProtocol>
            label={copy.protocol}
            value={websocketProtocol(form.websocketUrl)}
            disabled={disabled}
            lang={state.lang}
            help={copy.protocolHelp}
            options={[
              { value: "wss", label: "wss" },
              { value: "ws", label: "ws" },
            ]}
            onChange={(value) =>
              update("websocketUrl", withWebsocketProtocol(form.websocketUrl, value))
            }
          />
        </FieldRow>
      </FieldGroup>

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <Settings2 className="size-3.5" aria-hidden="true" />
            {advancedOpen ? copy.hideAdvanced : copy.showAdvanced}
            {advancedOpen ? (
              <ChevronUp className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-3.5" aria-hidden="true" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <section
            aria-label={`${copy.advancedSection}: ${server.name}`}
            className="mt-3 grid gap-5 rounded-lg border border-border bg-muted p-4"
          >
            <p className="max-w-2xl text-xs leading-5 text-muted-foreground">
              {copy.advancedSectionHelp}
            </p>

            <FieldGroup title={copy.identitySection}>
              <FieldRow>
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
              </FieldRow>
            </FieldGroup>

            <FieldGroup title={copy.registrationSection}>
              <FieldRow>
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
              </FieldRow>
              <SwitchField
                label={copy.sessionTimers}
                checked={form.sessionTimers}
                disabled={disabled}
                onChange={(checked) => update("sessionTimers", checked)}
              />
            </FieldGroup>

            <FieldGroup title={copy.mediaSection} help={copy.iceSectionHelp}>
              {/* Above the policy and above the entries, because it governs
                  both: with it off the policy has nothing to choose between and
                  the entries are not offered at all. */}
              <SwitchField
                label={copy.serverIceEnabledLabel}
                checked={server.iceEnabled}
                disabled={disabled}
                help={`${copy.serverIceEnabledHelp} ${copy.savesInstantly}`}
                onChange={(checked) =>
                  void state.setServerIceEnabled(server.id, checked)
                }
                status={
                  <SaveStatus
                    pending={iceTogglePending}
                    saved={iceToggleSucceeded}
                    savingLabel={copy.saving}
                    savedLabel={copy.saved}
                  />
                }
              />

              {/* Next to the switch that caused it, not in the card's action
                  row: a relay-only server refuses this write, and the operator
                  needs the reason where they are looking. */}
              {state.mutation.phase === "FAILED" &&
              state.mutation.target === iceToggleTarget ? (
                <InlineError
                  code={state.mutation.errorCode}
                  details={state.mutation.details}
                  lang={state.lang}
                  render={webphoneErrorText}
                />
              ) : null}

              <FieldRow>
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
              </FieldRow>
              <ServerIceServers server={server} state={state} />
            </FieldGroup>

            <FieldGroup title={copy.diagnosticsSection}>
              <FieldRow>
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
              </FieldRow>
            </FieldGroup>

            <FieldGroup
              title={copy.failoverDefaults}
              help={copy.failoverDefaultsHelp}
            >
              <FieldRow>
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
              </FieldRow>
            </FieldGroup>
          </section>
        </CollapsibleContent>
      </Collapsible>

      {state.mutation.phase === "FAILED" &&
      (state.mutation.target === target ||
        state.mutation.target === toggleTarget) ? (
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
              onClick={() => void save()}
              disabled={pending || !dirty}
            >
              {rowPending ? (
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
              pending={rowPending}
              saved={rowSaved}
              savingLabel={copy.saving}
              savedLabel={copy.saved}
            />
          }
          destructive={
            <Button
              type="button"
              variant="destructive"
              onClick={onRequestDeletion}
              disabled={pending}
              aria-label={`${copy.removeServer}: ${server.name}`}
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
