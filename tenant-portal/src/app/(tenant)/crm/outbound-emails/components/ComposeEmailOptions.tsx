"use client";

import {
  Badge, Button, DegradedBanner, EmptyState, ErrorState, Field,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { useOutboundEmailComposer } from "../hooks/useOutboundEmailComposer";
import { recipientKey, type useComposeEmailForm } from "../hooks/useComposeEmailForm";

export function ComposeEmailOptions({ composer, form }: {
  composer: ReturnType<typeof useOutboundEmailComposer>;
  form: ReturnType<typeof useComposeEmailForm>;
}) {
  const { t, lang } = useI18n();
  const copy = t.crmOutboundEmails;
  if (composer.isLoadingOptions) return <Skeleton className="h-32 w-full" />;
  if (composer.optionsError?.status === 403) return <DegradedBanner message={copy.sourceAccess} />;
  if (composer.optionsError) return <ErrorState title={copy.optionsFailed}
    description={copy.errors[composer.optionsError.code ?? ""] ?? copy.optionsFailedHint}
    retryLabel={t.common.retry} onRetry={form.reloadOptions} />;
  if (!form.options) return <EmptyState title={copy.chooseSource} description={copy.chooseSourceHint} />;
  return <>
    {form.options.availability.map((reason) => <EmptyState key={reason}
      title={copy.unavailableTitles[reason]} description={copy.unavailableDescriptions[reason]}
      action={{ label: copy.reloadOptions, onClick: form.reloadOptions }} />)}
    <Field showLabel label={copy.recipient} required>
      <Select value={form.recipientId || undefined} disabled={form.frozen || !form.options.recipients.length} onValueChange={form.changeRecipient}>
        <SelectTrigger size="sm"><SelectValue placeholder={copy.recipientPlaceholder} /></SelectTrigger>
        <SelectContent>{form.options.recipients.map((option) => <SelectItem key={recipientKey(option.reference)} value={recipientKey(option.reference)}>
          <bdi>{option.displayName} · {option.maskedAddress}</bdi>
        </SelectItem>)}</SelectContent>
      </Select>
    </Field>
    <Field showLabel label={copy.template} hint={copy.templateHint}>
      <Select value={form.chosenTemplateVersionId || undefined} disabled={form.frozen || !form.options.templates.length} onValueChange={form.changeTemplate}>
        <SelectTrigger size="sm"><SelectValue placeholder={copy.templatePlaceholder} /></SelectTrigger>
        <SelectContent>{form.options.templates.map((template) => <SelectItem key={template.templateVersionId} value={template.templateVersionId}>
          <bdi>{template.name} · {copy.version} {new Intl.NumberFormat(`${lang}-u-nu-latn`, { useGrouping: false }).format(template.versionNumber)} · {template.locale}</bdi>
        </SelectItem>)}</SelectContent>
      </Select>
    </Field>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Badge tone="neutral">{copy.locale}: <bdi>{form.options.resolvedLocale}</bdi></Badge>
      <Button size="sm" variant="outline" disabled={!form.canSend || composer.isPreviewing} loading={composer.isPreviewing} onClick={form.preview}>{copy.preview}</Button>
    </div>
    {composer.previewError && <DegradedBanner message={copy.previewFailed} />}
    {composer.preview && <section className="rounded-lg border border-border bg-muted p-3" aria-label={copy.preview} dir={composer.preview.direction === "RTL" ? "rtl" : "ltr"}>
      <h3 className="text-sm font-medium text-foreground">{composer.preview.subject}</h3>
      {composer.preview.preheader && <p className="mt-1 text-xs text-muted-foreground">{composer.preview.preheader}</p>}
      <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-sans text-sm text-foreground">{composer.preview.bodyText}</pre>
      <p className="mt-3 text-xs text-muted-foreground">{copy.templateReadOnly}</p>
    </section>}
  </>;
}
