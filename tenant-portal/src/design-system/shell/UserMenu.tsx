"use client";

import { LogOut, User } from "lucide-react";
import Link from "next/link";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { DENSITY_OPTIONS, useDensity, type Density } from "../theme/DensityProvider";
import { Avatar, AvatarFallback } from "../primitives/Avatar";
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t.common.profile}
          className="relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Avatar className="size-7">
            <AvatarFallback>{initials(user.firstName, user.lastName)}</AvatarFallback>
          </Avatar>
        </button>
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
