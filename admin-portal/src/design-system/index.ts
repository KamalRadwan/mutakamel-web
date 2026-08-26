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

export * from "./primitives/Button";
export * from "./primitives/Input";
export * from "./primitives/Textarea";
export * from "./primitives/Label";
export * from "./primitives/Field";
export * from "./primitives/Checkbox";
export * from "./primitives/RadioGroup";
export * from "./primitives/Switch";
export * from "./primitives/Select";
export * from "./primitives/Card";
export * from "./primitives/Badge";
export * from "./primitives/Separator";
export * from "./primitives/Skeleton";
export * from "./primitives/Dialog";
export * from "./primitives/Sheet";
export * from "./primitives/Tabs";
export * from "./primitives/DropdownMenu";
export * from "./primitives/Tooltip";
export * from "./primitives/Popover";
export * from "./primitives/ScrollArea";
export * from "./primitives/Collapsible";
export * from "./primitives/Avatar";
export * from "./primitives/Progress";
export * from "./primitives/AlertDialog";
export * from "./primitives/Table";
export * from "./primitives/Breadcrumb";

export * from "./patterns/data-table/types";
export * from "./patterns/data-table/DataTable";
export * from "./patterns/pagination/Pagination";
export * from "./patterns/filter-bar/types";
export * from "./patterns/filter-bar/FilterBar";

export * from "./patterns/form-drawer/FormDrawer";
export * from "./patterns/page-header/PageHeader";
export * from "./patterns/empty-state/EmptyState";
export * from "./patterns/error-state/ErrorState";
export * from "./patterns/degraded-banner/DegradedBanner";
export * from "./patterns/permission-gate/PermissionGate";
export * from "./patterns/ambiguous-outcome/AmbiguousOutcomePanel";
export * from "./patterns/kpi/StatCard";
export * from "./patterns/code-ref/CodeRef";

export * from "./patterns/confirm-action/ConfirmActionModal";
export * from "./patterns/status-badge/StatusBadge";
export * from "./patterns/status-badge/tone-map";
export * from "./patterns/operation-timeline/OperationTimeline";

export * from "./shell/nav-config";
export * from "./shell/useNavTree";
export * from "./shell/useSidebar";
export * from "./shell/AppShell";
export * from "./shell/Sidebar";
export * from "./shell/Topbar";
export * from "./shell/MobileNav";
export * from "./shell/SubNav";
export * from "./shell/CommandPalette";
