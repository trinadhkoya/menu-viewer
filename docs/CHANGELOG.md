# Changelog

All notable changes to this project, in reverse chronological order.

---

## [b7e20c7] — 2026-02-28

### UX: Full-screen customizer overlay, hero card redesign, CopyRef everywhere

**Full-Screen Overlay**
- Product customizer now renders as `position: fixed; inset: 0; z-index: 100` overlay
- Added slide-up + fade entrance animation (`@keyframes customizer-slidein`)
- Sidebar and category tree no longer visible during customization

**Hero Card Redesign**
- Wrapped hero content in `.customizer-hero-card` with subtle background, border-radius, padding
- Horizontal layout: image (80×80 with box-shadow) left, title/price/calories stacked right
- Added `·` separator between price and calories
- Required-selections hint redesigned as pill badge with SVG info icon
- Larger title (1.18rem), increased meta font-size (0.82rem)

**Header Consistency (Main ↔ Nested)**
- Unified CSS: font-size (1rem), font-weight (800), color, meta size (0.78rem), ref size (0.7rem)
- Added 32×32 product image thumbnail to nested customizer header
- Left-aligned all title text (removed centered layout)

**CopyRef Everywhere**
- Added `<CopyRef>` to 4 previously missing locations:
  - Nested section headers (groupRef)
  - Nested option items (itemRef)
  - Combo product cards (product ref)
  - Combo entree info (first product ref)
- New CSS classes: `.customizer-combo-product-ref`, `.customizer-combo-entree-ref`

---

## [5d4f828] — 2026-02-28

### Refactor: Clean up utility functions for clarity and performance

- Utility function refactors across `menuHelpers.ts`, `productCompareHelpers.ts`, `constructClassifier.ts`
- Improved function signatures and naming
- Reduced unnecessary object allocations

---

## [7a10d53] — 2026-02-28

### Feat: Upcharge calculation (Cases 3-4) + carry customizer selections to PDP

**Upcharge Logic**
- Case 1: Modifier has explicit `price` field → use directly
- Case 2: Modifier points to a product with `price` → use product price
- Case 3: Modifier group has `defaultModifierRef` → upcharge = selected − default
- Case 4: Differential pricing via `priceOverrides`

**Selection Carry-Over**
- Customizer selections now persist when navigating back to ProductDetail
- PDP reflects customized price/calories based on selections

---

## [64d5ab7] — 2026-02-28

### Feat: Migrate ProductCustomizer to Zustand store

- Replaced `useState`/`useReducer` state management with Zustand v5
- Created `customizerStore.ts` with factory pattern (`createCustomizerStore()`)
- Each customizer instance gets an isolated store via `CustomizerContext`
- Store manages: selections, upcharges, nested drill-down stack, active size, combo entree
- Removed prop-drilling for deeply nested components

---

## [141daf2] — 2026-02-28

### UX: Redesign ProductCustomizer for clarity and polish

- Removed footer CTA, added header Save button with disabled state
- Implemented segmented tab control for size selection in nested customizer
- Added price, calories, and CopyRef to nested header
- Various UI consistency fixes across main and nested customizer views

---

## [c60185c] — 2026-02-28

### Feat: Nested customization drill-down for virtual products with size variants

- Two-level customizer: main product → drill into modifier's own modifier groups
- Animated slide transition between levels
- Size variant selection for virtual parents (Small/Medium/Large tabs)
- Collapsible header with product image, name, price, calories
- Min/max selection constraints with visual indicators

---

## [1f3650a] — 2026-02-28

### Feat: Menupedia menu-viewer app (initial commit)

**Core Features**
- Menu Browser: sidebar category tree, product detail with modifiers, ingredients, nutrition, sizes
- Construct View: product classification engine with filterable dashboard
- Menu Diff: compare two menus side-by-side with added/removed/changed highlighting
- Product Compare: deep-compare a single product across environments
- Brand Picker: pre-configured endpoints for Arby's, BWW, Sonic, Dunkin'
- Search: fuzzy search across product names, IDs, PLUs, tags, categories
- Dark/Light theme with brand-specific accent colors

**Tech Stack**
- React 19 + TypeScript 5.9 + Vite 7.3
- Zero runtime dependencies beyond React
- Vitest + Testing Library for unit tests
- ESLint flat config
