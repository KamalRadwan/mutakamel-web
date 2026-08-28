"use client";

import { Phone } from "lucide-react";
import { useToast } from "@/components/ui/ToastContext";
import { SettingsResourceBoundary } from "../components/SettingsResourceBoundary";
import { useWebphoneSettings } from "./hooks/useWebphoneSettings";
import { WEBPHONE_COPY, webphoneErrorText } from "./webphone-copy";
import { ServerConfigSection } from "./components/ServerConfigSection";
import { EndpointsSection } from "./components/EndpointsSection";
import { IceServersSection } from "./components/IceServersSection";
import { TurnRestSection } from "./components/TurnRestSection";
import { ExtensionsSection } from "./components/ExtensionsSection";

export default function WebphoneSettingsPage() {
  const state = useWebphoneSettings();
  const toast = useToast();
  const copy = WEBPHONE_COPY[state.lang];

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
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Phone
            className="size-5 text-blue-600 dark:text-blue-400"
            aria-hidden="true"
          />
          {copy.title}
        </h1>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500 dark:text-slate-400">
          {copy.subtitle}
        </p>
      </header>

      <SettingsResourceBoundary
        state={state.loadState}
        error={state.loadError}
        lang={state.lang}
        onRetry={() => void state.refetch()}
      >
        {state.config && state.form ? (
          <>
            {!state.canUpdate ? (
              <p
                role="note"
                className="rounded-xl border border-slate-300 bg-slate-100 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {copy.readOnly}
              </p>
            ) : null}

            <ServerConfigSection state={state} onSave={() => void save()} />
            <EndpointsSection state={state} />
            <IceServersSection state={state} />
            <TurnRestSection state={state} />
            <ExtensionsSection state={state} />
          </>
        ) : null}
      </SettingsResourceBoundary>
    </div>
  );
}
