"use client";

import { Trash2 } from "lucide-react";
import { Button, Field, FormDrawer, FormModal, Input, Textarea } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";
import type { CategoryCommand } from "../category-api";
import { useCategoryEditor, type CategoryEditorRequest } from "../hooks/useCategoryEditor";
import { CategoryTargetPicker } from "./CategoryTargetPicker";

export function CategoryEditor({ editor, busy, uncertain, canWrite, error, onSubmit, onClose, onRetry }: {
  editor: CategoryEditorRequest; busy: boolean; uncertain: boolean; canWrite: boolean; error?: NormalizedApiError;
  onSubmit: (command: CategoryCommand) => Promise<void>; onClose: () => void; onRetry: () => void;
}) {
  const { t } = useI18n(); const copy = t.trade.categories;
  const form = useCategoryEditor(editor, onSubmit);
  const title = editor.action === "create" ? copy.add : editor.action === "update" ? copy.edit
    : editor.action === "status" ? editor.source?.status === "ACTIVE" ? copy.deactivate : copy.activate : copy[editor.action];
  const metadata = editor.action === "create" || editor.action === "update";
  const pending = busy || uncertain;
  const locked = pending || !canWrite;
  const fieldError = (field: keyof typeof form.issues, apiField: string = field) =>
    form.attempted && form.issues[field] ? copy.formInvalid : error?.fieldErrors?.[apiField]?.join(" ");
  const fields = <div className="space-y-4">
    {metadata ? <>
      <Field label={copy.code} error={fieldError("code") ?? (error?.code === "TRADE.CATALOG.CATEGORY_CODE_TAKEN" ? error.message : undefined)} required readOnly={editor.action === "update"} showLabel>
        <Input value={editor.source?.code ?? form.code} readOnly={editor.action === "update"} disabled={locked}
          onChange={(event) => form.setCode(event.target.value)} dir="ltr" maxLength={80} />
      </Field>
      <Field label={copy.defaultName} error={fieldError("displayName") ?? (error?.code === "TRADE.CATALOG.CATEGORY_NAME_TAKEN" ? error.message : undefined)} required showLabel><Input value={form.displayName}
        onChange={(event) => form.setDisplayName(event.target.value)} disabled={locked} /></Field>
      <fieldset className="space-y-3"><legend className="text-sm font-medium">{copy.translations}</legend>
        {form.names.map((entry) => <div key={entry.key} className="flex flex-wrap items-end gap-2">
          <Field label={copy.locale} error={fieldError("localizedNames")} showLabel className="w-28"><Input value={entry.locale} dir="ltr" disabled={locked}
            onChange={(event) => form.changeName(entry.key, { locale: event.target.value })} /></Field>
          <Field label={copy.translatedName} error={fieldError("localizedNames")} showLabel className="min-w-0 flex-1"><Input value={entry.name} disabled={locked}
            onChange={(event) => form.changeName(entry.key, { name: event.target.value })} /></Field>
          <Button variant="ghost" size="sm" disabled={locked || form.names.length <= 1} aria-label={`${t.common.delete} ${entry.locale}`}
            onClick={() => form.removeName(entry.key)}><Trash2 className="size-4" aria-hidden="true" /></Button>
        </div>)}
        <Button variant="outline" size="sm" disabled={locked || form.names.length >= 20} onClick={form.addName}>{copy.addTranslation}</Button>
      </fieldset>
    </> : null}
    {editor.action === "create" && editor.parent ? <p className="text-sm">{copy.parent}: {editor.parent.path.map((entry) => entry.name).join(" / ")}</p>
      : editor.action === "create" || editor.action === "move" || editor.action === "reorder"
        ? <CategoryTargetPicker mode={editor.action === "reorder" ? "before" : "parent"} source={editor.action === "create" ? null : editor.source}
          value={form.target} onChange={form.setTarget} disabled={locked}
          error={fieldError("target", editor.action === "reorder" ? "beforeId" : "parentId")} /> : null}
    {editor.action === "status" || editor.action === "delete" ? <Field label={copy.reason} error={fieldError("reason")} required showLabel>
      <Textarea value={form.reason} onChange={(event) => form.setReason(event.target.value)} disabled={locked} />
    </Field> : null}
    {!canWrite ? <p className="text-sm text-muted-foreground" role="status">{copy.writeUnavailable}</p> : null}
    {uncertain ? <Button variant="outline" onClick={onRetry} disabled={busy || !canWrite}>{copy.retryOriginal}</Button> : null}
  </div>;
  const shared = { open: true, title, isDirty: form.dirty, isSubmitting: pending, submitDisabled: !canWrite,
    onOpenChange: (open: boolean) => { if (!open && !pending) onClose(); }, onSubmit: () => { if (!locked) void form.save(); },
    error: form.invalid ? copy.formInvalid : error?.message, labels: {
      submit: title, cancel: t.common.cancel, discardTitle: t.common.discardTitle,
      discardDescription: t.common.discardDescription, discardConfirm: t.common.discardConfirm, discardCancel: t.common.cancel,
    } };
  return editor.action === "create"
    ? <FormModal {...shared} size="card" labels={{ ...shared.labels, sections: copy.translations, sectionInvalid: copy.formInvalid, close: t.common.close }}>{fields}</FormModal>
    : <FormDrawer {...shared}>{fields}</FormDrawer>;
}
