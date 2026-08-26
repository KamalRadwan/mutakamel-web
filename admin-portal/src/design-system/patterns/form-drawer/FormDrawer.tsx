"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../../primitives/Sheet";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "../../primitives/AlertDialog";
import { cn } from "../../lib/cn";
import { useFormDrawer } from "./useFormDrawer";

const WIDTH_CLASS: Record<"sm" | "md" | "lg" | "xl", string> = {
  sm: "sm:max-w-[400px]",
  md: "sm:max-w-[540px]",
  lg: "sm:max-w-[720px]",
  xl: "sm:max-w-[900px]",
};

export interface FormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  titleEn: string;
  titleAr: string;
  subtitleEn?: string;
  subtitleAr?: string;
  children: ReactNode;
  footerActions?: ReactNode;
  width?: "sm" | "md" | "lg" | "xl";
  isSubmitting?: boolean;
  /** When true, closing (X, Escape, overlay click) asks for confirmation first — see form-drawer.md. */
  isDirty?: boolean;
}

/** Implements docs/components/form-drawer.md — the shared slide-over for every create/edit form in the app. */
export function FormDrawer({
  isOpen,
  onClose,
  titleEn,
  titleAr,
  subtitleEn,
  subtitleAr,
  children,
  footerActions,
  width = "md",
  isSubmitting = false,
  isDirty = false,
}: FormDrawerProps) {
  const { lang } = useI18n();
  const { showDirtyGuard, requestClose, confirmDiscard, cancelDiscard } = useFormDrawer(onClose, isDirty);

  return (
    <>
      <Sheet
        open={isOpen}
        onOpenChange={(open) => {
          if (!open && !isSubmitting) requestClose();
        }}
      >
        <SheetContent side="end" className={cn("flex w-full flex-col", WIDTH_CLASS[width])}>
          <SheetHeader>
            <SheetTitle>{lang === "ar" ? titleAr : titleEn}</SheetTitle>
            {(subtitleEn || subtitleAr) && (
              <SheetDescription>{lang === "ar" ? subtitleAr : subtitleEn}</SheetDescription>
            )}
          </SheetHeader>
          <div className="-mx-6 flex-1 overflow-y-auto px-6">{children}</div>
          {footerActions && (
            <div className="mt-auto flex items-center justify-end gap-2 border-t border-border pt-4">
              {footerActions}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={showDirtyGuard} onOpenChange={(open) => !open && cancelDiscard()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {lang === "ar" ? "تجاهل التغييرات غير المحفوظة؟" : "Discard unsaved changes?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {lang === "ar"
                ? "لديك تغييرات غير محفوظة. سيتم فقدانها إذا أغلقت هذه النافذة."
                : "You have unsaved changes. They will be lost if you close this panel."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDiscard}>
              {lang === "ar" ? "متابعة التحرير" : "Keep editing"}
            </AlertDialogCancel>
            <AlertDialogAction destructive onClick={confirmDiscard}>
              {lang === "ar" ? "تجاهل" : "Discard"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
