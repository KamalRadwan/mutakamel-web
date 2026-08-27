"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Settings,
  ShieldCheck,
  CreditCard,
  Bell,
  Phone,
  Mail,
  Server,
  Siren,
  HardDrive,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export function SettingsSidebar() {
  const pathname = usePathname();
  const { t } = useI18n();

  const links = [
    { href: "/settings/platform", label: t.settings.tabs.platform, icon: Server },
    { href: "/settings/auth", label: t.settings.tabs.auth, icon: ShieldCheck },
    { href: "/settings/billing", label: t.settings.tabs.billing, icon: CreditCard },
    { href: "/settings/notifications", label: t.settings.tabs.notifications, icon: Bell },
    { href: "/settings/asterisk", label: t.settings.tabs.webphone, icon: Phone },
    { href: "/settings/smtp", label: t.settings.tabs.smtp, icon: Mail },
    { href: "/settings/fatal-alerts", label: t.settings.tabs.fatalAlerts, icon: Siren },
    { href: "/settings/storage", label: t.settings.tabs.storageRuntime, icon: HardDrive },
  ];

  return (
    <aside className="w-full lg:w-64 shrink-0 space-y-1">
      <div className="mb-4 px-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Settings className="w-4.5 h-4.5 text-muted-foreground" />
          {t.settings.pageTitle}
        </h2>
      </div>

      <nav className="flex flex-col gap-1">
        {links.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                isActive
                  ? "bg-brand-500 text-ink-950 dark:bg-brand-400"
                  : "text-muted-foreground hover:bg-ink-100 dark:hover:bg-ink-800/60 hover:text-foreground"
              }`}
            >
              <Icon className="w-4.5 h-4.5 shrink-0" aria-hidden="true" />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
