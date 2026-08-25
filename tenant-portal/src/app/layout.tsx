import type { Metadata } from "next";
import { I18nProvider } from "@/i18n/I18nContext";
import { ToastProvider } from "@/components/ui/ToastContext";
import { TenantAuthProvider } from "@/context/AuthContext";
import { TenantRealtimeProvider } from "@/context/TenantRealtimeProvider";
import { TenantAuthGuard } from "@/components/auth/TenantAuthGuard";
import { TenantHostAdmission } from "@/components/auth/TenantHostAdmission";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tenant Portal - Mutakamel Crowd Capital",
  description: "Comprehensive SaaS Operations & Management Portal for Tenants",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="h-full" suppressHydrationWarning>
      <body suppressHydrationWarning className="h-full bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 antialiased">
        <TenantHostAdmission>
          <I18nProvider>
            <ToastProvider>
              <TenantAuthProvider>
                <TenantRealtimeProvider>
                  <TenantAuthGuard>{children}</TenantAuthGuard>
                </TenantRealtimeProvider>
              </TenantAuthProvider>
            </ToastProvider>
          </I18nProvider>
        </TenantHostAdmission>
      </body>
    </html>
  );
}
