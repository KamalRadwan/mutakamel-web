import type { Metadata } from "next";
import { plexArabic, plexLatin, plexMono } from "./fonts";
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
    // No pre-hydration theme bootstrap here, unlike the tenant portal's root
    // layout. That script exists to read a stored preference before first
    // paint; this portal stores nothing and offers no theme control, so `.dark`
    // is never set and the page renders in the light palette. The dark tokens
    // are still declared in globals.css, so adding a toggle later is a wiring
    // job rather than a retheme.
    <html lang="ar" dir="rtl">
      {/* bg/text come from the `body` rule in globals.css, which reads
          --background and --foreground. Setting them again here as utilities
          would be a second place for the page's ground colour to live, and the
          slate-* pair that used to be here was a raw palette reference the
          token layer exists to remove. */}
      <body
        className={`${plexLatin.variable} ${plexArabic.variable} ${plexMono.variable} min-h-screen antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
