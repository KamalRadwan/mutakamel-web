"use client";

import { useState } from "react";
import {
  TAG_COLOR_MIN_CONTRAST,
  TAG_COLOR_PRESETS,
  findTagColorPreset,
  normalizeTagHexColor,
  sameTagColor,
  tagColorContrast,
  type TagColor,
} from "../../primitives/tag-color";

export type TagColorChannel = keyof TagColor;

/** The radio value for "no colour". Preset keys are camelCase, so it cannot collide. */
export const TAG_COLOR_NONE = "none";

// Where the custom inputs start when the tag has no colour yet: the neutral
// slate preset, so the first edit to either side still produces a legible pair.
const CUSTOM_SEED: TagColor = TAG_COLOR_PRESETS.find((preset) => preset.key === "slate") ?? TAG_COLOR_PRESETS[0];

/**
 * State for the controlled tag colour picker.
 *
 * The value is owned by the caller; this hook owns only the two hex DRAFTS,
 * because a half-typed `#1D4` is not a colour and must not reach `onChange`.
 * A draft commits the moment it parses, paired with the other side's current
 * colour — the backend accepts both or neither, never one.
 */
export function useTagColorPicker(value: TagColor | null, onChange: (next: TagColor | null) => void) {
  const [drafts, setDrafts] = useState<TagColor>(value ?? CUSTOM_SEED);
  const [previousValue, setPreviousValue] = useState(value);

  // A preset press, a reset from the parent, or a committed draft: the text
  // boxes follow the value. Clearing to "none" keeps the drafts, so switching
  // back to custom resumes from the last pair rather than from the seed.
  if (!sameTagColor(value, previousValue)) {
    setPreviousValue(value);
    if (value !== null) setDrafts(value);
  }

  const preset = findTagColorPreset(value);
  const radioValue = value === null ? TAG_COLOR_NONE : (preset?.key ?? "");
  const contrast = value === null ? null : tagColorContrast(value);

  // The committed side of each channel: the value when there is one, else a
  // parsed draft, else the seed. Used to complete a pair from one edit.
  function committed(channel: TagColorChannel): string {
    return value?.[channel] ?? normalizeTagHexColor(drafts[channel]) ?? CUSTOM_SEED[channel];
  }

  function handleRadioChange(next: string) {
    if (next === TAG_COLOR_NONE) {
      onChange(null);
      return;
    }
    const chosen = TAG_COLOR_PRESETS.find((candidate) => candidate.key === next);
    if (chosen) onChange({ backgroundColor: chosen.backgroundColor, textColor: chosen.textColor });
  }

  function handleChannelChange(channel: TagColorChannel, raw: string) {
    setDrafts((current) => ({ ...current, [channel]: raw }));
    const parsed = normalizeTagHexColor(raw);
    if (parsed === null) return;
    onChange(
      channel === "backgroundColor"
        ? { backgroundColor: parsed, textColor: committed("textColor") }
        : { backgroundColor: committed("backgroundColor"), textColor: parsed },
    );
  }

  return {
    radioValue,
    drafts,
    isCustom: value !== null && preset === null,
    isDraftInvalid: (channel: TagColorChannel) => normalizeTagHexColor(drafts[channel]) === null,
    // `<input type="color">` accepts only lower-case `#rrggbb`, and a draft
    // that does not parse yet shows the committed colour rather than black.
    nativeValue: (channel: TagColorChannel) => committed(channel).toLowerCase(),
    contrast,
    isLowContrast: contrast !== null && contrast < TAG_COLOR_MIN_CONTRAST,
    handleRadioChange,
    handleChannelChange,
  };
}
