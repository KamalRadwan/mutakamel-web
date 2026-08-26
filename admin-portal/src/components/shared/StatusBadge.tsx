// Re-export shim (docs/design-system/migration.md Phase 13). The real
// implementation moved to src/design-system/patterns/status-badge/,
// with its enum-to-tone table moved from a switch statement into
// tone-map.ts as data and its 5-hue map collapsed to 4 roles + a
// "progress" (neutral + pulse) treatment. Props kept exactly
// (enumType/customLabelEn/customLabelAr/showDot/size) so the 26 existing
// call sites are unaffected.
export { StatusBadge, type StatusBadgeProps } from "@/design-system/patterns/status-badge/StatusBadge";
