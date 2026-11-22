# Page views

## List pages: Board, Cards, Table

Every list page has a toolbar, start to end: primary "New" button, search field (fills the space), a divider, the advanced search toggle, a divider, the view switcher. Dividers are 1px `border`, 16 high. The switcher's active segment is `brand`.

### Board (kanban)

- Light gray columns (`neutral-soft`) with soft shadow, so the white cards stand out. Header: stage name, count pill, add button, collapse button. Under it a 4px status bar.
- Status bar and card due badge follow the due status colors (rule 11). The status bar is split into segments by the share of the stage's leads per due status, no activity (gray) included (2px gap between segments).
- Cards sit on the gray column as floating cards: `surface`, 1px `border`, `shadow-card` (as every card).
- Card title: an individual shows its display name only. A company shows the company name, and under it the primary contact's name only (no job title or other details).
- Empty stage: dashed zone with icon, "No leads in this stage", helper line and a "Quick add" button.
- Collapsed stage: 44px vertical strip with expand button, count (weight 500), name rotated to read from bottom to top, and stage icon. Cards can be dropped on it. Which stages are collapsed is remembered in the browser per user.
- Card: start edge in the card color (none by default), icon tile, name, expand and "..." buttons, divider, rating stars, due badge, view icon, owner avatar.
- Card color: the start edge takes the card's color; with no color (the default) the card has no colored edge. The backend colors map to tokens: RED `chart-5`, ORANGE `chart-9`, AMBER `warning`, YELLOW `chart-4`, GREEN `chart-3`, TEAL `chart-8`, BLUE `chart-1`, INDIGO `chart-10`, PURPLE `chart-6`, PINK `chart-7`, SLATE `icon-gray`. It is chosen from the card's Actions menu ("Change color": a grid of round swatches 20 plus "No color").
- Card Actions menu: Open, Edit, Change color, Move to (every other stage), then Delete after a divider. "Change color" and "Move to" open a submenu beside the menu, toward the inline start.
- Rating stars are clickable: choosing a star sets the rating to it; choosing the star that is already the current rating clears the rating to 0. On hover the stars up to the hovered one light up as a preview (filled `warning`); leaving restores the saved rating; only a click saves.
- Only one card per stage is expanded at a time; expanding a card collapses the other expanded card of the same stage.
- Expanded details, one row each with a 14 icon in `text-muted`, shown only when the value exists. Company: company phone, company email, primary contact phone, primary contact email, location. Individual: phone, email, location. Location is the country flag (`flag-icons`, 4:3), then "Country - City". Every phone is followed by the call, WhatsApp and Telegram icons. The details area never starts a drag, so its text (phone, email) can be selected and copied.
- Cards are dragged between stages. Existing behaviors to keep: live updates, keyboard alternative to dragging.
- Scrolling (owner 2026-11-21): columns never scroll on their own; the whole page scrolls vertically and the board scrolls sideways. Each stage loads one page of cards and ends with the "Load more (24 of 86)" button (or the "all shown" line), see 08-additional-screens "Kanban column totals and load more".

### Stage filter (Cards and Table)

Under the toolbar, the Cards and Table views show a stage filter (`shared/ui/step-filter`). It is a row of filled arrow buttons shaped like a breadcrumb: "All", then every active stage in order, each with its count for the current search. The chosen step is saturated (`bg-brand`); the others are soft (`bg-brand-soft`). The Disqualified step uses the danger colors and the Converted step the success colors. The choice is kept in the `stage` URL parameter. In right-to-left the arrows point left.

### Cards

- Grid view (owner 2026-11-21): every card in the grid has the SAME height (all rows as tall as the tallest card), the footer row (stars, activity, owner) is pinned to the bottom of each card, cards use `shadow-popover` so they read as floating, and the grid gap is 12.

Two card designs:

- Detailed card for data-heavy records (leads, opportunities): the board card plus stage chip, company, value, phone.
- Compact horizontal card for products: icon or product image, name, code and category, price, stage chip, stock badge, "..." button.

### Table

Rows as cards with the gradient header. See Components.

## Tree pages: three views

Catalogue (multi-level) and organization (company, branch, department, team) offer three views through the same switcher:

- Card rows: indented cards, 24px per level, with type label and count.
- Columns: each level in its own column.
- Org chart: top-down chart; each card has a 6px top band colored by level, name, type and count.

## Activities: three views

- Activity form: the quick due chips (Today, Tomorrow, In 2 days, Next week, Next month) take the color of the selected activity type (its `icon-*` tile color): unselected = 1px border and text in that color on `surface`; selected = filled with that color and `on-icon` text.

- Timeline grouped by day, with a dot in the due status color.
- Card grid, each card with a top band in the due status color.
- Monthly agenda: month grid with a gradient weekday header; activities inside each day in the due status color; today's number in a `brand` circle; "+N more" when a day has more than two. There is no weekly view.

Clicking an activity or "+N more" opens a modal.

## Themes

Two themes: Light (Gray 1, default) and Dark (Navy 5). The user switches between them. Status badges and icon tiles keep their colors in both.
