"use client";

import { useState } from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Network, Plus } from "lucide-react";
import { Button } from "@/design-system";
import { WEBPHONE_COPY, webphoneErrorText } from "../webphone-copy";
import type { TenantWebphoneSettingsState } from "../hooks/useTenantWebphoneSettings";
import {
  EMPTY_SERVER_DRAFT,
  serverDraftToDto,
  validateServerDraft,
  websocketProtocol,
  withWebsocketProtocol,
  type ServerDraft,
  type WebphoneTransport,
} from "../webphone-contract";
import {
  InlineError,
  SectionCard,
  SelectField,
  SwitchField,
  TextField,
} from "./WebphoneFields";
import { ServerCard } from "./ServerCard";

const PROTOCOL_OPTIONS: Array<{ value: WebphoneTransport; label: string }> = [
  { value: "wss", label: "wss" },
  { value: "ws", label: "ws" },
];

/**
 * The failover chain.
 *
 * Order is the substance of this list, so it is edited where it is read: a card
 * is dragged to its new position, and the whole id list goes to
 * `PUT /servers/order`. Drag is never the only path — every card also carries
 * move buttons, which is the same accessibility requirement the board's
 * Move-to menu exists for.
 */
export function ServersSection({
  state,
  describedBy,
}: {
  state: TenantWebphoneSettingsState;
  describedBy?: string;
}) {
  const copy = WEBPHONE_COPY[state.lang];
  const [draft, setDraft] = useState<ServerDraft>(EMPTY_SERVER_DRAFT);
  const [showDraftErrors, setShowDraftErrors] = useState(false);
  const pending = state.mutation.phase === "PENDING";
  const disabled = !state.canUpdateConfig || pending;
  const draftErrors = validateServerDraft(draft);
  const addPending = pending && state.mutation.target === "server:new";
  const orderPending = pending && state.mutation.target === "servers:order";

  const submitDraft = async () => {
    setShowDraftErrors(true);
    if (Object.keys(draftErrors).length > 0) return;
    if (await state.createServer(serverDraftToDto(draft))) {
      setDraft(EMPTY_SERVER_DRAFT);
      setShowDraftErrors(false);
    }
  };

  const handleDragEnd = (result: DropResult): void => {
    if (!result.destination) return;
    void state.moveServer(result.source.index, result.destination.index);
  };

  return (
    <SectionCard
      title={copy.serversSection}
      help={copy.serversSectionHelp}
      describedBy={describedBy}
      icon={<Network className="size-4 text-muted-foreground" aria-hidden="true" />}
    >
      {orderPending ? (
        <p role="status" className="text-xs text-muted-foreground">
          {copy.savingOrder}
        </p>
      ) : null}

      {state.mutation.target === "servers:order" &&
      state.mutation.phase === "FAILED" ? (
        <InlineError
          code={state.mutation.errorCode}
          details={state.mutation.details}
          lang={state.lang}
          render={webphoneErrorText}
        />
      ) : null}

      {state.servers.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          {copy.serversEmpty}
        </p>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="webphone-servers">
            {(provided) => (
              <ul
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex flex-col gap-3"
              >
                {state.servers.map((server, index) => (
                  <Draggable
                    key={server.id}
                    draggableId={server.id}
                    index={index}
                    isDragDisabled={disabled}
                  >
                    {(draggable) => (
                      <li ref={draggable.innerRef} {...draggable.draggableProps}>
                        <ServerCard
                          server={server}
                          position={index + 1}
                          total={state.servers.length}
                          state={state}
                          dragHandleProps={draggable.dragHandleProps}
                        />
                      </li>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>
      )}

      <form
        aria-label={copy.addServer}
        onSubmit={(event) => {
          event.preventDefault();
          void submitDraft();
        }}
        className="grid gap-4 rounded-lg border border-border p-4"
      >
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {copy.addServer}
        </h3>
        {/* Only the basics: a new server lands at the end of the chain with
            working defaults, and its advanced panel is one click away. */}
        <div className="grid gap-4 lg:grid-cols-2">
          <TextField
            label={copy.serverName}
            value={draft.name}
            maxLength={80}
            disabled={disabled}
            lang={state.lang}
            error={showDraftErrors ? draftErrors.name : undefined}
            onChange={(value) =>
              setDraft((current) => ({ ...current, name: value }))
            }
          />
          <TextField
            label={copy.sipDomain}
            value={draft.sipDomain}
            maxLength={253}
            disabled={disabled}
            lang={state.lang}
            placeholder="sip.example.com"
            error={showDraftErrors ? draftErrors.sipDomain : undefined}
            onChange={(value) =>
              setDraft((current) => ({ ...current, sipDomain: value }))
            }
          />
          <TextField
            label={copy.websocketUrl}
            value={draft.websocketUrl}
            maxLength={512}
            disabled={disabled}
            lang={state.lang}
            placeholder="wss://sip.example.com:8089/ws"
            error={showDraftErrors ? draftErrors.websocketUrl : undefined}
            onChange={(value) =>
              setDraft((current) => ({ ...current, websocketUrl: value }))
            }
          />
          <SelectField<WebphoneTransport>
            label={copy.serverProtocol}
            value={websocketProtocol(draft.websocketUrl)}
            disabled={disabled}
            lang={state.lang}
            help={copy.serverProtocolHelp}
            options={PROTOCOL_OPTIONS}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                websocketUrl: withWebsocketProtocol(current.websocketUrl, value),
              }))
            }
          />
        </div>

        <SwitchField
          label={copy.serverEnabledLabel}
          checked={draft.enabled}
          disabled={disabled}
          onChange={(checked) =>
            setDraft((current) => ({ ...current, enabled: checked }))
          }
        />

        {state.mutation.target === "server:new" &&
        state.mutation.phase === "FAILED" ? (
          <InlineError
            code={state.mutation.errorCode}
            details={state.mutation.details}
            lang={state.lang}
            render={webphoneErrorText}
          />
        ) : null}

        <div>
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={disabled}
            loading={addPending}
          >
            {addPending ? null : <Plus className="size-4" aria-hidden="true" />}
            {addPending ? copy.adding : copy.addServer}
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}
