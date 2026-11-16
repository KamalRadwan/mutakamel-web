"use client";

import { ImageIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { AcquisitionSource } from "../acquisition-source-contract";
import { useAcquisitionSourceIconPreview } from "../hooks/useAcquisitionSourceIconPreview";

export function SourceIconPreview({ source }: { source: AcquisitionSource }) {
  const { t } = useI18n();
  const preview = useAcquisitionSourceIconPreview(source.iconUrl);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-muted">
          {preview.visible && source.iconUrl ? (
            // The authenticated private icon must keep the browser session cookie.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={source.iconUrl} alt="" loading="lazy" onError={preview.onError} className="size-7 object-contain" />
          ) : <ImageIcon className="size-4 text-muted-foreground" aria-hidden="true" />}
        </span>
      </TooltipTrigger>
      {!preview.visible && <TooltipContent>{t.crmAcquisitionSources.iconUnavailable}</TooltipContent>}
    </Tooltip>
  );
}
