import { forwardRef } from "react";
import { cn } from "../lib/cn";
import { identifierText } from "../lib/variants";

export interface IdentifierTextProps
  extends React.HTMLAttributes<HTMLElement> {
  /**
   * Selects the whole value on one click. For keys a user is expected to hand
   * to support — idempotency keys, correlation ids — where a partial copy is
   * worse than no copy.
   */
  selectAll?: boolean;
}

/**
 * The one way to render a machine identifier: a UUID, a correlation id, an
 * idempotency key, a cursor, a wire code, a slug.
 *
 * Two things it does that a plain monospace `<span>` cannot:
 *
 * 1. **`<bdi dir="ltr">`.** This app's chrome is Arabic, so an RTL paragraph
 *    direction is the default. A bare Latin identifier inside it is reordered
 *    by the Unicode bidirectional algorithm — leading and trailing digits and
 *    punctuation migrate to the wrong end, so the id a user *reads* and the id
 *    they *copy out of a screenshot* is not the id the system holds. That is a
 *    correctness bug, not a cosmetic one. `<bdi>` isolates the run and
 *    `dir="ltr"` pins its internal direction, which together make the rendered
 *    order equal the stored order regardless of surrounding text.
 *    See docs/design/accessibility.md#bidirectional-text.
 * 2. **`wrap-anywhere`, never `break-all`.** A 36-character UUID has no break
 *    point, so it overflows a narrow cell. `overflow-wrap: anywhere` breaks it
 *    only when it would otherwise overflow; `word-break: break-all` also
 *    hyphenates ordinary prose mid-syllable, in both scripts.
 *    See docs/design/typography.md#identifiers-wrap-never-overflow.
 *
 * `scripts/design/identifier-guard.mjs` fails the build on a bare `font-mono`
 * identifier, so the two rules cannot be forgotten one call site at a time —
 * which is how 98 of them accumulated.
 */
export const IdentifierText = forwardRef<HTMLElement, IdentifierTextProps>(
  ({ className, selectAll, ...props }, ref) => (
    <bdi
      ref={ref}
      // Both attributes are load-bearing and neither substitutes for the
      // other: `dir` sets the direction, `<bdi>` isolates it from the
      // surrounding paragraph. A `<span dir="ltr">` still leaks its
      // directional influence outward into the Arabic sentence around it.
      dir="ltr"
      className={cn(identifierText, selectAll && "select-all", className)}
      {...props}
    />
  ),
);
IdentifierText.displayName = "IdentifierText";
