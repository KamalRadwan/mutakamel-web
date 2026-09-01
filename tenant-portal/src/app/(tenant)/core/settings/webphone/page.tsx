"use client";

import { RotateCw } from "lucide-react";
import { Button, Card, ErrorState, PageHeader, useToast } from "@/design-system";
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
  const pending = state.mutation.phase === "PENDING";
  const savePending = pending && state.mutation.target === "config";

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
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      {/* The screen's one filled action lives here and nowhere else — every
          "Add" submit below is `secondary`. See docs/design/patterns.md#pageheader. */}
      <PageHeader
        title={copy.title}
        description={copy.subtitle}
        primaryAction={
          state.form
            ? {
                label: savePending ? copy.saving : copy.save,
                onClick: () => void save(),
                disabled:
                  !state.canUpdateConfig || pending || !state.hasUnsavedChanges,
                loading: savePending,
              }
            : undefined
        }
        secondaryActions={
          <Button
            variant="outline"
            onClick={() => void state.refetch()}
            disabled={state.loadState === "LOADING"}
          >
            <RotateCw
              className={
                state.loadState === "LOADING" ? "size-4 animate-spin" : "size-4"
              }
              aria-hidden="true"
            />
            {copy.reload}
          </Button>
        }
      />

      {state.loadState === "LOADING" ? (
        <Card role="status" className="p-8 text-center text-xs text-muted-foreground">
          {copy.loading}
        </Card>
      ) : state.loadState === "FORBIDDEN" ? (
        <Card
          role="note"
          level="sunken"
          className="max-w-prose p-4 text-xs text-muted-foreground"
        >
          {copy.noReadPermission}
        </Card>
      ) : state.loadState === "ERROR" ? (
        <div role="alert">
          <ErrorState
            title={copy.loadFailed}
            onRetry={() => void state.refetch()}
            retryLabel={copy.retry}
          />
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
            <Card
              role="note"
              level="sunken"
              className="max-w-prose p-4 text-xs text-muted-foreground"
            >
              {copy.readOnly}
            </Card>
          ) : null}

          <TenantSeatCounter seats={state.seats} lang={state.lang} />

          {state.form ? (
            <>
              <ServerConfigSection state={state} describedBy={describedBy} />
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
