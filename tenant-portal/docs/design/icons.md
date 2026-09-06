# Icons

Status: **Specification**

Written: **2026-08-31**

Implementation: `src/design-system/lib/icons.ts`, exported from the
`@/design-system` barrel.

Icons come from `lucide-react` and nothing else. Emoji are banned outright —
see [anti-patterns.md](anti-patterns.md#9-emoji-as-ui). An icon never carries
meaning alone: it accompanies a label, or it takes an `aria-label` and a
`Tooltip`.

## Size — tied to `controlSize`, not chosen by eye

`iconSize` mirrors the five steps of
[`controlSize`](DESIGN-SYSTEM.md#3--sizing--density), so an icon inside a
control is sized by the control's own token rather than by whichever `size-*`
value the author reached for.

| `size` | Control height (at the shipped `--ui-scale` 1) | Icon |
| --- | ---: | --- |
| `xs` | 24px | `size-3` — 12px |
| `sm` | 28px | `size-3.5` — 14px |
| `md` | 32px | `size-3.5` — 14px |
| `lg` | 36px | `size-4` — 16px |
| `xl` | 40px | `size-5` — 20px |

```tsx
import { iconSize } from "@/design-system";

<Button size="sm">
  <Plus className={iconSize({ size: "sm" })} aria-hidden="true" />
  {label}
</Button>
```

`md` and `sm` deliberately land on the same 14px glyph. The control heights are
4px apart; the icon scale has fewer steps than the control scale because a
sub-pixel icon difference is noise, and rounding it into existence would produce
two glyph sizes nobody can tell apart. The heights above are whole pixels since
`--ui-scale` moved to 1 — the ratios the scale encodes did not change with it.

The scale carries `shrink-0`. An icon that shrinks inside a flex row is the
single most common cause of a squashed chevron next to a long Arabic label.

## Mirroring

**There is exactly one mirror mechanism: `rtl:-scale-x-100`**, exported as
`mirrorInRtl`.

```tsx
import { iconSize, mirrorInRtl } from "@/design-system";
import { cn } from "@/design-system";

<ArrowLeft className={cn(iconSize({ size: "lg" }), mirrorInRtl)} aria-hidden="true" />
```

`rtl:rotate-180` produces a visually similar result for a purely horizontal
glyph and is **not** equivalent: it flips the vertical axis too, and it composes
differently with any other transform on the same element. Two spellings also
mean neither can be linted. One outlier existed
(`/crm/customer-profiles/[id]`); it is now the canonical spelling.

Enforced in three places, because no single one of them can see the whole tree:

| Mechanism | Covers | Rejects |
| --- | --- | --- |
| ESLint `no-restricted-syntax` | everything except `src/design-system/` | `rtl:rotate-180`, `rtl:scale-x-*` |
| `pnpm design:census -- --check` | everything except `src/design-system/` | `rtlMirrorOutliers` ratcheted at **0** |
| `src/design-system/lib/icons.test.ts` | `src/design-system/` | both of the above, **plus** a directional glyph rendered with no mirror at all |

The census also carries `rtlMirrorCanonical`, an **informational** counter of
the sanctioned spelling. It is excluded from the regression set for the same
reason `fontNormalOrMedium` is: it is expected to grow.

### What mirrors

`DIRECTIONAL_ICON_NAMES` is the code-side transcription of the "Flips" column
in [theming.md](theming.md#icons-that-must-mirror). A glyph on that list
rendered without `mirrorInRtl` fails `icons.test.ts`.

| Mirrors | Never mirrors |
| --- | --- |
| `ArrowLeft` · `ArrowRight` | `ChevronDown` · `ChevronUp` · `ArrowUp` · `ArrowDown` |
| `ChevronLeft` · `ChevronRight` | `Check` · `X` · `Plus` · `Search` · `Trash2` |
| `ChevronsLeft` · `ChevronsRight` | Clock and calendar glyphs |
| `MoveLeft` · `MoveRight` | Logos and brand marks |
| `ArrowLeftToLine` · `ArrowRightToLine` | Media transport controls |

A **vertical** chevron is direction-neutral. `Accordion`'s disclosure chevron
rotates on open and must not also mirror — the two transforms would fight.
`Calendar` is a third case: `react-day-picker` already picks its chevron
orientation from `dir`, so adding a mirror there would cancel it out.

## The canonical icon per concept

One concept, one glyph, across every screen in the product. A second glyph for
"delete" is how an interface starts to read as assembled rather than designed.

This map is the reference; it is deliberately **not** a code export. A single
module re-exporting forty icons defeats `lucide-react`'s per-icon tree shaking,
and every route would pay for glyphs it does not render.

### Records and navigation

| Concept | Icon | Notes |
| --- | --- | --- |
| Back to list | `ArrowLeft` | Mirrors |
| Breadcrumb separator | `ChevronRight` | Mirrors |
| Previous / next page | `ChevronLeft` / `ChevronRight` | Mirrors |
| Disclosure (accordion, tree) | `ChevronDown` | Rotates, never mirrors |
| Open in a new place | `ExternalLink` | |
| Overflow menu | `MoreHorizontal` | Never `MoreVertical` — pick one |
| Command palette | `Search` | Same glyph as search; it *is* search |
| Sort, unsorted | `ArrowUpDown` | |
| Sort, applied | `ArrowUp` / `ArrowDown` | Vertical: no mirror |
| Drag handle | `GripVertical` | |
| Column settings | `Columns3` | |

### Actions

| Concept | Icon |
| --- | --- |
| Create | `Plus` |
| Edit | `Pencil` |
| Delete | `Trash2` |
| Duplicate | `Copy` |
| Copy to clipboard | `Copy`, becoming `Check` on success |
| Save | no icon — the label carries it |
| Filter | `SlidersHorizontal` |
| Refresh / retry | `RotateCw` |
| Upload | `Upload` |
| Download | `Download` |
| Remove one chip or file | `X` |
| Confirm / applied | `Check` |

### State and outcome

| Concept | Icon | Role |
| --- | --- | --- |
| Error, load failure | `AlertTriangle` | `negative` |
| Warning, needs attention | `AlertTriangle` | `caution` |
| Success | `CheckCircle2` | `positive` |
| Information, read-only notice | `Info` | `ink` |
| Blocked, no permission | `ShieldAlert` | `ink` |
| Not found | `SearchX` | `ink` |
| Offline / connection lost | `WifiOff` | `caution` |
| In progress | **no icon** — the pending dot | `ink` + motion |

`AlertTriangle` appears twice on purpose. The glyph says "something needs your
attention"; the **role colour** says how badly. Giving warning and error
different glyphs makes the pair harder to scan, not easier.

### Objects

| Concept | Icon |
| --- | --- |
| User, person | `User` |
| Users, team | `Users` |
| Company, legal entity | `Building2` |
| Branch, location | `MapPin` |
| Attachment, file | `Paperclip` |
| Image | `ImageIcon` |
| Money, invoice | `Receipt` |
| Time, history | `Clock` |
| Audit event | `History` |
| Scheduled activity | `Activity` |
| Settings | `Settings` |
| Permissions, roles | `KeyRound` |

`Activity` — the pulse line — and never `Zap`. An activity has a due date, and
a lightning bolt reads as energy or as something instantaneous, which is the
opposite of scheduled. It is a stroke glyph, so at the `sm` step it carries a
heavier `strokeWidth={2.5}` — at 14px a hairline polyline is not a mark. The
weight is lucide's own prop, not `stroke-[2.5]`, which is ambiguous between a
stroke colour and a stroke width.

## Checklist

- [ ] Sized through `iconSize({ size })`, matching the control it sits in
- [ ] `aria-hidden="true"` when a visible label is beside it
- [ ] `aria-label` **and** a `Tooltip` when it is the only content of a control
- [ ] Directional glyphs carry `mirrorInRtl`; nothing else does
- [ ] The concept's canonical glyph from the map above, not a synonym
- [ ] No emoji
