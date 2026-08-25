import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Mutakamel Partner Portal",
  title: "بوابة شركاء متكامل | Mutakamel Partner Portal",
  description:
    "A reserved future workspace for Mutakamel partners. Partner access and services are not available yet.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-slate-50 text-slate-950 antialiased dark:bg-slate-950 dark:text-slate-50">
        {children}
      </body>
    </html>
  );
}
