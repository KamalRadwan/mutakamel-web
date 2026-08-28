import { Readex_Pro, DM_Mono } from "next/font/google";

export const readex = Readex_Pro({
  subsets: ["latin", "arabic"],
  weight: ["400", "500", "600"],
  variable: "--font-readex",
  display: "swap",
});

export const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});
