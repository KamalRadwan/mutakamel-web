"use client";

import { ChevronDown, Loader2, LogOut, User } from "lucide-react";
import Link from "next/link";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useProfileAvatarImage } from "@/hooks/useProfileAvatarImage";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { useUserMenuLogout } from "./hooks/useUserMenuLogout";
import { DENSITY_OPTIONS, useDensity, type Density } from "../theme/DensityProvider";
import { Avatar, AvatarFallback, AvatarImage } from "../primitives/Avatar";
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
  const { isLoggingOut, isMenuOpen, setIsMenuOpen, handleLogoutSelect } = useUserMenuLogout(logout);
  const avatarSrc = useProfileAvatarImage(user?.id);
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
    <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t.common.profile}
          aria-busy={isLoggingOut}
          className="h-[38px] gap-2 rounded-full border border-nav-chrome-line bg-white/8 px-0 ps-1 pe-3 text-nav-foreground-strong not-disabled:hover:bg-white/15 not-disabled:hover:text-white"
        >
          <Avatar className="size-7">
            {avatarSrc ? <AvatarImage src={avatarSrc} alt="" className="object-cover" /> : null}
            <AvatarFallback className="bg-transparent bg-gradient-avatar font-semibold text-white">
              <span className="text-2xs leading-none">
                {initials(user.firstName, user.lastName)}
              </span>
            </AvatarFallback>
          </Avatar>
          {fullName && (
            <span className="hidden max-w-40 truncate text-label font-semibold text-nav-foreground-strong lg:inline">
              {fullName}
            </span>
          )}
          {isLoggingOut ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin text-nav-foreground/75 motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-3.5 shrink-0 text-nav-foreground/75" aria-hidden="true" />
          )}
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
          <Link href={TENANT_ROUTES.coreProfile}>
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
        <DropdownMenuItem
          variant="destructive"
          disabled={isLoggingOut}
          aria-busy={isLoggingOut}
          onSelect={handleLogoutSelect}
        >
          {isLoggingOut ? (
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <LogOut className="size-4" aria-hidden="true" />
          )}
          <span aria-live="polite">{isLoggingOut ? t.common.signingOut : t.common.signOut}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
