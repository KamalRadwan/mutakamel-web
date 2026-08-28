"use client";

import { useState } from "react";
import { Loader2, Network, Plus, Save, Trash2 } from "lucide-react";
import { WEBPHONE_COPY, webphoneErrorText } from "../webphone-copy";
import type { WebphoneSettingsState } from "../hooks/useWebphoneSettings";
import {
  EMPTY_ENDPOINT_DRAFT,
  endpointDraftToDto,
  validateEndpointDraft,
  type EndpointDraft,
  type WebphoneEndpoint,
} from "../webphone-contract";
import { InlineError, SectionCard, SwitchField, TextField } from "./WebphoneFields";

export function EndpointsSection({ state }: { state: WebphoneSettingsState }) {
  const copy = WEBPHONE_COPY[state.lang];
  const [draft, setDraft] = useState<EndpointDraft>(EMPTY_ENDPOINT_DRAFT);
  const [showDraftErrors, setShowDraftErrors] = useState(false);
  const pending = state.mutation.phase === "PENDING";
  const draftErrors = validateEndpointDraft(draft);

  const submitDraft = async () => {
    setShowDraftErrors(true);
    if (Object.keys(draftErrors).length > 0) return;
    if (await state.createEndpoint(endpointDraftToDto(draft))) {
      setDraft(EMPTY_ENDPOINT_DRAFT);
      setShowDraftErrors(false);
    }
  };

  return (
    <SectionCard
      title={copy.endpointsSection}
      help={copy.endpointsSectionHelp}
      icon={<Network className="size-4 text-blue-500" aria-hidden="true" />}
    >
      {state.endpoints.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {copy.endpointsEmpty}
        </p>
      ) : (
        <ul className="space-y-3">
          {state.endpoints.map((endpoint) => (
            <li key={endpoint.id}>
              <EndpointRow endpoint={endpoint} state={state} />
            </li>
          ))}
        </ul>
      )}

      {state.canUpdate ? (
        <form
          aria-label={copy.addEndpoint}
          onSubmit={(event) => {
            event.preventDefault();
            void submitDraft();
          }}
          className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950"
        >
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">
            {copy.addEndpoint}
          </h3>
          <div className="grid gap-4 lg:grid-cols-3">
            <TextField
              label={copy.websocketUrl}
              value={draft.websocketUrl}
              maxLength={512}
              disabled={pending}
              lang={state.lang}
              placeholder="wss://sip.example.com:8089/ws"
              error={showDraftErrors ? draftErrors.websocketUrl : undefined}
              onChange={(value) =>
                setDraft((current) => ({ ...current, websocketUrl: value }))
              }
            />
            <TextField
              label={copy.endpointLabel}
              value={draft.label}
              maxLength={64}
              disabled={pending}
              lang={state.lang}
              error={showDraftErrors ? draftErrors.label : undefined}
              onChange={(value) =>
                setDraft((current) => ({ ...current, label: value }))
              }
            />
            <TextField
              label={copy.priority}
              value={draft.priority}
              maxLength={3}
              inputMode="numeric"
              disabled={pending}
              lang={state.lang}
              error={showDraftErrors ? draftErrors.priority : undefined}
              onChange={(value) =>
                setDraft((current) => ({ ...current, priority: value }))
              }
            />
          </div>
          <SwitchField
            label={copy.endpointEnabledLabel}
            checked={draft.enabled}
            disabled={pending}
            onChange={(checked) =>
              setDraft((current) => ({ ...current, enabled: checked }))
            }
          />
          {state.mutation.target === "endpoint:new" &&
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
              {pending && state.mutation.target === "endpoint:new" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="size-4" aria-hidden="true" />
              )}
              {pending && state.mutation.target === "endpoint:new"
                ? copy.adding
                : copy.addEndpoint}
            </button>
          </div>
        </form>
      ) : null}
    </SectionCard>
  );
}

function EndpointRow({
  endpoint,
  state,
}: {
  endpoint: WebphoneEndpoint;
  state: WebphoneSettingsState;
}) {
  const copy = WEBPHONE_COPY[state.lang];
  const [draft, setDraft] = useState<EndpointDraft>({
    label: endpoint.label ?? "",
    websocketUrl: endpoint.websocketUrl,
    priority: String(endpoint.priority),
    enabled: endpoint.enabled,
  });
  const [showErrors, setShowErrors] = useState(false);
  const errors = validateEndpointDraft(draft);
  const pending = state.mutation.phase === "PENDING";
  const target = `endpoint:${endpoint.id}` as const;
  const rowPending = pending && state.mutation.target === target;
  const dirty =
    draft.websocketUrl.trim() !== endpoint.websocketUrl ||
    draft.label.trim() !== (endpoint.label ?? "") ||
    Number(draft.priority) !== endpoint.priority;

  const save = async () => {
    setShowErrors(true);
    if (Object.keys(errors).length > 0) return;
    const label = draft.label.trim();
    await state.updateEndpoint(endpoint.id, {
      websocketUrl: draft.websocketUrl.trim(),
      priority: Number(draft.priority),
      label: label === "" ? null : label,
    });
  };

  return (
    <article
      aria-label={`${copy.endpointRegion}: ${endpoint.websocketUrl}`}
      className="grid gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700"
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <TextField
          label={copy.websocketUrl}
          value={draft.websocketUrl}
          maxLength={512}
          disabled={!state.canUpdate || pending}
          lang={state.lang}
          error={showErrors ? errors.websocketUrl : undefined}
          onChange={(value) =>
            setDraft((current) => ({ ...current, websocketUrl: value }))
          }
        />
        <TextField
          label={copy.endpointLabel}
          value={draft.label}
          maxLength={64}
          disabled={!state.canUpdate || pending}
          lang={state.lang}
          error={showErrors ? errors.label : undefined}
          onChange={(value) =>
            setDraft((current) => ({ ...current, label: value }))
          }
        />
        <TextField
          label={copy.priority}
          value={draft.priority}
          maxLength={3}
          inputMode="numeric"
          disabled={!state.canUpdate || pending}
          lang={state.lang}
          error={showErrors ? errors.priority : undefined}
          onChange={(value) =>
            setDraft((current) => ({ ...current, priority: value }))
          }
        />
      </div>

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
            endpoint.enabled
              ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
              : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          {endpoint.enabled ? copy.enabled : copy.disabled}
        </span>
        {state.canUpdate ? (
          <>
            <button
              type="button"
              onClick={() => void save()}
              disabled={pending || !dirty}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-800 dark:text-slate-200"
            >
              {rowPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-3.5" aria-hidden="true" />
              )}
              {copy.save}
            </button>
            <button
              type="button"
              onClick={() =>
                void state.updateEndpoint(endpoint.id, {
                  enabled: !endpoint.enabled,
                })
              }
              disabled={pending}
              aria-label={
                endpoint.enabled ? copy.toggleEndpointOff : copy.toggleEndpointOn
              }
              className="inline-flex min-h-9 items-center rounded-lg bg-slate-100 px-3 text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-800 dark:text-slate-200"
            >
              {endpoint.enabled ? copy.disable : copy.enable}
            </button>
            <button
              type="button"
              onClick={() => void state.deleteEndpoint(endpoint.id)}
              disabled={pending}
              aria-label={`${copy.removeEndpoint}: ${endpoint.websocketUrl}`}
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
