"use client";

import { RotateCw } from "lucide-react";
import { Button, Card, ErrorState, PageHeader } from "@/design-system";
import { useTenantWebphoneSettings } from "./hooks/useTenantWebphoneSettings";
import { WEBPHONE_COPY } from "./webphone-copy";
import { WebphoneUnavailableNotice } from "./components/WebphoneUnavailableNotice";
import { TenantSeatCounter } from "./components/TenantSeatCounter";
import { ServersSection } from "./components/ServersSection";
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
 *
 * There is no scope-level save. WebPhone has no stored scope settings any more:
 * `enabled` is derived from the servers below, so every write on this screen
 * belongs to a server, an ICE entry, or an extension, and is submitted from the
 * row that owns it.
 */
export default function TenantWebphoneSettingsPage() {
  const state = useTenantWebphoneSettings();
  const copy = WEBPHONE_COPY[state.lang];
  const describedBy = state.isSubscribed ? undefined : UNAVAILABLE_NOTICE_ID;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      {/* No filled action: with the scope-level save gone, every submit below
          is `secondary`. See docs/design/patterns.md#pageheader. */}
      <PageHeader
        title={copy.title}
        description={copy.subtitle}
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

          <ServersSection state={state} describedBy={describedBy} />

          <ExtensionsSection state={state} describedBy={describedBy} />
        </>
      )}
    </div>
  );
}
