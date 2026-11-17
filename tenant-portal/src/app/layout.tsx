import type { Metadata } from "next";
import { headers } from "next/headers";
import { uiArabic, uiLatin, uiMono } from "./fonts";
import "./globals.css";
import { DirectionBridge } from "@/i18n/DirectionBridge";
import { I18nProvider } from "@/i18n/I18nContext";
import { loadServerLanguage, readServerLanguage } from "@/i18n/server";
import { formatTemplate } from "@/lib/format/template";
import { DensityProvider, ThemeProvider, TooltipProvider } from "@/design-system";
import { BrandingProvider } from "@/context/BrandingContext";
import { InlineBootstrapScript } from "./InlineBootstrapScript";

export async function generateMetadata(): Promise<Metadata> {
  const { dictionary: t } = await loadServerLanguage();
  return {
    title: {
      default: formatTemplate(t.metadata.title, {
        portal: t.common.portalName,
        app: t.common.appName,
      }),
      template: formatTemplate(t.metadata.titleTemplate, {
        page: "%s",
        portal: t.common.portalName,
      }),
    },
    description: t.metadata.description,
  };
}

// Language and direction come from the tenant_lang cookie on the server.
// Theme and density still live in localStorage, so this script applies them
// before hydration — see
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
  var t=localStorage.getItem("tenant_theme");
  var dark=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);
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
  const initialLanguage = await readServerLanguage();
  const directions = { ar: "rtl", en: "ltr" } as const;

  return (
    <html lang={initialLanguage} dir={directions[initialLanguage]} className={`${uiLatin.variable} ${uiArabic.variable} ${uiMono.variable} h-full`} suppressHydrationWarning>
      <head>
        <InlineBootstrapScript nonce={nonce} html={BOOTSTRAP} />
      </head>
      <body
        suppressHydrationWarning
        className="h-full antialiased"
      >
        <I18nProvider initialLanguage={initialLanguage}>
          <ThemeProvider>
            <DensityProvider>
              <DirectionBridge>
                <BrandingProvider>
                  <TooltipProvider>{children}</TooltipProvider>
                </BrandingProvider>
              </DirectionBridge>
            </DensityProvider>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
