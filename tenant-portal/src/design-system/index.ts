// The only import path for feature code — never a deep path into
// primitives/patterns/views/shell/feedback/lib/theme directly. That single
// indirection is what lets a piece move, merge, or get rewritten without
// touching call sites. See docs/architecture/file-architecture.md#the-barrel.

export * from "./lib/cn";
export * from "./lib/variants";

export * from "./theme/ThemeProvider";

export * from "./primitives/Avatar";
export * from "./primitives/AlertDialog";
export * from "./primitives/Badge";
export * from "./primitives/Button";
export * from "./primitives/Card";
export * from "./primitives/Checkbox";
export * from "./primitives/Dialog";
export * from "./primitives/DropdownMenu";
export * from "./primitives/Field";
export * from "./primitives/Input";
export * from "./primitives/Label";
export * from "./primitives/Popover";
export * from "./primitives/RadioGroup";
export * from "./primitives/ScrollArea";
export * from "./primitives/Select";
export * from "./primitives/Separator";
export * from "./primitives/Sheet";
export * from "./primitives/Skeleton";
export * from "./primitives/Switch";
export * from "./primitives/Table";
export * from "./primitives/Tabs";
export * from "./primitives/Textarea";
export * from "./primitives/Tooltip";

export * from "./feedback/AppToast";
export * from "./feedback/format-api-error";
export * from "./feedback/ToastProvider";
export * from "./feedback/useToast";

export * from "./patterns/confirm-action/ConfirmActionModal";
export * from "./patterns/data-table/DataTable";
export * from "./patterns/data-table/DataTableSkeleton";
export * from "./patterns/data-table/types";
export * from "./patterns/degraded-banner/DegradedBanner";
export * from "./patterns/empty-state/EmptyState";
export * from "./patterns/error-state/ErrorState";
export * from "./patterns/filter-bar/FilterBar";
export * from "./patterns/form-drawer/FormDrawer";
export * from "./patterns/kpi/StatCard";
export * from "./patterns/page-header/PageHeader";
export * from "./patterns/pagination/Pagination";
export * from "./patterns/permission-gate/hasPermission";
export * from "./patterns/permission-gate/PermissionGate";
export * from "./patterns/status-badge/StatusBadge";
export * from "./patterns/status-badge/tone-map";

export * from "./views/ViewSwitcher";
export * from "./views/board/BoardCard";
export * from "./views/board/BoardColumn";
export * from "./views/board/BoardView";
export * from "./views/board/types";
export * from "./views/card/CardView";
export * from "./views/table/TableView";
export * from "./views/useWorkspaceView";

export * from "./shell/AppShell";
export * from "./shell/LanguageToggle";
export * from "./shell/MobileNav";
export * from "./shell/nav-config";
export * from "./shell/NotificationsDropdown";
export * from "./shell/Sidebar";
export * from "./shell/SubNav";
export * from "./shell/ThemeToggle";
export * from "./shell/Topbar";
export * from "./shell/useNavTree";
export * from "./shell/useSidebar";
export * from "./shell/UserMenu";
