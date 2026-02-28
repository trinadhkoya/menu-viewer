# Code Review Findings

Comprehensive code review performed on commit `b7e20c7`. Findings organized by priority.

---

## P0 — Must Fix (Correctness / Bugs)

### 1. `storeRef.current` accessed during render (React Compiler violation)
**File:** `ProductCustomizer.tsx`
**Issue:** `storeRef.current` is read inside the render body and passed to hooks. React Compiler (and future concurrent features) may produce stale reads since ref access during render is not tracked.
**Fix:** Replace `storeRef` with a state-initialized store or use `useMemo` to create the store once.

### 2. Unused parameters
**File:** `ProductCustomizer.tsx`
- `NestedIntensitySelector` receives `groupRef` but never uses it
- `ComboCustomizer` receives `onProductSelect` but never uses it

**Fix:** Remove unused params or implement the intended behavior.

### 3. Dangling `·` separator when calories is null
**File:** `ProductCustomizer.tsx` (hero meta section)
**Issue:** When a product has `price` but no `calories`, the `·` separator still renders: `$4.99 ·`
**Fix:** Conditionally render the separator only when both price and calories exist.

### 4. DiffView "N fields differ" count mismatch
**File:** `DiffView.tsx` + `menuDiff.ts`
**Issue:** The detail panel shows "N fields differ" but fewer (or zero) rows appear in the table. Ref fields (e.g., `categoryProductRefs`) produce diffs with summary values like "3 refs" → "+1 added" but the left/right values may both be non-null summaries that look identical, or the row renders but is invisible due to CSS overflow.
**Status:** Under investigation.

---

## P1 — Should Fix (Quality / Polish)

### 5. Dark mode coverage gap (~2,000 lines)
**File:** `App.css`
**Issue:** The entire `.customizer-*` section (~2,000 lines of CSS) has **no** `[data-theme="dark"]` overrides. Dozens of hardcoded light-mode colors: `#fff`, `#f8f9fa`, `#333`, `#1e3a5f`, `#e2e2e2`, etc.
**Fix:** Add dark mode overrides for all customizer classes.

### 6. Accessibility gaps
**Across all components:**
- No `role="dialog"` or `aria-modal="true"` on the customizer overlay
- No focus trap — Tab key escapes the overlay into the page behind
- No `aria-label`/`aria-labelledby` on interactive elements
- Missing focus-visible rings on custom buttons
- Color contrast: some muted text colors fail WCAG AA

### 7. Performance: `selectPriceResult` not memoized
**File:** `customizerStore.ts`
**Issue:** The `selectPriceResult` selector creates a new object on every call, causing unnecessary re-renders in all subscribers.
**Fix:** Use Zustand's `useShallow` or memoize the selector output.

### 8. Performance: JSON.stringify deep comparisons
**File:** `ProductCustomizer.tsx`
**Issue:** Several `useEffect` dependencies use `JSON.stringify(obj)` for deep comparison. This runs on every render.
**Fix:** Use a dedicated deep-equal utility or restructure state to avoid deep comparisons.

### 9. Empty CSS rulesets
**File:** `App.css`
**Issue:** Multiple empty rulesets (e.g., `.customizer-group-*` classes) left from refactoring.
**Fix:** Remove dead CSS.

---

## P2 — Nice to Have (Maintainability)

### 10. ProductCustomizer.tsx is 1,284 lines
**Issue:** Single file contains: main customizer, nested customizer, combo customizer, intensity selector, option rows, hero card, header, footer logic.
**Fix:** Extract into ~5-6 focused components:
- `CustomizerHero.tsx` — hero card
- `CustomizerOptionRow.tsx` — modifier row with selection
- `NestedCustomizer.tsx` — nested drill-down view
- `ComboCustomizer.tsx` — combo product handling
- `IntensitySelector.tsx` — intensity slider/selector

### 11. Near-identical component pairs (~250 lines duplication)
**Issue:** Main customizer and nested customizer share ~80% identical rendering logic for option rows, headers, and footers. 
**Fix:** Extract shared `OptionRow` and `Header` components.

### 12. 10 separate store subscriptions per option row
**Issue:** Each option row component subscribes to the store 10 times via individual `useStore(store, selector)` calls.
**Fix:** Combine into a single selector that returns all needed values.

### 13. App.css is 9,427 lines
**Issue:** All styles in one file makes maintenance difficult and causes merge conflicts.
**Fix:** Consider CSS modules or splitting by component (low priority given zero-dependency policy).

### 14. Legacy dead CSS classes
**File:** `App.css`
**Issue:** `.customizer-group-badge`, `.customizer-group-label`, and other `.customizer-group-*` classes are defined but no longer used after the hero card redesign.
**Fix:** Audit and remove unused classes.

### 15. No error boundaries
**Issue:** If a component throws during render (e.g., malformed menu data), the entire app crashes.
**Fix:** Add React error boundaries around major view sections.

### 16. No loading states for URL fetch
**Issue:** When loading a menu from URL, there's no visual loading indicator.
**Fix:** Add a spinner/skeleton state during fetch.

### 17. Test coverage gaps
**Issue:** Tests exist for `constructClassifier`, `menuDiff`, and `productCompareHelpers`, but no tests for:
- `menuHelpers.ts`
- `productCustomization.ts`
- `customizerStore.ts`
- Any React components

---

## Summary

| Priority | Count | Effort Estimate |
|----------|-------|-----------------|
| P0 | 4 | ~2 hours |
| P1 | 5 | ~6 hours |
| P2 | 8 | ~12 hours |

**Recommended order:** P0 items first (especially the storeRef and DiffView bugs), then dark mode (P1), then component decomposition (P2).
