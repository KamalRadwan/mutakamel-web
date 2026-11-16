"use client";

import {
  DegradedBanner,
  PermissionGate,
  UnavailableState,
  Field,
  FormDrawer,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/design-system";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { useI18n } from "@/i18n/I18nContext";
import {
  ACCESS_POLICY_BLOCKED_CODE,
  TEMPLATE_READ_PERMISSION,
  TEMPLATE_CODE_MAX,
  TEMPLATE_DESCRIPTION_MAX,
  TEMPLATE_DIRECTIONS,
  TEMPLATE_NAME_MAX,
} from "../templates-contract";
import type { useTemplateCreate, TemplateCreateValues } from "../hooks/useTemplateCreate";
import { templateCreationScopeKey } from "../hooks/useTemplateCreate";
import { formatStarterPresentation } from "../template-starter-presentation";
import { TemplateCreatePageSetup } from "./TemplateCreatePageSetup";
import { DEFAULT_TEMPLATE_PAGE, type TemplateCreatePageValues } from "../template-create-page";

const NO_STARTER = "__blank";

export function CreateTemplateDrawer({
  isOpen,
  browseStarters,
  create,
  onClose,
  onCloseAutoFocus,
}: {
  isOpen: boolean;
  browseStarters: boolean;
  create: ReturnType<typeof useTemplateCreate>;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const { t, lang } = useI18n();
  const copy = t.coreOperations.templates;
  const { values, change } = create;

  const close = () => {
    create.reset();
    onClose();
  };

  const detail = create.starterPresentation && formatStarterPresentation(create.starterPresentation, lang);
  const starterHint = detail ? copy.starterHint + " " + detail : copy.starterHint;
  const starterField = (
    <Field label={copy.starter} hint={create.isLoadingStarters ? t.common.loading : starterHint}>
      <Select
        value={values.starterKey || NO_STARTER}
        onValueChange={(value) => change({ starterKey: value === NO_STARTER ? "" : value })}
        disabled={create.isSubmitting || create.isLoadingStarters || (browseStarters && !create.hasCompatibleSource)}
      >
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_STARTER}>{copy.starterNone}</SelectItem>
          {create.starters.map((starter) => (
            <SelectItem key={starter.starterKey} value={starter.starterKey}>{starter.displayName}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      onCloseAutoFocus={onCloseAutoFocus}
      title={browseStarters ? copy.firstUse.browse : copy.createTitle}
      description={copy.createDescription}
      isDirty={values.name.length > 0 || values.code.length > 0 ||
        Object.entries(DEFAULT_TEMPLATE_PAGE).some(([field, value]) => values.page[field as keyof TemplateCreatePageValues] !== value)}
      isSubmitting={create.isSubmitting}
      onSubmit={() => void create.submit()}
      error={create.formError ?? undefined}
      submitDisabled={create.scope === null || !create.hasCompatibleSource}
      labels={{
        submit: t.common.create,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <div className="flex flex-col gap-4">
        {create.scopesUnavailable ? <DegradedBanner message={copy.scopesUnavailable} /> : null}
        {create.scopes.length === 0 && !create.scopesUnavailable ? (
          <DegradedBanner message={copy.noCreationScope} />
        ) : null}

        {create.sourceError?.status === 403 ? (
          create.sourceError.code === ACCESS_POLICY_BLOCKED_CODE ? <UnavailableState backHref={TENANT_ROUTES.core} /> :
            <PermissionGate require={TEMPLATE_READ_PERMISSION} denied>{null}</PermissionGate>
        ) : create.sourceError ? <DegradedBanner message={copy.sourcesUnavailable} /> : null}
        {!create.isLoadingSources && create.scope && !create.sourceError && !create.hasCompatibleSource ? (
          <DegradedBanner message={copy.noCompatibleSources} />
        ) : null}
        {create.starterError ? <DegradedBanner message={copy.startersUnavailable} /> : null}
        {browseStarters ? starterField : null}

        <Field label={copy.scope} hint={copy.scopeHint} required>
          <Select
            value={values.scopeKey}
            onValueChange={(value) => change({ scopeKey: value })}
            disabled={create.isSubmitting || create.scopes.length === 0}
          >
            <SelectTrigger textSize="compact" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent textSize="compact">
              {create.scopes.map((scope) => (
                <SelectItem key={templateCreationScopeKey(scope)} value={templateCreationScopeKey(scope)}>
                  {scope.label ?? copy.scopeTenant}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <TupleSelect
          label={copy.documentType}
          value={values.documentType}
          options={create.documentTypes}
          labels={copy.documentTypes}
          disabled={create.isSubmitting || !create.hasCompatibleSource}
          onChange={(value) =>
            change({ documentType: value as TemplateCreateValues["documentType"], starterKey: "" })
          }
        />
        <TupleSelect
          label={copy.outputChannel}
          value={values.outputChannel}
          options={create.outputChannels}
          labels={copy.outputChannels}
          disabled={create.isSubmitting || !create.hasCompatibleSource}
          onChange={(value) =>
            change({
              outputChannel: value as TemplateCreateValues["outputChannel"],
              starterKey: "",
            })
          }
        />
        <TupleSelect
          label={copy.layoutMode}
          value={values.layoutMode}
          options={create.layoutModes}
          labels={copy.layoutModes}
          disabled={create.isSubmitting || !create.hasCompatibleSource}
          onChange={(value) =>
            change({ layoutMode: value as TemplateCreateValues["layoutMode"], starterKey: "" })
          }
        />
        <TupleSelect
          label={copy.dataSource}
          value={values.dataSourceKey}
          options={create.adapterKeys}
          labels={copy.adapterKeys}
          disabled={create.isSubmitting || !create.hasCompatibleSource}
          onChange={(value) =>
            change({ dataSourceKey: value as TemplateCreateValues["dataSourceKey"], starterKey: "" })
          }
        />
        <TupleSelect
          label={copy.locale}
          value={values.locale}
          options={create.locales}
          labels={copy.locales}
          disabled={create.isSubmitting || !create.hasCompatibleSource}
          onChange={(value) =>
            change({ locale: value as TemplateCreateValues["locale"], starterKey: "" })
          }
        />
        <TupleSelect
          label={copy.direction}
          value={values.direction}
          options={TEMPLATE_DIRECTIONS}
          labels={copy.directions}
          disabled={create.isSubmitting || !create.hasCompatibleSource}
          onChange={(value) =>
            change({ direction: value as TemplateCreateValues["direction"], starterKey: "" })
          }
        />

        {browseStarters ? null : starterField}

        <TemplateCreatePageSetup values={values.page} outputChannel={values.outputChannel} disabled={create.isSubmitting}
          onChange={patch => change({ page: { ...values.page, ...patch } })} />

        <Field label={copy.code} hint={copy.codeHint} required>
          <Input size="sm" placeholder={copy.code}
            dir="ltr"
            value={values.code}
            onChange={(event) => change({ code: event.target.value.toUpperCase() })}
            maxLength={TEMPLATE_CODE_MAX}
            disabled={create.isSubmitting}
            required
          />
        </Field>

        <Field label={copy.name} required>
          <Input size="sm" placeholder={copy.name}
            value={values.name}
            onChange={(event) => change({ name: event.target.value })}
            maxLength={TEMPLATE_NAME_MAX}
            disabled={create.isSubmitting}
            required
          />
        </Field>

        <Field label={copy.description}>
          <Textarea placeholder={copy.description}
            value={values.description}
            onChange={(event) => change({ description: event.target.value })}
            maxLength={TEMPLATE_DESCRIPTION_MAX}
            disabled={create.isSubmitting}
          />
        </Field>
      </div>
    </FormDrawer>
  );
}

function TupleSelect({
  label,
  value,
  options,
  labels,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  labels: Record<string, string>;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} required>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {labels[option] ?? option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
