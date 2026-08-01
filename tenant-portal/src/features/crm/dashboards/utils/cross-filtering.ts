import type { CrmDashboardWidget } from "../models/dashboard-types";
import type { DashboardPointSelection } from "../components/renderers/dashboard-echarts-options";
export function handleCrossFiltering(
  widget: CrmDashboardWidget, 
  selection: DashboardPointSelection, 
  storeSetFilters: (filters: Record<string, string>) => void,
  currentFilters: Record<string, string>
) {
  // If no dimension is mapped or it's a simple metric card, we can't filter
  if (!selection.pointKey) return;

  // Ideally, the widget's config would declare which dimension this key represents.
  // For a generic CRM dashboard, if we click a bar labeled "Ahmed", 
  // we might want to filter the whole dashboard by `ownerId = Ahmed`.
  
  // Here is a naive cross-filtering strategy:
  // We use the selection.seriesKey or the widget's group-by spec as the filter key.
  const filterKey = widget.querySpec?.dimension?.key || "dimension";
  const filterValue = String(selection.pointKey);

  const newFilters = { ...currentFilters };

  // Toggle logic: If the exact filter is already applied, clicking it again removes it.
  if (newFilters[filterKey] === filterValue) {
    delete newFilters[filterKey];
  } else {
    newFilters[filterKey] = filterValue;
  }

  storeSetFilters(newFilters);
}
