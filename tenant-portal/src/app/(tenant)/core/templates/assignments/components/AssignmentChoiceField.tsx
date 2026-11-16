"use client";

import { Button, DegradedBanner, Field, NameSelect, PermissionGate } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";
import { TEMPLATE_READ_PERMISSION } from "../../templates-contract";

export function AssignmentChoiceField({ label, options, value, onChange, disabled, empty, failure, page }: {
  label: string;
  options: readonly { value: string; label: string }[];
  value?: string;
  onChange: (value: string) => void;
  disabled: boolean;
  empty: string;
  failure: string;
  page: {
    isLoading: boolean;
    error?: NormalizedApiError;
    canGoBack: boolean;
    canGoNext: boolean;
    wasReset: boolean;
    goBack: () => void;
    goNext: () => void;
    reload: () => void;
  };
}) {
  const { t } = useI18n();
  if (page.error?.status === 403) return <PermissionGate require={TEMPLATE_READ_PERMISSION} denied>{null}</PermissionGate>;
  return (
    <div className="flex flex-col gap-2">
      <Field label={label} showLabel required>
        <NameSelect value={value} options={options} onValueChange={onChange} placeholder={t.coreIdentity.picker.placeholder}
          disabled={disabled || page.isLoading || Boolean(page.error) || options.length === 0} />
      </Field>
      <div role="status" className="empty:hidden text-xs text-muted-foreground">
        {page.isLoading ? t.common.loading : (!page.error && options.length === 0 ? empty : null)}
      </div>
      {page.error ? (
        <div className="flex flex-wrap items-center gap-2">
          <DegradedBanner message={failure} />
          <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={page.reload}>{t.common.retry}</Button>
        </div>
      ) : null}
      {page.wasReset ? <DegradedBanner message={t.coreOperations.templates.cursorExpired} /> : null}
      {page.canGoBack || page.canGoNext ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={page.goBack}
            disabled={disabled || page.isLoading || !page.canGoBack}>{t.common.previousPage}</Button>
          <Button type="button" size="sm" variant="outline" onClick={page.goNext}
            disabled={disabled || page.isLoading || !page.canGoNext}>{t.common.nextPage}</Button>
        </div>
      ) : null}
    </div>
  );
}
