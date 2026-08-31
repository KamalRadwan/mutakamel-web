"use client";

import { useMemo, useState } from "react";
import type { ComboboxOption } from "@/design-system";
import { supportedTimezones } from "../workspace-settings-contract";

// The list is the browser's own IANA table, which is the same authority the
// server validates against (`new Intl.DateTimeFormat(..., { timeZone })` in
// WorkspaceSettingsService.assertValidTimezone). It is a local constant, not a
// server page, so filtering here is not the client-side filtering of a remote
// list that `Combobox` exists to prevent.
const VISIBLE_OPTIONS = 50;

export function useTimezoneOptions(currentValue: string) {
  const [query, setQuery] = useState("");
  const zones = useMemo(() => supportedTimezones(), []);

  const options = useMemo<ComboboxOption[]>(() => {
    const needle = query.trim().toLocaleLowerCase();
    const matches = zones.filter((zone) => zone.toLocaleLowerCase().includes(needle));
    // The saved zone always stays selectable, even when the browser's table
    // does not contain it — a value the server accepted is not ours to drop.
    const withCurrent =
      currentValue && !matches.includes(currentValue) && zones.includes(currentValue)
        ? [currentValue, ...matches]
        : matches;
    return withCurrent.slice(0, VISIBLE_OPTIONS).map((zone) => ({ value: zone, label: zone }));
  }, [zones, query, currentValue]);

  return {
    /** Empty when the browser exposes no IANA table; the screen falls back to a text input. */
    hasZones: zones.length > 0,
    options,
    onSearch: setQuery,
  };
}
