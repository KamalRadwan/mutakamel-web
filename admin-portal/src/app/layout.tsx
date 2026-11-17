import type { Metadata } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { uiArabic, uiLatin, uiMono } from "./fonts";
import { I18nProvider } from "@/i18n/I18nContext";
import { DirectionBridge } from "@/i18n/DirectionBridge";
import { ToastProvider } from "@/components/ui/ToastContext";
import { AuthProvider } from "@/context/AuthContext";
import { PreferencesProvider } from "@/context/PreferencesContext";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AdminWebPhone } from "@/components/layout/AdminWebPhone";

export const metadata: Metadata = {
  title: "متكامل - Control Plane Admin Portal",
  description: "Mutakamel Control Plane Administration Portal",
};

// Runs before hydration (next/script beforeInteractive is injected into the
// initial HTML and executes before any page code) so an Arabic or
// RTL-preferring user never sees a wrong-direction first frame — the same
// technique next-themes uses internally, just below, for the dark class.
// Reads the same localStorage key I18nContext does (app_lang); no cookie
// plumbing needed since this only has to beat first paint, not SSR.
const LANG_DIR_BOOTSTRAP = `(function(){try{var l=window.localStorage.getItem("app_lang")==="ar"?"ar":"en";document.documentElement.lang=l;document.documentElement.dir=l==="ar"?"rtl":"ltr";}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Reading request headers keeps documents dynamic so each render uses the
  // nonce minted by proxy.ts, including both pre-hydration bootstraps.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      dir="ltr"
      className={`${uiLatin.variable} ${uiArabic.variable} ${uiMono.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <Script id="lang-dir-bootstrap" strategy="beforeInteractive" nonce={nonce}>
          {LANG_DIR_BOOTSTRAP}
        </Script>
        <ThemeProvider
          nonce={nonce}
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <I18nProvider>
            <DirectionBridge>
              <ToastProvider>
                <AuthProvider>
                  {/* Inside AuthProvider because it needs the session, and
                      inside ThemeProvider because applying the saved theme is
                      what it is for. */}
                  <PreferencesProvider>
                    <AuthGuard>
                      {children}
                      <AdminWebPhone />
                    </AuthGuard>
                  </PreferencesProvider>
                </AuthProvider>
              </ToastProvider>
            </DirectionBridge>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
