"use client";

import { Files } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { TemplateDocumentType } from "../templates-contract";

export function TemplateFirstUse({
  canCreate,
  documentTypes,
  scopeLabel,
  onCreate,
  onChoose,
  onBrowse,
}: {
  canCreate: boolean;
  documentTypes: readonly TemplateDocumentType[];
  scopeLabel: string | null;
  onCreate: (trigger: HTMLButtonElement) => void;
  onChoose: (documentType: TemplateDocumentType, trigger: HTMLButtonElement) => void;
  onBrowse?: (trigger: HTMLButtonElement) => void;
}) {
  const { t } = useI18n();
  const copy = t.coreOperations.templates;
  const firstUse = copy.firstUse;

  return (
    <Card>
      <CardContent className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 py-10 text-center sm:py-14">
        <Files className="size-10 text-brand-600" aria-hidden="true" />
        {canCreate && <Badge tone="brand">{firstUse.empty}</Badge>}
        <h2 className="text-xl font-semibold text-foreground">{canCreate ? firstUse.title : firstUse.empty}</h2>
        {canCreate && (
          <>
            <p className="text-sm text-muted-foreground">{firstUse.description}</p>
            {scopeLabel && documentTypes.length > 0 && (
              <fieldset className="w-full">
                <legend className="mx-auto text-sm font-medium text-foreground">{firstUse.choose}</legend>
                <p className="mb-3 mt-1 text-sm text-muted-foreground">{scopeLabel}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {documentTypes.map(documentType => (
                    <Button key={documentType} type="button" variant="outline" size="md"
                      className="h-auto min-h-11 whitespace-normal" onClick={event => onChoose(documentType, event.currentTarget)}>
                      {copy.documentTypes[documentType]}
                    </Button>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" variant="primary" onClick={event => onCreate(event.currentTarget)}>{copy.createTitle}</Button>
              {onBrowse && <Button type="button" variant="outline" onClick={event => onBrowse(event.currentTarget)}>{firstUse.browse}</Button>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
