import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { isStorageByteLimit } from "../lib/storage-byte-capacity";

export function useStorageByteLimit(initialValue: string | null = null) {
  const { lang } = useI18n();
  const copy = (lang === "ar" ? ar : en).storageByteCapacity;
  const [value, setValue] = useState(initialValue ?? "");
  const [checked, setChecked] = useState(false);
  const valid = isStorageByteLimit(value);

  return {
    copy,
    value,
    setValue,
    error: checked && !valid ? copy.invalidLimit : undefined,
    validate: () => {
      setChecked(true);
      return valid;
    },
  };
}
