# Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────┐
│                        App.tsx                          │
│  (root layout, view routing, menu state, theme)         │
├──────────┬──────────┬───────────┬───────────┬───────────┤
│MenuUpload│ Sidebar  │ProductDtl │ DiffView  │ConstructV │
│  er.tsx  │  .tsx    │  .tsx     │  .tsx      │ iew.tsx   │
│          │          │           │            │           │
│ brand    │ category │ product   │ env-to-env │ classify  │
│ picker,  │ tree,    │ sections, │ compare,   │ every     │
│ upload,  │ search   │ customiz- │ entity     │ product,  │
│ paste,   │ results  │ er modal  │ matching   │ filter    │
│ URL      │          │           │            │ dashboard │
├──────────┴──────────┴───────────┴───────────┴───────────┤
│                     Utilities                            │
│  menuHelpers │ menuDiff │ productCompareHelpers │ ...    │
├──────────────┴──────────┴───────────────────────┴───────┤
│                   Zustand Store                          │
│              customizerStore.ts                          │
│  (per-instance customizer state via factory pattern)     │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| UI Framework | React | 19.2 |
| Language | TypeScript | 5.9 |
| Bundler | Vite | 7.3 |
| State Management | Zustand | 5.0.11 |
| Testing | Vitest + Testing Library | 4.0 |
| Linting | ESLint (flat config) | 9.39 |
| Runtime deps | **Zero** beyond React + Zustand | — |

## File Map

### Components (~3,400 lines)

| File | Lines | Purpose |
|------|-------|---------|
| `ProductCustomizer.tsx` | 1,284 | Interactive modifier selection overlay with nested drill-down, upcharge calc, combo handling |
| `ProductDetail.tsx` | 881 | Full product view — modifiers, ingredients, nutrition, sizes, images |
| `DiffView.tsx` | 587 | Menu-to-menu diff — entity list, detail panel, status filtering |
| `App.tsx` | 284 | Root layout, view routing, menu/comparison state holder |
| `ProductCompare.tsx` | — | Cross-env product comparison with modifier-group-level diffs |
| `ConstructView.tsx` | — | Product classification dashboard with filters |
| `Sidebar.tsx` | 140 | Category tree and search integration |
| `MenuUploader.tsx` | — | Brand picker, file upload, JSON paste, URL fetch |
| `MenuStats.tsx` | — | Quick stats panel for loaded menus |
| `SearchBar.tsx` / `SearchResults.tsx` | — | Fuzzy search across products |
| `CopyRef.tsx` | — | Inline ref ID display with clipboard copy |
| `BrandIcons.tsx` | — | SVG icons for each brand |
| `Breadcrumb.tsx` | — | Navigation breadcrumb |
| `ConstructBadge.tsx` | — | Colored badge for product construct type |
| `OptimizedImage.tsx` | — | Lazy-loaded product images |
| `ThemeToggle.tsx` | — | Dark/light mode switch |
| `MenupediaLogo.tsx` | — | App logo SVG |

### Utilities (~2,400 lines)

| File | Lines | Purpose |
|------|-------|---------|
| `constructClassifier.ts` | 1,298 | Rule-based product type classification engine |
| `menuHelpers.ts` | 548 | Ref resolution, modifier tree walking, category helpers |
| `menuDiff.ts` | 347 | Diff engine — entity matching (ID → displayName fallback), field comparison |
| `productCompareHelpers.ts` | 239 | Product-level deep comparison with modifier group diffs |
| `productCustomization.ts` | — | Customization-specific helpers (upcharge cases, selection logic) |
| `detectBrand.ts` | — | Auto-detect brand from menu JSON structure |

### Store

| File | Lines | Purpose |
|------|-------|---------|
| `customizerStore.ts` | 283 | Zustand store factory — creates isolated store per customizer instance |

### Types

| File | Lines | Purpose |
|------|-------|---------|
| `menu.ts` | 143 | TypeScript interfaces for MBDP menu schema |

### Styles

| File | Lines | Purpose |
|------|-------|---------|
| `App.css` | 9,427 | **All** application styles in a single file |
| `index.css` | — | Global resets and base styles |

## Key Architectural Decisions

### 1. Single CSS File
All styles live in `App.css` (~9.4K lines). This was a pragmatic choice during rapid iteration — no CSS modules, no CSS-in-JS, no Tailwind. Tradeoff: easy to global-search but hard to maintain at scale.

### 2. Zero Runtime Dependencies
Beyond React and Zustand, the app has no runtime dependencies. No axios (uses `fetch`), no lodash (hand-rolled utilities), no UI library. This keeps the bundle small (~360KB JS, ~155KB CSS) and avoids dependency churn.

### 3. Zustand Store-per-Instance
The customizer needs independent state for each product customization (especially for nested drill-downs). Rather than a global store, `createCustomizerStore()` is a factory that creates an isolated Zustand store per customizer instance, passed via React Context (`CustomizerContext`).

### 4. Entity Matching in Diff
When comparing two menus, products are matched by `_ref` ID first, then by `displayName` as a fallback. This handles cases where IDs change across environments but the product name is stable. Matched-by-name items show a visual indicator.

### 5. Construct Classification Rules
The classifier in `constructClassifier.ts` (1,298 lines) uses a rule-based approach to categorize products. Rules check for `isVirtual`, `comboProductRefs`, modifier-group-only presence, category membership, and cross-references between products.

### 6. Full-Screen Customizer Overlay
The product customizer renders as a `position: fixed; inset: 0` overlay rather than an inline panel. This was a UX decision to prevent the sidebar category tree from competing for attention during product customization. Entry animation: slide-up + fade.

## Data Flow

```
Menu JSON (file/URL/paste)
     │
     ▼
 App.tsx parses & stores in state
     │
     ├─► Sidebar.tsx (category tree)
     │       │
     │       └─► user selects product
     │               │
     │               ▼
     │       ProductDetail.tsx
     │               │
     │               └─► "Customize" button
     │                       │
     │                       ▼
     │               ProductCustomizer.tsx (full-screen overlay)
     │                       │
     │                       └─► Zustand store (selections, upcharges)
     │
     ├─► DiffView.tsx (two menus loaded)
     │       │
     │       └─► menuDiff.ts engine
     │               │
     │               ▼
     │       EntityDiff[] → list + detail panel
     │
     ├─► ConstructView.tsx
     │       │
     │       └─► constructClassifier.ts
     │               │
     │               ▼
     │       Classified products → filterable grid
     │
     └─► ProductCompare.tsx (two menus, select product)
             │
             └─► productCompareHelpers.ts
                     │
                     ▼
             Field-by-field + modifier-group diffs
```

## Component Relationships

```
App.tsx
 ├── MenuUploader (brand pick / upload)
 ├── Sidebar
 │    ├── SearchBar
 │    └── SearchResults
 ├── ProductDetail
 │    ├── OptimizedImage
 │    ├── CopyRef
 │    ├── ConstructBadge
 │    └── ProductCustomizer (overlay)
 │         └── customizerStore (Zustand context)
 ├── DiffView
 │    └── DiffDetail (inline)
 ├── ConstructView
 │    └── ConstructBadge
 ├── ProductCompare
 ├── MenuStats
 ├── Breadcrumb
 └── ThemeToggle
```
