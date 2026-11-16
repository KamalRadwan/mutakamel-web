"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Combobox } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { WIDGET_LIBRARY_SEARCH_LIMIT, parseWidgetOwnerOptions, widgetOwnerOptionsPath, type WidgetLibraryFilters } from "../../dashboards/widget-library-contract";
import { useWidgetSafety } from "../hooks/useWidgetSafety";
import { WIDGET_READ, assertWidgetStatus } from "../hooks/widget-requests";

export function WidgetLibraryOwnerFilter({ access, value, onChange, disabled }: {
  access: WidgetLibraryFilters["access"];
  value: string | null;
  onChange: (value: string | null) => void;
  disabled: boolean;
}) {
  const { t } = useI18n();
  const { user } = useTenantAuth();
  const { startRead, currentRead } = useWidgetSafety("widget-library-owner-options");
  const labels = t.crmWidgets.review;
  const active = useRef<AbortController>(null);
  const [page, setPage] = useState<ReturnType<typeof parseWidgetOwnerOptions> | null>(null);
  const [search, setSearch] = useState("");
  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  const [selectedLabel, setSelectedLabel] = useState<string>();
  const [state, setState] = useState<"idle" | "loading" | "error">("loading");
  useEffect(() => () => active.current?.abort(), []);

  const load = async (input: string, trail: Array<string | null> = [null]) => {
    const ticket = startRead();
    if (!ticket) return;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const term = input.trim().slice(0, WIDGET_LIBRARY_SEARCH_LIMIT);
    const cursor = trail.at(-1) ?? undefined;
    setSearch(term); setCursors(trail); setState("loading"); setPage(null);
    try {
      const response = await axiosClient.get<unknown>(widgetOwnerOptionsPath(access, term, cursor), { ...WIDGET_READ, signal: controller.signal });
      if (controller.signal.aborted || !currentRead(ticket)) return;
      assertWidgetStatus(response, 200);
      const next = parseWidgetOwnerOptions(response.data);
      if (cursor && next.items.some(item => item.id >= cursor)) throw new Error("Invalid owner option cursor page.");
      setPage(next);
      setState("idle");
    } catch {
      if (!controller.signal.aborted && currentRead(ticket)) { setPage(null); setState("error"); }
    }
  };
  const options = (page?.items ?? []).map(item => ({ value: item.id,
    label: item.id === user?.id ? t.crmDashboards.ownerYou : item.name ?? t.crmDashboards.ownerUnknown }));

  return <Combobox aria-label={t.crmWidgets.owner} value={value ?? undefined} selectedLabel={selectedLabel}
    placeholder={labels.allWidgetOwners} searchPlaceholder={labels.searchWidgetOwners} emptyLabel={t.common.noData}
    loadingLabel={t.common.loading} loading={state === "loading"} clearLabel={labels.clearWidgetOwner}
    options={options} disabled={disabled} onSearch={input => void load(input)}
    errorContent={state === "error" ? <Button size="sm" variant="outline" onClick={() => void load(search, cursors)}>{t.common.retry}</Button> : undefined}
    footer={cursors.length > 1 || page?.nextCursor ? <div className="flex gap-2">
      <Button size="sm" variant="outline" disabled={state === "loading" || cursors.length < 2}
        onClick={() => void load(search, cursors.slice(0, -1))}>{t.common.previousPage}</Button>
      <Button size="sm" variant="outline" disabled={state === "loading" || !page?.nextCursor}
        onClick={() => { if (page?.nextCursor) void load(search, [...cursors, page.nextCursor]); }}>{t.common.nextPage}</Button>
    </div> : undefined}
    onValueChange={id => { setSelectedLabel(options.find(option => option.value === id)?.label); onChange(id ?? null); }}
    className="w-full sm:w-auto sm:min-w-44" popoverClassName="min-w-56" wrapLabels />;
}
