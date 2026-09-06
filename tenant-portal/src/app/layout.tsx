import type { Metadata } from "next";
import { headers } from "next/headers";
import { plexArabic, plexLatin, plexMono } from "./fonts";
import "./globals.css";
import { DirectionBridge } from "@/i18n/DirectionBridge";
import { ar } from "@/i18n/dictionaries/ar";
import { formatTemplate } from "@/lib/format/template";
import { DensityProvider, ThemeProvider, TooltipProvider } from "@/design-system";
import { BrandingProvider } from "@/context/BrandingContext";
import { InlineBootstrapScript } from "./InlineBootstrapScript";

// The static default and the template every route-level title composes with.
// Sourced from the Arabic dictionary rather than written here, because the
// server always renders `lang="ar"` (language lives in localStorage, so no
// request can resolve it) — hardcoding the copy would put a second, untracked
// translation surface outside src/i18n. `RouteTitle` refines the title per
// route on the client, where the language is actually known.
export const metadata: Metadata = {
  title: {
    default: formatTemplate(ar.metadata.title, {
      portal: ar.common.portalName,
      app: ar.common.appName,
    }),
    template: formatTemplate(ar.metadata.titleTemplate, {
      page: "%s",
      portal: ar.common.portalName,
    }),
  },
  description: ar.metadata.description,
};

// All three axes — language, theme, density — must be correct in the first
// painted frame. None can be resolved on the server without a cookie, so this
// inline script writes the DOM before React hydrates — see
// docs/design/theming.md#no-flash--the-mechanism.
//
// Density writes nothing for the default: globals.css already carries
// --ui-scale: 1, so STANDARD is the ABSENCE of an override rather than an
// override that happens to agree. The default moved from compact (0.9) to
// standard (1) when the admin portal's geometry was adopted — 0.9 was the one
// reason the tenant chrome rendered ~10% smaller than admin's at every edge.
// DensityProvider.applyDensity does the same, and its test pins both against
// this string so they cannot drift.
const BOOTSTRAP = `(function(){try{
  var d=document.documentElement;
  var l=localStorage.getItem("tenant_lang")==="en"?"en":"ar";
  d.lang=l; d.dir=l==="ar"?"rtl":"ltr";
  var t=localStorage.getItem("tenant_theme");
  var dark=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);
  d.classList.toggle("dark",dark);
  var s=localStorage.getItem("tenant_density");
  if(s==="compact")d.style.setProperty("--ui-scale","0.9");
  else if(s==="comfortable")d.style.setProperty("--ui-scale","1.1");
}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // `src/proxy.ts` mints this per request and hands it over on the request
  // headers. It is the only thing that lets the bootstrap survive a
  // `script-src` with no `'unsafe-inline'` — see
  // docs/architecture/security-headers.md#the-nonce-problem.
  //
  // Absent means the proxy did not run for this request, in which case no CSP
  // was set either and an un-nonced inline script is still executed. The two
  // travel together, so there is no state where the bootstrap is silently lost.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="ar" dir="rtl" className="h-full" suppressHydrationWarning>
      <head>
        <InlineBootstrapScript nonce={nonce} html={BOOTSTRAP} />
      </head>
      <body
        suppressHydrationWarning
        className={`${plexLatin.variable} ${plexArabic.variable} ${plexMono.variable} h-full antialiased`}
      >
        <ThemeProvider>
          <DensityProvider>
            <DirectionBridge>
              <BrandingProvider>
                <TooltipProvider>{children}</TooltipProvider>
              </BrandingProvider>
            </DirectionBridge>
          </DensityProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
