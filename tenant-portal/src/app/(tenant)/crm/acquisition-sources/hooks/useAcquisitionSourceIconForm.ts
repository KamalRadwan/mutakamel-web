"use client";

import { useEffect, useRef, useState } from "react";
import type { UploadFile } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatBytes } from "@/lib/format/number";

export function useAcquisitionSourceIconForm(onSubmit: (file: File) => Promise<boolean>, uploading: boolean) {
  const { lang } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const preview = useRef<string | undefined>(undefined);
  const [rejections, setRejections] = useState<string[]>([]);
  useEffect(() => () => { if (preview.current) URL.revokeObjectURL(preview.current); }, []);
  function clearPreview() {
    if (preview.current) URL.revokeObjectURL(preview.current);
    preview.current = undefined;
    setPreviewUrl(undefined);
  }
  const files: UploadFile[] = file ? [{
    id: `${file.name}-${file.size}`, file, status: uploading ? "uploading" : "ready", previewUrl,
  }] : [];
  return {
    files, error: rejections[0],
    formatBytes: (bytes: number) => formatBytes(bytes, lang),
    add: (accepted: File[]) => {
      clearPreview(); setRejections([]);
      const next = accepted[0] ?? null;
      setFile(next);
      if (next) { preview.current = URL.createObjectURL(next); setPreviewUrl(preview.current); }
    },
    remove: () => { setFile(null); clearPreview(); setRejections([]); },
    reject: setRejections,
    submit: async () => { if (file && await onSubmit(file)) setFile(null); },
  };
}
