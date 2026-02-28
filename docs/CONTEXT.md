# Project Context

## What Is Menupedia?

Menupedia is a browser-based developer tool for exploring, debugging, and comparing **MBDP (Menu Business Data Platform) normalized menu JSON** files across Inspire Brands properties. It targets internal QA engineers, menu operations teams, and developers who need to quickly inspect, validate, and diff menu data across environments.

## Problem It Solves

- **Menu JSON is massive and deeply nested** — a single brand menu can have thousands of products, modifier groups, modifiers, ingredients, sizes, and cross-references. Navigating raw JSON is painful.
- **Cross-environment validation** — teams need to verify that menu changes in QA match what's expected before promoting to UAT/Production.
- **Construct classification** — understanding whether a product is a standard item, a combo, a virtual parent, or a modifier-only entity requires domain-specific rules that aren't obvious from raw data.
- **Customization debugging** — the modifier tree (product → modifier groups → modifiers → nested groups) can be 3+ levels deep with upcharges, defaults, min/max constraints, and conditional availability.

## Supported Brands

| Brand | Key | Sample File |
|-------|-----|-------------|
| Arby's | `arbys` | `arbys-menu-response.json` |
| Buffalo Wild Wings | `bww` | `bww-menu-response.json` |
| Sonic Drive-In | `sonic` | `snc-menu-response.json` |
| Dunkin' | `dunkin` | `dunkin-menu.json` |

Brands are auto-detected from the menu JSON structure via `utils/detectBrand.ts`.

## Environments

The Brand Picker supports loading menus from:
- **QA** — internal testing environment
- **UAT** — user acceptance testing
- **Demo** — pre-production demos
- **Production** — live menu data

Menus can also be loaded via file upload, JSON paste, or direct URL.

## Key Domain Concepts

### Menu Schema (MBDP Normalized)
- **Products** — keyed by ref ID, contain `displayName`, `description`, `isAvailable`, `isVirtual`, `plu`, `price`, `calories`, modifier group refs, ingredient refs, image URLs
- **Categories** — hierarchical tree, each containing product refs and child category refs
- **Modifier Groups** — contain modifiers (which are themselves product refs), with `min`/`max` selection constraints
- **Modifiers** — link back to products, can have their own nested modifier groups (e.g., sauce intensity → sub-modifiers)
- **Ingredients** — linked via `ingredientRefs`, describe product composition
- **Size Variants** — virtual parent products map to sized children (e.g., "Coffee" → Small, Medium, Large) via `relatedProducts`

### Product Constructs
Products are classified into structural types:
- **Standard** — simple product, no virtual flag, no combo elements
- **Virtual Parent** — `isVirtual: true`, serves as a size/variant selector
- **Virtual Child** — a sized variant linked from a virtual parent
- **Combo** — has `comboProductRefs` linking to entrees, sides, drinks
- **Modifier-Only** — appears only as a modifier, not listed in any category
- **Orphan** — not referenced by any category or modifier group

### Upcharge Calculation
When a modifier is selected, its price may add to the base product price. Four cases are handled:
1. Modifier has explicit `price` → use it
2. Modifier points to a product with `price` → use product price
3. Modifier group has `defaultModifierRef` → upcharge = selected price − default price
4. Differential pricing via `priceOverrides`

## Session History

This project was built iteratively in a single extended session (Feb 28, 2026). Major milestones:

1. **Initial app** — React 19 + TypeScript + Vite scaffold, menu parsing, sidebar, product detail
2. **Construct View** — classification engine, filterable dashboard
3. **Menu Diff** — entity matching by ID then displayName fallback, field-level comparison
4. **Product Compare** — cross-environment deep comparison
5. **Brand Picker** — pre-configured endpoints per brand/environment
6. **Product Customizer** — interactive modifier selection with nested drill-down
7. **Zustand migration** — moved customizer state from useState to Zustand store
8. **Upcharge Cases 3-4** — differential pricing logic
9. **UX polish** — full-screen overlay, hero card redesign, CopyRef everywhere
10. **Code review** — identified P0/P1/P2 improvements (dark mode gaps, accessibility, duplication)

## What's Not Yet Done

- Dark mode coverage for customizer component (~2000 lines of CSS without dark overrides)
- Accessibility (ARIA attributes, focus management, keyboard navigation)
- DiffView bug: "2 fields differ" count mismatch with visible rows
- DiffView layout restructure (vertical card layout vs horizontal table)
- Performance optimizations (memoization, reducing re-renders)
- Component decomposition (ProductCustomizer.tsx is 1284 lines)
