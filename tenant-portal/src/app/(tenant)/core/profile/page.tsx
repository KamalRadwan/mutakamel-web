"use client";

import { RefreshCw } from "lucide-react";
import {
  Button,
  CORE_IDENTITY_NAV_ITEMS,
  DetailSection,
  ErrorState,
  Field,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  SubNav,
} from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { useCoreErrorText } from "../hooks/useCoreErrorText";
import { useTenantProfilePreferences } from "./hooks/useTenantProfilePreferences";

export default function TenantProfilePage() {
  const screen = useTenantProfilePreferences();
  const { t, lang } = screen;
  const copy = t.coreIdentity.profile;
  const describeError = useCoreErrorText();
  const writeText = describeError(screen.writeError);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={copy.title}
        description={copy.subtitle}
        secondaryActions={
          <Button variant="outline" onClick={screen.reload} disabled={screen.isLoading}>
            <RefreshCw
              className={`size-4 ${screen.isLoading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {t.common.retry}
          </Button>
        }
      />

      <SubNav items={CORE_IDENTITY_NAV_ITEMS} />

      {writeText ? (
        <p
          role="alert"
          className="rounded-sm border border-negative-200 bg-negative-100 p-2.5 text-xs text-negative-800 dark:border-negative-800 dark:bg-negative-950 dark:text-negative-300"
        >
          {copy.saveFailed} {writeText}
        </p>
      ) : null}

      {screen.loadError ? (
        <ErrorState
          title={copy.loadFailed}
          description={describeError(screen.loadError)}
          onRetry={screen.reload}
          retryLabel={t.common.retry}
        />
      ) : screen.isLoading ? (
        <div className="flex flex-col gap-3" role="status" aria-busy="true">
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <>
          <DetailSection title={copy.preferences} description={copy.preferencesDescription}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={copy.theme} hint={copy.themeHint}>
                <Select
                  value={screen.theme}
                  onValueChange={(next) => {
                    const match = screen.themes.find((theme) => theme === next);
                    if (match) screen.setThemePreference(match);
                  }}
                  disabled={screen.isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {screen.themes.map((theme) => (
                      <SelectItem key={theme} value={theme}>
                        {copy.themes[theme]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label={copy.language} hint={copy.languageHint}>
                <Select
                  value={lang}
                  onValueChange={(next) => {
                    const match = screen.languages.find((language) => language === next);
                    if (match) screen.setLanguagePreference(match);
                  }}
                  disabled={screen.isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {screen.languages.map((language) => (
                      <SelectItem key={language} value={language}>
                        {copy.languages[language]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </DetailSection>

          <DetailSection
            title={copy.serverCopy}
            description={copy.serverCopyDescription}
            emptyValueLabel={t.detail.notRecorded}
            fields={[
              {
                label: copy.theme,
                value: screen.serverTheme
                  ? copy.themes[screen.serverTheme]
                  : screen.profile?.themeKey,
              },
              {
                label: copy.language,
                value: screen.serverLanguage
                  ? copy.languages[screen.serverLanguage]
                  : screen.profile?.language,
              },
              {
                label: copy.lastSaved,
                value: screen.savedAt ? formatDateTime(screen.savedAt, lang) : null,
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
