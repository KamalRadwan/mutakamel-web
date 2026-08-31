// Public authentication routes (/login, /admin/accept-invite,
// /admin/reset-password) render no app shell — no sidebar, no navbar.
// This layout exists as the route group's designated extension point should
// shared auth-page chrome (e.g. a background, a centered card frame) be
// needed later.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
