"use client";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { templateBindingsAr, templateBindingsEn } from "@/i18n/dictionaries/template-bindings";
import { dataFields } from "../binding-catalogue";
import type { DataDescriptor } from "../binding-contract";
import type { DataResult } from "../binding-contract";

export function useDataCopy() { const { lang } = useI18n(); return { ar: templateBindingsAr, en: templateBindingsEn }[lang]; }
export function useDataInteger() { const { lang } = useI18n(); return new Intl.NumberFormat({ ar: "ar-EG-u-nu-latn", en: "en-US" }[lang], { maximumFractionDigits: 0 }).format; }
export function useDataInput(change: (value: string) => void) { return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => change(event.target.value); }
export function useDataNumber(change: (value: number) => void) { return (event: ChangeEvent<HTMLInputElement>) => change(event.target.valueAsNumber); }
export function useDataNotice(result: DataResult | null) {
  const notice = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (result && result !== "applied" && result !== "unchanged") notice.current?.focus(); }, [result]);
  return notice;
}
export function useFieldSearch(descriptor: DataDescriptor, rowSourcePath?: string, formula = false, eligiblePaths?: readonly string[]) {
  const [search, setSearch] = useState(""), [group, setGroup] = useState("ALL");
  const all = dataFields(descriptor, rowSourcePath).filter(({ path, field }) => (!formula || field.dataType !== "DATETIME") && (eligiblePaths === undefined || eligiblePaths.includes(path)));
  const groups = [...new Set(all.map(({ path }) => path.split(".")[0]))];
  const rows = all.filter(({ path, field }) => (group === "ALL" || path.split(".")[0] === group) && `${path} ${field.labelKey}`.toLocaleLowerCase("en-US").includes(search.toLocaleLowerCase("en-US")));
  return { search, setSearch, group, setGroup, groups, rows, count: all.length };
}
