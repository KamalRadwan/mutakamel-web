"use client";

import Link from "next/link";
import { Construction } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export function UnavailableCapability({
  backHref,
}: {
  backHref: string;
}) {
  const { lang } = useI18n();

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center p-6 text-center">
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Construction
          className="mx-auto size-10 text-amber-500"
          aria-hidden="true"
        />
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {lang === "ar" ? "هذه الإمكانية غير متاحة بعد" : "This capability is not available yet"}
        </h1>
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
          {lang === "ar"
            ? "أُوقف النموذج التجريبي لأنه لم يكن متصلًا بعقد الخادم. لن تعرض البوابة بيانات أو نجاحًا وهميًا."
            : "The demo scaffold was disabled because it was not connected to a server contract. The portal will not show fabricated data or success states."}
        </p>
        <Link
          href={backHref}
          className="inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          {lang === "ar" ? "العودة إلى إمكانية متاحة" : "Return to an available capability"}
        </Link>
      </div>
    </section>
  );
}
