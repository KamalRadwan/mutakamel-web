"use client";

import { Compass } from "lucide-react";
import {
  Button,
  DetailSection,
  Field,
  IdentifierText,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import {
  TEMPLATE_ADAPTER_KEYS,
  TEMPLATE_DOCUMENT_TYPES,
  TEMPLATE_LOCALES,
  TEMPLATE_OUTPUT_CHANNELS,
} from "../../templates-contract";
import { isSalesQuotationSelector, type AssignmentSelector, type ResolvedAssignment } from "../../template-assignments-contract";

export function ResolvePreviewPanel({
  selector,
  resolved: result,
  isResolving,
  onChange,
  onResolve,
}: {
  selector: Omit<AssignmentSelector, "scope">;
  resolved: ResolvedAssignment | null;
  isResolving: boolean;
  onChange: (patch: Partial<Omit<AssignmentSelector, "scope">>) => void;
  onResolve: () => void;
}) {
  const { t, lang, dir } = useI18n();
  const copy = t.coreOperations.templates;
  const { documentType, outputChannel, adapterKey, locale } = selector;

  return (
    <DetailSection
      title={copy.resolveTitle}
      description={copy.resolveDescription}
      action={
        <Button
          variant="outline"
          size="sm"
          loading={isResolving}
          onClick={onResolve}
        >
          <Compass className="size-4" aria-hidden="true" />
          {copy.resolveRun}
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={copy.documentType} showLabel>
          <Select dir={dir} value={documentType} onValueChange={(value) => onChange({ documentType: value })} disabled={isResolving}>
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATE_DOCUMENT_TYPES.map((value) => (
                <SelectItem key={value} value={value}>
                  {copy.documentTypes[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={copy.outputChannel} showLabel>
          <Select dir={dir} value={outputChannel} onValueChange={(value) => onChange({ outputChannel: value })} disabled={isResolving}>
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATE_OUTPUT_CHANNELS.map((value) => (
                <SelectItem key={value} value={value}>
                  {copy.outputChannels[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={copy.dataSource} showLabel>
          <Select dir={dir} value={adapterKey} onValueChange={(value) => onChange({ adapterKey: value })} disabled={isResolving}>
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATE_ADAPTER_KEYS.map((value) => (
                <SelectItem key={value} value={value}>
                  {copy.adapterKeys[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={copy.locale} showLabel>
          <Select dir={dir} value={locale} onValueChange={(value) => onChange({ locale: value })} disabled={isResolving}>
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATE_LOCALES.map((value) => (
                <SelectItem key={value} value={value}>
                  {copy.locales[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {result ? (
        <div role="status" className="flex flex-col gap-1 border-t border-border pt-3 text-sm">
          <span className="text-foreground">
            {result.chosen
              ? formatTemplate(copy.resolveChosen, {
                  version: formatNumber(result.chosen.version.number, lang),
                  priority: formatNumber(result.chosen.priority, lang),
                  localeMatch: result.chosen.localeMatch === "EXACT"
                    ? copy.locales[locale as keyof typeof copy.locales]
                    : copy.assignmentDefaultLocale,
                })
              : copy.resolveNone}
          </span>
          {result.chosen ? (
            <>
              <span className="text-xs text-muted-foreground">{copy.scopeTypes[result.chosen.matchedScope.type]}</span>
              {isSalesQuotationSelector(selector) ? (
                <span className="text-xs text-muted-foreground">
                  {copy.definitionTitle} <IdentifierText selectAll>{result.chosen.version.definitionId}</IdentifierText>
                </span>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {copy.assignmentVersionId} <IdentifierText selectAll>{result.chosen.version.id}</IdentifierText>
              </span>
            </>
          ) : null}
          <span className="text-xs text-muted-foreground">
            {formatDateTime(result.evaluatedAt, lang)}
          </span>
        </div>
      ) : null}
    </DetailSection>
  );
}
