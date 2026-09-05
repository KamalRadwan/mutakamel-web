"use client";

import { useMemo, useState } from "react";
import { List } from "lucide-react";
import { Button, Combobox, FieldControlBoundary, Input, type ComboboxOption } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
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

/**
 * A contact's job title: a hundred of them to pick from, or your own.
 *
 * What is stored is the title itself, because that is what `jobTitle` is on
 * the wire — free text with a length cap, printed back verbatim by every
 * screen that shows a contact. A key would read as `SALES_MANAGER` on all of
 * them.
 *
 * Two modes, and the value decides which without being asked: a value the
 * catalogue recognises (in either language) shows the list; anything else is
 * somebody's own title and shows the text box, so a record written before this
 * control existed opens in the mode that can edit it. Picking the last entry,
 * `OTHER`, is the only way to reach the text box deliberately — and `OTHER`
 * itself is never stored, since "Other" is not a job.
 */
export function CrmJobTitleField({ value, disabled, onChange, onBlur }: CrmJobTitleFieldProps) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState("");
  const [choseCustom, setChoseCustom] = useState(false);

  const catalogue = useMemo(() => getJobTitleOptions(lang), [lang]);
  const matched = findJobTitle(value, lang);
  const isCustom = choseCustom || (value.trim().length > 0 && !matched);

  const options = useMemo<ComboboxOption[]>(() => {
    const needle = query.trim().toLowerCase();
    return catalogue
      .filter((option) => needle.length === 0 || option.label.toLowerCase().includes(needle))
      .map((option) => ({ value: option.key, label: option.label }));
  }, [catalogue, query]);

  if (isCustom) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={value}
          maxLength={JOB_TITLE_MAX_LENGTH}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
        {/* The way back to the list. Clearing the box alone would not do it:
            an empty value is also how the list mode starts. */}
        <FieldControlBoundary>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            data-icon-button
            aria-label={t.crmShared.backToJobTitleList}
            onClick={() => {
              setChoseCustom(false);
              onChange("");
            }}
          >
            <List className="size-3.5" aria-hidden="true" />
          </Button>
        </FieldControlBoundary>
      </div>
    );
  }

  return (
    <Combobox
      value={matched?.key}
      selectedLabel={matched?.label}
      options={options}
      onSearch={setQuery}
      // A static catalogue: there is nothing to wait for between the keystroke
      // and the answer.
      debounceMs={0}
      onValueChange={(key) => {
        if (key === OTHER_JOB_TITLE_KEY) {
          setChoseCustom(true);
          onChange("");
          return;
        }
        onChange(catalogue.find((option) => option.key === key)?.label ?? "");
      }}
      onBlur={onBlur}
      placeholder={t.crmShared.chooseJobTitle}
      searchPlaceholder={t.crmShared.searchJobTitles}
      loadingLabel={t.common.loading}
      emptyLabel={t.crmShared.noMatchingJobTitles}
      disabled={disabled}
    />
  );
}
