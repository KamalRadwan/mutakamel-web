"use client";
import Link from "next/link";
import { AlertTriangle, Settings, Workflow } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Checkbox, Collapsible,
  CollapsibleContent, CollapsibleTrigger, Field, IdentifierText, Input, useCan } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { formatNumber } from "@/lib/format/number";
import type { CrmSettingsView } from "../hooks/useCrmSettingsView";

export function CrmSettingsCards({ model, pipelineName }: { model: CrmSettingsView; pipelineName: string }) {
  const { t, lang } = useI18n();
  const s = t.crmSettings;
  const canReadPipelines = useCan("crm.pipelines.read");
  if (!model.settings || !model.draft) return null;
  const { settings, draft } = model;
  const readOnly = !model.canManage;
  return (
    <div className="grid items-start gap-4 xl:grid-cols-3">
      <div className="flex flex-col gap-4 xl:col-span-2">
        <Card>
          <CardHeader className="border-b border-border"><CardTitle>{s.conversionTitle}</CardTitle></CardHeader>
          <CardContent className="p-4">
            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox className="mt-0.5" checked={draft.requireQualifiedStageForConversion}
                onCheckedChange={(value) => model.setQualification(value === true)} disabled={model.isSaving || readOnly} />
              <span><span className="font-medium">{s.qualification}</span><span className="mt-1 block text-xs text-muted-foreground">{s.qualificationHelp}</span></span>
            </label>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b border-border"><CardTitle>{s.retentionTitle}</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3 p-4">
            <Field label={s.retentionPeriod} showLabel required readOnly={readOnly} hint={s.retentionHelp} error={model.errors.retention}>
              <div className="flex items-center gap-2"><Input type="number" min={30} max={2555} step={1} readOnly={readOnly} disabled={model.isSaving}
                value={Number.isNaN(draft.outboundEmailContentRetentionDays) ? "" : draft.outboundEmailContentRetentionDays}
                onChange={(event) => model.setRetention(event.target.valueAsNumber)} /><span className="text-xs text-muted-foreground">{s.days}</span></div>
            </Field>
            {model.isDirty && <p className="text-xs text-muted-foreground">{s.currentRetention}: {formatNumber(settings.outboundEmailContentRetentionDays, lang)} {s.days}</p>}
            <p className="text-xs leading-relaxed text-muted-foreground">{s.retentionScope}</p>
          </CardContent>
        </Card>
        {model.hasRetentionConflict && <p className="text-xs text-caution-800 dark:text-caution-300">{s.reviewBeforeSave}</p>}
        <div><Button variant="outline" size="sm" onClick={model.discard} disabled={readOnly || !model.isDirty || model.isSaving || model.needsReview}>{s.reset}</Button></div>
      </div>
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader className="border-b border-border"><CardTitle>{s.serverState}</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3 p-4">
            <dl className="divide-y divide-border text-sm">
              <div className="flex flex-wrap justify-between gap-2 pb-3"><dt className="text-muted-foreground">{s.defaultPipeline}</dt><dd>{pipelineName}</dd></div>
              <div className="flex items-center justify-between gap-2 pt-3"><dt className="text-muted-foreground">{s.asterisk}</dt><dd><Badge tone="neutral">{settings.asteriskIntegration.enabled ? s.telephonyEnabled : s.telephonyDisabled}</Badge></dd></div>
            </dl>
            {canReadPipelines && <Button variant="outline" size="sm" asChild><Link href={TENANT_ROUTES.crmPipelines}><Workflow className="size-4" aria-hidden="true" />{s.managePipelines}</Link></Button>}
            <Collapsible><CollapsibleTrigger>{s.technicalDetails}</CollapsibleTrigger><CollapsibleContent><dl className="space-y-2 pt-2 text-xs"><div><dt>{s.defaultPipeline}</dt><dd><IdentifierText>{settings.defaultPipelineId}</IdentifierText></dd></div><div><dt>{s.policyRevision}</dt><dd><IdentifierText>{settings.outboundEmailRetentionPolicyRevision}</IdentifierText></dd></div></dl></CollapsibleContent></Collapsible>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b border-border"><CardTitle>{s.telephonyTitle}</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-start gap-3 p-4"><p className="text-sm text-muted-foreground">{s.telephonyDescription}</p>
            <Button variant="outline" size="sm" onClick={model.openTelephony}><Settings className="size-4" aria-hidden="true" />{s.openTelephony}</Button>
            {settings.asteriskIntegration.allowInvalidTlsCertificate && <p role="status" className="flex gap-2 text-xs text-caution-800 dark:text-caution-300"><AlertTriangle className="size-4 shrink-0" aria-hidden="true" />{s.existingTlsWarning}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
