"use client";

import { ChevronDown, LogOut, User } from "lucide-react";
import Link from "next/link";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { DENSITY_OPTIONS, useDensity, type Density } from "../theme/DensityProvider";
import { Avatar, AvatarFallback } from "../primitives/Avatar";
import { Button } from "../primitives/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../primitives/DropdownMenu";

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function UserMenu() {
  const { t } = useI18n();
  const { user, logout } = useTenantAuth();
  const { density, setDensity } = useDensity();

  // A lookup, not a ternary chain: the zero-ternary rule exists because a
  // nested one carried hardcoded Arabic past the lint gate once already.
  const densityLabel: Record<Density, string> = {
    compact: t.common.densityCompact,
    standard: t.common.densityStandard,
    comfortable: t.common.densityComfortable,
  };

  if (!user) return null;

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t.common.profile}
          className="h-7 gap-1.5 rounded-full border border-white/20 bg-white/10 ps-1 pe-2.5 text-white hover:bg-white/20 hover:text-white"
        >
          <Avatar className="size-5">
            <AvatarFallback className="bg-gradient-to-br from-sky-400 to-indigo-500 text-2xs font-bold text-white">
              {initials(user.firstName, user.lastName)}
            </AvatarFallback>
          </Avatar>
          {fullName && (
            <span className="max-w-40 truncate text-xs font-semibold text-white">
              {fullName}
            </span>
          )}
          <ChevronDown className="size-3 shrink-0 text-white/70" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">
            {user.firstName} {user.lastName}
          </span>
          <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={TENANT_ROUTES.coreSessions}>
            <User className="size-4" aria-hidden="true" />
            {t.common.profile}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {t.common.density}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={density}
          onValueChange={(next) => setDensity(next as Density)}
        >
          {DENSITY_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {densityLabel[option]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void logout()}>
          <LogOut className="size-4" aria-hidden="true" />
          {t.common.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
