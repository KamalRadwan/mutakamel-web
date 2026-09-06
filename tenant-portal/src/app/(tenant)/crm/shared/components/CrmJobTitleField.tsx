"use client";

import { useMemo, useState } from "react";
import { Combobox, type ComboboxOption } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import {
  JOB_TITLE_MAX_LENGTH,
  OTHER_JOB_TITLE_KEY,
  findJobTitle,
  getJobTitleOptions,
} from "@/lib/catalogues/contact-titles";

export interface CrmJobTitleFieldProps {
  value: string;
  disabled?: boolean;
  onChange: (next: string) => void;
  onBlur: () => void;
}

/** The row that commits whatever was typed. Never a stored value. */
const USE_TYPED_KEY = "__use-typed__";

/**
 * A contact's job title: a hundred ranked titles to pick from, or your own —
 * in one control, at the same time.
 *
 * What is stored is the title itself, because that is what `jobTitle` is on the
 * wire: free text with a length cap, printed back verbatim by every screen that
 * shows a contact. A key would read as `SALES_MANAGER` on all of them.
 *
 * This replaced a two-MODE control. There, the list and the text box were
 * alternatives: you reached your own title by finding `OTHER` at the bottom of
 * a hundred rows, and the box that appeared then hid the list, so a title you
 * half-remembered could not be searched for once you had started typing it.
 * Here the search box IS the text box — type, and either take a suggestion or
 * take what you typed from the first row.
 *
 * A stored title the catalogue does not know still shows as itself, so a record
 * written before any of this opens in a control that can edit it.
 */
export function CrmJobTitleField({ value, disabled, onChange, onBlur }: CrmJobTitleFieldProps) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState("");

  const catalogue = useMemo(() => getJobTitleOptions(lang), [lang]);
  const matched = findJobTitle(value, lang);

  const options = useMemo<ComboboxOption[]>(() => {
    const typed = query.trim();
    const needle = typed.toLowerCase();
    const rows = catalogue
      // `OTHER` is dropped: it existed only to reach the text box, and the
      // text box is now the thing you are already typing in.
      .filter((option) => option.key !== OTHER_JOB_TITLE_KEY)
      .filter((option) => needle.length === 0 || option.label.toLowerCase().includes(needle))
      .map((option) => ({ value: option.key, label: option.label }));

    // Offered FIRST, and only when what was typed is not already a row: it is
    // the answer for someone whose title is not on any list, and burying it
    // under a hundred near-misses is what the old `OTHER` did.
    const exact = rows.some((row) => row.label.toLowerCase() === needle);
    if (typed.length === 0 || exact) return rows;

    // `@MaxLength(120)` on every `jobTitle` in CRM. The row stays visible past
    // the cap but cannot be taken, because a row that simply vanished would
    // read as "your title is not allowed" with no way to find out why — and
    // silently storing a truncated title is worse than either.
    const tooLong = typed.length > JOB_TITLE_MAX_LENGTH;
    return [
      {
        value: USE_TYPED_KEY,
        label: formatTemplate(t.crmShared.useTypedJobTitle, { value: typed }),
        description: tooLong
          ? formatTemplate(t.crmShared.jobTitleTooLong, { max: JOB_TITLE_MAX_LENGTH })
          : t.crmShared.jobTitleHint,
        disabled: tooLong,
      },
      ...rows,
    ];
  }, [catalogue, query, t]);

  return (
    <Combobox
      // A title off the catalogue is shown by its key; anything else is shown
      // as the text it is, which is what keeps a hand-typed title readable.
      value={matched?.key ?? (value || undefined)}
      selectedLabel={matched?.label ?? value}
      options={options}
      onSearch={setQuery}
      // A static catalogue: nothing to wait for between the keystroke and the
      // answer, and waiting would delay the "use what I typed" row.
      debounceMs={0}
      onValueChange={(key) => {
        if (key === undefined) {
          onChange("");
          return;
        }
        if (key === USE_TYPED_KEY) {
          onChange(query.trim());
          return;
        }
        onChange(catalogue.find((option) => option.key === key)?.label ?? "");
      }}
      onBlur={onBlur}
      placeholder={t.crmShared.chooseJobTitle}
      searchPlaceholder={t.crmShared.searchJobTitles}
      loadingLabel={t.common.loading}
      emptyLabel={t.crmShared.noMatchingJobTitles}
      clearLabel={t.crmShared.clearJobTitle}
      disabled={disabled}
    />
  );
}
