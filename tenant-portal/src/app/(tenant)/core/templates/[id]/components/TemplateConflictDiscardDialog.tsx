"use client";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/design-system";
import type { ComponentProps, RefObject } from "react";
import type { TemplateConflictCopy } from "@/i18n/dictionaries/template-conflict";

type Lifecycle = Pick<ComponentProps<typeof AlertDialogContent>, "onOpenAutoFocus" | "onCloseAutoFocus" | "onEscapeKeyDown">;
export function TemplateConflictDiscardDialog({ open, copy, root, lifecycle, cancel, confirm }: {
  open: boolean; copy: TemplateConflictCopy; root: RefObject<HTMLDivElement | null>; lifecycle: Lifecycle; cancel: () => void; confirm: () => void;
}) {
  return <AlertDialog open={open} onOpenChange={next => { if (!next) cancel(); }}>
    <AlertDialogContent ref={root} {...lifecycle} className="w-[calc(100%-2rem)]">
      <AlertDialogHeader><AlertDialogTitle>{copy.discardTitle}</AlertDialogTitle><AlertDialogDescription>{copy.discardHelp}</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={event => { event.preventDefault(); cancel(); }}>{copy.cancel}</AlertDialogCancel>
        <AlertDialogAction onClick={event => { event.preventDefault(); confirm(); }}>{copy.discard}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
