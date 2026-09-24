"use client";

import { useId } from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Ban, TriangleAlert } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { cn } from "../../lib/cn";
import { focusRing } from "../../lib/variants";
import { FieldControlBoundary } from "../../primitives/field-control";
import { Input } from "../../primitives/Input";
import { Label } from "../../primitives/Label";
import { TagChip } from "../../primitives/TagChip";
import { TAG_COLOR_PRESETS, type TagColor } from "../../primitives/tag-color";
import { TAG_COLOR_NONE, useTagColorPicker, type TagColorChannel } from "./useTagColorPicker";

export interface TagColorPickerProps {
  /** `null` is an uncoloured tag. */
  value: TagColor | null;
  onChange: (next: TagColor | null) => void;
  /** The text the preview chip shows — usually the tag's name as typed. */
  previewLabel?: string;
  disabled?: boolean;
  className?: string;
}

// A swatch is a radio: the set is one choice, arrow keys move through it (and
// follow the document direction), and the checked one is marked by a ring,
// never by hue — docs/design/anti-patterns.md#4-hue-coded-controls.
const SWATCH = cn(
  "flex h-8 w-full cursor-pointer items-center justify-center rounded-md border text-xs font-medium",
  "data-[state=checked]:ring-2 data-[state=checked]:ring-ring data-[state=checked]:ring-offset-2 data-[state=checked]:ring-offset-background",
  "disabled:cursor-not-allowed disabled:opacity-50",
  focusRing,
);

/**
 * Picks a tag's background + text colour: none, one of thirty presets, or a
 * custom pair typed as hex or chosen from the system colour dialog.
 *
 * Generic on purpose — any app's tag uses it. A custom pair below 4.5:1 is
 * allowed (the tenant may know better) but always flagged, in words.
 */
export function TagColorPicker({ value, onChange, previewLabel, disabled, className }: TagColorPickerProps) {
  const { t, lang } = useI18n();
  const copy = t.tagColors;
  const picker = useTagColorPicker(value, onChange);
  const presetsHeadingId = useId();
  const customHeadingId = useId();
  const warningId = useId();
  const inputId = useId();

  function renderChannel(channel: TagColorChannel, label: string) {
    const invalid = picker.isDraftInvalid(channel);
    return (
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${inputId}-${channel}`} className="text-xs font-normal text-muted-foreground">
          {label}
        </Label>
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            aria-label={formatTemplate(copy.systemPicker, { label })}
            value={picker.nativeValue(channel)}
            onChange={(event) => picker.handleChannelChange(channel, event.target.value)}
            disabled={disabled}
            className={cn(
              "h-(--size-control-sm) w-9 shrink-0 cursor-pointer rounded-md border border-input bg-card p-0.5",
              "disabled:cursor-not-allowed disabled:opacity-50",
              focusRing,
            )}
          />
          <Input
            id={`${inputId}-${channel}`}
            size="sm"
            dir="ltr"
            value={picker.drafts[channel]}
            onChange={(event) => picker.handleChannelChange(channel, event.target.value)}
            maxLength={7}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? `${inputId}-${channel}-error` : undefined}
            disabled={disabled}
            className="w-28 font-mono uppercase"
          />
        </div>
        {invalid && (
          <p id={`${inputId}-${channel}-error`} className="text-xs text-destructive">
            {copy.invalidHex}
          </p>
        )}
      </div>
    );
  }

  return (
    <FieldControlBoundary>
      <div className={cn("flex flex-col gap-4", className)}>
        <section aria-labelledby={presetsHeadingId} className="flex flex-col gap-2">
          <h3 id={presetsHeadingId} className="text-xs font-medium text-muted-foreground">
            {copy.presets}
          </h3>
          <RadioGroupPrimitive.Root
            aria-labelledby={presetsHeadingId}
            value={picker.radioValue}
            onValueChange={picker.handleRadioChange}
            disabled={disabled}
            className="grid grid-cols-8 gap-1.5 p-1"
          >
            <RadioGroupPrimitive.Item
              value={TAG_COLOR_NONE}
              aria-label={copy.none}
              title={copy.none}
              className={cn(SWATCH, "border-input bg-card text-muted-foreground")}
            >
              <Ban className="size-3.5" aria-hidden="true" />
            </RadioGroupPrimitive.Item>
            {TAG_COLOR_PRESETS.map((preset) => (
              <RadioGroupPrimitive.Item
                key={preset.key}
                value={preset.key}
                aria-label={copy.names[preset.key]}
                title={copy.names[preset.key]}
                className={cn(SWATCH, "border-transparent")}
                // Tenant-facing data from a fixed table, not a token: see TagChip.
                style={{ backgroundColor: preset.backgroundColor, color: preset.textColor }}
              >
                <span aria-hidden="true">{copy.sample}</span>
              </RadioGroupPrimitive.Item>
            ))}
          </RadioGroupPrimitive.Root>
        </section>

        <section aria-labelledby={customHeadingId} className="flex flex-col gap-2">
          <h3 id={customHeadingId} className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            {copy.custom}
            {picker.isCustom && (
              <span className="rounded-sm bg-muted px-1.5 py-0.5 text-2xs text-foreground">{copy.customActive}</span>
            )}
          </h3>
          <div className="flex flex-wrap gap-4">
            {renderChannel("backgroundColor", copy.background)}
            {renderChannel("textColor", copy.text)}
          </div>
        </section>

        <section className="flex flex-col gap-2" aria-live="polite">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{copy.preview}</span>
            <TagChip
              label={previewLabel?.trim() || copy.previewFallback}
              backgroundColor={value?.backgroundColor}
              textColor={value?.textColor}
              aria-describedby={picker.isLowContrast ? warningId : undefined}
            />
            {picker.contrast !== null && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatTemplate(copy.contrast, {
                  ratio: formatNumber(picker.contrast, lang, { maximumFractionDigits: 2, minimumFractionDigits: 2 }),
                })}
              </span>
            )}
          </div>
          {picker.isLowContrast && (
            <p
              id={warningId}
              className="flex items-start gap-1.5 rounded-sm bg-warning-subtle px-2 py-1.5 text-xs text-warning-subtle-foreground"
            >
              <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              {copy.lowContrast}
            </p>
          )}
        </section>
      </div>
    </FieldControlBoundary>
  );
}
