import type { Metadata } from "next";
import Script from "next/script";
import { dmMono, readex } from "./fonts";
import "./globals.css";
import { DirectionBridge } from "@/i18n/DirectionBridge";
import { ThemeProvider, TooltipProvider } from "@/design-system";

export const metadata: Metadata = {
  title: "Tenant Portal - Mutakamel Crowd Capital",
  description: "Comprehensive SaaS Operations & Management Portal for Tenants",
};

// Both axes (language, theme) must be correct in the first painted frame.
// Neither can be resolved on the server without a cookie, so this inline
// script writes the DOM before React hydrates — see
// docs/design/theming.md#no-flash--the-mechanism.
const BOOTSTRAP = `(function(){try{
  var d=document.documentElement;
  var l=localStorage.getItem("tenant_lang")==="en"?"en":"ar";
  d.lang=l; d.dir=l==="ar"?"rtl":"ltr";
  var t=localStorage.getItem("tenant_theme");
  var dark=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);
  d.classList.toggle("dark",dark);
}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="h-full" suppressHydrationWarning>
      <head>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {BOOTSTRAP}
        </Script>
      </head>
      <body
        suppressHydrationWarning
        className={`${readex.variable} ${dmMono.variable} h-full antialiased`}
      >
        <ThemeProvider>
          <DirectionBridge>
            <TooltipProvider>{children}</TooltipProvider>
          </DirectionBridge>
        </ThemeProvider>
      </body>
    </html>
  );
}
