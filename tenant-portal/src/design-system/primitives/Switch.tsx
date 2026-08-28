import { forwardRef } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "../lib/cn";
import { focusRing } from "../lib/variants";

export const Switch = forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent",
      "data-[state=unchecked]:bg-input data-[state=checked]:bg-primary",
      "disabled:cursor-not-allowed disabled:opacity-50",
      focusRing,
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block size-4 rounded-full bg-card shadow-pop ring-0 transition-transform",
        // translate-x has no logical form. The thumb starts inset-inline-start
        // and travels toward inset-inline-end when checked, so it must flip
        // sign under RTL rather than always moving the same screen direction.
        "translate-x-0.5 rtl:data-[state=checked]:-translate-x-4 ltr:data-[state=checked]:translate-x-4",
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";
