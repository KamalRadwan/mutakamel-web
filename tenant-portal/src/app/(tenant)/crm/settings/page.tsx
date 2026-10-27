"use client";

import { AlertTriangle, RotateCw, Save } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DegradedBanner,
  ErrorState,
  Field,
  IdentifierText,
  Input,
  NAV_SECTIONS,
  PageHeader,
  PermissionGate,
  SubNav,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useCrmSettings } from "./hooks/useCrmSettings";
import { useCrmSettingsNames } from "./hooks/useCrmSettingsNames";

const CRM_SETUP_ITEMS = NAV_SECTIONS.find((section) => section.id === "crmSetup")?.items ?? [];

export default function CrmSettingsPage() {
  const { t } = useI18n();
  const {
    settings,
    draft,
    setDraft,
    isLoading,
    isSaving,
    isDirty,
    canManage,
    error,
    queryError,
    hasRetentionConflict,
    reloadRetentionPolicy,
    fetchSettings,
    resetDraft,
    saveSettings,
  } = useCrmSettings();
  const { stageName, pipelineName } = useCrmSettingsNames(settings?.defaultLeadStageId, settings?.defaultPipelineId);

  // A CRM route is reachable by direct URL even when the sidebar hides it, so
  // the 403 is reachable in-body and gets the mandated surface rather than a
  // load error — AGENTS.md, docs/design/states.md. Permission string and
  // scoping mirror CRM_ENTRY_ROUTES in src/lib/navigation/tenant-routes.ts.
  return (
    <PermissionGate require="crm.settings.read" denied={queryError?.status === 403}>
      <div className="flex flex-col gap-4">
        <PageHeader className="sr-only" title={t.crm.cRMGeneralSettingsModule} description={t.crm.customizeAutomatedDistributi} />

        <SubNav items={CRM_SETUP_ITEMS} />

        {settings && draft && (error || hasRetentionConflict) && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-negative-200 bg-negative-100 p-2.5 text-xs text-negative-800 dark:border-negative-800 dark:bg-negative-950 dark:text-negative-300">
            <div>
              <p>{hasRetentionConflict ? t.crmSettings.retentionConflict : error}</p>
              {hasRetentionConflict && error && <p>{error}</p>}
            </div>
            <Button variant="outline" size="sm" onClick={() => void (hasRetentionConflict ? reloadRetentionPolicy() : fetchSettings())} disabled={isLoading || isSaving}>
              <RotateCw className="size-4" aria-hidden="true" />
              {hasRetentionConflict ? t.crmSettings.reloadRetentionPolicy : t.crmSettings.retry}
            </Button>
          </div>
        )}

        {!canManage && settings && <DegradedBanner message={t.crmSettings.readOnly} />}

        {isLoading ? (
          <Card>
            <CardContent className="p-3 sm:p-3.5 text-center text-xs text-muted-foreground">{t.crmSettings.loading}</CardContent>
          </Card>
        ) : !settings || !draft ? (
          <div role="alert">
            <ErrorState title={t.crmSettings.unavailable} description={error ?? undefined} onRetry={() => void fetchSettings()} retryLabel={t.crmSettings.retry} />
          </div>
        ) : (
          <>
            <Card>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveSettings();
                }}
              >
                <CardContent className="flex flex-col gap-3 p-3 sm:p-3.5">
                  <label className="flex items-start gap-2.5 text-sm text-foreground">
                    <Checkbox
                      className="mt-0.5"
                      checked={draft.requireQualifiedStageForConversion}
                      onCheckedChange={(checked) =>
                        setDraft((current) =>
                          current ? { ...current, requireQualifiedStageForConversion: checked === true } : current,
                        )
                      }
                      disabled={isSaving || !canManage}
                    />
                    {t.crmSettings.qualification}
                  </label>

                  <div className="max-w-sm">
                    <Field label={t.crmSettings.retention} hint={t.crmSettings.retentionHelp} required>
                      <Input size="sm"
                        type="number"
                        min={30}
                        max={2555}
                        step={1}
                        placeholder={t.crmSettings.retention}
                        value={Number.isNaN(draft.outboundEmailContentRetentionDays) ? "" : draft.outboundEmailContentRetentionDays}
                        onChange={(event) =>
                          setDraft((current) =>
                            current ? { ...current, outboundEmailContentRetentionDays: event.target.valueAsNumber } : current,
                          )
                        }
                        disabled={isSaving || !canManage}
                        required
                      />
                    </Field>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.crmSettings.currentRetention}: <IdentifierText>{settings.outboundEmailContentRetentionDays}</IdentifierText>
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
                    <Button size="sm" type="button" variant="ghost" onClick={resetDraft} disabled={!canManage || !isDirty || isSaving}>
                      {t.crmSettings.reset}
                    </Button>
                    <Button size="sm" type="submit" variant="primary" loading={isSaving} disabled={!canManage || !isDirty || isSaving || hasRetentionConflict}>
                      {!isSaving && <Save className="size-4" aria-hidden="true" />}
                      {isSaving ? t.crmSettings.saving : t.crmSettings.save}
                    </Button>
                  </div>
                </CardContent>
              </form>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t.crmSettings.serverState}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 p-3 sm:p-3.5 pt-0">
                <dl className="grid gap-4 text-xs md:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">{t.crmSettings.defaultLeadStage}</dt>
                    <dd className="mt-1 text-foreground">
                      {stageName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t.crmSettings.defaultPipeline}</dt>
                    <dd className="mt-1 text-foreground">
                      {pipelineName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t.crmSettings.asterisk}</dt>
                    <dd className="mt-1">
                      <Badge tone={settings.asteriskIntegration.enabled ? "positive" : "neutral"}>
                        {settings.asteriskIntegration.enabled ? t.common.active : t.common.inactive}
                      </Badge>
                    </dd>
                  </div>
                </dl>
                <Collapsible>
                  <CollapsibleTrigger>{t.crmSettings.technicalDetails}</CollapsibleTrigger>
                  <CollapsibleContent>
                    <dl className="grid gap-3 pt-3 text-xs">
                      <div><dt>{t.crmSettings.defaultLeadStage}</dt><dd><IdentifierText>{settings.defaultLeadStageId ?? t.crmSettings.notSet}</IdentifierText></dd></div>
                      <div><dt>{t.crmSettings.defaultPipeline}</dt><dd><IdentifierText>{settings.defaultPipelineId}</IdentifierText></dd></div>
                      <div><dt>{t.crmSettings.policyRevision}</dt><dd><IdentifierText>{settings.outboundEmailRetentionPolicyRevision}</IdentifierText></dd></div>
                    </dl>
                  </CollapsibleContent>
                </Collapsible>
                {settings.asteriskIntegration.allowInvalidTlsCertificate && (
                  <p className="flex gap-2 rounded-sm border border-caution-200 bg-caution-100 p-2.5 text-xs text-caution-800 dark:border-caution-800 dark:bg-caution-950 dark:text-caution-300">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {t.crmSettings.insecureTls}
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PermissionGate>
  );
}
