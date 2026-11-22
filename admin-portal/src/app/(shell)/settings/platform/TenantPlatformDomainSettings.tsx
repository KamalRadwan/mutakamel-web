"use client";

import { Badge, Button, Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { SettingsResourceBoundary } from "../components/SettingsResourceBoundary";
import { SettingsSaveConfirmation } from "../components/SettingsSaveConfirmation";
import { useSettingsSaveConfirmation } from "../hooks/useSettingsSaveConfirmation";
import { useTenantPlatformDomain } from "../hooks/useTenantPlatformDomain";

export function matchesTenantPlatformDomainSearch(search: string) {
  const term = search.trim().toLowerCase();
  return !term || [en, ar].some((dictionary) => {
    const { title, description } = dictionary.settings.pages.platform.tenantPlatformDomain;
    return [title, description].some((value) => value.toLowerCase().includes(term));
  });
}

export function TenantPlatformDomainSettings({ lang, visible }: { lang: "ar" | "en"; visible: boolean }) {
  const copy = (lang === "ar" ? ar : en).settings.pages.platform.tenantPlatformDomain;
  const domain = useTenantPlatformDomain();
  const confirmation = useSettingsSaveConfirmation(domain.save);
  if (!visible) return null;
  const current = domain.options?.defaultDomain;
  const eligible = domain.options?.eligibleDomains ?? [];
  const isEligible = current != null && eligible.includes(current);
  const errorMessage = domain.stale
    ? copy.staleSelection
    : domain.ambiguous
      ? copy.unknownOutcome
      : domain.writeError?.httpStatus === 403
        ? copy.forbidden
        : domain.writeError
          ? copy.saveFailed
          : undefined;

  return (
    <section aria-labelledby="tenant-platform-domain-heading" className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="space-y-1">
        <h2 id="tenant-platform-domain-heading" className="text-sm font-semibold">{copy.title}</h2>
        <p className="text-xs text-muted-foreground">{copy.description}</p>
      </div>
      <SettingsResourceBoundary state={domain.loadState} error={domain.loadError} lang={lang} onRetry={() => void domain.reload()}>
        <p role="status" className="flex flex-wrap items-center gap-2 text-xs">
          <span>{copy.current}</span>
          {current ? <bdi className="break-all font-mono">{current}</bdi> : null}
          <Badge tone={isEligible ? "success" : "warn"}>
            {isEligible ? copy.configured : current ? copy.ineligible : copy.missing}
          </Badge>
        </p>
        {eligible.length === 0 ? <p className="text-xs text-muted-foreground">{copy.empty}</p> : null}
        {!domain.canWrite ? <p className="text-xs text-muted-foreground">{copy.forbidden}</p> : null}
        {eligible.length > 0 && domain.canWrite ? (
          <Field id="tenant-platform-domain-selection" label={copy.choose} error={errorMessage}>
            {(field) => (
              <Select value={domain.selected} onValueChange={domain.select} disabled={!domain.canSelect}>
                <SelectTrigger {...field} size="sm" className="w-full max-w-sm">
                  <SelectValue placeholder={copy.choose} />
                </SelectTrigger>
                <SelectContent>
                  {eligible.map((value) => <SelectItem key={value} value={value}><bdi>{value}</bdi></SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </Field>
        ) : null}
        {domain.writeError?.correlationId ? (
          <p className="text-xs text-muted-foreground">{copy.correlationId} <bdi>{domain.writeError.correlationId}</bdi></p>
        ) : null}
        {eligible.length > 0 && domain.canWrite ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={confirmation.request} disabled={!domain.canSave} loading={domain.isSaving}>
              {domain.ambiguous ? copy.retryExact : copy.save}
            </Button>
            {domain.stale ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => void domain.reload()} disabled={domain.isSaving}>
                {copy.reload}
              </Button>
            ) : null}
          </div>
        ) : null}
        <SettingsSaveConfirmation confirmation={confirmation} description={copy.confirm(domain.selected)} lang={lang} />
      </SettingsResourceBoundary>
    </section>
  );
}
