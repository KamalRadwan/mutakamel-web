"use client";
import type { ComponentProps } from "react";
import { Button } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { templateRichTextCopy } from "@/i18n/template-rich-text-copy";
import { templateAuthoringHostCopy } from "@/i18n/template-authoring-host-copy";
import { FieldPicker } from "../bindings/FieldPicker";
import { StructuredTextEditor } from "../rich-text/StructuredTextEditor";
import { TemplateInspectorFeedback } from "../feedback/TemplateInspectorFeedback";
import type { InspectorExtensionPorts } from "../inspector/inspector-ports";
import { inspectorRecord } from "../inspector/inspector-contract";
import { designerBindingDescriptor, designerBindingPickerScope, designerInlineBindings } from "../../designer-extension-data";
import { useDesignerRichTextPort } from "../hooks/useDesignerRichTextPort";
import { useDesignerExtensionScope } from "./designer-extension-context";

function RichTextPort({ node, native, disabled }: ComponentProps<NonNullable<InspectorExtensionPorts["RichTextEditor"]>>) {
  const scope = useDesignerExtensionScope(), { lang } = useI18n(), copy = templateRichTextCopy[lang];
  const edit = useDesignerRichTextPort(node, native, disabled);
  const descriptor = designerBindingDescriptor(scope.provider.descriptor);
  const hostCopy = templateAuthoringHostCopy[lang];
  if (!edit.editing) return <Button type="button" variant="outline" disabled={edit.startDisabled} onClick={edit.start}>{copy.title}</Button>;
  return <div className="space-y-3"><fieldset disabled={edit.disabled}>
    <StructuredTextEditor bridge={edit.bridge} native={native} {...edit.editing} headingsEnabled={false} bindings={descriptor ? designerInlineBindings(descriptor) : []}
      onComplete={edit.complete} onTextProperties={edit.requestAppearance} />
  </fieldset>{edit.disabled && <Button type="button" variant="outline" onClick={edit.complete}>{copy.discard}</Button>}
    {edit.appearanceRequested && <div className="space-y-2"><p role="alert">{hostCopy.appearanceHelp}</p><div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={edit.keepEditing}>{hostCopy.keepEditing}</Button>
      <Button type="button" variant="outline" onClick={edit.complete}>{copy.discard}</Button>
    </div></div>}
  </div>;
}
function BindingPickerPort({ value, fields, onValue, disabled }: ComponentProps<NonNullable<InspectorExtensionPorts["BindingPicker"]>>) {
  const scope = useDesignerExtensionScope(), descriptor = designerBindingDescriptor(scope.provider.descriptor);
  const id = scope.editor.inspectorBridge.selection()[0], node = scope.editor.document?.nodes[id];
  if (!descriptor) return null;
  const picker = designerBindingPickerScope(descriptor, fields, node), binding = inspectorRecord(value);
  return <fieldset disabled={disabled || !scope.provider.isCurrent()}><FieldPicker {...picker} value={String(binding.path ?? "")}
    change={path => { if (!disabled && scope.provider.isCurrent()) onValue({ ...binding, path }); }} /></fieldset>;
}
export const designerInspectorExtensions: InspectorExtensionPorts = Object.freeze({
  RichTextEditor: RichTextPort, BindingPicker: BindingPickerPort, Feedback: TemplateInspectorFeedback,
});
