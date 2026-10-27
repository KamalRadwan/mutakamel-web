"use client";

import Link from "next/link";
import { User, Shield, Settings, LogOut, ChevronDown } from "lucide-react";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/design-system";
import { useUserDropdown } from "./hooks/useUserDropdown";

export function UserDropdown() {
  const {
    t,
    isOpen,
    currentAdmin,
    canViewRoles,
    canViewSettings,
    setIsOpen,
    handleLogout,
  } = useUserDropdown();

  const fullName = `${currentAdmin.firstName} ${currentAdmin.lastName}`.trim();
  const avatarInitials = `${currentAdmin.firstName.charAt(0)}${currentAdmin.lastName.charAt(0)}`.toUpperCase();
  const accountMenuLabel = `${fullName}, ${t.common.accountMenu}`;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={accountMenuLabel}
          className="h-9.5 shrink-0 gap-2 rounded-full border border-nav-chrome-line bg-white/5 px-0 ps-1 pe-2.5 text-nav-foreground hover:bg-white/10 hover:text-nav-foreground-strong md:pe-3"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-avatar text-xs font-semibold leading-none text-white">
            {avatarInitials}
          </span>

          {fullName ? (
            <span className="hidden max-w-40 truncate text-label font-semibold text-nav-foreground-strong md:inline">
              {fullName}
            </span>
          ) : null}
          <ChevronDown className="size-3.5 shrink-0 text-nav-foreground/75" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="normal-case tracking-normal">
          <span className="mb-1 flex items-center justify-between gap-2">
            <span className="truncate text-xs font-semibold text-foreground">{fullName}</span>
            <Badge tone="info" className="shrink-0">{currentAdmin.tier}</Badge>
          </span>
          <span className="block truncate text-xs font-normal text-muted-foreground">
            {currentAdmin.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/profile">
            <User className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>{t.common.profileAndCurrency}</span>
          </Link>
        </DropdownMenuItem>
        {canViewRoles ? (
          <DropdownMenuItem asChild>
            <Link href="/roles">
              <Shield className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>{t.common.permissionsAndRoles}</span>
            </Link>
          </DropdownMenuItem>
        ) : null}
        {canViewSettings ? (
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>{t.common.systemSettings}</span>
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={() => void handleLogout()}>
          <LogOut className="size-4" aria-hidden="true" />
          <span>{t.common.signOut}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
