"use client";

import { useState } from "react";
import { ChartNoAxesColumn, ChartNoAxesCombined, FilePlus2, Funnel, Gauge, Grid3X3, LayoutTemplate, Search } from "lucide-react";
import { Badge, Button, DegradedBanner, Input, PageHeader } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName, localizedValue } from "@/lib/format/localized";
import { WIDGET_RECIPE_FAMILIES, type WidgetRecipe } from "../../dashboards/dashboard-catalog-contract";
import { DashboardRecoveryNotice, type DashboardRecoveryProps } from "../../dashboards/components/DashboardRecoveryNotice";

const RECIPE_ICONS: Partial<Record<WidgetRecipe["visualizationType"], typeof LayoutTemplate>> = {
  METRIC_CARD: Gauge, LINE: ChartNoAxesCombined, FUNNEL: Funnel, BAR: ChartNoAxesColumn, HEATMAP: Grid3X3,
};

export function WidgetRecipeGallery({ recipes, catalogUnavailable, blocked, canPreview, invalidRecipe, recovery, onRetry, onBack, onBlank, onChoose }: {
  recipes: readonly WidgetRecipe[];
  catalogUnavailable: boolean;
  blocked: boolean;
  canPreview: boolean;
  invalidRecipe: boolean;
  recovery: DashboardRecoveryProps;
  onRetry: () => void;
  onBack: () => void;
  onBlank: () => void;
  onChoose: (recipe: WidgetRecipe) => void;
}) {
  const { t, lang } = useI18n();
  const copy = t.crmWidgets.recipes;
  const [search, setSearch] = useState("");
  const [family, setFamily] = useState<WidgetRecipe["family"] | null>(null);
  const term = search.trim().toLocaleLowerCase(lang);
  const shown = recipes.filter(recipe => (!family || recipe.family === family) && (!term
    || [recipe.nameAr, recipe.nameEn, recipe.descriptionAr, recipe.descriptionEn].some(text => text.toLocaleLowerCase(lang).includes(term))));

  return <div className="flex flex-col gap-4 px-1 pb-6 sm:px-3">
    <PageHeader title={copy.title} description={copy.description}
      leading={<LayoutTemplate className="mt-0.5 size-7 shrink-0" aria-hidden="true" />}
      primaryAction={{ label: copy.blank, icon: <FilePlus2 className="size-4" aria-hidden="true" />, disabled: blocked, onClick: onBlank }}
      secondaryActions={<Button size="xl" variant="outline" onClick={onBack}>{t.common.cancel}</Button>} />
    <DashboardRecoveryNotice {...recovery} />
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
      <div className="relative w-full sm:max-w-sm"><Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input aria-label={copy.search} placeholder={copy.search} value={search} maxLength={120}
          onChange={event => setSearch(event.target.value)} className="ps-8" />
      </div>
      <div role="group" aria-label={copy.family} className="flex flex-wrap gap-2">
        {[null, ...WIDGET_RECIPE_FAMILIES].map(key => <Button key={key ?? "all"} size="sm" variant={family === key ? "secondary" : "outline"}
          aria-pressed={family === key} onClick={() => setFamily(key)}>{key ? copy.families[key] : copy.all}</Button>)}
      </div>
    </div>
    {catalogUnavailable && <div className="space-y-2"><DegradedBanner message={t.crmWidgets.catalogueUnavailableForBuilder} />
      <Button variant="outline" onClick={onRetry}>{t.common.retry}</Button></div>}
    {invalidRecipe && <p role="alert" className="text-sm text-destructive">{copy.unavailable}</p>}
    {shown.length === 0 ? <p role="status" className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
      {recipes.length ? copy.noMatches : copy.noRecipes}</p>
      : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map(recipe => {
          const name = localizedName(recipe, lang);
          const Icon = RECIPE_ICONS[recipe.visualizationType] ?? LayoutTemplate;
          return <article key={recipe.key} aria-label={name} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><Badge tone="neutral">{copy.families[recipe.family]}</Badge>
                <h2 className="mt-2 text-base font-semibold">{name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{localizedValue(recipe.descriptionAr, recipe.descriptionEn, lang)}</p></div>
              <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                <Icon className="size-6" aria-hidden="true" /></div>
            </div>
            <div className="flex flex-wrap gap-2"><Badge tone="neutral">{t.crmDashboards.visualizations[recipe.visualizationType]}</Badge>
              {recipe.sourceResources.map(resource => <Badge key={resource} tone="neutral">{t.crmWidgets.metricPicker.resources[resource]}</Badge>)}</div>
            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <span className="text-xs text-muted-foreground">{canPreview ? copy.checkedOnPreview : copy.previewAccess}</span>
              <Button variant="outline" size="sm" disabled={blocked} onClick={() => onChoose(recipe)}>{copy.use}</Button>
            </div>
          </article>;
        })}
      </div>}
  </div>;
}
