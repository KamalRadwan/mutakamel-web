"use client";
import { Badge, Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger, Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { useDesignerGeometryDialog } from "../hooks/useDesignerGeometryForm";
import { useDesignerDestination } from "../hooks/useDesignerDestination";
import type { DesignerInteractionController } from "../../designer-interaction-controller";
import type { DesignerInteractionEditor as Editor } from "./DesignerInteractionPanel";

export function DesignerSelectionDialog({ editor, controller, selectedIds }: { editor: Editor; controller: DesignerInteractionController; selectedIds: readonly string[] }) {
  const c = editor.t.quotationPdf.designer.geometry, d = editor.t.quotationPdf.designer, { lang } = useI18n();
  const numbers = new Intl.NumberFormat({ ar: "ar-EG-u-nu-latn", en: "en-US" }[lang]);
  return <Dialog><DialogTrigger asChild><Button variant="outline" size="sm" disabled={!editor.document}>{c.selection}</Button></DialogTrigger>
    <DialogContent size="2xl" className="max-h-[85dvh] overflow-auto"><DialogTitle>{c.selection}</DialogTitle><DialogDescription>{c.selectionHelp}</DialogDescription>
      <ul className="divide-y divide-border">{Object.values(editor.document?.nodes ?? {}).map((node, index) => <li key={node.id} className="flex items-center gap-2 py-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 text-sm"><Checkbox checked={selectedIds.includes(node.id)} onCheckedChange={checked => controller.select(checked === true ? [...selectedIds, node.id] : selectedIds.filter(id => id !== node.id))} />
          <span>{node.name ?? formatTemplate(c.objectPosition, { index: numbers.format(index + 1) })}</span>
        </label>
        {node.locked && <Badge tone="neutral">{d.lock}</Badge>}{node.hidden && <Badge tone="neutral">{d.hide}</Badge>}
      </li>)}</ul>
    </DialogContent>
  </Dialog>;
}
export function DesignerDestinationDialog({ editor, controller, operation, disabled }: { editor: Editor; controller: DesignerInteractionController; operation: "move" | "paste"; disabled: boolean }) {
  const dialog = useDesignerGeometryDialog(), c = editor.t.quotationPdf.designer.geometry;
  const label = operation === "move" ? c.moveTo : c.paste;
  return <Dialog open={dialog.open} onOpenChange={dialog.onOpenChange}><DialogTrigger asChild><Button variant="outline" size="sm" disabled={disabled}>{label}</Button></DialogTrigger>
    <DialogContent size="2xl"><DialogTitle>{label}</DialogTitle><DialogDescription>{c.destinationHelp}</DialogDescription>
      {dialog.open && <DestinationForm editor={editor} controller={controller} operation={operation} done={dialog.close} />}
    </DialogContent>
  </Dialog>;
}
function DestinationForm({ editor, controller, operation, done }: { editor: Editor; controller: DesignerInteractionController; operation: "move" | "paste"; done: () => void }) {
  const form = useDesignerDestination(editor.document, controller, operation, done), c = editor.t.quotationPdf.designer.geometry, { lang } = useI18n();
  const numbers = new Intl.NumberFormat({ ar: "ar-EG-u-nu-latn", en: "en-US" }[lang]);
  return <form onSubmit={form.submit} className="space-y-3">{form.rejected && <p role="alert" className="text-sm text-destructive">{c.refused}</p>}<Field label={c.destination} showLabel><Select disabled={!editor.editable || editor.hasPending || editor.conflict} value={form.destination} onValueChange={form.setDestination}>
    <SelectTrigger><SelectValue placeholder={c.chooseDestination} /></SelectTrigger><SelectContent>{form.destinations.map((node, index) => <SelectItem key={node.id} value={node.id}>{node.name ?? formatTemplate(c.objectPosition, { index: numbers.format(index + 1) })}</SelectItem>)}</SelectContent>
  </Select></Field><Button type="submit" variant="outline" disabled={!editor.editable || editor.hasPending || editor.conflict || !form.destination}>{c.apply}</Button></form>;
}
