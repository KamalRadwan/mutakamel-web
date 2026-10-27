"use client";

import { Button, Field, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { MOVEMENT_LINES_MAX, type MovementLineSnapshot } from "../movements-contract";
import type { useReversalLines } from "../hooks/useReversalLines";
import { SerialKeysField } from "./SerialKeysField";

export function ReversalLinesFields({ editor, knownLines, disabled }: {
  editor: ReturnType<typeof useReversalLines>;
  knownLines: MovementLineSnapshot[];
  disabled: boolean;
}) {
  const { t } = useI18n();
  return (
    <section className="flex flex-col gap-3" aria-label={t.tradeInventory.reversalLinesLabel}>
      <p className="text-sm text-muted-foreground">{t.tradeInventory.reversalLinesHint}</p>
      {knownLines.length > 0 && (
        <div className="flex flex-col gap-2 text-sm">
          <p>{t.tradeInventory.recordedLinesHint}</p>
          {knownLines.map((line) => (
            <p key={line.id} className="break-words" dir="ltr">{line.id}: {line.serialKeys.join(", ")}</p>
          ))}
        </div>
      )}
      {editor.lines.map((line, index) => (
        <div key={index} className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-3">
          <Field label={t.tradeInventory.movementLineId} required showLabel>
            <Input value={line.lineId} disabled={disabled}
              onChange={(event) => editor.change(index, { lineId: event.target.value })} />
          </Field>
          <Field label={t.tradeInventory.quantity} required showLabel>
            <Input value={line.quantity} inputMode="decimal" disabled={disabled}
              onChange={(event) => editor.change(index, { quantity: event.target.value })} />
          </Field>
          <SerialKeysField value={line.serialKeys} quantity={line.quantity} subset disabled={disabled}
            onChange={(serialKeys) => editor.change(index, { serialKeys })} />
          <Button type="button" variant="ghost" disabled={disabled} onClick={() => editor.remove(index)}>
            {t.tradeInventory.removeLine}
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" disabled={disabled || editor.lines.length >= MOVEMENT_LINES_MAX}
        onClick={editor.add}>{t.tradeInventory.addReversalLine}</Button>
    </section>
  );
}
