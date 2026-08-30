"use client";

import { useI18n } from "@/i18n/I18nContext";
import { Sheet, SheetContent, SheetTitle } from "../primitives/Sheet";
import { Sidebar } from "./Sidebar";

export function MobileNav({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { lang } = useI18n();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="start"
        closeLabel={lang === "ar" ? "إغلاق التنقل الرئيسي" : "Close main navigation"}
        className="w-[min(85vw,17rem)] gap-0 border-0 p-0"
      >
        <SheetTitle className="sr-only">{lang === "ar" ? "التنقل الرئيسي" : "Main navigation"}</SheetTitle>
        <Sidebar
          collapsed={false}
          onToggleCollapse={() => {}}
          variant="mobile"
          onNavigate={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
