import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Keep custom token namespaces aligned with globals.css and the CRM Leads v3 contract.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["2xs", "micro", "badge", "caption", "label", "tab", "card-title", "column-title"],
      radius: ["card", "column"],
      shadow: ["pop", "overlay", "toolbar", "column", "card", "nav-active"],
    },
    classGroups: {
      "bg-image": [
        {
          bg: [
            "gradient-header",
            "gradient-brand-strip",
            "gradient-primary",
            "gradient-avatar",
            "gradient-logo",
            "gradient-canvas",
            "gradient-chip-active",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
