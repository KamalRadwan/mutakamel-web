---
name: frontend-design
description: Complete UI/UX design skill combining creative identity principles, technical design system metrics (1440px layout, 1152px net width, 44px rows, WCAG standards), semantic CSS color variables, Arabic & English bilingual bi-directional support (RTL/LTR), and Next.js / Tailwind CSS best practices.
---

# Frontend Design & Technical UI/UX Skill Guide

This skill combines **Creative Identity**, **Design System Metrics**, and **Semantic CSS Color Variables Architecture** for building high-density, distinctive, bilingual (Arabic & English) Next.js & Tailwind CSS portals.

---

## Part 1: Creative Identity & Aesthetic Direction

### 1. Distinctive Identity (Avoid AI Defaults)
- **Make Opinionated Choices**: Approach every interface as a design lead building a distinctive point of view. Reject generic defaults (e.g. indiscriminate warm cream tones, generic black + single neon accent).
- **Ground it in the Subject**: Design around the specific domain, real content, instruments, and metrics of the application rather than generic placeholders.
- **Thesis Hero**: Open pages with the most characteristic operational element (headline, live data summary, or interactive widget).

### 2. Typography & Micro-copy
- **Bilingual Font Pairing**: Pair typography gracefully for both Arabic and Latin scripts (e.g., Cairo/Tajawal for Arabic and Inter/Outfit for English).
- **Micro-copy**: Write clear, active, user-centric text in both languages ("حفظ التغييرات" / "Save Changes" instead of generic verbs).
- **Restrained Motion**: Use micro-interactions, hover highlights, and deliberate transitions (`transition-all duration-150 ease-in-out`).

---

## Part 2: Technical Design System & Layout Math

### 1. Canvas & Responsive Breakdown
- **Primary Design Canvas**: `1440px × 900px` (with testing target at `1366px × 768px`).
- **Net Usable Content Width Math**:
  $$\text{Net Width} = \text{Screen Width } (1440) - \text{Sidebar } (240) - \text{Padding } (24 \times 2) = 1152\text{px}$$
  - Expanded Sidebar (240px): Net Content = **1152px**
  - Collapsed Sidebar (72px): Net Content = **1320px**
- **Breakpoints Strategy**:
  - `≥ 1280px`: Expanded Sidebar (or user preference).
  - `< 1280px`: Collapsed Sidebar (72px).
  - `< 1024px`: Drawer / Overlay Sidebar.

### 2. Component Metrics & Layout Grid
| Element | Specification / Range | Best Practice / Context |
| :--- | :--- | :--- |
| **Top Header** | `64px` fixed | Clean 8px-grid alignment |
| **Sidebar Expanded** | `240px` | Medium label lengths in RTL & LTR |
| **Sidebar Collapsed** | `72px` | `16px padding + 40px icon + 16px padding` |
| **Page Padding** | `24px` Desktop / `16px` Compact | Preserves net 1152px width |
| **Grid System** | 12 Columns, `16px` Gutter | `grid-template-columns: repeat(auto-fit, minmax(260px, 1fr))` |
| **Card Gap** | `16px` fixed | Consistent card separation |

### 3. Data Tables Density & Heights
- **Row Densities**:
  - **Compact**: `40px` (Dense data views)
  - **Default (Recommended)**: `44px` (Optimal balance for readability, checkboxes, and action icons)
  - **Comfortable**: `48px` (When rows contain avatars, 2 lines of text, or multiple badges)
- **Data Table Essentials**: Sticky table header, column visibility toggles, fixed action columns, and virtualization for large data sets.

### 4. Inputs & Buttons (WCAG Accessibility)
- **Default Control Height**: `40px`
- **Compact Toolbar Controls**: `36px`
- **Click / Touch Target**: Ensure interactive icons have minimum touch/click targets of `44px × 44px` or `48px × 48px` per WCAG AAA / Material specs.

### 5. Typography Scale (Arabic RTL & English LTR)
- **Page Title**: `22px - 24px` (`font-bold`)
- **Section Titles**: `18px - 20px` (`font-semibold`)
- **Table Data & Primary Body**: `14px` (`font-medium`) — *Do not drop main body/table text below 14px for optimal legibility in both languages*.
- **Secondary Text / Metadata**: `13px` (`text-slate-500`) — *Use only for dates, IDs, and secondary badges*.
- **Caption / Small Labels**: `12px` (`uppercase tracking-wider`).

---

## Part 3: Semantic Color Tokens & Theme Architecture

Use functional, semantic CSS color tokens (`var(--color-bg-canvas)`, `var(--color-primary)`) rather than hardcoding palette names directly in components.

### Light & Dark Token Values
```css
:root {
  color-scheme: light;
  --color-bg-canvas: #f6f8fc;
  --color-bg-surface: #ffffff;
  --color-bg-raised: #ffffff;
  --color-bg-subtle: #f1f5f9;
  --color-bg-hover: #f8fafc;
  --color-bg-selected: #eff6ff;
  --color-bg-sidebar: #ffffff;
  --color-bg-header: #ffffff;
  --color-text-primary: #0f172a;
  --color-text-secondary: #475569;
  --color-text-muted: #5b6b80;
  --color-text-disabled: #94a3b8;
  --color-border-subtle: #e2e8f0;
  --color-border-default: #cbd5e1;
  --color-border-control: #64748b;
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-primary-pressed: #1e40af;
  --color-primary-soft: #eff6ff;
  --color-on-primary: #ffffff;
  --color-link: #1d4ed8;
  --color-focus-ring: #2563eb;
  --color-success: #15803d;
  --color-success-soft: #f0fdf4;
  --color-warning: #b45309;
  --color-warning-soft: #fffbeb;
  --color-danger: #dc2626;
  --color-danger-soft: #fef2f2;
  --color-info: #0369a1;
  --color-info-soft: #f0f9ff;
}

[data-theme="dark"] {
  color-scheme: dark;
  --color-bg-canvas: #0b1220;
  --color-bg-surface: #111a2b;
  --color-bg-raised: #172235;
  --color-bg-subtle: #172235;
  --color-bg-hover: #1e2b41;
  --color-bg-selected: #102a4c;
  --color-bg-sidebar: #0e1728;
  --color-bg-header: #111a2b;
  --color-text-primary: #f8fafc;
  --color-text-secondary: #cbd5e1;
  --color-text-muted: #94a3b8;
  --color-text-disabled: #64748b;
  --color-border-subtle: #273449;
  --color-border-default: #334155;
  --color-border-control: #64748b;
  --color-primary: #60a5fa;
  --color-primary-hover: #93c5fd;
  --color-primary-pressed: #3b82f6;
  --color-primary-soft: #102a4c;
  --color-on-primary: #07111f;
  --color-link: #93c5fd;
  --color-focus-ring: #60a5fa;
  --color-success: #4ade80;
  --color-success-soft: #0d2a1b;
  --color-warning: #fbbf24;
  --color-warning-soft: #2a1f0a;
  --color-danger: #f87171;
  --color-danger-soft: #321516;
  --color-info: #38bdf8;
  --color-info-soft: #0b2636;
}
```

---

## Part 4: Project Rules & Stack Conventions

1. **Tailwind CSS First**: Always use Tailwind CSS v4 utility classes first for all layouts and components.
2. **Next.js Routing**: Always import and use `Link` from `next/link` for client-side navigation instead of plain `<a href="...">` tags.
3. **Bilingual Bi-directional Support (RTL & LTR)**:
   - Full support for both **Arabic (RTL)** and **English (LTR)** across all 3 portals.
   - Use logical directional utilities (e.g. `start-*`, `end-*`, `ms-*`, `me-*` or Tailwind logical properties) for automatic layout mirroring.
   - Ensure directional icons (arrows, chevrons, back buttons) mirror appropriately based on active locale.
