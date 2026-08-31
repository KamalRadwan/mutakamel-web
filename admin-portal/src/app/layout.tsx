import type { Metadata } from "next";
import Script from "next/script";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { plexArabic, plexLatin, plexMono } from "./fonts";
import { I18nProvider } from "@/i18n/I18nContext";
import { DirectionBridge } from "@/i18n/DirectionBridge";
import { ToastProvider } from "@/components/ui/ToastContext";
import { AuthProvider } from "@/context/AuthContext";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AdminWebPhone } from "@/components/layout/AdminWebPhone";

export const metadata: Metadata = {
  title: "متكامل - Control Plane Admin Portal",
  description: "Mutakamel Control Plane Administration Portal",
};

// Runs before hydration (next/script beforeInteractive is injected into the
// initial HTML and executes before any page code) so an English or
// LTR-preferring user never sees a wrong-direction first frame — the same
// technique next-themes uses internally, just below, for the dark class.
// Reads the same localStorage key I18nContext does (app_lang); no cookie
// plumbing needed since this only has to beat first paint, not SSR.
const LANG_DIR_BOOTSTRAP = `(function(){try{var l=window.localStorage.getItem("app_lang")==="en"?"en":"ar";document.documentElement.lang=l;document.documentElement.dir=l==="ar"?"rtl":"ltr";}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${plexLatin.variable} ${plexArabic.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <Script id="lang-dir-bootstrap" strategy="beforeInteractive">
          {LANG_DIR_BOOTSTRAP}
        </Script>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <I18nProvider>
            <DirectionBridge>
              <ToastProvider>
                <AuthProvider>
                  <AuthGuard>
                    {children}
                    <AdminWebPhone />
                  </AuthGuard>
                </AuthProvider>
              </ToastProvider>
            </DirectionBridge>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
