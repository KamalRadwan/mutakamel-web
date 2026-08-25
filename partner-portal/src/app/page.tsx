export default function Home() {
  return (
    <main className="flex min-h-screen items-center px-4 py-8 sm:px-6 sm:py-12">
      <section
        aria-labelledby="partner-portal-title"
        className="mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="grid lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
          <header className="flex flex-col justify-between gap-12 bg-slate-950 px-6 py-8 text-white sm:px-10 sm:py-10">
            <div className="flex items-center gap-3" dir="ltr">
              <span
                aria-hidden="true"
                className="grid size-11 place-items-center rounded-xl border border-cyan-300/40 bg-cyan-300/10 text-lg font-semibold text-cyan-200"
              >
                M
              </span>
              <div>
                <p className="text-sm font-semibold tracking-[0.18em]">
                  MUTAKAMEL
                </p>
                <p
                  lang="ar"
                  dir="rtl"
                  className="mt-0.5 text-xs text-slate-400"
                >
                  متكامل
                </p>
              </div>
            </div>

            <div>
              <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-cyan-200">
                <span>نطاق مستقبلي</span>
                <span aria-hidden="true">·</span>
                <span lang="en" dir="ltr" className="tracking-[0.16em]">
                  FUTURE SCOPE
                </span>
              </p>
              <p className="mt-3 max-w-sm text-sm leading-7 text-slate-300">
                هذه الصفحة تحدد حدود المنتج الحالية بوضوح، إلى أن يُعتمد نطاق
                مستقل للبوابة.
              </p>
              <p
                lang="en"
                dir="ltr"
                className="mt-2 max-w-sm text-sm leading-6 text-slate-400"
              >
                This page marks the current product boundary until a dedicated
                portal scope is approved.
              </p>
            </div>
          </header>

          <div className="px-6 py-9 sm:px-10 sm:py-12 lg:px-12 lg:py-14">
            <h1
              id="partner-portal-title"
              className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl dark:text-white"
            >
              بوابة شركاء متكامل
            </h1>
            <p
              lang="en"
              dir="ltr"
              className="mt-2 text-lg font-medium text-slate-500 dark:text-slate-400"
            >
              Mutakamel Partner Portal
            </p>

            <div className="mt-8 grid gap-7 sm:grid-cols-2 sm:gap-8">
              <div lang="ar" dir="rtl">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  الحالة الحالية
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                  هذه المساحة محجوزة لإصدار مستقبلي. تسجيل دخول الشركاء،
                  والخدمات، وواجهات API غير متاحة حاليًا، ولم يُعتمد موعد
                  للإطلاق.
                </p>
              </div>

              <div
                lang="en"
                dir="ltr"
                className="border-t border-slate-200 pt-7 sm:border-e sm:border-t-0 sm:pt-0 sm:pe-8 dark:border-slate-700"
              >
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Current status
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                  This workspace is reserved for a future release. Partner
                  sign-in, services, and APIs are not available, and no launch
                  timeline has been approved.
                </p>
              </div>
            </div>

            <aside className="mt-9 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                لا توجد إجراءات متاحة في الوقت الحالي.
              </p>
              <p
                lang="en"
                dir="ltr"
                className="mt-1 text-sm text-slate-500 dark:text-slate-400"
              >
                No actions are available at this time.
              </p>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
