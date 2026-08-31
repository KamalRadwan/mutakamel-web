"use client";

import { RotateCw } from "lucide-react";
import { Button } from "@/design-system";
import { PageHeader } from "@/design-system";
import { useToast } from "@/components/ui/ToastContext";
import { useTenantWebphoneSettings } from "./hooks/useTenantWebphoneSettings";
import { WEBPHONE_COPY, webphoneErrorText } from "./webphone-copy";
import { WebphoneUnavailableNotice } from "./components/WebphoneUnavailableNotice";
import { TenantSeatCounter } from "./components/TenantSeatCounter";
import { ServerConfigSection } from "./components/ServerConfigSection";
import { EndpointsSection } from "./components/EndpointsSection";
import { IceServersSection } from "./components/IceServersSection";
import { TurnRestSection } from "./components/TurnRestSection";
import { ExtensionsSection } from "./components/ExtensionsSection";

const UNAVAILABLE_NOTICE_ID = "webphone-unavailable-notice";

/**
 * Tenant WebPhone settings.
 *
 * The screen renders whether or not the workspace is subscribed. A hidden
 * screen is undiscoverable — a customer never learns the module exists — so an
 * unsubscribed workspace gets the same screen, inert, with the reason stated.
 * The refusal that produces that state is an expected read outcome, not an
 * error, and is never surfaced as one.
 */
export default function TenantWebphoneSettingsPage() {
  const state = useTenantWebphoneSettings();
  const toast = useToast();
  const copy = WEBPHONE_COPY[state.lang];
  const describedBy = state.isSubscribed ? undefined : UNAVAILABLE_NOTICE_ID;

  const save = async () => {
    if (await state.saveConfig()) {
      toast.success(copy.savedNotice);
    } else {
      toast.error(
        copy.save,
        webphoneErrorText(
          state.mutation.errorCode,
          state.lang,
          state.mutation.details,
        ),
      );
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title={copy.title} subtitle={copy.subtitle}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void state.refetch()}
          disabled={state.loadState === "LOADING"}
        >
          <RotateCw
            className={`size-4 ${state.loadState === "LOADING" ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          {copy.reload}
        </Button>
      </PageHeader>

      {state.loadState === "LOADING" ? (
        <p
          role="status"
          className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900"
        >
          {copy.loading}
        </p>
      ) : state.loadState === "FORBIDDEN" ? (
        <p
          role="note"
          className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        >
          {copy.noReadPermission}
        </p>
      ) : state.loadState === "ERROR" ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
        >
          <span>{copy.loadFailed}</span>
          <Button variant="outline" size="sm" onClick={() => void state.refetch()}>
            <RotateCw className="size-4" aria-hidden="true" />
            {copy.retry}
          </Button>
        </div>
      ) : (
        <>
          {state.entitlement === "ACTIVE" ? null : (
            <WebphoneUnavailableNotice
              id={UNAVAILABLE_NOTICE_ID}
              entitlement={state.entitlement}
              lang={state.lang}
            />
          )}

          {state.isSubscribed && !state.canUpdateConfig ? (
            <p
              role="note"
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              {copy.readOnly}
            </p>
          ) : null}

          <TenantSeatCounter seats={state.seats} lang={state.lang} />

          {state.form ? (
            <>
              <ServerConfigSection
                state={state}
                describedBy={describedBy}
                onSave={() => void save()}
              />
              <EndpointsSection state={state} describedBy={describedBy} />
              <IceServersSection state={state} describedBy={describedBy} />
              <TurnRestSection state={state} describedBy={describedBy} />
            </>
          ) : null}

          <ExtensionsSection state={state} describedBy={describedBy} />
        </>
      )}
    </div>
  );
}
