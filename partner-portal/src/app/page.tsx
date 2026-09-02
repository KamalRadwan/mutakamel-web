// Restyled onto the shared token layer. The markup, the copy and the bilingual
// structure are untouched — this page's job is still to state a product
// boundary, and none of that changed. What changed is that it no longer names
// raw Tailwind palette steps.
//
// Every `slate-*` / `cyan-*` / `white` reference became a semantic role, so the
// page now inherits whatever the token layer says rather than restating it, and
// the `dark:` pairs mostly disappeared with them: a role like `--card` already
// carries its own dark value, which is the difference between a page that has a
// dark mode and a page that hardcodes two of everything.
//
// Three shapes also came down to the system's scale: `rounded-3xl`/`2xl`/`xl`
// are not steps this system has (the ceiling is `rounded-xl` at 10px, and
// nothing here needs the ceiling), and the bespoke
// `shadow-[0_24px_80px_-40px_...]` became `shadow-overlay`, the large-surface
// elevation token.
export default function Home() {
  return (
    <main className="flex min-h-screen items-center px-4 py-8 sm:px-6 sm:py-12">
      <section
        aria-labelledby="partner-portal-title"
        className="mx-auto w-full max-w-5xl overflow-hidden rounded-lg border border-border bg-card shadow-overlay"
      >
        <div className="grid lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
          {/* The one panel that is dark in both themes, so it keeps explicit ink
              steps rather than a role: --card would invert it in dark mode and
              the brand mark would lose the ground it is drawn against. */}
          <header className="flex flex-col justify-between gap-12 bg-ink-950 px-6 py-8 text-ink-100 sm:px-10 sm:py-10">
            <div className="flex items-center gap-3" dir="ltr">
              <span
                aria-hidden="true"
                className="grid size-11 place-items-center rounded-md border border-brand-300/40 bg-brand-300/10 text-lg font-semibold text-brand-200"
              >
                M
              </span>
              <div>
                <p className="text-sm font-semibold tracking-[0.18em]">
                  MUTAKAMEL
                </p>
                <p lang="ar" dir="rtl" className="mt-0.5 text-xs text-ink-400">
                  متكامل
                </p>
              </div>
            </div>

            <div>
              <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-brand-200">
                <span>نطاق مستقبلي</span>
                <span aria-hidden="true">·</span>
                <span lang="en" dir="ltr" className="tracking-[0.16em]">
                  FUTURE SCOPE
                </span>
              </p>
              <p className="mt-3 max-w-sm text-sm leading-7 text-ink-300">
                هذه الصفحة تحدد حدود المنتج الحالية بوضوح، إلى أن يُعتمد نطاق
                مستقل للبوابة.
              </p>
              <p
                lang="en"
                dir="ltr"
                className="mt-2 max-w-sm text-sm leading-6 text-ink-400"
              >
                This page marks the current product boundary until a dedicated
                portal scope is approved.
              </p>
            </div>
          </header>

          <div className="px-6 py-9 sm:px-10 sm:py-12 lg:px-12 lg:py-14">
            {/* text-2xl is the top of this scale (25px). The old text-3xl/4xl
                pair sat above every step the system defines. */}
            <h1
              id="partner-portal-title"
              className="text-2xl font-semibold tracking-tight text-foreground"
            >
              بوابة شركاء متكامل
            </h1>
            <p
              lang="en"
              dir="ltr"
              className="mt-2 text-lg font-medium text-muted-foreground"
            >
              Mutakamel Partner Portal
            </p>

            <div className="mt-8 grid gap-7 sm:grid-cols-2 sm:gap-8">
              <div lang="ar" dir="rtl">
                <h2 className="text-sm font-semibold text-foreground">
                  الحالة الحالية
                </h2>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  هذه المساحة محجوزة لإصدار مستقبلي. تسجيل دخول الشركاء،
                  والخدمات، وواجهات API غير متاحة حاليًا، ولم يُعتمد موعد
                  للإطلاق.
                </p>
              </div>

              <div
                lang="en"
                dir="ltr"
                className="border-t border-border pt-7 sm:border-e sm:border-t-0 sm:pt-0 sm:pe-8"
              >
                <h2 className="text-sm font-semibold text-foreground">
                  Current status
                </h2>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  This workspace is reserved for a future release. Partner
                  sign-in, services, and APIs are not available, and no launch
                  timeline has been approved.
                </p>
              </div>
            </div>

            {/* `muted` is the sunken step of the surface ladder — the right role
                for a panel that sits below the card it is on, and it carries its
                own dark value, so the dark: override this had is gone. */}
            <aside className="mt-9 rounded-md border border-border bg-muted px-5 py-4">
              <p className="text-sm font-medium text-foreground">
                لا توجد إجراءات متاحة في الوقت الحالي.
              </p>
              <p
                lang="en"
                dir="ltr"
                className="mt-1 text-sm text-muted-foreground"
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
