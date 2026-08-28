import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "@/i18n/I18nContext";
import { ToastProvider } from "@/components/ui/ToastContext";
import { AuthProvider } from "@/context/AuthContext";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AdminWebPhone } from "@/components/layout/AdminWebPhone";

export const metadata: Metadata = {
  title: "متكامل - Control Plane Admin Portal",
  description: "Mutakamel Control Plane Administration Portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="dark" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <I18nProvider>
          <ToastProvider>
            <AuthProvider>
              <AuthGuard>
                {children}
                <AdminWebPhone />
              </AuthGuard>
            </AuthProvider>
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
