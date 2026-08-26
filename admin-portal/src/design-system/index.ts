// Public barrel for the design system. Feature code (src/app, src/features)
// imports design-system pieces only from "@/design-system", never from a
// deep path — that indirection is what lets primitives move or merge later
// without touching call sites.

export * from "./lib/cn";
export * from "./lib/variants";
export * from "./lib/tokens";

export * from "./feedback/AppToast";
export * from "./feedback/useToast";
export * from "./feedback/ToastProvider";
export * from "./feedback/format-api-error";
