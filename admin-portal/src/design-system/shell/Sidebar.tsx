"use client";

import Link from "next/link";
import { ShieldCheck, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useNavTree } from "./useNavTree";
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/Tooltip";
import { Button } from "../primitives/Button";
import { cn } from "../lib/cn";
import { focusRing, hitArea } from "../lib/variants";
import type { NavItem, NavSection } from "./nav-config";

export const SIDEBAR_EXPANDED_WIDTH = "15rem";
export const SIDEBAR_COLLAPSED_WIDTH = "3.25rem";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** Renders inside a Sheet for mobile — drops the fixed positioning/width and the collapse rail entirely. */
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
}

export function Sidebar({ collapsed, onToggleCollapse, variant = "desktop", onNavigate }: SidebarProps) {
  const { lang } = useI18n();
  const { sections, activeItem } = useNavTree();
  const isCollapsed = variant === "desktop" && collapsed;
  const mainSections = sections.filter((s) => !s.pinned);
  const pinnedSections = sections.filter((s) => s.pinned);

  return (
    <aside
      className={cn(
        "h-full flex-col bg-sidebar text-sidebar-foreground",
        variant === "desktop"
          ? "fixed inset-y-0 start-0 z-40 hidden border-e border-sidebar-border transition-[width] duration-150 motion-reduce:transition-none lg:flex"
          : "flex",
      )}
      style={variant === "desktop" ? { width: isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH } : undefined}
    >
      <div className={cn("flex h-12 shrink-0 items-center border-b border-sidebar-border", isCollapsed ? "justify-center px-2" : "gap-2.5 px-3")}>
        <Link
          href="/dashboard"
          onClick={onNavigate}
          aria-label={isCollapsed ? (lang === "ar" ? "لوحة تحكم متكامل" : "Mutakamel dashboard") : undefined}
          className={cn(
            "flex min-w-0 items-center gap-2.5 rounded-md outline-none",
            focusRing,
            "focus-visible:ring-sidebar-ring focus-visible:ring-offset-sidebar",
            hitArea,
          )}
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <ShieldCheck className="size-4" aria-hidden="true" />
          </span>
          {!isCollapsed && (
            <span className="flex min-w-0 flex-col leading-none">
              <span className="truncate text-sm font-semibold text-sidebar-foreground">
                {lang === "ar" ? "متكامل" : "Mutakamel"}
              </span>
              <span className="mt-0.5 truncate text-xs text-muted-foreground">
                {lang === "ar" ? "مركز التحكم" : "Control Plane"}
              </span>
            </span>
          )}
        </Link>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 py-3" aria-label={lang === "ar" ? "التنقل الرئيسي" : "Main navigation"}>
        {mainSections.map((section) => (
          <SidebarGroup key={section.key} section={section} collapsed={isCollapsed} activeItem={activeItem} lang={lang} onNavigate={onNavigate} />
        ))}
      </nav>

      {pinnedSections.length > 0 && (
        <div className="shrink-0 border-t border-sidebar-border px-2 py-3">
          {pinnedSections.map((section) => (
            <SidebarGroup key={section.key} section={section} collapsed={isCollapsed} activeItem={activeItem} lang={lang} onNavigate={onNavigate} />
          ))}
        </div>
      )}

      {variant === "desktop" && (
        <div className="shrink-0 border-t border-sidebar-border p-2">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onToggleCollapse}
            aria-label={
              isCollapsed
                ? lang === "ar" ? "توسيع الشريط الجانبي" : "Expand sidebar"
                : lang === "ar" ? "طي الشريط الجانبي" : "Collapse sidebar"
            }
            title={`${lang === "ar" ? "تبديل الشريط الجانبي" : "Toggle sidebar"} (Ctrl/⌘+B)`}
            aria-keyshortcuts="Control+B Meta+B"
            className={cn(
              "h-8 w-full justify-start gap-2 px-2 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring focus-visible:ring-offset-sidebar",
              isCollapsed && "justify-center",
            )}
          >
            {isCollapsed ? (
              lang === "ar" ? <PanelLeftClose className="size-4" aria-hidden="true" /> : <PanelLeftOpen className="size-4" aria-hidden="true" />
            ) : (
              lang === "ar" ? <PanelLeftOpen className="size-4" aria-hidden="true" /> : <PanelLeftClose className="size-4" aria-hidden="true" />
            )}
            {!isCollapsed && <span className="text-xs font-medium">{lang === "ar" ? "طي" : "Collapse"}</span>}
          </Button>
        </div>
      )}
    </aside>
  );
}

function SidebarGroup({
  section,
  collapsed,
  activeItem,
  lang,
  onNavigate,
}: {
  section: NavSection;
  collapsed: boolean;
  activeItem: NavItem | undefined;
  lang: "ar" | "en";
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {!collapsed && section.labelKey && (
        <p
          className={cn(
            "px-2.5 pb-1 text-xs font-semibold text-muted-foreground/80",
            lang === "ar" ? "tracking-normal" : "uppercase tracking-wider",
          )}
        >
          {lang === "ar" ? section.labelKey.ar : section.labelKey.en}
        </p>
      )}
      {section.items.map((item) => (
        <SidebarLink key={item.key} item={item} collapsed={collapsed} active={activeItem?.key === item.key} lang={lang} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

function SidebarLink({
  item,
  collapsed,
  active,
  lang,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
  lang: "ar" | "en";
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const label = lang === "ar" ? item.labelKey.ar : item.labelKey.en;

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-label={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-8 items-center gap-2.5 rounded-md text-xs outline-none transition-colors motion-reduce:transition-none",
        collapsed ? "justify-center px-0" : "px-2.5",
        active
          ? "bg-sidebar-selected font-medium text-sidebar-selected-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        "motion-reduce:transition-none",
        focusRing,
        "focus-visible:ring-sidebar-ring focus-visible:ring-offset-sidebar",
        hitArea,
      )}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute inset-y-1 start-0 w-0.5 rounded-full bg-sidebar-primary"
        />
      )}
      <Icon className="size-4 shrink-0 text-current" aria-hidden="true" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side={lang === "ar" ? "left" : "right"}>{label}</TooltipContent>
    </Tooltip>
  );
}
