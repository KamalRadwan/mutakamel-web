"use client";

import { Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { useInspectorCopy } from "../inspector/useInspectorForm";
import { useQuotationImageReplacement, type QuotationImageEditor } from "../hooks/useQuotationImageReplacement";

export function QuotationImageReplacement({ editor }: { editor: QuotationImageEditor }) {
  const copy = useInspectorCopy();
  const replacement = useQuotationImageReplacement(editor);
  if (!replacement) return null;

  return <Field label={copy.asset} showLabel className="min-w-40 max-w-64" error={replacement.failed ? copy.blocked : undefined}>
    <Select value={replacement.currentAssetId} onValueChange={replacement.replace}>
      <SelectTrigger><SelectValue placeholder={copy.image} /></SelectTrigger>
      <SelectContent>{replacement.assets.map(asset => <SelectItem key={asset.id} value={asset.id}>
        <bdi>{asset.originalFileName}</bdi>
      </SelectItem>)}</SelectContent>
    </Select>
  </Field>;
}
