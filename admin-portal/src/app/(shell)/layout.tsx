// Placeholder shell for the 50 authenticated routes — Phase 14 of the
// design-system migration (docs/design-system/migration.md) replaces this
// with the sidebar/topbar app shell. Until then, each route/nested layout
// keeps rendering its own navbar component exactly as before the
// route-group restructuring; this file only marks the boundary.
export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
