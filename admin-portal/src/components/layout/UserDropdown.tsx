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
  const accountMenuLabel = `${fullName}, ${t.common.accountMenu}`;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={accountMenuLabel}
          className="h-auto gap-2.5 px-1.5 py-1 ps-2"
        >
          <span className="relative flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
            <span>{currentAdmin.firstName[0]}</span>
            <span className="absolute bottom-0 end-0 size-2.5 rounded-full border-2 border-card bg-success" aria-hidden="true" />
          </span>

          <span className="hidden flex-col text-start md:flex">
            <span className="text-xs font-semibold leading-none text-foreground">
              {fullName}
            </span>
            <span className="mt-0.5 text-xs leading-none text-muted-foreground">
              {currentAdmin.roleName}
            </span>
          </span>
          <ChevronDown className="ms-0.5 size-3.5 text-muted-foreground" aria-hidden="true" />
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
