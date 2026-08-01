"use client";

import Link from "next/link";
import { useSidebar } from "./hooks/useSidebar";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Sidebar() {
  const { currentAppTitle, activeNavItems, isItemActive, isCollapsed, toggleCollapse, dir } = useSidebar();

  const CollapseIcon = dir === "rtl" 
    ? (isCollapsed ? ChevronLeft : ChevronRight) 
    : (isCollapsed ? ChevronRight : ChevronLeft);

  return (
    <aside className={`${isCollapsed ? "w-[72px]" : "w-64"} transition-all duration-200 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0 h-[calc(100vh-4rem)] sticky top-16 p-3 overflow-hidden select-none`}>
      {/* Header & Toggle Button */}
      <div className={`mb-2 pb-2 border-b border-slate-100 dark:border-slate-800/80 flex items-center ${isCollapsed ? "justify-center flex-col gap-2" : "justify-between px-2"}`}>
        {!isCollapsed && (
          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">
            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
            <span className="truncate">{currentAppTitle}</span>
          </div>
        )}

        <button
          onClick={toggleCollapse}
          type="button"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <CollapseIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Nav items list */}
      <nav className="flex-1 overflow-y-auto space-y-1 pe-0.5 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
        {activeNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = isItemActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded-xl text-xs transition-all ${
                isCollapsed ? "justify-center p-2.5" : "px-3 py-2"
              } ${
                isActive
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 font-bold border border-blue-200/50 dark:border-blue-800/50"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60 font-medium"
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`} />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
