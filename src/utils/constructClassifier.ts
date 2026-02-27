/**
 * MBDP Construct Classifier
 *
 * Official 25-construct system from the MBDP Menu Products Constructs Page.
 *
 * PRIMARY TYPES (mutually exclusive, auto-detected from JSON):
 *   1AAA — No alternatives & no ingredientRefs (leaf product)
 *   1ABB — No alternatives, has ingredientRefs (customizable)
 *   2    — Virtual Product (isVirtual = true)
 *   1BAA — Has alternatives (relatedProducts), no ingredientRefs (sized)
 *   1BBB — Has alternatives + ingredientRefs (sized & customizable)
 *
 * BEHAVIORAL SUB-CONSTRUCTS (#6-#16) — layered on top of primary type
 * COMBO/MEAL/BUNDLE (#17-#25) — combo slot configurations
 */

import type { Menu, Product, ProductGroup } from '../types/menu';
import { resolveRef } from './menuHelpers';

// ─────────────────────────────────────────────
// Construct Definition
// ─────────────────────────────────────────────

export interface ConstructDef {
  id: string;
  name: string;
  shortName: string;
  category: 'single' | 'combo';
  description: string;
  engineeringTerm: string;
  icon: string;
  color: string;
}

/** All 25 official MBDP constructs */
export const CONSTRUCTS: ConstructDef[] = [
  // ── Primary Single-Product Types ──
  {
    id: '1AAA',
    name: 'No Size/Selection, No Customization',
    shortName: 'Leaf',
    category: 'single',
    description: 'Standalone item — cannot be customized or sized. What you see is what you get.',
    engineeringTerm: 'No alternatives & no ingredientRefs',
    icon: '🍃',
    color: '#22c55e',
  },
  {
    id: '1ABB',
    name: 'No Size, Customizable',
    shortName: 'Customizable',
    category: 'single',
    description: 'Has no sizes/selections, but ingredients can be modified or changed.',
    engineeringTerm: 'No alternatives with ingredientRefs',
    icon: '🎛️',
    color: '#3b82f6',
  },
  {
    id: '2',
    name: 'Virtual Product',
    shortName: 'Virtual',
    category: 'single',
    description: 'Does not exist in POS. Houses multiple PLUs for simplicity or improved guest experience.',
    engineeringTerm: 'Virtual Product',
    icon: '👻',
    color: '#8b5cf6',
  },
  {
    id: '1BAA',
    name: 'Sized, Not Customizable',
    shortName: 'Sized',
    category: 'single',
    description: 'Product has sizes or selections (alternatives), but the recipe cannot be modified.',
    engineeringTerm: 'With alternatives and no ingredientRefs',
    icon: '📏',
    color: '#f97316',
  },
  {
    id: '1BBB',
    name: 'Sized + Customizable',
    shortName: 'Sized+Custom',
    category: 'single',
    description: 'Product has sizes/selections and ingredients can also be customized.',
    engineeringTerm: 'With alternatives and ingredientRefs',
    icon: '🎨',
    color: '#ec4899',
  },
  // ── Behavioral Sub-Constructs (#6-#16) ──
  {
    id: '#6',
    name: 'Pre-selected Ingredients',
    shortName: 'Defaults',
    category: 'single',
    description: 'Ingredients have default choices pre-selected for customers.',
    engineeringTerm: 'with Default ingredientRefs',
    icon: '✅',
    color: '#16a34a',
  },
  {
    id: '#7',
    name: 'Non-removable Defaults',
    shortName: 'Non-removable',
    category: 'single',
    description: 'Pre-selected ingredients that the customer cannot remove.',
    engineeringTerm: 'with Default ingredientRefs and non-removable',
    icon: '🔒',
    color: '#dc2626',
  },
  {
    id: '#8',
    name: 'Defaults + Max Selection',
    shortName: 'Max Select',
    category: 'single',
    description: 'Pre-selected ingredients with a maximum number of selections.',
    engineeringTerm: 'with ingredientRefs, defaults, max selection',
    icon: '🔢',
    color: '#7c3aed',
  },
  {
    id: '#9',
    name: 'Free Default Ingredients',
    shortName: 'Free Defaults',
    category: 'single',
    description: 'Pre-selected ingredients that are free of additional charge.',
    engineeringTerm: 'with ingredientRefs, defaults, free',
    icon: '🆓',
    color: '#059669',
  },
  {
    id: '#10',
    name: 'No Default Ingredients',
    shortName: 'No Defaults',
    category: 'single',
    description: 'Ingredients available but none pre-selected. Customer must choose.',
    engineeringTerm: 'with ingredientRefs, no defaults',
    icon: '⬜',
    color: '#6b7280',
  },
  {
    id: '#11',
    name: 'Intensity Options',
    shortName: 'Intensity',
    category: 'single',
    description: 'Ingredients with intensity levels (Easy / Regular / Extra). Sonic-specific.',
    engineeringTerm: 'with ingredientRefs with Intensity',
    icon: '🌡️',
    color: '#ea580c',
  },
  {
    id: '#12',
    name: 'Drinks',
    shortName: 'Drink',
    category: 'single',
    description: 'Beverage product — typically sized with flavor add-ons.',
    engineeringTerm: 'Drinks',
    icon: '🥤',
    color: '#0ea5e9',
  },
  {
    id: '#13',
    name: 'Max Unique Choices',
    shortName: 'MaxUnique',
    category: 'single',
    description: 'Product group limits distinct choices. Dunkin-specific.',
    engineeringTerm: 'maxUniqueChoices',
    icon: '🎯',
    color: '#d946ef',
  },
  {
    id: '#14',
    name: 'Volume Pricing',
    shortName: 'VolPrice',
    category: 'single',
    description: 'Price changes based on quantity. Dunkin-specific.',
    engineeringTerm: 'volumePricing',
    icon: '📊',
    color: '#0d9488',
  },
  {
    id: '#15',
    name: 'Free Quantity',
    shortName: 'FreeQty',
    category: 'single',
    description: 'Selection quantity includes free items (e.g. first N toppings free).',
    engineeringTerm: 'freeQuantity',
    icon: '🎁',
    color: '#65a30d',
  },
  {
    id: '#16',
    name: 'Size-Based Defaults',
    shortName: 'SizeDefaults',
    category: 'single',
    description: 'Default options change based on selected size. Dunkin-specific.',
    engineeringTerm: 'defaultIfSelected',
    icon: '↔️',
    color: '#ca8a04',
  },
  // ── Combo / Meal / Bundle (#17-#25) ──
  {
    id: '#17',
    name: 'Single Entree, No Size',
    shortName: '1 Entree',
    category: 'combo',
    description: 'Combo/Meal with one entree, no size/selection. Classic Entree + Side + Drink.',
    engineeringTerm: 'Single Entree without Alternatives',
    icon: '🍔',
    color: '#14b8a6',
  },
  {
    id: '#18',
    name: 'Single Entree, Sized',
    shortName: '1 Entree+Size',
    category: 'combo',
    description: 'Combo/Meal allowing entree variant selection (e.g. single / double / triple).',
    engineeringTerm: 'Single Entree with Alternatives',
    icon: '🍟',
    color: '#06b6d4',
  },
  {
    id: '#19',
    name: 'Multiple Entrees',
    shortName: 'Multi-Entree',
    category: 'combo',
    description: 'Bundle where customer selects more than 1 entree at discounted/promo price.',
    engineeringTerm: 'Multiple Entrees',
    icon: '🍱',
    color: '#a855f7',
  },
  {
    id: '#20',
    name: 'Deals',
    shortName: 'Deal',
    category: 'combo',
    description: 'Discounted Combo/Meal/Bundle. Usually a new PLU for the deal.',
    engineeringTerm: 'Deals, negative pricing',
    icon: '🏷️',
    color: '#ef4444',
  },
  {
    id: '#21',
    name: 'Drinks w/ Combo PLUs',
    shortName: 'DrinkPLU',
    category: 'combo',
    description: 'Drinks with individual PLUs for size/flavor combos, shown as one product.',
    engineeringTerm: 'Drinks with Combination PLUs',
    icon: '🥤',
    color: '#0284c7',
  },
  {
    id: '#22',
    name: 'Side: No Default',
    shortName: 'Side (pick)',
    category: 'combo',
    description: 'Combo/Meal side options without a pre-selected side.',
    engineeringTerm: 'Side Options without default',
    icon: '🥗',
    color: '#84cc16',
  },
  {
    id: '#23',
    name: 'Side: Pre-Selected',
    shortName: 'Side (default)',
    category: 'combo',
    description: 'Combo/Meal side options with a pre-selected default side.',
    engineeringTerm: 'Side Options with default',
    icon: '🥗',
    color: '#4d7c0f',
  },
  {
    id: '#24',
    name: 'Drink: No Default',
    shortName: 'Drink (pick)',
    category: 'combo',
    description: 'Combo/Meal drink options without a pre-selected drink.',
    engineeringTerm: 'Drink Options without default',
    icon: '🧊',
    color: '#0369a1',
  },
  {
    id: '#25',
    name: 'Drink: Pre-Selected',
    shortName: 'Drink (default)',
    category: 'combo',
    description: 'Combo/Meal drink options with a pre-selected default drink.',
    engineeringTerm: 'Drink Options with default',
    icon: '🧊',
    color: '#1e40af',
  },
];

/** The 5 primary single-product types */
export const PRIMARY_TYPES = CONSTRUCTS.filter(
  (c) => ['1AAA', '1ABB', '2', '1BAA', '1BBB'].includes(c.id),
);

/** Behavioral sub-constructs #6-#16 */
export const BEHAVIORAL_CONSTRUCTS = CONSTRUCTS.filter(
  (c) => c.category === 'single' && c.id.startsWith('#'),
);

/** Combo/Meal/Bundle constructs #17-#25 */
export const COMBO_CONSTRUCTS = CONSTRUCTS.filter(
  (c) => c.category === 'combo',
);

// ─────────────────────────────────────────────
// Lookup helper
// ─────────────────────────────────────────────

const constructMap = new Map(CONSTRUCTS.map((c) => [c.id, c]));

export function getConstruct(id: string): ConstructDef | undefined {
  return constructMap.get(id);
}

// ─────────────────────────────────────────────
// Structural Flags (computed from Product JSON)
// ─────────────────────────────────────────────

export interface StructuralFlags {
  isVirtual: boolean;
  isCombo: boolean;
  hasIngredientRefs: boolean;
  hasModifierGroupRefs: boolean;
  hasAlternatives: boolean;
  hasBundleLink: boolean;
}

function hasKeys(obj: unknown): boolean {
  return obj != null && typeof obj === 'object' && Object.keys(obj).length > 0;
}

export function computeFlags(product: Product): StructuralFlags {
  const rp = product.relatedProducts as Record<string, unknown> | undefined;
  return {
    isVirtual: product.isVirtual === true,
    isCombo: product.isCombo === true,
    hasIngredientRefs: hasKeys(product.ingredientRefs),
    hasModifierGroupRefs: hasKeys(product.modifierGroupRefs),
    hasAlternatives: rp != null && hasKeys((rp as Record<string, unknown>).alternatives),
    hasBundleLink: rp != null && (rp as Record<string, unknown>).bundle != null,
  };
}

// ─────────────────────────────────────────────
// Primary Type Classification
// ─────────────────────────────────────────────

/**
 * Decision tree for primary construct type:
 *
 *   isVirtual?
 *     YES -> "2" (Virtual Product)
 *     NO  -> has relatedProducts (alternatives)?
 *       YES -> has ingredientRefs?
 *         YES -> "1BBB" (Sized + Customizable)
 *         NO  -> "1BAA" (Sized, Not Customizable)
 *       NO  -> has ingredientRefs?
 *         YES -> "1ABB" (Customizable)
 *         NO  -> "1AAA" (Leaf)
 */
export function classifyPrimaryType(flags: StructuralFlags): string {
  if (flags.isVirtual) return '2';
  if (flags.hasAlternatives) {
    return flags.hasIngredientRefs ? '1BBB' : '1BAA';
  }
  return flags.hasIngredientRefs ? '1ABB' : '1AAA';
}

// ─────────────────────────────────────────────
// Behavioral Tag Detection
// ─────────────────────────────────────────────

/**
 * Analyze ingredient groups to detect behavioral sub-constructs.
 * Looks into productGroups referenced by ingredientRefs.
 */
export function detectBehavioralTags(
  product: Product,
  menu: Menu,
): string[] {
  const tags: string[] = [];

  if (!hasKeys(product.ingredientRefs)) return tags;

  const ingredientRefs = product.ingredientRefs!;
  let hasAnyDefaults = false;
  let hasAnyNoDefaults = false;
  let hasNonRemovable = false;
  let hasMaxSelection = false;
  let hasFreeInGroup = false;
  let hasIntensity = false;

  for (const ref of Object.keys(ingredientRefs)) {
    const resolved = resolveRef(menu, ref);
    if (!resolved) continue;

    const entity = resolved as unknown as ProductGroup;
    if (!entity.childRefs) continue;

    const childRefs = entity.childRefs;
    const children = Object.values(childRefs);

    // Check for defaults
    const defaultChildren = children.filter((c) => c.isDefault === true);
    if (defaultChildren.length > 0) {
      hasAnyDefaults = true;
    } else if (children.length > 0) {
      hasAnyNoDefaults = true;
    }

    // Check selectionQuantity for max, free, min constraints
    const sq = entity.selectionQuantity;
    if (sq) {
      if (sq.max != null && sq.max > 0) {
        hasMaxSelection = true;
      }
      if (sq.free != null && sq.free > 0) {
        hasFreeInGroup = true;
      }
      // Non-removable: min >= number of defaults (all must stay)
      if (
        sq.min != null &&
        sq.min > 0 &&
        defaultChildren.length > 0 &&
        sq.min >= defaultChildren.length
      ) {
        hasNonRemovable = true;
      }
    }

    // Check for intensity-style attributes on children
    for (const child of children) {
      const extra = child as Record<string, unknown>;
      if (extra.intensity || extra.portionSize || extra.Easy || extra.Regular || extra.Extra) {
        hasIntensity = true;
      }
    }
  }

  // #6: Pre-selected defaults
  if (hasAnyDefaults) tags.push('#6');

  // #7: Non-removable defaults
  if (hasNonRemovable) tags.push('#7');

  // #8: Defaults + max selection
  if (hasAnyDefaults && hasMaxSelection) tags.push('#8');

  // #9: Free defaults
  if (hasAnyDefaults && hasFreeInGroup) tags.push('#9');

  // #10: No defaults (ingredients present but none pre-selected)
  if (hasAnyNoDefaults && !hasAnyDefaults) tags.push('#10');

  // #11: Intensity
  if (hasIntensity) tags.push('#11');

  // #15: Free quantity (also check product-level)
  const productExtra = product as Record<string, unknown>;
  if (hasFreeInGroup || (productExtra.freeQuantity != null)) tags.push('#15');

  // #14: Volume pricing (product-level)
  if (productExtra.volumePrices != null || productExtra.volumePricing != null) tags.push('#14');

  // #13: maxUniqueChoices (product-level or group-level)
  if (productExtra.maxUniqueChoices != null) tags.push('#13');

  return tags;
}

// ─────────────────────────────────────────────
// Classified Product (result of classification)
// ─────────────────────────────────────────────

export interface ClassifiedProduct {
  ref: string;
  product: Product;
  primaryType: string;
  primaryConstruct: ConstructDef;
  behavioralTags: string[];
  flags: StructuralFlags;
}

// ─────────────────────────────────────────────
// Classify all products in a menu
// ─────────────────────────────────────────────

export function classifyAllProducts(menu: Menu): ClassifiedProduct[] {
  const products = menu.products ?? {};
  return Object.entries(products).map(([id, product]) => {
    const flags = computeFlags(product);
    const primaryType = classifyPrimaryType(flags);
    const primaryConstruct = getConstruct(primaryType)!;
    const behavioralTags = detectBehavioralTags(product, menu);
    return {
      ref: `products.${id}`,
      product,
      primaryType,
      primaryConstruct,
      behavioralTags,
      flags,
    };
  });
}

// ─────────────────────────────────────────────
// Stats & Filtering
// ─────────────────────────────────────────────

export interface ConstructStats {
  constructId: string;
  construct: ConstructDef;
  count: number;
}

/** Count of products per primary type */
export function getPrimaryTypeStats(items: ClassifiedProduct[]): ConstructStats[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.primaryType, (counts.get(item.primaryType) ?? 0) + 1);
  }
  return PRIMARY_TYPES.map((c) => ({
    constructId: c.id,
    construct: c,
    count: counts.get(c.id) ?? 0,
  }));
}

/** Count of products per behavioral tag (only those with > 0) */
export function getBehavioralTagStats(items: ClassifiedProduct[]): ConstructStats[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const tag of item.behavioralTags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return BEHAVIORAL_CONSTRUCTS
    .filter((c) => (counts.get(c.id) ?? 0) > 0)
    .map((c) => ({
      constructId: c.id,
      construct: c,
      count: counts.get(c.id) ?? 0,
    }));
}

/** Extra structural flags: combos, modifier-attached, bundle links */
export interface ExtraFlagStats {
  combos: number;
  modifierGroupProducts: number;
  bundleLinks: number;
}

export function getExtraFlagStats(items: ClassifiedProduct[]): ExtraFlagStats {
  return {
    combos: items.filter((i) => i.flags.isCombo).length,
    modifierGroupProducts: items.filter((i) => i.flags.hasModifierGroupRefs).length,
    bundleLinks: items.filter((i) => i.flags.hasBundleLink).length,
  };
}

/** Filter products by primary type, behavioral tag, extra flag, search */
export function filterProducts(
  items: ClassifiedProduct[],
  opts: {
    primaryType?: string | null;
    behavioralTag?: string | null;
    extraFlag?: string | null;
    search?: string;
  },
): ClassifiedProduct[] {
  let result = items;

  if (opts.primaryType) {
    result = result.filter((i) => i.primaryType === opts.primaryType);
  }

  if (opts.behavioralTag) {
    result = result.filter((i) => i.behavioralTags.includes(opts.behavioralTag!));
  }

  if (opts.extraFlag) {
    switch (opts.extraFlag) {
      case 'combo':
        result = result.filter((i) => i.flags.isCombo);
        break;
      case 'modifierGroups':
        result = result.filter((i) => i.flags.hasModifierGroupRefs);
        break;
      case 'bundleLink':
        result = result.filter((i) => i.flags.hasBundleLink);
        break;
    }
  }

  if (opts.search) {
    const q = opts.search.toLowerCase();
    result = result.filter(
      (i) =>
        i.product.displayName?.toLowerCase().includes(q) ||
        i.ref.toLowerCase().includes(q),
    );
  }

  return result;
}
