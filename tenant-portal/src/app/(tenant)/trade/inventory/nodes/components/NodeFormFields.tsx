"use client";

import { Cloud, Lock, Store, Warehouse } from "lucide-react";
import {
  Badge,
  Button,
  cn,
  Field,
  Input,
  MultiSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SWATCH_SURFACE_PALETTES,
  type SwatchHue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import {
  COMMON_TIMEZONES,
  NODE_CODE_MAX_LENGTH,
  NODE_NAME_MAX_LENGTH,
  NODE_STATUSES,
  NODE_TIMEZONE_MAX_LENGTH,
  NODE_TYPES,
  type NodeFormValues,
} from "../../inventory-contract";
import { useNodeBranchOptions } from "../hooks/useNodeBranchOptions";

interface NodeFormFieldsProps {
  values: NodeFormValues;
  onChange: (patch: Partial<NodeFormValues>) => void;
  isSubmitting: boolean;
  /** `UpdateNodeDto` has no `code` or `nodeType` — both are fixed at create. */
  isEdit: boolean;
  errors?: Partial<Record<keyof NodeFormValues, string>>;
}

const NODE_TYPE_META: Record<
  NodeFormValues["nodeType"],
  { hue: SwatchHue; Icon: typeof Warehouse }
> = {
  WAREHOUSE: { hue: "indigo", Icon: Warehouse },
  STORE: { hue: "green", Icon: Store },
  VIRTUAL: { hue: "purple", Icon: Cloud },
};

export function NodeFormFields({
  values,
  onChange,
  isSubmitting,
  isEdit,
  errors,
}: NodeFormFieldsProps) {
  const { t, lang } = useI18n();
  const { preview: branchPreview, options: branchOptions } = useNodeBranchOptions(values.branchIds);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field showLabel
          label={t.tradeInventory.nodeCode}
          error={errors?.code}
          required
          readOnly={isEdit}
          hint={`${values.code.trim().length}/${NODE_CODE_MAX_LENGTH}`}
        >
          <Input
            size="sm"
            placeholder={t.tradeInventory.nodeCode}
            value={values.code}
            maxLength={NODE_CODE_MAX_LENGTH}
            readOnly={isEdit}
            disabled={isSubmitting}
            onChange={(event) => onChange({ code: event.target.value })}
          />
        </Field>

        <Field showLabel
          label={t.tradeInventory.nodeName}
          error={errors?.name}
          required
          hint={`${values.name.trim().length}/${NODE_NAME_MAX_LENGTH}`}
        >
          <Input
            size="sm"
            placeholder={t.tradeInventory.nodeName}
            value={values.name}
            maxLength={NODE_NAME_MAX_LENGTH}
            disabled={isSubmitting}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </Field>
      </div>

      {/* Interactive Node Archetype Cards + Accessible Select */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">
            {t.tradeInventory.nodeType}
          </span>
          {isEdit ? (
            <Badge tone="neutral">
              <Lock className="size-3" aria-hidden="true" />
              {t.tradeInventory.nodeImmutableHint}
            </Badge>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {NODE_TYPES.map((typeValue) => {
            const { hue, Icon } = NODE_TYPE_META[typeValue];
            const palette = SWATCH_SURFACE_PALETTES[hue];
            const active = values.nodeType === typeValue;
            return (
              <Button
                key={typeValue}
                type="button"
                variant="ghost"
                disabled={isSubmitting || isEdit}
                aria-pressed={active}
                onClick={() => onChange({ nodeType: typeValue })}
                className={cn(
                  "flex h-auto items-center justify-start gap-2.5 rounded-lg border p-3 text-start transition-all",
                  active ? palette.tileActive : palette.tileIdle,
                  (isSubmitting || isEdit) && "cursor-not-allowed opacity-70",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                    active ? palette.iconBoxActive : palette.iconBoxIdle,
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <span className="block truncate text-xs font-semibold">
                    {t.tradeStatus[typeValue]}
                  </span>
                </div>
              </Button>
            );
          })}
        </div>

        <Field showLabel label={t.tradeInventory.nodeType} required readOnly={isEdit} className="sr-only">
          <Select
            value={values.nodeType}
            disabled={isSubmitting || isEdit}
            onValueChange={(next) =>
              onChange({ nodeType: next as NodeFormValues["nodeType"] })
            }
          >
            <SelectTrigger size="sm" aria-label={t.tradeInventory.nodeType}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NODE_TYPES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t.tradeStatus[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Field showLabel
            label={t.tradeInventory.nodeTimezone}
            error={errors?.timezone}
            required
            hint={t.tradeInventory.nodeTimezoneHint}
          >
            <Input
              size="sm"
              placeholder={t.tradeInventory.nodeTimezone}
              value={values.timezone}
              maxLength={NODE_TIMEZONE_MAX_LENGTH}
              disabled={isSubmitting}
              onChange={(event) => onChange({ timezone: event.target.value })}
            />
          </Field>
          <div className="flex flex-wrap gap-1">
            {COMMON_TIMEZONES.map((tz) => (
              <Button
                key={tz}
                type="button"
                variant="ghost"
                size="sm"
                disabled={isSubmitting}
                onClick={() => onChange({ timezone: tz })}
                className={cn(
                  "h-auto rounded-md border px-2 py-0.5 font-mono text-2xs transition-colors",
                  values.timezone.trim() === tz
                    ? SWATCH_SURFACE_PALETTES.indigo.pillActive
                    : "border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {tz}
              </Button>
            ))}
          </div>
        </div>

        {isEdit ? (
          <Field showLabel label={t.common.status} required>
            <Select
              value={values.status}
              disabled={isSubmitting}
              onValueChange={(next) =>
                onChange({ status: next as NodeFormValues["status"] })
              }
            >
              <SelectTrigger size="sm" aria-label={t.common.status}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NODE_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t.tradeStatus[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
      </div>

      {/* Branch Assignment Studio */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">
            {t.tradeInventory.nodeBranches}
          </span>
          <Badge
            tone={
              branchPreview.validIds.length > 0 &&
              branchPreview.invalidEntries.length === 0
                ? "positive"
                : "caution"
            }
          >
            {`${formatNumber(branchPreview.validIds.length, lang)} / 100`}
          </Badge>
        </div>

        <Field showLabel
          label={t.tradeInventory.nodeBranches}
          error={errors?.branchIds}
          required
          hint={t.tradeInventory.nodeBranchesHint}
        >
          <MultiSelect textSize="compact" values={branchPreview.validIds} options={branchOptions}
            onValuesChange={(next) => onChange({ branchIds: next.join("\n") })}
            placeholder={t.common.selectBranch} disabled={isSubmitting}
            searchPlaceholder={t.common.searchBranches} emptyLabel={t.common.noMatchingBranches}
            moreLabel={t.crmLeads.card.moreTags} removeLabel={t.crmPipelines.removeChip}
            overflowLabel={t.tradeInventory.nodeBranches} />
        </Field>
      </div>
    </div>
  );
}

