import { useState } from "react";
import { TEMPLATE_LIMITS } from "@mutakamel/template-schema/browser-safe";
import { useI18n } from "@/i18n/I18nContext";
import { tableInsertionCopy } from "@/i18n/dictionaries/template-table-insertion";
import type { EditorDocument } from "../../template-editor-model";
import type { ScopedTableChoice, ScopedTableOffer } from "../bindings/scoped-table-source";

interface Selection {
  document: EditorDocument | null;
  offerPin: string;
  sourcePath: string;
  columns: string[];
  failed: boolean;
}

export function useScopedTableSelection(document: EditorDocument | null, available: ScopedTableOffer | null,
  disabled: boolean, insert: (choice: ScopedTableChoice) => boolean) {
  const { lang } = useI18n();
  const [selection, setSelection] = useState<Selection | null>(null);
  const offer = disabled ? null : available;
  const current = selection && selection.document === document && selection.offerPin === offer?.pin ? selection : null;
  const source = offer?.sources.find(item => item.sourcePath === current?.sourcePath);
  const columns = current?.columns ?? [];

  const selectSource = (sourcePath: string) => {
    if (offer?.sources.some(item => item.sourcePath === sourcePath)) {
      setSelection({ document, offerPin: offer.pin, sourcePath, columns: [], failed: false });
    }
  };
  const canChooseColumn = (path: string) => columns.includes(path) || columns.length < TEMPLATE_LIMITS.maxTableColumns;
  const selectColumn = (path: string, checked: boolean) => {
    if (!current || !source?.columnPaths.includes(path) || !canChooseColumn(path)) return;
    const next = checked ? [...new Set([...columns, path])] : columns.filter(column => column !== path);
    setSelection({ ...current, columns: next, failed: false });
  };
  const submit = () => {
    if (!current || !source || !columns.length) return;
    const applied = insert({ offerPin: current.offerPin, sourcePath: source.sourcePath, rowKeyPath: source.rowKeyPath, columnPaths: columns });
    setSelection(applied ? null : { ...current, failed: true });
  };

  return { copy: tableInsertionCopy[lang], offer, source, columns, failed: current?.failed,
    selectSource, selectColumn, submit, canSubmit: !!source && columns.length > 0, canChooseColumn };
}
