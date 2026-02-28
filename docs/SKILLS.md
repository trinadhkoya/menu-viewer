# Skills & Capabilities Demonstrated

A record of the engineering skills, patterns, and techniques applied during the development of Menupedia.

---

## 1. React & Frontend Architecture

### Component Design
- **Compound component pattern** — ProductCustomizer contains nested sub-components (Hero, OptionRow, NestedView, ComboView) that share state via context
- **Controlled overlays** — full-screen modal with `position: fixed; inset: 0` without a portal, managed via parent state
- **Conditional rendering** — extensive use of short-circuit and ternary rendering for status badges, optional fields, and view states
- **Ref forwarding** — used for scroll-to-top behavior in nested customizer transitions

### State Management
- **Zustand store factory** — `createCustomizerStore()` creates isolated stores per instance, avoiding global state pollution
- **React Context as store transport** — `CustomizerContext` provides the Zustand store to deeply nested components without prop drilling
- **Derived state** — price results, selection summaries, and upcharge calculations derived from base selections in selectors
- **Optimistic UI** — selections update immediately in the store, price recalculation follows

### Performance Patterns
- **Memoized components** — `React.memo` on frequently re-rendered option rows
- **Selector-based subscriptions** — Zustand's `useStore(store, selector)` to minimize re-renders
- **Lazy image loading** — `OptimizedImage` component with intersection observer
- **CSS animations** — hardware-accelerated `transform` + `opacity` for overlay transitions (no JS animation libraries)

---

## 2. TypeScript

### Type System Usage
- **Interface hierarchy** — `MenuData`, `Product`, `Category`, `ModifierGroup`, `Modifier`, `Ingredient` with nested ref types
- **Discriminated unions** — `EntityDiff.status: 'added' | 'removed' | 'changed'` for type-safe status handling
- **Generic utility types** — diff engine uses generic field comparison functions
- **Strict null checks** — optional chaining and nullish coalescing throughout for safe access to deeply nested menu data
- **Type narrowing** — guard functions for product construct classification

---

## 3. CSS & Visual Design

### Layout Techniques
- **Flexbox compositions** — sidebar + content, hero card (image + text stack), option rows (label + controls)
- **CSS Grid** — construct view dashboard grid with responsive columns
- **Fixed overlays** — full-screen customizer without z-index conflicts
- **Sticky positioning** — sidebar header and search bar stick while content scrolls

### Theming
- **CSS custom properties** — `--accent`, `--bg-primary`, `--text-primary` etc. driven by `data-theme` attribute
- **Brand-specific accents** — different `--accent` color per brand (Arby's red, BWW yellow, Sonic blue, etc.)
- **Dark/light toggle** — `[data-theme="dark"]` overrides with persisted preference

### Animation
- **Keyframe animations** — `@keyframes customizer-slidein` for overlay entrance
- **Transitions** — smooth hover states, collapsible sections, tab switches
- **Transform-based** — GPU-accelerated transforms for 60fps animations

---

## 4. Algorithm & Data Processing

### Diff Engine (`menuDiff.ts`)
- **Two-pass entity matching** — first pass by ID, second pass by displayName for cross-environment ID changes
- **Field-level comparison** — scalar fields compared by value, ref fields compared by structure with summarization
- **Summary generation** — "+N added, -N removed, ~N modified" summaries for ref field diffs

### Construct Classifier (`constructClassifier.ts`)
- **Rule-based classification** — 1,298 lines of domain-specific rules
- **Multi-pass analysis** — first pass identifies basic types, second pass resolves cross-references (virtual parent/child relationships)
- **Category membership analysis** — determines if a product is orphaned, modifier-only, or category-listed

### Upcharge Calculation
- **Four-case pricing model** — handles explicit price, product-ref price, default-modifier differential, and price overrides
- **Cascading fallback** — tries each case in order, falls back to next if current case doesn't apply

### Search
- **Fuzzy matching** — searches across displayName, description, PLU, tags, category names
- **Ranked results** — exact matches ranked above partial matches

---

## 5. Developer Tooling

### Build & Development
- **Vite 7.3** — sub-second HMR, ~573ms production builds
- **ESLint flat config** — modern ESLint 9 configuration
- **Vitest** — fast unit testing with Testing Library for DOM assertions
- **Zero-dependency policy** — only React + Zustand at runtime

### Code Quality
- **Comprehensive code review** — systematic P0/P1/P2 categorization of findings
- **Git discipline** — atomic commits with conventional commit messages (`feat:`, `ux:`, `refactor:`)
- **Test coverage** — unit tests for core utilities (diff engine, classifier, compare helpers)

---

## 6. Domain Expertise

### MBDP Menu Schema
- Deep understanding of the normalized menu data model: products, categories, modifier groups, modifiers, ingredients
- Knowledge of virtual parent/child relationships, combo structures, and modifier nesting patterns
- Cross-environment comparison semantics (QA vs UAT vs Production)

### Multi-Brand Support
- Brand detection from JSON structure
- Brand-specific theming and configuration
- Understanding of menu operations workflows across Inspire Brands portfolio

---

## 7. Problem-Solving Patterns Used

| Pattern | Example |
|---------|---------|
| **Iterative refinement** | Hero card went through 4 iterations: centered → left-aligned → card wrapper → pill badge |
| **Bug triangulation** | DiffView "2 fields differ" bug: traced from UI → component → diff engine → field count logic |
| **CSS-only solutions** | Full-screen overlay achieved with pure CSS (`position: fixed`) instead of portal/state lifting |
| **Factory pattern** | Zustand store factory for per-instance isolation |
| **Audit-then-fix** | CopyRef: audited all displayName usages → identified 4 missing → added systematically |
| **Deep code review** | Systematic 17-item review covering correctness, accessibility, performance, maintainability |

---

## 8. Communication & Process

- **Requirement clarification** — asked targeted questions when intent was ambiguous
- **Visual feedback loop** — responsive to screenshot-based feedback
- **Incremental delivery** — commit-after-milestone approach with clear commit messages
- **Trade-off awareness** — documented known issues and deferred improvements with rationale
