"use client";

import { useState } from "react";
import { Compass } from "lucide-react";
import {
  Button,
  DetailSection,
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import {
  TEMPLATE_ADAPTER_KEYS,
  TEMPLATE_DOCUMENT_TYPES,
  TEMPLATE_LOCALES,
  TEMPLATE_OUTPUT_CHANNELS,
} from "../../templates-contract";
import type { ResolvedAssignment } from "../../template-assignments-contract";

/**
 * "Which template actually renders for this selector, right now?"
 *
 * Priority and effective windows overlap and the server decides. Asking it
 * directly is the only way an operator can see the answer before a document
 * renders with the wrong template — which is the point at which the mistake
 * would otherwise become visible.
 */
export function ResolvePreviewPanel({
  resolved,
  isResolving,
  onResolve,
}: {
  resolved: ResolvedAssignment | null;
  isResolving: boolean;
  onResolve: (selector: Record<string, unknown>) => void;
}) {
  const { t, lang } = useI18n();
  const copy = t.coreOperations.templates;
  const [documentType, setDocumentType] = useState<string>(TEMPLATE_DOCUMENT_TYPES[0]);
  const [outputChannel, setOutputChannel] = useState<string>(TEMPLATE_OUTPUT_CHANNELS[0]);
  const [adapterKey, setAdapterKey] = useState<string>(TEMPLATE_ADAPTER_KEYS[0]);
  const [locale, setLocale] = useState<string>(TEMPLATE_LOCALES[0]);

  return (
    <DetailSection
      title={copy.resolveTitle}
      description={copy.resolveDescription}
      action={
        <Button
          variant="outline"
          size="sm"
          loading={isResolving}
          onClick={() =>
            onResolve({
              documentType,
              outputChannel,
              adapterKey,
              locale,
              scope: { type: "TENANT" },
            })
          }
        >
          <Compass className="size-4" aria-hidden="true" />
          {copy.resolveRun}
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={copy.documentType}>
          <Select value={documentType} onValueChange={setDocumentType} disabled={isResolving}>
            <SelectTrigger>
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

        <Field label={copy.outputChannel}>
          <Select value={outputChannel} onValueChange={setOutputChannel} disabled={isResolving}>
            <SelectTrigger>
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

        <Field label={copy.dataSource}>
          <Select value={adapterKey} onValueChange={setAdapterKey} disabled={isResolving}>
            <SelectTrigger>
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

        <Field label={copy.locale}>
          <Select value={locale} onValueChange={setLocale} disabled={isResolving}>
            <SelectTrigger>
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

      {resolved ? (
        <div className="flex flex-col gap-1 border-t border-border pt-3 text-sm">
          <span className="text-foreground">
            {resolved.chosen
              ? formatTemplate(copy.resolveChosen, {
                  version: String(resolved.chosen.versionNumber),
                  priority: String(resolved.chosen.priority),
                  localeMatch: resolved.chosen.localeMatch,
                })
              : copy.resolveNone}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatTemplate(copy.resolveEvaluatedAt, {
              at: formatDateTime(resolved.evaluatedAt, lang),
              count: String(resolved.eligibleCandidateCount),
            })}
          </span>
        </div>
      ) : null}
    </DetailSection>
  );
}
