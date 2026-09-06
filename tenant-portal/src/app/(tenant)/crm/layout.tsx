// A pass-through, deliberately — like core/layout.tsx and trade/layout.tsx.
//
// A segment layout that renders a real <div> puts an auto-height box between
// the shell's <main> and the screen, and `h-full` resolves against the nearest
// box rather than the nearest one with a height. Every CRM screen asks for
// `h-full`; with an unstyled wrapper in the way it computed to `auto`, so a
// board sized itself to its cards, stopped short of the fold, and the PAGE
// scrolled instead of the columns. This layout used to hand the full-height
// column to `/crm/opportunities` alone by matching the pathname — which is why
// the leads board was short, and why every board added later would have been
// too, until someone thought to add its route to a list in here.
//
// The height chain lives in AppShell: <main> is the flex item with the definite
// height, so a screen that wants the whole pane has to be its child. The one
// thing /crm/opportunities needs beyond that is `overflow-hidden`, and that now
// sits on its own workspace root, where the screen asking for it can see it.
export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
