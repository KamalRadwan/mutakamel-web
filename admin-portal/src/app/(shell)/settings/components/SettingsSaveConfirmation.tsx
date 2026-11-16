"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import type { useSettingsSaveConfirmation } from "../hooks/useSettingsSaveConfirmation";

export function SettingsSaveConfirmation({ confirmation, description, lang }: {
  confirmation: ReturnType<typeof useSettingsSaveConfirmation>;
  description: string;
  lang: string;
}) {
  const copy = (lang === "ar" ? ar : en).settings.confirmation;
  return (
    <AlertDialog open={confirmation.isOpen} onOpenChange={(open) => !open && confirmation.cancel()}>
      <AlertDialogContent aria-modal="true" onCloseAutoFocus={confirmation.restoreFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={(event) => {
            event.preventDefault();
            void confirmation.confirm();
          }}>
            {copy.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
