"use client";

import { Avatar, AvatarFallback, AvatarImage, cn } from "@/design-system";

export function CrmOwnerAvatar({
  initials,
  name,
  imageUrl,
  className,
}: {
  initials: string;
  name?: string;
  imageUrl?: string | null;
  className?: string;
}) {
  const trimmedInitials = initials.trim();
  const trimmedImageUrl = imageUrl?.trim() ?? "";
  if (!trimmedInitials && !trimmedImageUrl) {
    return <></>;
  }

  const label = name?.trim() || trimmedInitials || undefined;

  return (
    <Avatar
      tone="user"
      title={label}
      aria-label={label}
      className={cn("size-[25px]", className)}
    >
      {trimmedImageUrl ? <AvatarImage src={trimmedImageUrl} alt="" /> : null}
      <AvatarFallback>
        <span className="text-micro leading-none">{trimmedInitials}</span>
      </AvatarFallback>
    </Avatar>
  );
}
