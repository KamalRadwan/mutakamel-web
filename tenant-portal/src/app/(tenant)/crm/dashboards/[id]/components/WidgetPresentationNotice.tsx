import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { CrmMetricUnit, CrmVisualization, WidgetQuerySpec } from "../../widget-contract";
import { unsupportedWidgetPresentation } from "../../widget-presentation";
export function WidgetPresentationNotice({ visualizationType, displaySpec, querySpec, unit }: {
  visualizationType?: CrmVisualization; displaySpec: Record<string, unknown>; querySpec?: WidgetQuerySpec; unit?: CrmMetricUnit | null;
}) {
  const { t } = useI18n();
  const unsupported = unsupportedWidgetPresentation(visualizationType, displaySpec, querySpec);
  if (typeof displaySpec.numberFormat === "string" && displaySpec.numberFormat.startsWith("duration-") && unit !== "DURATION" && !unsupported.includes("numberFormat")) unsupported.push("numberFormat");
  if (!unsupported.length) return null;
  const labels = t.crmWidgets.review;
  return <p role="note" className="text-xs text-muted-foreground">{formatTemplate(labels.presentationUnavailable, {
    controls: unsupported.map((key) => key === "seriesColor" ? labels.color : labels.display[key]).join(" · "),
  })}</p>;
}
