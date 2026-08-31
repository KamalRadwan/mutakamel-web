import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class lists, resolving conflicting Tailwind utilities (last one
 * wins) rather than concatenating them. Every design-system component and
 * every call site that overrides a component's className should go through
 * this instead of template-literal concatenation.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
