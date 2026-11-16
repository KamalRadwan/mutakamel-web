import type { Metadata } from "next";
import { loadServerLanguage } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dictionary: t } = await loadServerLanguage();
  return { title: t.nav.appWorkspace };
}

export default function CoreLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
