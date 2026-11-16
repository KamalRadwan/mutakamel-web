"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useI18n } from "@/i18n/I18nContext";
import {
  describeBrandingAssetRejection,
  inspectBrandingAssetFile,
  type BrandingAssetKind,
} from "../branding-image-validation";

export interface UseBrandingUploadModalOptions {
  kind: BrandingAssetKind;
  isUploading: boolean;
  serverError: string | null;
  onClearServerError: () => void;
  onUpload: (kind: BrandingAssetKind, file: File) => Promise<boolean>;
  onClose: () => void;
}

export function useBrandingUploadModal({
  kind,
  isUploading,
  serverError,
  onClearServerError,
  onUpload,
  onClose,
}: UseBrandingUploadModalOptions) {
  const { t, lang } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mountedRef = useRef(true);
  const selectionSeqRef = useRef(0);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      selectionSeqRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!previewUrl) return undefined;
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const selectFile = useCallback(
    async (file: File | null | undefined): Promise<void> => {
      if (isUploading || !file) return;
      const sequence = ++selectionSeqRef.current;
      onClearServerError();
      setClientError(null);
      setIsInspecting(true);
      setSelectedFile(null);
      setPreviewUrl(null);
      setDimensions(null);

      const inspection = await inspectBrandingAssetFile(kind, file);
      if (!mountedRef.current || sequence !== selectionSeqRef.current) return;

      setIsInspecting(false);
      if (!inspection.ok) {
        setClientError(describeBrandingAssetRejection(kind, inspection.reason, t, lang));
        return;
      }

      const nextPreviewUrl =
        typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
          ? URL.createObjectURL(file)
          : null;
      setSelectedFile(file);
      setPreviewUrl(nextPreviewUrl);
      setDimensions({ width: inspection.width, height: inspection.height });
    },
    [isUploading, kind, lang, onClearServerError, t],
  );

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      void selectFile(file);
    },
    [selectFile],
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (!isUploading) setIsDragActive(true);
    },
    [isUploading],
  );

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragActive(false);
      if (isUploading) return;
      void selectFile(event.dataTransfer.files?.[0]);
    },
    [isUploading, selectFile],
  );

  const openFilePicker = useCallback(() => {
    if (!isUploading) fileInputRef.current?.click();
  }, [isUploading]);

  const requestClose = useCallback(() => {
    if (isUploading) return;
    selectionSeqRef.current += 1;
    onClose();
  }, [isUploading, onClose]);

  const submit = useCallback(async (): Promise<void> => {
    if (!selectedFile || isInspecting || isUploading || clientError !== null) return;
    const uploaded = await onUpload(kind, selectedFile);
    if (uploaded && mountedRef.current) {
      onClose();
    }
  }, [clientError, isInspecting, isUploading, kind, onClose, onUpload, selectedFile]);

  const setFileInputNode = useCallback((node: HTMLInputElement | null) => {
    fileInputRef.current = node;
  }, []);

  const activeError = clientError ?? serverError;
  const canSubmit = selectedFile !== null && !isInspecting && !isUploading && clientError === null;

  return {
    setFileInputNode,
    selectedFile,
    previewUrl,
    dimensions,
    activeError,
    isInspecting,
    isDragActive,
    canSubmit,
    openFilePicker,
    handleInputChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    requestClose,
    submit,
  };
}
