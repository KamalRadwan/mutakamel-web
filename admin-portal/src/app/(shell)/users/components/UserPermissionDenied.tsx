"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { ErrorState, Button } from "@/design-system";

export function UserPermissionDenied() {
  const { lang, t } = useI18n();

  return (
    <div className="rounded-lg border border-border bg-card">
      <ErrorState
        title={t.users.permissionDeniedTitle}
        error={{
          isNormalized: true,
          httpStatus: 403,
          errorCode: "ADMIN_PERMISSION_DENIED",
          errorCategory: "AUTHORIZATION",
          message: t.users.permissionDeniedDesc,
        }}
      />
      <div className="flex justify-center pb-6">
        <Button variant="outline" size="sm" asChild>
          <Link href="/users">
            {lang === "ar" ? <ArrowRight className="size-3.5" /> : <ArrowLeft className="size-3.5" />}
            {t.users.backToUsers}
          </Link>
        </Button>
      </div>
    </div>
  );
}
