"use client";

import { useState } from "react";

export function useAcquisitionSourceIconPreview(iconUrl: string | null) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return { visible: !!iconUrl && failedUrl !== iconUrl, onError: () => setFailedUrl(iconUrl) };
}
