"use client";

import { useI18n } from "@/i18n/I18nContext";
import type { WidgetSpecLimitation } from "../../widget-form";

/**
 * Why the editor is not offered for this widget — D23.
 *
 * Shown only to an actor who *could* otherwise edit. A viewer is not told the
 * widget is unsafe to edit; they simply have no editor, and explaining a
 * restriction that does not apply to them is noise.
 *
 * Naming the specific parts matters more than it looks. "This cannot be
 * edited" reads as a bug; "it charts more than one metric, and it has stored
 * filters" tells the user what they own that the form would have thrown away,
 * and is the difference between a limit and a fault.
 */
export function WidgetNotEditableNotice({
  limitations,
}: {
  limitations: readonly WidgetSpecLimitation[];
}) {
  const { t } = useI18n();

  return (
    <section
      role="note"
      className="flex flex-col gap-1.5 rounded-sm border border-border bg-muted p-3"
    >
      <h2 className="text-sm font-medium text-foreground">{t.crmWidgets.notEditableTitle}</h2>
      <p className="text-xs text-muted-foreground">{t.crmWidgets.notEditableDescription}</p>
      <ul className="flex list-disc flex-col gap-1 ps-4 text-xs text-muted-foreground">
        {limitations.map((limitation) => (
          <li key={limitation}>{t.crmWidgets.notEditableReasons[limitation]}</li>
        ))}
      </ul>
    </section>
  );
}
