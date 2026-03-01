# Prompt: Add a New Data Quality Field Check

Copy, fill in the blanks, and paste this prompt to add a new field check to the Data Quality page.

---

## The Prompt

```
Add a Data Quality check for **[FIELD_NAME]** (e.g. price, calories, nutritionalInfo).

### Detection rules

| Product type | Rule | Severity | Priority |
|---|---|---|---|
| Non-virtual | `[FIELD_NAME]` is missing/empty/falsy → flag it | **warning** | **[high / medium]** |
| Virtual — parent has field, sized products don't | Sized products can inherit from virtual → observation only | **info** | **low** |
| Virtual — parent also missing | Nothing to inherit → flag it | **warning** | **[high / medium]** |

"Missing" means: `[FIELD_NAME]` is `null`, `undefined`, empty string, or `[any extra falsy condition, e.g. 0 for price]`.

### What to check

- **Field path on Product**: `product.[FIELD_NAME]`  
  _(or `product.customAttributes.[FIELD_NAME]` if nested)_
- **Icon**: [EMOJI]
- **Check title**: "Products missing [FIELD_NAME]"
- **Inheritable title**: "[FIELD_NAME] inheritable from virtual"

### Implementation checklist

1. **menuHelpers.ts** — add:
   - `_has[FieldName](p)` predicate (or reuse `_scanMissingField` with inline predicate)
   - `ProductMissing[FieldName]` type (or reuse `_MissingFieldResult` mapped type)
   - `getProductsMissing[FieldName](menu)` — filters `!isVirtual || !parentHasField`
   - `get[FieldName]InheritableObservations(menu)` — filters `isVirtual && parentHasField`
   - Export all new types and functions

2. **DataQuality.tsx** — add:
   - Import the 2 new functions + type
   - `useMemo` hooks for both  
   - Push 2 new entries into the `checks` array (warning + info)
   - Wire both into `<MissingFieldDetail>` via `check.id` conditionals
   - Add both to `handleExport` CSV via `pushFieldRows`
   - Add both to `useDataQualityCount` (only the warning one)
   - Add to `healthScore` denominator

3. **menu.ts** — if the field doesn't already exist on `Product`, add it to the interface.

### Follow existing patterns
- Use `_scanMissingField(menu, predicate)` generic scanner if the field lives directly on Product or follows the same virtual → sized structure.
- Keep the same type shape: `{ productRef, productName, isVirtual, parentHas[X], groups[], directProducts[] }`.
- Non-virtual hits → `groups: [], directProducts: []` (flat entry).
```

---

## Quick example — adding `price` check

```
Add a Data Quality check for **price**.

| Product type | Rule | Severity | Priority |
|---|---|---|---|
| Non-virtual | price is null/undefined/0 → flag it | warning | high |
| Virtual | We don't care about the virtual product's own price. Check its sized products directly — if a sized product has price null/undefined/0, flag it | warning | high |
| Virtual — parent has price, sized don't | Still flag — no inheritance concept for price | warning | high |

"Missing" means: price is null, undefined, or 0.

- Field: product.price
- Icon: 💲
- Title: "Products missing price"
- No inheritable observation for price (price doesn't inherit).
```
