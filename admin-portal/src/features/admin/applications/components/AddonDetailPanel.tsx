"use client";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { addonCopy } from "../lib/addon-copy";
import { AddonWorkspace } from "./AddonWorkspace";

interface Props {
  applicationKey: string;
  applicationName: string;
  addonKey: string;
  actorId: string;
  canReadTiers: boolean;
  canUpdate: boolean;
  canCritical: boolean;
  canDelete: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

/**
 * The panel is a frame, not a second addon screen. Everything inside it is the
 * same `AddonWorkspace` the per-application page renders, so the two entry
 * points cannot drift into two different definitions of what an addon is.
 *
 * `side="end"` is logical, so the panel enters from the correct edge in both
 * directions. The default sheet width is sized for a form; this one has to hold
 * the published/draft comparison table, so it is widened here rather than in
 * the primitive.
 */
export function AddonDetailPanel(props: Props) {
  const { lang, dir } = useI18n();
  const copy = addonCopy(lang);
  return (
    <Sheet open onOpenChange={open => { if (!open) props.onClose(); }}>
      {/*
        No `aria-label` here: Radix derives the dialog's name from SheetTitle via
        `aria-labelledby`, which wins the accessible-name computation, so a label
        prop would be silently inert. The localized context therefore lives
        inside the title itself rather than beside it.
      */}
      <SheetContent
        side="end"
        dir={dir}
        closeLabel={copy.close}
        className="w-[min(100vw,56rem)] gap-0 overflow-y-auto p-0"
      >
        <SheetHeader className="sticky top-0 z-10 border-b border-border bg-card px-4 py-3">
          <SheetTitle className="flex flex-col gap-0.5 pe-10">
            <span className="text-xs text-muted-foreground">{copy.detailPanel}</span>
            <bdi className="break-all font-mono" dir="ltr">{props.addonKey}</bdi>
          </SheetTitle>
          <SheetDescription>
            {copy.perApplication}: <bdi>{props.applicationName}</bdi>
          </SheetDescription>
        </SheetHeader>
        <div className="p-3 sm:p-3.5">
          <AddonWorkspace
            key={`${props.actorId}:${props.applicationKey}:${props.addonKey}`}
            applicationKey={props.applicationKey}
            addonKey={props.addonKey}
            actorId={props.actorId}
            canReadTiers={props.canReadTiers}
            canUpdate={props.canUpdate}
            canCritical={props.canCritical}
            canDelete={props.canDelete}
            onDeleted={props.onDeleted}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
