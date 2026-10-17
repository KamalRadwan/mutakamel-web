"use client";

import { Cloud, Lock, Store, Warehouse } from "lucide-react";
import {
  Badge,
  Button,
  cn,
  Field,
  IdentifierText,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SWATCH_SURFACE_PALETTES,
  Textarea,
  type SwatchHue,
} from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import {
  COMMON_TIMEZONES,
  NODE_CODE_MAX_LENGTH,
  NODE_NAME_MAX_LENGTH,
  NODE_STATUSES,
  NODE_TIMEZONE_MAX_LENGTH,
  NODE_TYPES,
  parseBranchIdsPreview,
  type NodeFormValues,
} from "../../inventory-contract";

interface NodeFormFieldsProps {
  values: NodeFormValues;
  onChange: (patch: Partial<NodeFormValues>) => void;
  isSubmitting: boolean;
  /** `UpdateNodeDto` has no `code` or `nodeType` — both are fixed at create. */
  isEdit: boolean;
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
}: NodeFormFieldsProps) {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const { branchIds: availableBranchIds } = useTenantBranchSelection(user);

  const branchPreview = parseBranchIdsPreview(values.branchIds);

  const toggleBranchId = (id: string) => {
    if (isSubmitting) return;
    const current = branchPreview.validIds;
    const next = current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id];
    onChange({ branchIds: next.join("\n") });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={t.tradeInventory.nodeCode}
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

        <Field
          label={t.tradeInventory.nodeName}
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
              {t.tradeInventory.nodeCreateDescription}
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
                  <span className="block truncate text-2xs text-muted-foreground">
                    {typeValue}
                  </span>
                </div>
              </Button>
            );
          })}
        </div>

        <Field label={t.tradeInventory.nodeType} required readOnly={isEdit} className="sr-only">
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
          <Field
            label={t.tradeInventory.nodeTimezone}
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
          <Field label={t.common.status} required>
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

        {availableBranchIds.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {availableBranchIds.map((bId) => {
              const selected = branchPreview.validIds.includes(bId);
              return (
                <Button
                  key={bId}
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => toggleBranchId(bId)}
                  className={cn(
                    "inline-flex h-auto items-center gap-1 rounded-full border px-2.5 py-0.5 text-2xs font-semibold transition-colors",
                    selected
                      ? SWATCH_SURFACE_PALETTES.green.pillActive
                      : "border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <IdentifierText className="text-2xs">{bId}</IdentifierText>
                </Button>
              );
            })}
          </div>
        ) : null}

        <Field
          label={t.tradeInventory.nodeBranches}
          required
          hint={t.tradeInventory.nodeBranchesHint}
        >
          <Textarea
            placeholder={t.tradeInventory.nodeBranches}
            value={values.branchIds}
            rows={4}
            disabled={isSubmitting}
            onChange={(event) => onChange({ branchIds: event.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}
