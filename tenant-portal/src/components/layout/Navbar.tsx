"use client";

import Link from "next/link";
import { useNavbar } from "./hooks/useNavbar";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageToggle } from "./LanguageToggle";
import { UserDropdown } from "./UserDropdown";
import { WebPhoneTrigger } from "./WebPhoneTrigger";
import { WebRTCPhoneWidget } from "./WebRTCPhoneWidget";
import { CoreNavbarLinks } from "./CoreNavbarLinks";
import { CrmNavbarLinks } from "./CrmNavbarLinks";
import { TradeNavbarLinks } from "./TradeNavbarLinks";
import { NotificationsDropdown } from "./NotificationsDropdown";
import { ChevronDown, Calendar } from "lucide-react";

export function Navbar() {
  const { t, apps, activeApp, isOpen, toggleDropdown, closeDropdown, dropdownRef } = useNavbar();
  const ActiveIcon = activeApp.icon;

  return (
    <header className="h-[45px] border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 px-4 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        {/* Logo Only */}
        <Link href="/" className="flex items-center shrink-0">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm shadow-blue-500/20">
            M
          </div>
        </Link>

        <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800"></div>

        {/* Apps Dropdown Switcher */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={toggleDropdown}
            type="button"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-slate-100/70 dark:bg-slate-800/60 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-all text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <div className="w-4 h-4 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ActiveIcon className="w-3 h-3" />
            </div>
            <span>{activeApp.name}</span>
            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
          </button>

          {isOpen && (
            <div className="absolute top-full mt-1.5 start-0 z-50 w-64 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-1.5 space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Applications
              </div>
              {apps.map((app) => {
                const Icon = app.icon;
                return (
                  <Link
                    key={app.id}
                    href={app.href}
                    onClick={closeDropdown}
                    className={`flex items-center p-2 rounded-xl text-xs transition-colors ${
                      app.isActive
                        ? "bg-blue-50/80 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        app.isActive
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="leading-snug">{app.name}</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                          {app.description}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Dynamic Horizontal App Nav Links */}
        {activeApp.id === "core" && (
          <>
            <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-0.5 hidden md:block"></div>
            <div className="hidden md:block">
              <CoreNavbarLinks />
            </div>
          </>
        )}
        {activeApp.id === "crm" && (
          <>
            <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-0.5 hidden md:block"></div>
            <div className="hidden md:block">
              <CrmNavbarLinks />
            </div>
          </>
        )}
        {activeApp.id === "trade" && (
          <>
            <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-0.5 hidden md:block"></div>
            <div className="hidden md:block">
              <TradeNavbarLinks />
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <WebPhoneTrigger />
        <LanguageToggle />
        <ThemeToggle />

        <Link
          href="/crm/activities-tasks-calendar-reminders"
          className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={t.nav.crmActivities}
        >
          <Calendar className="w-4 h-4" />
        </Link>

        <NotificationsDropdown />

        <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-0.5"></div>

        <UserDropdown />
      </div>
      <WebRTCPhoneWidget />
    </header>
  );
}
