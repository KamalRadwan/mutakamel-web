"use client";

import {
  DegradedBanner,
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
import { useI18n } from "@/i18n/I18nContext";
import {
  TEMPLATE_ADAPTER_KEYS,
  TEMPLATE_CODE_MAX,
  TEMPLATE_DESCRIPTION_MAX,
  TEMPLATE_DIRECTIONS,
  TEMPLATE_DOCUMENT_TYPES,
  TEMPLATE_LAYOUT_MODES,
  TEMPLATE_LOCALES,
  TEMPLATE_NAME_MAX,
  TEMPLATE_OUTPUT_CHANNELS,
} from "../templates-contract";
import { useTemplateCreate, type TemplateCreateValues } from "../hooks/useTemplateCreate";

const NO_STARTER = "__blank";

export function CreateTemplateDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const copy = t.coreOperations.templates;
  const create = useTemplateCreate(isOpen);
  const { values, change } = create;

  const close = () => {
    create.reset();
    onClose();
  };

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={copy.createTitle}
      description={copy.createDescription}
      isDirty={values.name.length > 0 || values.code.length > 0}
      isSubmitting={create.isSubmitting}
      onSubmit={() => void create.submit()}
      error={create.formError ?? undefined}
      submitDisabled={create.scope === null}
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

        <Field label={copy.scope} hint={copy.scopeHint} required>
          <Select
            value={values.scopeIndex}
            onValueChange={(value) => change({ scopeIndex: value })}
            disabled={create.isSubmitting || create.scopes.length === 0}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {create.scopes.map((scope, index) => (
                <SelectItem key={`${scope.type}-${scope.companyId ?? "tenant"}`} value={String(index)}>
                  {scope.label ?? copy.scopeTenant}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <TupleSelect
          label={copy.documentType}
          value={values.documentType}
          options={TEMPLATE_DOCUMENT_TYPES}
          labels={copy.documentTypes}
          disabled={create.isSubmitting}
          onChange={(value) =>
            change({ documentType: value as TemplateCreateValues["documentType"], starterKey: "" })
          }
        />
        <TupleSelect
          label={copy.outputChannel}
          value={values.outputChannel}
          options={TEMPLATE_OUTPUT_CHANNELS}
          labels={copy.outputChannels}
          disabled={create.isSubmitting}
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
          options={TEMPLATE_LAYOUT_MODES}
          labels={copy.layoutModes}
          disabled={create.isSubmitting}
          onChange={(value) =>
            change({ layoutMode: value as TemplateCreateValues["layoutMode"], starterKey: "" })
          }
        />
        <TupleSelect
          label={copy.dataSource}
          value={values.dataSourceKey}
          options={TEMPLATE_ADAPTER_KEYS}
          labels={copy.adapterKeys}
          disabled={create.isSubmitting}
          onChange={(value) =>
            change({ dataSourceKey: value as TemplateCreateValues["dataSourceKey"], starterKey: "" })
          }
        />
        <TupleSelect
          label={copy.locale}
          value={values.locale}
          options={TEMPLATE_LOCALES}
          labels={copy.locales}
          disabled={create.isSubmitting}
          onChange={(value) =>
            change({ locale: value as TemplateCreateValues["locale"], starterKey: "" })
          }
        />
        <TupleSelect
          label={copy.direction}
          value={values.direction}
          options={TEMPLATE_DIRECTIONS}
          labels={copy.directions}
          disabled={create.isSubmitting}
          onChange={(value) =>
            change({ direction: value as TemplateCreateValues["direction"], starterKey: "" })
          }
        />

        <Field
          label={copy.starter}
          hint={create.isLoadingStarters ? t.common.loading : copy.starterHint}
        >
          <Select
            value={values.starterKey || NO_STARTER}
            onValueChange={(value) =>
              change({ starterKey: value === NO_STARTER ? "" : value })
            }
            disabled={create.isSubmitting || create.isLoadingStarters}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_STARTER}>{copy.starterNone}</SelectItem>
              {create.starters.map((starter) => (
                <SelectItem key={starter.starterKey} value={starter.starterKey}>
                  {starter.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={copy.code} hint={copy.codeHint} required>
          <Input
            dir="ltr"
            value={values.code}
            onChange={(event) => change({ code: event.target.value.toUpperCase() })}
            maxLength={TEMPLATE_CODE_MAX}
            disabled={create.isSubmitting}
            required
          />
        </Field>

        <Field label={copy.name} required>
          <Input
            value={values.name}
            onChange={(event) => change({ name: event.target.value })}
            maxLength={TEMPLATE_NAME_MAX}
            disabled={create.isSubmitting}
            required
          />
        </Field>

        <Field label={copy.description}>
          <Textarea
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
        <SelectTrigger>
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
