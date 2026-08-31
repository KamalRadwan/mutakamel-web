import type { Metadata } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import { dmMono, readex } from "./fonts";
import "./globals.css";
import { DirectionBridge } from "@/i18n/DirectionBridge";
import { DensityProvider, ThemeProvider, TooltipProvider } from "@/design-system";
import { TenantBrandingTokens } from "./TenantBrandingTokens";

export const metadata: Metadata = {
  title: "Tenant Portal - Mutakamel Crowd Capital",
  description: "Comprehensive SaaS Operations & Management Portal for Tenants",
};

// All three axes — language, theme, density — must be correct in the first
// painted frame. None can be resolved on the server without a cookie, so this
// inline script writes the DOM before React hydrates — see
// docs/design/theming.md#no-flash--the-mechanism.
//
// Density writes nothing for the default: globals.css already carries
// --ui-scale: 0.9, so compact is the ABSENCE of an override rather than an
// override that happens to agree. DensityProvider.applyDensity does the same,
// and its test pins both against this string so they cannot drift.
const BOOTSTRAP = `(function(){try{
  var d=document.documentElement;
  var l=localStorage.getItem("tenant_lang")==="en"?"en":"ar";
  d.lang=l; d.dir=l==="ar"?"rtl":"ltr";
  var t=localStorage.getItem("tenant_theme");
  var dark=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);
  d.classList.toggle("dark",dark);
  var s=localStorage.getItem("tenant_density");
  if(s==="standard")d.style.setProperty("--ui-scale","1");
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
        <Script id="theme-bootstrap" strategy="beforeInteractive" nonce={nonce}>
          {BOOTSTRAP}
        </Script>
      </head>
      <body
        suppressHydrationWarning
        className={`${readex.variable} ${dmMono.variable} h-full antialiased`}
      >
        <ThemeProvider>
          <DensityProvider>
            <DirectionBridge>
              <TenantBrandingTokens />
              <TooltipProvider>{children}</TooltipProvider>
            </DirectionBridge>
          </DensityProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
