"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useNavbar } from "./hooks/useNavbar";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageToggle } from "./LanguageToggle";
import { UserDropdown } from "./UserDropdown";
import { CoreNavbarLinks } from "./CoreNavbarLinks";
import { CrmNavbarLinks } from "./CrmNavbarLinks";
import { NotificationsDropdown } from "./NotificationsDropdown";
import { ChevronDown } from "lucide-react";

export function Navbar() {
  const { apps, activeApp, isOpen, toggleDropdown, closeDropdown, dropdownRef } = useNavbar();
  const ActiveIcon = activeApp.icon;
  const appSwitcherButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeDropdown();
      appSwitcherButtonRef.current?.focus({ preventScroll: true });
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeDropdown, isOpen]);

  return (
    <>
    <header className="sticky top-0 z-40 flex h-[45px] min-w-0 items-center justify-between gap-1 border-b border-slate-200 bg-white/80 px-2 backdrop-blur-md sm:px-4 dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2.5">
        {/* Logo Only */}
        <Link href="/" className="flex shrink-0 items-center" aria-label="Mutakamel home">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm shadow-blue-500/20">
            M
          </div>
        </Link>

        <div className="hidden h-4 w-px bg-slate-200 sm:block dark:bg-slate-800" />

        {/* Apps Dropdown Switcher */}
        <div className="relative" ref={dropdownRef}>
          <button
            ref={appSwitcherButtonRef}
            onClick={toggleDropdown}
            type="button"
            aria-expanded={isOpen}
            aria-haspopup="menu"
            aria-controls="tenant-app-switcher-menu"
            aria-label={`Application switcher: ${activeApp.name}`}
            className="flex max-w-full cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-100/70 px-1.5 py-1 text-xs font-semibold text-slate-800 transition-all hover:bg-slate-200/60 sm:px-2.5 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <div className="w-4 h-4 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ActiveIcon className="h-3 w-3" aria-hidden="true" />
            </div>
            <span className="hidden max-w-36 truncate sm:inline">{activeApp.name}</span>
            <ChevronDown
              className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          {isOpen && (
            <div
              id="tenant-app-switcher-menu"
              role="menu"
              aria-label="Applications"
              className="fixed inset-x-2 top-[49px] z-50 space-y-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl sm:absolute sm:inset-x-auto sm:start-0 sm:top-full sm:mt-1.5 sm:w-64 dark:border-slate-800 dark:bg-slate-900"
            >
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
                    role="menuitem"
                    aria-current={app.isActive ? "page" : undefined}
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
                        <Icon className="h-4 w-4" aria-hidden="true" />
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
            <div className="mx-0.5 hidden h-4 w-px bg-slate-200 2xl:block dark:bg-slate-800" />
            <div className="hidden min-w-0 2xl:block">
              <CoreNavbarLinks />
            </div>
          </>
        )}
        {activeApp.id === "crm" && (
          <>
            <div className="mx-0.5 hidden h-4 w-px bg-slate-200 2xl:block dark:bg-slate-800" />
            <div className="hidden min-w-0 2xl:block">
              <CrmNavbarLinks />
            </div>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
        <LanguageToggle />
        <ThemeToggle />

        <NotificationsDropdown />

        <div className="mx-0.5 hidden h-4 w-px bg-slate-200 sm:block dark:bg-slate-800" />

        <UserDropdown />
      </div>
    </header>
    {activeApp.id === "core" || activeApp.id === "crm" ? (
      <div className="sticky top-[45px] z-30 overflow-x-auto border-b border-slate-200 bg-white px-2 py-1 2xl:hidden dark:border-slate-800 dark:bg-slate-900">
        {activeApp.id === "core" ? <CoreNavbarLinks /> : <CrmNavbarLinks />}
      </div>
    ) : null}
    </>
  );
}
