"use client";

import Link from "next/link";
import { UserX, ArrowLeft, ArrowRight } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { EmptyState, Button } from "@/design-system";

export function UserNotFoundState() {
  const { lang, t } = useI18n();

  return (
    <EmptyState
      icon={UserX}
      title={t.users.userNotFoundTitle}
      description={t.users.userNotFoundDesc}
      action={
        <Button variant="outline" size="sm" asChild>
          <Link href="/users">
            {lang === "ar" ? <ArrowRight className="size-3.5" /> : <ArrowLeft className="size-3.5" />}
            {t.users.backToUsers}
          </Link>
        </Button>
      }
    />
  );
}
