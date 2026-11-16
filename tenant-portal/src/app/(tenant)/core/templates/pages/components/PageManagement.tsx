"use client";
import { Button, ConfirmActionModal, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from "@/design-system";
import type { PageController } from "../page-controller";
import { pageErrorText } from "../page-copy";
import { useInterlockedPageManagement } from "../hooks/useInterlockedPageManagement";
import type { PageTextInterlock } from "../page-text-interlock";
import { PageSetupDialog } from "./PageSetupDialog";
import { ZoneDialog } from "./ZoneDialog";

export function PageManagement({ controller: base, interlock, locale }: { controller: PageController; interlock: PageTextInterlock; locale: "ar-EG" | "en-US" }) {
  const { controller, textActive, state, copy, active, document, selected, paginationSelected, errorRef, fixed, flow, explicit, setup, zoneBase, removal, status, pageLabel, openSetup, closeSetup, openZones, closeZones, add, duplicate, requestRemoval, closeRemoval, confirmRemoval, removalDescription } = useInterlockedPageManagement(base, interlock, locale);
  if (!document) return null;
  if (document.layoutMode === "EMAIL_FLOW") return <p role="status" className="text-sm text-muted-foreground">{copy.emailHelp}</p>;
  const setupDialog = setup && <PageSetupDialog interlock={interlock} textActive={textActive} controller={controller} base={setup.base} pageId={setup.pageId} copy={copy} locale={locale} close={closeSetup} basicSetupOnly={state.basicSetupOnly} />;
  return <section aria-label={copy.title} className="space-y-3 rounded-lg border border-border bg-card p-3">
    {state.error && !textActive && <p ref={errorRef} role="alert" tabIndex={-1} className="text-sm text-destructive">{pageErrorText(copy, state.error)}</p>}
    {state.blocked && !textActive && <p role="status" className="text-sm text-muted-foreground">{pageErrorText(copy, state.blocked)}</p>}
    {textActive && <p role="status" className="text-sm text-muted-foreground">{copy.textSessionActive}</p>}
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" disabled={!state.editable} onClick={openSetup}>{copy.setup}</Button>
      {!state.basicSetupOnly && <>
        {flow && <Button variant="outline" size="sm" disabled={!state.editable} onClick={openZones}>{copy.zones}</Button>}
        <label className="flex items-center gap-2 text-sm"><Switch checked={state.printBounds} onCheckedChange={controller.setPrintBounds} />{copy.printBounds}</label>
        <label className="flex items-center gap-2 text-sm"><Switch checked={state.rulers} onCheckedChange={controller.setRulers} />{copy.rulers}</label>
      </>}
    </div>
    {!state.basicSetupOnly && <>
    {fixed && !explicit && <p className="text-sm text-muted-foreground">{copy.retainedHelp}</p>}
    {explicit && <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={add} disabled={!state.editable || state.pages.length >= 100}>{copy.add}</Button>
      <Button variant="outline" size="sm" onClick={duplicate} disabled={!state.editable || !active || state.pages.length >= 100}>{copy.duplicate}</Button>
      <Button variant="outline" size="sm" onClick={() => active && controller.reorderPage(active.key, -1)} disabled={!state.editable || state.activeIndex <= 0}>{copy.earlier}</Button>
      <Button variant="outline" size="sm" onClick={() => active && controller.reorderPage(active.key, 1)} disabled={!state.editable || state.activeIndex >= state.pages.length - 1}>{copy.later}</Button>
      <Button variant="outline" size="sm" onClick={requestRemoval} disabled={!state.editable || state.pages.length <= 1}>{copy.remove}</Button>
      {selected && <Select value="" onValueChange={controller.moveSelection} disabled={!state.editable}>
        <SelectTrigger className="w-64" aria-label={copy.moveSelection}><SelectValue placeholder={copy.moveSelection} /></SelectTrigger>
        <SelectContent>{state.pages.filter(page => page.key !== active?.key).map((page, index) => <SelectItem key={page.key} value={page.key}>{page.name || pageLabel(index)}</SelectItem>)}</SelectContent>
      </Select>}
    </div>}
    {flow && <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{copy.flowHelp}</p>
      {paginationSelected && <div className="flex flex-wrap gap-3">
        {(["keepTogether", "breakBefore", "breakAfter"] as const).map(flag => <label key={flag} className="flex items-center gap-2 text-sm">
          <Switch checked={paginationSelected.layout[flag] === true} disabled={!state.editable} onCheckedChange={value => controller.setFlowFlags(paginationSelected.id, { [flag]: value })} />{copy[flag]}
        </label>)}
        <Button variant="outline" size="sm" disabled={!state.editable} onClick={() => controller.insertPageBreak(paginationSelected.id)}>{copy.insertBreak}</Button>
      </div>}
    </div>}
    <nav aria-label={copy.title} className="flex flex-wrap items-center gap-2">
      {state.pages.map((page, index) => <Button key={page.key} size="sm" variant={page.key === state.activeKey ? "secondary" : "ghost"}
        disabled={textActive} aria-current={page.key === state.activeKey ? "page" : undefined} onClick={() => controller.navigate(page.key)}>{page.name || pageLabel(index)}</Button>)}
    </nav>
    <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{status}</p>
    {zoneBase && <ZoneDialog interlock={interlock} textActive={textActive} controller={controller} base={zoneBase} copy={copy} locale={locale} close={closeZones} />}
    <ConfirmActionModal loading={textActive} open={!!removal} onOpenChange={open => { if (!open) closeRemoval(); }} title={copy.deleteTitle}
      description={removalDescription} confirmLabel={copy.remove} cancelLabel={copy.cancel} onConfirm={confirmRemoval} />
    </>}
    {setupDialog}
  </section>;
}
