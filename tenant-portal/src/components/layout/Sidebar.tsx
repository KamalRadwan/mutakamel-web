"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSidebar } from "./hooks/useSidebar";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";

function getIconStyle(href: string) {
  if (href.includes("users") || href.includes("staff")) {
    return "bg-blue-500/15 text-blue-600 dark:text-blue-400";
  }
  if (href.includes("companies")) {
    return "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400";
  }
  if (href.includes("branches")) {
    return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  }
  if (href.includes("departments")) {
    return "bg-purple-500/15 text-purple-600 dark:text-purple-400";
  }
  if (href.includes("teams")) {
    return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  }
  if (href.includes("organization")) {
    return "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400";
  }
  if (href.includes("roles")) {
    return "bg-rose-500/15 text-rose-600 dark:text-rose-400";
  }
  if (href.includes("leads")) {
    return "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400";
  }
  if (href.includes("customer")) {
    return "bg-teal-500/15 text-teal-600 dark:text-teal-400";
  }
  if (href.includes("pipelines-boards") || href.includes("pipelines")) {
    return "bg-purple-500/15 text-purple-600 dark:text-purple-400";
  }
  if (href.includes("pipeline")) {
    return "bg-sky-500/15 text-sky-600 dark:text-sky-400";
  }
  if (href.includes("lead-stages")) {
    return "bg-pink-500/15 text-pink-600 dark:text-pink-400";
  }
  if (href.includes("acquisition-sources")) {
    return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  }
  if (href.includes("billing")) {
    return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  }
  if (href.includes("wallet")) {
    return "bg-violet-500/15 text-violet-600 dark:text-violet-400";
  }
  if (href.includes("activities")) {
    return "bg-sky-500/15 text-sky-600 dark:text-sky-400";
  }
  if (href.includes("settings")) {
    return "bg-blue-500/15 text-blue-600 dark:text-blue-400";
  }
  if (href.includes("api-documentation")) {
    return "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400";
  }
  if (href === "/" || href.includes("dashboard")) {
    return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  }

  return "bg-blue-500/15 text-blue-600 dark:text-blue-400";
}

export function Sidebar() {
  const { currentAppTitle, activeNavItems, isItemActive, isCollapsed, toggleCollapse, dir, pathname } = useSidebar();
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  // Auto-expand parent if active child route when pathname changes
  useEffect(() => {
    const updates: Record<string, boolean> = {};

    activeNavItems.forEach((item) => {
      if (item.children) {
        const hasActiveChild = item.children.some((child) => pathname.startsWith(child.href));
        if (hasActiveChild || pathname.startsWith(item.href)) {
          updates[item.href] = true;
        }
      }
    });

    if (Object.keys(updates).length > 0) {
      setExpandedItems((prev) => ({ ...prev, ...updates }));
    }
  }, [pathname, activeNavItems]);

  const toggleExpand = (href: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedItems((prev) => ({ ...prev, [href]: !prev[href] }));
  };

  const CollapseIcon = dir === "rtl" 
    ? (isCollapsed ? ChevronLeft : ChevronRight) 
    : (isCollapsed ? ChevronRight : ChevronLeft);

  return (
    <aside className={`${isCollapsed ? "w-[72px]" : "w-64"} transition-all duration-200 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0 h-[calc(100vh-45px)] sticky top-[45px] p-3 overflow-hidden select-none`}>
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
          const hasChildren = item.children && item.children.length > 0;
          const isChildActive = hasChildren && item.children?.some((c) => isItemActive(c.href));
          const isActive = isItemActive(item.href) || isChildActive;
          const isExpanded = expandedItems[item.href] ?? (isActive || false);
          const iconStyle = getIconStyle(item.href);

          if (hasChildren) {
            return (
              <div key={item.href} className="space-y-1">
                <button
                  type="button"
                  onClick={(e) => toggleExpand(item.href, e)}
                  title={isCollapsed ? item.label : undefined}
                  className={`w-full flex items-center justify-between rounded-xl text-xs transition-all ${
                    isCollapsed ? "justify-center p-2" : "px-2.5 py-1.5"
                  } ${
                    isActive
                      ? "bg-blue-50/80 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 font-bold border border-blue-200/50 dark:border-blue-800/50"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60 font-medium"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`p-1.5 rounded-lg flex items-center justify-center shrink-0 ${iconStyle}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>
                  {!isCollapsed && (
                    <span className="p-0.5 text-slate-400">
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </span>
                  )}
                </button>

                {!isCollapsed && isExpanded && (
                  <div className="ms-4 ps-2 border-s-2 border-slate-200 dark:border-slate-800 space-y-1 my-1">
                    {item.children?.map((subItem) => {
                      const SubIcon = subItem.icon;
                      const isSubActive = isItemActive(subItem.href);
                      const subIconStyle = getIconStyle(subItem.href);

                      return (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                            isSubActive
                              ? "bg-blue-600 text-white dark:bg-blue-500 font-bold shadow-sm"
                              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70 font-medium"
                          }`}
                        >
                          {SubIcon && (
                            <div className={`p-1 rounded-md flex items-center justify-center shrink-0 ${isSubActive ? "bg-white/20 text-white" : subIconStyle}`}>
                              <SubIcon className="w-3 h-3" />
                            </div>
                          )}
                          <span className="truncate">{subItem.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.label : undefined}
              className={`flex items-center gap-2.5 rounded-xl text-xs transition-all ${
                isCollapsed ? "justify-center p-2" : "px-2.5 py-1.5"
              } ${
                isActive
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 font-bold border border-blue-200/50 dark:border-blue-800/50"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60 font-medium"
              }`}
            >
              <div className={`p-1.5 rounded-lg flex items-center justify-center shrink-0 ${iconStyle}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

