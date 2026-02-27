/**
 * Brand-Agnostic Product Construct Classifier
 *
 * Classifies every product in a menu based on its actual structural properties
 * in the JSON — works for Sonic, Arby's, BWW, Dunkin', or any future brand.
 *
 * Detection is purely data-driven: we look at what fields are present and how
 * they're configured (ingredientRefs, modifierGroupRefs, relatedProducts,
 * isVirtual, isRecipe, isCombo, volumePrices, quantity patterns, etc.).
 */

import type { Menu, Product, ProductGroup, ChildRefOverride, Quantity } from '../types/menu';
import {
  resolveRef,
  isProductGroupRef,
  isProductRef,
} from './menuHelpers';

// ────────────────────────────────────────────────────────────────
// Construct Tags — atomic structural traits detected from the data
// ────────────────────────────────────────────────────────────────

export type ConstructTag =
  // === Core product shape ===
  | 'simple'                // No ingredientRefs, no modifierGroupRefs, no alternatives
  | 'virtual'              // isVirtual = true (parent shell for variants)
  | 'recipe'               // isRecipe = true (recipe-level product)
  | 'combo-like'           // ingredientRefs contain entree + side/drink groups

  // === Customization ===
  | 'has-ingredients'      // Has ingredientRefs (customizable via product groups)
  | 'has-modifiers'        // Has modifierGroupRefs (preparation customization)
  | 'has-both'             // Both ingredientRefs and modifierGroupRefs

  // === Alternatives / Sizing ===
  | 'has-alternatives'     // relatedProducts contains size/variant productGroup refs
  | 'no-alternatives'      // No relatedProducts pointing to productGroups

  // === Ingredient detail traits ===
  | 'ingredients-with-defaults'   // Some ingredient childRef has isDefault=true
  | 'ingredients-no-defaults'     // Has ingredients but none are default
  | 'ingredients-non-removable'   // Default + quantity.min >= 1 (can't remove)
  | 'ingredients-max-selection'   // Ingredient productGroup has selectionQuantity.max
  | 'ingredients-free-qty'        // Ingredient productGroup has selectionQuantity.free or child.quantity.free
  | 'ingredients-intensity'       // Child has quantity.max > 1 (Easy/Regular/Extra pattern)

  // === Dunkin-specific patterns (auto-detected) ===
  | 'volume-prices'        // Has volumePrices array (e.g. dozen donuts)
  | 'default-if-selected'  // selectionQuantity.defaultIfSelected or child.quantity.defaultIfSelected
  | 'max-unique-choices'   // selectionQuantity.maxUniqueChoices
  | 'free-quantity'         // selectionQuantity.free > 0 on ingredient groups

  // === Combo sub-traits ===
  | 'has-entree-group'     // ingredientRefs point to an entree-selection group
  | 'has-side-group'       // ingredientRefs point to a side group
  | 'has-drink-group'      // ingredientRefs point to a drink group
  | 'side-has-default'     // Side group has a default child
  | 'side-no-default'      // Side group exists but no default
  | 'drink-has-default'    // Drink group has a default child
  | 'drink-no-default'     // Drink group exists but no default
  | 'multi-entree'         // Multiple entree groups or entree group with multiple selections
  | 'negative-price'       // price < 0 (deal)

  // === Drink detection ===
  | 'drink-product'        // Product looks like a drink (name/category heuristic)

  // === Misc ===
  | 'has-operation-hours'  // Has operationHours (daypart restricted)
  | 'has-tags'             // Has tags array (allergens, etc.)
  | 'has-nutrition'        // Has nutrition with totalCalories > 0
  | 'has-cta-label'        // Has ctaLabel (size label like "Sm", "Med", "Lg")
  | 'has-custom-attributes'; // Has customAttributes

// ────────────────────────────────────────────────────────────────
// Classification result
// ────────────────────────────────────────────────────────────────

export interface ConstructClassification {
  /** Primary product shape */
  primary: 'simple' | 'customizable' | 'virtual' | 'combo-like';
  /** All detected structural tags */
  tags: ConstructTag[];
  /** Human-readable one-line summary */
  summary: string;
  /** Color for primary badge */
  color: string;
  /** Icon for primary badge */
  icon: string;
}

// ────────────────────────────────────────────────────────────────
// Tag metadata for UI rendering
// ────────────────────────────────────────────────────────────────

export interface TagInfo {
  label: string;
  description: string;
  color: string;
  icon: string;
  /** Tags that are grouping categories (shown in the filter panel) */
  isFilterable: boolean;
}

export const TAG_INFO: Record<ConstructTag, TagInfo> = {
  // Core shape
  'simple':                 { label: 'Simple', description: 'No customization — standalone item', color: '#22c55e', icon: '🧁', isFilterable: true },
  'virtual':                { label: 'Virtual', description: 'Virtual product — not in POS, groups size variants', color: '#f97316', icon: '👻', isFilterable: true },
  'recipe':                 { label: 'Recipe', description: 'Recipe-level product', color: '#06b6d4', icon: '🍳', isFilterable: true },
  'combo-like':             { label: 'Combo / Meal', description: 'Bundles entree + side + drink', color: '#8b5cf6', icon: '🍔+🍟', isFilterable: true },

  // Customization
  'has-ingredients':        { label: 'Ingredients', description: 'Customizable via ingredient refs (product groups)', color: '#3b82f6', icon: '🧩', isFilterable: true },
  'has-modifiers':          { label: 'Modifiers', description: 'Has modifier groups for preparation options', color: '#f59e0b', icon: '🔧', isFilterable: true },
  'has-both':               { label: 'Ingredients + Modifiers', description: 'Both ingredient refs and modifier groups', color: '#ec4899', icon: '🎛️', isFilterable: true },

  // Alternatives
  'has-alternatives':       { label: 'Has Alternatives', description: 'Size/variant alternatives via relatedProducts', color: '#a855f7', icon: '📏', isFilterable: true },
  'no-alternatives':        { label: 'No Alternatives', description: 'No size or variant options', color: '#94a3b8', icon: '•', isFilterable: false },

  // Ingredient detail
  'ingredients-with-defaults':   { label: 'Default Ingredients', description: 'Some ingredients are pre-selected', color: '#06b6d4', icon: '✅', isFilterable: true },
  'ingredients-no-defaults':     { label: 'No Default Ingredients', description: 'Ingredients available but none pre-selected', color: '#64748b', icon: '⬜', isFilterable: true },
  'ingredients-non-removable':   { label: 'Non-Removable', description: 'Some defaults cannot be removed (min >= 1)', color: '#ef4444', icon: '🔒', isFilterable: true },
  'ingredients-max-selection':   { label: 'Max Selection', description: 'Ingredient groups have a max selection limit', color: '#f59e0b', icon: '🔢', isFilterable: true },
  'ingredients-free-qty':        { label: 'Free Quantity', description: 'Some ingredients include free quantity', color: '#10b981', icon: '🎁', isFilterable: true },
  'ingredients-intensity':       { label: 'Intensity (Easy/Reg/Extra)', description: 'Quantity-based intensity options', color: '#8b5cf6', icon: '🌡️', isFilterable: true },

  // Dunkin patterns
  'volume-prices':          { label: 'Volume Pricing', description: 'Quantity-based pricing tiers (e.g. dozen discount)', color: '#0ea5e9', icon: '📦', isFilterable: true },
  'default-if-selected':    { label: 'Default If Selected', description: 'Default quantity changes based on size selection', color: '#d946ef', icon: '🔄', isFilterable: true },
  'max-unique-choices':     { label: 'Max Unique Choices', description: 'Limits on number of unique ingredient choices', color: '#f43f5e', icon: '🔺', isFilterable: true },
  'free-quantity':          { label: 'Free Qty on Group', description: 'Product group offers free quantity; overage charged', color: '#84cc16', icon: '🆓', isFilterable: true },

  // Combo sub-traits
  'has-entree-group':       { label: 'Entree Group', description: 'Contains an entree selection group', color: '#7c3aed', icon: '🍔', isFilterable: false },
  'has-side-group':         { label: 'Side Group', description: 'Contains a side selection group', color: '#059669', icon: '🍟', isFilterable: false },
  'has-drink-group':        { label: 'Drink Group', description: 'Contains a drink selection group', color: '#0891b2', icon: '🥤', isFilterable: false },
  'side-has-default':       { label: 'Side Default', description: 'Side group has a default selection', color: '#047857', icon: '🍟✅', isFilterable: false },
  'side-no-default':        { label: 'Side No Default', description: 'Side group has no default', color: '#059669', icon: '🍟⬜', isFilterable: false },
  'drink-has-default':      { label: 'Drink Default', description: 'Drink group has a default selection', color: '#155e75', icon: '🥤✅', isFilterable: false },
  'drink-no-default':       { label: 'Drink No Default', description: 'Drink group has no default', color: '#0e7490', icon: '🥤⬜', isFilterable: false },
  'multi-entree':           { label: 'Multi-Entree', description: 'Multiple entree selections in the combo', color: '#6d28d9', icon: '🍔🍔', isFilterable: true },
  'negative-price':         { label: 'Negative Price (Deal)', description: 'Has a negative price — likely a deal or discount', color: '#dc2626', icon: '💰', isFilterable: true },

  // Drink
  'drink-product':          { label: 'Drink', description: 'Identified as a drink product', color: '#06b6d4', icon: '🥤', isFilterable: true },

  // Misc
  'has-operation-hours':    { label: 'Daypart Restricted', description: 'Has operationHours — available at specific times', color: '#f97316', icon: '🕐', isFilterable: true },
  'has-tags':               { label: 'Has Tags', description: 'Has tags (allergens, dietary info, etc.)', color: '#94a3b8', icon: '🏷️', isFilterable: false },
  'has-nutrition':          { label: 'Has Nutrition', description: 'Has nutrition data with calories', color: '#94a3b8', icon: '📊', isFilterable: false },
  'has-cta-label':          { label: 'Has CTA Label', description: 'Has a CTA label (size name like Sm, Med, Lg)', color: '#94a3b8', icon: '🏷️', isFilterable: false },
  'has-custom-attributes':  { label: 'Custom Attributes', description: 'Has custom attributes (brand-specific data)', color: '#94a3b8', icon: '⚙️', isFilterable: false },
};

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function hasAlternatives(product: Product): boolean {
  if (!product.relatedProducts) return false;
  for (const [key, override] of Object.entries(product.relatedProducts)) {
    if (isProductGroupRef(key)) return true;
    if (key === 'alternatives' && override && typeof override === 'object') return true;
    if (override && typeof override === 'object') {
      for (const innerRef of Object.keys(override)) {
        if (isProductGroupRef(innerRef)) return true;
      }
    }
  }
  return false;
}

function getIngredientGroups(menu: Menu, product: Product): Array<{ ref: string; group: ProductGroup }> {
  if (!product.ingredientRefs) return [];
  const groups: Array<{ ref: string; group: ProductGroup }> = [];
  for (const ref of Object.keys(product.ingredientRefs)) {
    if (isProductGroupRef(ref)) {
      const pg = resolveRef(menu, ref) as ProductGroup | undefined;
      if (pg) groups.push({ ref, group: pg });
    }
  }
  return groups;
}

function groupHasDefault(pg: ProductGroup): boolean {
  if (!pg.childRefs) return false;
  return Object.values(pg.childRefs).some(o => (o as ChildRefOverride)?.isDefault);
}

function groupHasNonRemovable(pg: ProductGroup): boolean {
  if (!pg.childRefs) return false;
  return Object.values(pg.childRefs).some(o => {
    const ov = o as ChildRefOverride;
    return ov?.isDefault && ov?.quantity?.min != null && ov.quantity.min >= 1;
  });
}

function groupHasIntensity(pg: ProductGroup): boolean {
  if (!pg.childRefs) return false;
  return Object.values(pg.childRefs).some(o => {
    const ov = o as ChildRefOverride;
    return ov?.quantity?.max != null && ov.quantity.max > 1;
  });
}

function groupHasFreeQty(pg: ProductGroup): boolean {
  const sq = pg.selectionQuantity as (Quantity & { free?: number }) | undefined;
  if (sq?.free != null && sq.free > 0) return true;
  if (!pg.childRefs) return false;
  return Object.values(pg.childRefs).some(o => {
    const ov = o as ChildRefOverride;
    return ov?.quantity?.free != null && ov.quantity.free > 0;
  });
}

function groupHasDefaultIfSelected(pg: ProductGroup): boolean {
  const sq = pg.selectionQuantity as (Quantity & { defaultIfSelected?: number }) | undefined;
  if (sq && 'defaultIfSelected' in sq) return true;
  if (!pg.childRefs) return false;
  return Object.values(pg.childRefs).some(o => {
    const ov = o as ChildRefOverride & { quantity?: Quantity & { defaultIfSelected?: number } };
    return ov?.quantity && 'defaultIfSelected' in ov.quantity;
  });
}

function groupHasMaxUniqueChoices(pg: ProductGroup): boolean {
  const sq = pg.selectionQuantity as (Quantity & { maxUniqueChoices?: number }) | undefined;
  return sq != null && 'maxUniqueChoices' in sq;
}

/** Classify a productGroup as entree/side/drink/other by its displayName */
function classifyGroup(pg: ProductGroup): 'entree' | 'side' | 'drink' | 'other' {
  const name = (pg.displayName || '').toLowerCase();
  const pgAny = pg as ProductGroup & { entreeSelection?: boolean };
  if (pgAny.entreeSelection || /\bentree\b|\bentrée\b/i.test(name)) return 'entree';
  if (/\bsandwich\b|\btender/i.test(name) && pgAny.entreeSelection) return 'entree';
  if (/\bside\b|\bfries\b|\btots\b|\bonion ring/i.test(name)) return 'side';
  if (/\bdrink\b|\bbeverage\b|\bsoda\b/i.test(name)) return 'drink';
  return 'other';
}

function isDrinkProduct(menu: Menu, product: Product, productRef: string): boolean {
  if (product.tags?.some(t => /drink|beverage|soda|slush|shake|lemonade|limeade|tea|coffee|juice|recharger/i.test(t))) {
    return true;
  }
  for (const [, cat] of Object.entries(menu.categories || {})) {
    const catName = (cat.displayName || '').toLowerCase();
    if (/drink|beverage|slush|shake|lemonade|tea|coffee|recharger|frozen/i.test(catName)) {
      const rawId = productRef.startsWith('products.') ? productRef.substring(9) : productRef;
      if (cat.childRefs && (rawId in cat.childRefs || productRef in cat.childRefs)) return true;
    }
  }
  const name = (product.displayName || '').toLowerCase();
  return /\bslush\b|\bshake\b|\blemonade\b|\blimeade\b|\biced tea\b|\bcoffee\b|\bsoda\b|\bcoca.cola\b|\bcoke\b|\bsprite\b|\bdr pepper\b|\bfanta\b|\bhi.c\b|\bminute maid\b|\brecharger\b|\bjuice\b|\bwater\b|\bmilk\b|\btea\b/i.test(name);
}

// ────────────────────────────────────────────────────────────────
// Main classifier
// ────────────────────────────────────────────────────────────────

export function classifyProduct(menu: Menu, product: Product, productRef: string): ConstructClassification {
  const tags: ConstructTag[] = [];

  const hasIngRefs = !!product.ingredientRefs && Object.keys(product.ingredientRefs).length > 0;
  const hasModRefs = !!product.modifierGroupRefs && Object.keys(product.modifierGroupRefs).length > 0;
  const hasAlts = hasAlternatives(product);
  const isVirtual = !!product.isVirtual;
  const isRecipe = !!product.isRecipe;
  const isDrink = isDrinkProduct(menu, product, productRef);
  const hasVolumePrices = 'volumePrices' in (product as Record<string, unknown>);

  // ── Core shape tags ──
  if (isVirtual) tags.push('virtual');
  if (isRecipe) tags.push('recipe');
  if (!hasIngRefs && !hasModRefs && !isVirtual) tags.push('simple');

  if (hasIngRefs) tags.push('has-ingredients');
  if (hasModRefs) tags.push('has-modifiers');
  if (hasIngRefs && hasModRefs) tags.push('has-both');

  if (hasAlts) tags.push('has-alternatives');
  else tags.push('no-alternatives');

  if (isDrink) tags.push('drink-product');

  // ── Ingredient detail analysis ──
  if (hasIngRefs) {
    const igGroups = getIngredientGroups(menu, product);
    let anyDefault = false;
    let anyNonRemovable = false;
    let anyMax = false;
    let anyFree = false;
    let anyIntensity = false;
    let anyDefaultIfSelected = false;
    let anyMaxUnique = false;

    // Combo detection accumulators
    let entreeCount = 0;
    let sideDefault = false;
    let sideNoDefault = false;
    let drinkDefault = false;
    let drinkNoDefault = false;
    let hasEntree = false;
    let hasSide = false;
    let hasDrink = false;

    for (const { group: pg } of igGroups) {
      if (groupHasDefault(pg)) anyDefault = true;
      if (groupHasNonRemovable(pg)) anyNonRemovable = true;
      if (pg.selectionQuantity?.max != null && pg.selectionQuantity.max > 0) anyMax = true;
      if (groupHasFreeQty(pg)) anyFree = true;
      if (groupHasIntensity(pg)) anyIntensity = true;
      if (groupHasDefaultIfSelected(pg)) anyDefaultIfSelected = true;
      if (groupHasMaxUniqueChoices(pg)) anyMaxUnique = true;

      const gType = classifyGroup(pg);
      if (gType === 'entree') {
        hasEntree = true;
        entreeCount += pg.childRefs ? Object.keys(pg.childRefs).length : 0;
      }
      if (gType === 'side') {
        hasSide = true;
        if (groupHasDefault(pg)) sideDefault = true; else sideNoDefault = true;
      }
      if (gType === 'drink') {
        hasDrink = true;
        if (groupHasDefault(pg)) drinkDefault = true; else drinkNoDefault = true;
      }
    }

    // Direct product refs in ingredientRefs = fixed entree within a combo
    if (product.ingredientRefs) {
      for (const ref of Object.keys(product.ingredientRefs)) {
        if (isProductRef(ref)) {
          hasEntree = true;
          entreeCount += 1;
        }
      }
    }

    if (anyDefault) tags.push('ingredients-with-defaults');
    if (!anyDefault && igGroups.length > 0) tags.push('ingredients-no-defaults');
    if (anyNonRemovable) tags.push('ingredients-non-removable');
    if (anyMax) tags.push('ingredients-max-selection');
    if (anyFree) { tags.push('ingredients-free-qty'); tags.push('free-quantity'); }
    if (anyIntensity) tags.push('ingredients-intensity');
    if (anyDefaultIfSelected) tags.push('default-if-selected');
    if (anyMaxUnique) tags.push('max-unique-choices');

    // Combo-like detection
    if (hasEntree && (hasSide || hasDrink)) {
      tags.push('combo-like');
      tags.push('has-entree-group');
      if (hasSide) {
        tags.push('has-side-group');
        if (sideDefault) tags.push('side-has-default');
        if (sideNoDefault) tags.push('side-no-default');
      }
      if (hasDrink) {
        tags.push('has-drink-group');
        if (drinkDefault) tags.push('drink-has-default');
        if (drinkNoDefault) tags.push('drink-no-default');
      }
      if (entreeCount > 1) tags.push('multi-entree');
    }
  }

  // ── Volume prices (Dunkin pattern) ──
  if (hasVolumePrices) tags.push('volume-prices');

  // ── Negative price (deal) ──
  if (product.price != null && product.price < 0) tags.push('negative-price');

  // ── Misc tags ──
  if (product.operationHours) tags.push('has-operation-hours');
  if (product.tags && product.tags.length > 0) tags.push('has-tags');
  if (product.nutrition?.totalCalories != null && product.nutrition.totalCalories > 0) tags.push('has-nutrition');
  if (product.ctaLabel) tags.push('has-cta-label');
  if ('customAttributes' in (product as Record<string, unknown>)) tags.push('has-custom-attributes');

  // ── Primary classification ──
  let primary: ConstructClassification['primary'] = 'simple';
  if (tags.includes('combo-like')) {
    primary = 'combo-like';
  } else if (tags.includes('virtual')) {
    primary = 'virtual';
  } else if (tags.includes('has-ingredients') || tags.includes('has-modifiers')) {
    primary = 'customizable';
  }

  const summary = buildSummary(primary, tags);
  const { color, icon } = getPrimaryStyle(primary);

  return { primary, tags, summary, color, icon };
}

function buildSummary(primary: ConstructClassification['primary'], tags: ConstructTag[]): string {
  const parts: string[] = [];

  switch (primary) {
    case 'simple': parts.push('Simple product'); break;
    case 'virtual': parts.push('Virtual product'); break;
    case 'combo-like': parts.push('Combo / Meal'); break;
    case 'customizable': parts.push('Customizable product'); break;
  }

  if (tags.includes('recipe')) parts.push('recipe');
  if (tags.includes('has-alternatives')) parts.push('with size variants');
  if (tags.includes('has-ingredients') && !tags.includes('combo-like')) parts.push('with ingredients');
  if (tags.includes('has-modifiers')) parts.push('with modifiers');
  if (tags.includes('volume-prices')) parts.push('with volume pricing');
  if (tags.includes('drink-product')) parts.push('(drink)');
  if (tags.includes('multi-entree')) parts.push('multi-entree');
  if (tags.includes('negative-price')) parts.push('(deal)');

  return parts.join(' · ');
}

function getPrimaryStyle(primary: ConstructClassification['primary']): { color: string; icon: string } {
  switch (primary) {
    case 'simple': return { color: '#22c55e', icon: '🧁' };
    case 'virtual': return { color: '#f97316', icon: '👻' };
    case 'combo-like': return { color: '#8b5cf6', icon: '🍔🍟' };
    case 'customizable': return { color: '#3b82f6', icon: '🎛️' };
  }
}

// ────────────────────────────────────────────────────────────────
// Bulk helpers
// ────────────────────────────────────────────────────────────────

export interface ClassifiedProduct {
  ref: string;
  product: Product;
  classification: ConstructClassification;
}

/** Classify every product in the menu */
export function classifyAllProducts(menu: Menu): ClassifiedProduct[] {
  return Object.entries(menu.products || {}).map(([id, product]) => ({
    ref: `products.${id}`,
    product,
    classification: classifyProduct(menu, product, `products.${id}`),
  }));
}

/** Group classified products by each tag they carry */
export function groupByTag(classified: ClassifiedProduct[]): Map<ConstructTag, ClassifiedProduct[]> {
  const groups = new Map<ConstructTag, ClassifiedProduct[]>();
  for (const item of classified) {
    for (const tag of item.classification.tags) {
      if (!groups.has(tag)) groups.set(tag, []);
      groups.get(tag)!.push(item);
    }
  }
  return groups;
}

/** Group classified products by primary classification */
export function groupByPrimary(classified: ClassifiedProduct[]): Map<string, ClassifiedProduct[]> {
  const groups = new Map<string, ClassifiedProduct[]>();
  for (const item of classified) {
    const key = item.classification.primary;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return groups;
}

/** Get all filterable tags that actually appear in the classified products, with counts */
export function getActiveFilterTags(classified: ClassifiedProduct[]): Array<{ tag: ConstructTag; info: TagInfo; count: number }> {
  const counts = new Map<ConstructTag, number>();
  for (const item of classified) {
    for (const tag of item.classification.tags) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .filter(([tag]) => TAG_INFO[tag]?.isFilterable)
    .map(([tag, count]) => ({ tag, info: TAG_INFO[tag], count }))
    .sort((a, b) => b.count - a.count);
}

/** Filter classified products by a set of required tags (AND logic) */
export function filterByTags(classified: ClassifiedProduct[], requiredTags: Set<ConstructTag>): ClassifiedProduct[] {
  if (requiredTags.size === 0) return classified;
  return classified.filter(item =>
    Array.from(requiredTags).every(tag => item.classification.tags.includes(tag)),
  );
}
