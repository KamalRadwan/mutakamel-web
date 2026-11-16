"use client";

import { GripVertical, ImagePlus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Tooltip, TooltipContent, TooltipTrigger } from "@/design-system";
import { localizedName } from "@/lib/format/localized";
import type { AcquisitionSource } from "../acquisition-source-contract";
import type { useAcquisitionSourcesWorkspace } from "../hooks/useAcquisitionSourcesWorkspace";

export function AcquisitionSourceActions({ source, workspace }: { source: AcquisitionSource; workspace: ReturnType<typeof useAcquisitionSourcesWorkspace> }) {
  const { state, editor, icon, busy } = workspace;
  const { t, lang } = state;
  const name = localizedName(source, lang);
  const disabled = busy || state.writeBlocked || workspace.hasOpenForm || !!workspace.selectedForMove;
  return (
    <div className="flex items-center justify-end gap-1 font-sans">
      <Tooltip><TooltipTrigger asChild>
        <Button id={workspace.dialogFocus.actionId(source.id, "edit")} variant="outline" size="sm" className="size-7! p-0!" disabled={disabled} aria-label={`${t.crmAcquisitionSources.editTitle}: ${name}`} onClick={() => editor.select(source)}>
          <Pencil className="size-3.5" aria-hidden="true" />
        </Button>
      </TooltipTrigger><TooltipContent>{state.needsReload ? t.crmAcquisitionSources.reloadRequired : t.crmAcquisitionSources.editTitle}</TooltipContent></Tooltip>
      <Button id={workspace.dialogFocus.actionId(source.id, "icon")} variant="outline" size="sm" disabled={disabled}
        aria-label={`${t.crmAcquisitionSources.iconTitle}: ${name}`} onClick={() => icon.select(source)}>
        <ImagePlus className="size-3.5" aria-hidden="true" />{t.crmAcquisitionSources.iconTitle}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button id={workspace.dialogFocus.actionId(source.id, "menu")} variant="outline" size="sm" className="size-7! p-0!" disabled={disabled} aria-label={`${t.crmAcquisitionSources.moreActions}: ${name}`}>
          <MoreHorizontal className="size-3.5" aria-hidden="true" />
        </Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" onCloseAutoFocus={workspace.dialogFocus.onMenuCloseAutoFocus}>
          <DropdownMenuItem disabled={workspace.reorderBlocked} onSelect={() => workspace.openMove(source)}><GripVertical className="size-4" aria-hidden="true" />{t.crmAcquisitionSources.moveTitle}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => state.selectForDelete(source)}><Trash2 className="size-4" aria-hidden="true" />{t.common.delete}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
