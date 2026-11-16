"use client";

import { useState } from "react";
import { ErrorState, PermissionGate, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import type { WidgetRecipe } from "../../dashboards/dashboard-catalog-contract";
import { WidgetBuilder } from "../components/WidgetBuilder";
import { WidgetRecipeGallery } from "../components/WidgetRecipeGallery";
import { useWidgetCreatePage } from "../hooks/useWidgetCreatePage";
import { validateWidgetForm, widgetSpecLimitations, widgetToForm, type WidgetFormState } from "../widget-form";

export default function NewWidgetPage() {
  return <PermissionGate require={["crm.widgets.read", "crm.widgets.create"]}><NewWidgetWorkspace /></PermissionGate>;
}

function NewWidgetWorkspace() {
  const { t, lang } = useI18n();
  const state = useWidgetCreatePage();
  const { list } = state;
  const [entry, setEntry] = useState<{ scope: string; key: string; initial?: WidgetFormState } | null>(null);
  const [invalidScope, setInvalidScope] = useState<string | null>(null);
  const selected = entry?.scope === list.scope ? entry : null;
  const blocked = list.blocked || !list.canCreate;
  if (list.queryError?.status === 403) return <PermissionGate require="crm.widgets.read" denied>{null}</PermissionGate>;
  if (list.isLoading && !list.hasLoaded) return <div className="space-y-4" role="status" aria-label={t.crmWidgets.createTitle}>
    <Skeleton className="h-10 w-64" /><Skeleton className="h-40 w-full" />
  </div>;
  if (list.queryError && !list.hasLoaded) return <ErrorState title={t.crmWidgets.loadFailed}
    description={t.crmDashboards.actionFailed} onRetry={() => void list.reload()} retryLabel={t.common.retry} />;

  if (!selected) {
    const choose = (recipe: WidgetRecipe) => {
      if (blocked) return;
      const initial = widgetToForm({ ...recipe, name: localizedName(recipe, lang) });
      if (widgetSpecLimitations(recipe.querySpec, recipe.displaySpec).length || validateWidgetForm(initial, list.catalog)) {
        setInvalidScope(list.scope); return;
      }
      setInvalidScope(null);
      setEntry({ scope: list.scope, key: recipe.key, initial });
    };
    return <WidgetRecipeGallery key={list.scope} recipes={list.catalog?.widgetRecipes ?? []}
      catalogUnavailable={!list.catalog} blocked={blocked} canPreview={list.canPreview} invalidRecipe={invalidScope === list.scope}
      recovery={{ blocked: list.needsReview, ready: list.reviewReady, busy: list.isLoading || list.isSubmitting,
        onReload: () => void list.reload(), onAcknowledge: list.review }}
      onRetry={() => { setInvalidScope(null); void list.reload(); }} onBack={state.cancel}
      onBlank={() => { if (!blocked) setEntry({ scope: list.scope, key: "blank" }); }} onChoose={choose} />;
  }

  return <WidgetBuilder key={`${list.scope}:${selected.key}`} title={t.crmWidgets.createTitle} initial={selected.initial}
    catalog={list.catalog} isSubmitting={list.isSubmitting} error={state.error} canPreview={list.canPreview}
    blocked={blocked} needsReview={list.needsReview} reviewReady={list.reviewReady}
    onReload={() => void list.reload()} onReview={list.review} onCancel={() => setEntry(null)} onSaveDraft={(form) => void state.create(form)} />;
}
