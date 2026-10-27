"use client";

import { createContext, forwardRef, useContext } from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "../lib/cn";

export type AvatarTone = "default" | "user";

const AvatarToneContext = createContext<AvatarTone>("default");

export interface AvatarProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  tone?: AvatarTone;
}

export const Avatar = forwardRef<React.ComponentRef<typeof AvatarPrimitive.Root>, AvatarProps>(
  ({ className, tone = "default", ...props }, ref) => (
    <AvatarToneContext.Provider value={tone}>
      <AvatarPrimitive.Root
        ref={ref}
        className={cn(
          "relative flex size-8 shrink-0 overflow-hidden rounded-full",
          tone === "user" && "ring-[1.5px] ring-card",
          className,
        )}
        {...props}
      />
    </AvatarToneContext.Provider>
  ),
);
Avatar.displayName = "Avatar";

export const AvatarImage = forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image ref={ref} className={cn("aspect-square size-full", className)} {...props} />
));
AvatarImage.displayName = "AvatarImage";

export interface AvatarFallbackProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback> {
  tone?: AvatarTone;
}

// Initials fallback — shown while the image loads and whenever it fails.
export const AvatarFallback = forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Fallback>,
  AvatarFallbackProps
>(({ className, tone, ...props }, ref) => {
  const contextTone = useContext(AvatarToneContext);
  const resolvedTone = tone ?? contextTone;

  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn(
        "flex size-full items-center justify-center rounded-full text-xs",
        resolvedTone === "user"
          ? "bg-gradient-avatar font-bold text-white"
          : "bg-secondary font-medium text-secondary-foreground",
        tone === "user" && contextTone !== "user" && "ring-[1.5px] ring-inset ring-card",
        className,
      )}
      {...props}
    />
  );
});
AvatarFallback.displayName = "AvatarFallback";
