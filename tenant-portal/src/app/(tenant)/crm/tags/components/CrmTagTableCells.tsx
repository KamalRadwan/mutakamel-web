"use client";

import { Pencil, Trash2 } from "lucide-react";
import {
  Button, TagChip, TagColorMark, TagColorSwatch, Tooltip, TooltipContent, TooltipTrigger, findTagColorPreset,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { crmTagColor, type CrmTagCatalogueItem } from "../../shared/tag-contract";

export function CrmTagNameCell({ item }: { item: CrmTagCatalogueItem }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <TagColorMark backgroundColor={item.backgroundColor} textColor={item.textColor} />
      <TagChip label={item.name} backgroundColor={item.backgroundColor} textColor={item.textColor} />
    </div>
  );
}

export function CrmTagColourCell({ item }: { item: CrmTagCatalogueItem }) {
  const { t } = useI18n();
  const color = crmTagColor(item);
  const preset = findTagColorPreset(color);
  const label = color ? preset ? t.tagColors.names[preset.key] : t.crmTags.customColour : t.tagColors.none;
  return (
    <div className="flex items-center gap-3">
      <TagColorSwatch backgroundColor={item.backgroundColor} textColor={item.textColor}
        label={color ? `${label}: ${color.backgroundColor} / ${color.textColor}` : label} />
      <span>{label}</span>
    </div>
  );
}

interface CrmTagActionsCellProps {
  item: CrmTagCatalogueItem;
  disabled: boolean;
  onEdit: (item: CrmTagCatalogueItem) => void;
  onDelete: (item: CrmTagCatalogueItem) => void;
}

export function CrmTagActionsCell({ item, disabled, onEdit, onDelete }: CrmTagActionsCellProps) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-end gap-2 font-sans">
      <Button variant="outline" size="sm" className="text-primary focus-visible:ring-inset"
        onClick={() => onEdit(item)} disabled={disabled} aria-label={`${t.crmTags.edit}: ${item.name}`}>
        <Pencil className="size-3.5" aria-hidden="true" />{t.crmTags.edit}
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="sm" className="size-7 p-0 text-destructive focus-visible:ring-inset"
            onClick={() => onDelete(item)} disabled={disabled} aria-label={`${t.common.delete}: ${item.name}`}>
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t.common.delete}</TooltipContent>
      </Tooltip>
    </div>
  );
}
