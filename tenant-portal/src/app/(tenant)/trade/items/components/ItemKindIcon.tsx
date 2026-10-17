import { Briefcase, Layers, Package } from "lucide-react";

/** The Item kind glyph, and the fallback wherever an Item has no image. */
export function ItemKindIcon({ kind, className }: { kind: string; className?: string }) {
  if (kind === "SERVICE") return <Briefcase className={className} aria-hidden="true" />;
  if (kind === "COMBO") return <Layers className={className} aria-hidden="true" />;
  return <Package className={className} aria-hidden="true" />;
}
