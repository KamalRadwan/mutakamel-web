"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, Server } from "lucide-react";
import { Button } from "@/design-system";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { WEBPHONE_COPY, webphoneErrorText } from "../webphone-copy";
import type { WebphoneSettingsState } from "../hooks/useWebphoneSettings";
import { useOrderableList } from "../hooks/useOrderableList";
import {
  moveInList,
  newServerDto,
  type WebphoneServer,
} from "../webphone-contract";
import { InlineError, SaveStatus, SectionCard } from "./WebphoneFields";
import { ServerCard } from "./ServerCard";

/**
 * The failover chain as a list rather than a form.
 *
 * Position is the priority, so the order is edited by moving cards and written
 * as one `PUT /servers/order` carrying every id — never as an editable number
 * on a card, which would let two servers claim the same place.
 */
export function ServersSection({ state }: { state: WebphoneSettingsState }) {
  const copy = WEBPHONE_COPY[state.lang];
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<WebphoneServer | null>(
    null,
  );
  const pending = state.mutation.phase === "PENDING";

  // The optimistic order survives only until the authoritative reload lands;
  // any id it no longer knows about is dropped rather than rendered as a gap.
  const ordered = useMemo(() => {
    if (!pendingOrder) return state.servers;
    const byId = new Map(state.servers.map((server) => [server.id, server]));
    const listed = pendingOrder
      .map((id) => byId.get(id))
      .filter((server): server is WebphoneServer => Boolean(server));
    const missing = state.servers.filter(
      (server) => !pendingOrder.includes(server.id),
    );
    return [...listed, ...missing];
  }, [pendingOrder, state.servers]);

  const ids = useMemo(() => ordered.map((server) => server.id), [ordered]);

  const applyMove = async (from: number, to: number) => {
    const nextIds = moveInList(ids, from, to);
    setPendingOrder(nextIds);
    const succeeded = await state.reorderServers(nextIds);
    // Either way the server list is now authoritative: a success reloaded it,
    // a failure leaves the previous order standing.
    setPendingOrder(null);
    return succeeded;
  };

  const orderable = useOrderableList({
    ids,
    disabled: !state.canUpdate || pending,
    onMove: (from, to) => void applyMove(from, to),
  });

  const confirmDeletion = async () => {
    if (!pendingDeletion) return;
    if (await state.deleteServer(pendingDeletion.id)) setPendingDeletion(null);
  };

  return (
    <SectionCard
      title={copy.serversSection}
      help={copy.serversSectionHelp}
      icon={<Server className="size-4 text-info" aria-hidden="true" />}
    >
      {state.mutation.target === "servers:order" &&
      state.mutation.phase === "FAILED" ? (
        <InlineError
          code={state.mutation.errorCode}
          details={state.mutation.details}
          lang={state.lang}
          render={webphoneErrorText}
        />
      ) : null}

      <SaveStatus
        pending={pending && state.mutation.target === "servers:order"}
        saved={
          state.mutation.phase === "SUCCEEDED" &&
          state.mutation.target === "servers:order"
        }
        savingLabel={copy.reordering}
        savedLabel={copy.reorderSaved}
      />

      {ordered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          {copy.serversEmpty}
        </p>
      ) : (
        <ol className="grid gap-3">
          {ordered.map((server, index) => (
            <li key={server.id} {...orderable.rowProps(server.id)}>
              <ServerCard
                server={server}
                position={index + 1}
                total={ordered.length}
                state={state}
                orderable={orderable}
                onMoveUp={() => orderable.moveUp(index)}
                onMoveDown={() => orderable.moveDown(index)}
                onRequestDeletion={() => setPendingDeletion(server)}
              />
            </li>
          ))}
        </ol>
      )}

      {state.canUpdate ? <AddServerButton state={state} /> : null}

      <DestructiveActionModal
        isOpen={pendingDeletion !== null}
        onClose={() => setPendingDeletion(null)}
        onConfirm={() => void confirmDeletion()}
        title={copy.deleteServerTitle}
        description={copy.deleteServerDescription}
        targetName={pendingDeletion?.name ?? ""}
        actionType="delete"
        requireNameTyping={false}
        isSubmitting={pending}
        confirmLabel={copy.confirmDeleteServer}
        submittingLabel={copy.deleting}
      />
    </SectionCard>
  );
}

/**
 * Adds a server in one click, then gets out of the way.
 *
 * There is no create form: the card that appears is already the editor, so a
 * second set of the same four fields would only be a place for the two to
 * disagree. The row arrives disabled and carrying a placeholder identity, which
 * is why appending it to a live chain is safe.
 */
function AddServerButton({ state }: { state: WebphoneSettingsState }) {
  const copy = WEBPHONE_COPY[state.lang];
  const pending = state.mutation.phase === "PENDING";
  const creating = pending && state.mutation.target === "server:new";
  const created =
    state.mutation.phase === "SUCCEEDED" &&
    state.mutation.target === "server:new";

  return (
    <div className="grid gap-3 rounded-xl border border-dashed border-border p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="primary"
          disabled={pending}
          onClick={() =>
            void state.createServer(
              newServerDto(state.servers, copy.newServerName),
            )
          }
        >
          {creating ? (
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
          {creating ? copy.adding : copy.addServer}
        </Button>
        <SaveStatus
          pending={creating}
          saved={created}
          savingLabel={copy.adding}
          savedLabel={copy.added}
        />
      </div>
      <p className="max-w-2xl text-xs leading-5 text-muted-foreground">
        {copy.addServerHelp}
      </p>

      {state.mutation.target === "server:new" &&
      state.mutation.phase === "FAILED" ? (
        <InlineError
          code={state.mutation.errorCode}
          details={state.mutation.details}
          lang={state.lang}
          render={webphoneErrorText}
        />
      ) : null}
    </div>
  );
}
