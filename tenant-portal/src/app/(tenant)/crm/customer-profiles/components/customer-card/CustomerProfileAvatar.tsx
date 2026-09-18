"use client";

import type { ReactNode } from "react";
import { Building2, UserRound } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  cn,
} from "@/design-system";
import type {
  CustomerProfileOwner,
  CustomerProfileType,
} from "../../hooks/useCustomerProfiles";

function initials(value: string): string {
  const parts = value.trim().split(/\s+/u).filter(Boolean);
  if (parts.length === 0) return "";
  const selected = parts.length === 1 ? parts : [parts[0], parts.at(-1)!];
  return selected.map((part) => Array.from(part)[0] ?? "").join("");
}

function ProfileAvatar({
  imageUrl,
  name,
  fallback,
  className,
}: {
  imageUrl: string | null;
  name: string;
  fallback: ReactNode;
  className?: string;
}) {
  const letters = initials(name);
  return (
    <Avatar
      className={cn("size-6 border border-border bg-muted", className)}
      aria-hidden="true"
    >
      {imageUrl && (
        <AvatarImage src={imageUrl} alt="" className="object-cover" />
      )}
      <AvatarFallback className="bg-brand-500/10 text-2xs text-brand-700 dark:text-brand-300">
        {letters || fallback}
      </AvatarFallback>
    </Avatar>
  );
}

export function CustomerProfileAvatar({
  imageUrl,
  displayName,
  profileType,
  className,
}: {
  imageUrl: string | null;
  displayName: string;
  profileType: CustomerProfileType;
  className?: string;
}) {
  const FallbackIcon = profileType === "CORPORATE" ? Building2 : UserRound;
  return (
    <ProfileAvatar
      imageUrl={imageUrl}
      name={displayName}
      fallback={<FallbackIcon className="size-3.5" aria-hidden="true" />}
      className={className}
    />
  );
}

export function CustomerOwnerAvatar({
  owner,
  className,
}: {
  owner: CustomerProfileOwner;
  className?: string;
}) {
  const name = [owner.firstName, owner.lastName].filter(Boolean).join(" ");
  return (
    <ProfileAvatar
      imageUrl={owner.avatarUrl}
      name={name}
      fallback={<UserRound className="size-3.5" aria-hidden="true" />}
      className={className}
    />
  );
}
