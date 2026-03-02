/**
 * MBDP Construct Classifier
 *
 * Official 25-construct system from the MBDP Menu Products Constructs Page.
 *
 * PRIMARY TYPES (5, mutually exclusive, auto-detected from JSON):
 *   1AAA — No alternatives & no ingredientRefs (leaf product)
 *   1ABB — No alternatives, has ingredientRefs (customizable)
 *   2    — Virtual Product (isVirtual = true, no ingredientRefs, no alternatives)
 *   1BAA — Has alternatives (relatedProducts), no ingredientRefs (sized)
 *   1BBB — Has alternatives + ingredientRefs (sized & customizable)
 *
 * STRUCTURAL TAGS (data-driven, multiple can apply):
 *   bare              — no ingredientRefs AND no modifierGroupRefs
 *   has-modifiers      — has modifierGroupRefs
 *   has-bundle         — relatedProducts.bundle exists
 *   is-combo           — isCombo = true
 *   virtual-ingredient — isVirtual + ingredientRefs but no alternatives
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
  // ── Primary Single-Product Types (5) ──
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
    description: 'Product has sizes or selections (alternatives), but the recipe is not able to be modified.',
    engineeringTerm: 'With alternatives, no ingredientRefs',
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

/** The 5 official primary single-product types */
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
 * Decision tree for the 5 official primary construct types.
 *
 * Only two structural axes matter for primary classification:
 *   1. alternatives (relatedProducts.alternatives) — sizing/selection
 *   2. ingredientRefs — customization
 *
 * modifierGroupRefs do NOT affect primary type (captured as structural tag instead).
 *
 * Tree:
 *   isVirtual AND no ingredientRefs AND no alternatives?
 *     YES -> "2" (Virtual Product)
 *   has alternatives?
 *     YES -> has ingredientRefs?
 *       YES -> "1BBB" (Sized + Customizable)
 *       NO  -> "1BAA" (Sized, Not Customizable)
 *     NO  -> has ingredientRefs?
 *       YES -> "1ABB" (Customizable)
 *       NO  -> "1AAA" (Leaf)
 *
 * Virtual products that have ingredientRefs (e.g. K-Cup Pods, Bottled Drinks)
 * fall through to the normal decision tree instead of being classified as "2".
 */
export function classifyPrimaryType(flags: StructuralFlags): string {
  // Pure virtual: no ingredients, no alternatives → type 2
  if (flags.isVirtual && !flags.hasIngredientRefs && !flags.hasAlternatives) {
    return '2';
  }
  if (flags.hasAlternatives) {
    return flags.hasIngredientRefs ? '1BBB' : '1BAA';
  }
  return flags.hasIngredientRefs ? '1ABB' : '1AAA';
}

// ─────────────────────────────────────────────
// Structural Tags (data-driven, multiple per product)
// ─────────────────────────────────────────────

export interface StructuralTagDef {
  id: string;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  color: string;
}

/**
 * Data-driven structural tags — enrichments discovered from actual menu JSON
 * analysis. Multiple tags can apply to a single product.
 */
export const STRUCTURAL_TAGS: StructuralTagDef[] = [
  {
    id: 'bare',
    name: 'No Customization & No Modifications',
    shortName: 'Bare',
    description: 'Product has no ingredientRefs and no modifierGroupRefs — cannot be customized or modified.',
    icon: '🍃',
    color: '#84cc16',
  },
  {
    id: 'has-modifiers',
    name: 'Has Modifier Groups',
    shortName: 'Modifiers',
    description: 'Product has modifierGroupRefs — non-tangible modifications like "sauce on side", cookie pieces, etc.',
    icon: '🔧',
    color: '#f59e0b',
  },
  {
    id: 'has-bundle',
    name: 'Bundle Link',
    shortName: 'Bundle',
    description: 'Product has a relatedProducts.bundle reference linking it to a combo/meal counterpart.',
    icon: '🔗',
    color: '#6366f1',
  },
  {
    id: 'is-combo',
    name: 'Combo / Meal',
    shortName: 'Combo',
    description: 'Product is flagged as a combo (isCombo = true).',
    icon: '🍔',
    color: '#8b5cf6',
  },
  {
    id: 'virtual-ingredient',
    name: 'Virtual + Ingredients (Unintentional)',
    shortName: 'V+Ing',
    description: 'Virtual product with ingredientRefs — unintentional construct. Virtual products should use relatedProducts (productGroups) or modifierGroupRefs, not ingredientRefs. Found in BWW (1) and Dunkin (6).',
    icon: '⚠️',
    color: '#ef4444',
  },
];

// ─────────────────────────────────────────────
// Unintentional Constructs
// ─────────────────────────────────────────────

/** Definition for an unintentional (invalid) construct pattern */
export interface UnintentionalConstructDef {
  id: string;
  name: string;
  shortName: string;
  description: string;
  linkedStructuralTag: string;
  icon: string;
  color: string;
}

/**
 * Unintentional constructs — patterns that appear in menu data but should not exist.
 * These are data quality issues that need to be fixed at the source.
 */
export const UNINTENTIONAL_CONSTRUCTS: UnintentionalConstructDef[] = [
  {
    id: 'U1',
    name: 'Virtual Product with ingredientRefs',
    shortName: 'V+Ingredients',
    description: 'Virtual products should never have ingredientRefs. They should use relatedProducts.alternatives (productGroups) for sizing/selection or modifierGroupRefs for modifications. Having ingredientRefs on a virtual product is a configuration error.',
    linkedStructuralTag: 'virtual-ingredient',
    icon: '⚠️',
    color: '#ef4444',
  },
];

const unintentionalMap = new Map(UNINTENTIONAL_CONSTRUCTS.map((u) => [u.id, u]));

export function getUnintentionalConstruct(id: string): UnintentionalConstructDef | undefined {
  return unintentionalMap.get(id);
}

const structuralTagMap = new Map(STRUCTURAL_TAGS.map((t) => [t.id, t]));

export function getStructuralTag(id: string): StructuralTagDef | undefined {
  return structuralTagMap.get(id);
}

/** Detect which structural tags apply to a product */
export function detectStructuralTags(flags: StructuralFlags): string[] {
  const tags: string[] = [];

  // Bare: no ingredientRefs AND no modifierGroupRefs
  if (!flags.hasIngredientRefs && !flags.hasModifierGroupRefs) {
    tags.push('bare');
  }

  // Has modifier groups (orthogonal to primary classification)
  if (flags.hasModifierGroupRefs) {
    tags.push('has-modifiers');
  }

  // Bundle link
  if (flags.hasBundleLink) {
    tags.push('has-bundle');
  }

  // Combo
  if (flags.isCombo) {
    tags.push('is-combo');
  }

  // Virtual with ingredients but no alternatives (unusual pattern)
  if (flags.isVirtual && flags.hasIngredientRefs && !flags.hasAlternatives) {
    tags.push('virtual-ingredient');
  }

  return tags;
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
  /** Data-driven structural tags (bare, has-modifiers, etc.) */
  structuralTags: string[];
  flags: StructuralFlags;
  /** Category ref this product belongs to (from rootCategoryRef tree) */
  categoryRef?: string;
  /** Category display name */
  categoryName?: string;
  /** For size variants: ref of the parent virtual product */
  parentVirtualRef?: string;
  /** For size variants: display name of the parent virtual product */
  parentVirtualName?: string;
  /** Top-level main category ref (direct child of root) */
  mainCategoryRef?: string;
  /** Top-level main category display name */
  mainCategoryName?: string;
  /** Bundle target: ref of the meal/combo counterpart this product links to */
  bundleTargetRef?: string;
  /** Bundle target: display name of the meal/combo counterpart */
  bundleTargetName?: string;
  /** Bundle sources: products that link TO this product via their bundle ref */
  bundleSources?: Array<{ ref: string; name: string }>;
}

// ─────────────────────────────────────────────
// Category-tree traversal
// ─────────────────────────────────────────────

/**
 * Walk from rootCategoryRef collecting:
 *   - { categoryRef, categoryName, productRef } for every product in the tree
 *   - Recurses into sub-categories
 */
interface CategoryProductEntry {
  categoryRef: string;
  categoryName: string;
  productRef: string;
  /** The top-level main category (direct child of root) */
  mainCategoryRef: string;
  mainCategoryName: string;
}

function collectCategoryProducts(menu: Menu): CategoryProductEntry[] {
  const entries: CategoryProductEntry[] = [];
  const visited = new Set<string>();

  function walk(catRef: string, mainCatRef: string, mainCatName: string): void {
    if (visited.has(catRef)) return;
    visited.add(catRef);

    const cat = resolveRef(menu, catRef) as { displayName?: string; childRefs?: Record<string, unknown> } | undefined;
    if (!cat?.childRefs) return;

    const catName = cat.displayName ?? catRef;

    for (const childRef of Object.keys(cat.childRefs)) {
      if (childRef.startsWith('products.')) {
        entries.push({
          categoryRef: catRef,
          categoryName: catName,
          productRef: childRef,
          mainCategoryRef: mainCatRef,
          mainCategoryName: mainCatName,
        });
      } else if (childRef.startsWith('categories.')) {
        walk(childRef, mainCatRef, mainCatName);
      }
    }
  }

  if (menu.rootCategoryRef) {
    // Walk each top-level category (direct child of root)
    const rootCat = resolveRef(menu, menu.rootCategoryRef) as { childRefs?: Record<string, unknown> } | undefined;
    if (rootCat?.childRefs) {
      for (const topRef of Object.keys(rootCat.childRefs)) {
        if (topRef.startsWith('categories.')) {
          const topCat = resolveRef(menu, topRef) as { displayName?: string } | undefined;
          const topName = topCat?.displayName ?? topRef;
          walk(topRef, topRef, topName);
        } else if (topRef.startsWith('products.')) {
          // Products directly under root (rare)
          const rootDisplay = (resolveRef(menu, menu.rootCategoryRef) as { displayName?: string })?.displayName ?? 'Root';
          entries.push({
            categoryRef: menu.rootCategoryRef,
            categoryName: rootDisplay,
            productRef: topRef,
            mainCategoryRef: menu.rootCategoryRef,
            mainCategoryName: rootDisplay,
          });
        }
      }
    }
  }

  return entries;
}

// ─────────────────────────────────────────────
// Classify all products in a menu
// ─────────────────────────────────────────────

function classifyOne(
  ref: string,
  product: Product,
  menu: Menu,
  extra?: Partial<ClassifiedProduct>,
): ClassifiedProduct {
  const flags = computeFlags(product);
  const primaryType = classifyPrimaryType(flags);
  const primaryConstruct = getConstruct(primaryType)!;
  const behavioralTags = detectBehavioralTags(product, menu);
  const structuralTags = detectStructuralTags(flags);
  return {
    ref,
    product,
    primaryType,
    primaryConstruct,
    behavioralTags,
    structuralTags,
    flags,
    ...extra,
  };
}

/**
 * Classify products reachable from rootCategoryRef.
 *
 * 1. Walk the category tree to find orderable products.
 * 2. Classify each product.
 * 3. For virtual products with relatedProducts.alternatives pointing to
 *    productGroups, also traverse into those groups and classify every
 *    size-variant child product (tagged with parentVirtualRef/Name).
 */
export function classifyAllProducts(menu: Menu): ClassifiedProduct[] {
  const products = menu.products ?? {};
  const catEntries = collectCategoryProducts(menu);
  const result: ClassifiedProduct[] = [];
  const seen = new Set<string>();

  for (const { categoryRef, categoryName, productRef, mainCategoryRef, mainCategoryName } of catEntries) {
    if (seen.has(productRef)) continue;
    seen.add(productRef);

    const id = productRef.substring('products.'.length);
    const product = products[id];
    if (!product) continue;

    // Classify the category-level product itself
    const classified = classifyOne(productRef, product, menu, {
      categoryRef,
      categoryName,
      mainCategoryRef,
      mainCategoryName,
    });
    result.push(classified);

    // For virtual products: traverse into alternatives → productGroup → children
    if (product.isVirtual === true) {
      const rp = product.relatedProducts as Record<string, unknown> | undefined;
      const alts = rp?.alternatives as Record<string, unknown> | undefined;
      if (alts && typeof alts === 'object') {
        for (const altRef of Object.keys(alts)) {
          if (!altRef.startsWith('productGroups.')) continue;
          const pg = resolveRef(menu, altRef) as ProductGroup | undefined;
          if (!pg?.childRefs) continue;

          for (const childRef of Object.keys(pg.childRefs)) {
            if (!childRef.startsWith('products.') || seen.has(childRef)) continue;
            seen.add(childRef);

            const childId = childRef.substring('products.'.length);
            const childProduct = products[childId];
            if (!childProduct) continue;

            result.push(
              classifyOne(childRef, childProduct, menu, {
                categoryRef,
                categoryName,
                mainCategoryRef,
                mainCategoryName,
                parentVirtualRef: productRef,
                parentVirtualName: product.displayName ?? undefined,
              }),
            );
          }
        }
      }
    }

    // Resolve bundle reference: relatedProducts.bundle → target product
    const rp = product.relatedProducts as Record<string, unknown> | undefined;
    const bundleVal = rp?.bundle;
    if (bundleVal != null) {
      const bundleRef = typeof bundleVal === 'string' ? bundleVal : String(bundleVal);
      if (bundleRef.startsWith('products.')) {
        const target = resolveRef(menu, bundleRef) as Product | undefined;
        if (target) {
          classified.bundleTargetRef = bundleRef;
          classified.bundleTargetName = target.displayName ?? undefined;
        }
      }
    }
  }

  // Second pass: build reverse bundle links (target → sources)
  const bundleTargetMap = new Map<string, Array<{ ref: string; name: string }>>();
  for (const item of result) {
    if (item.bundleTargetRef) {
      const sources = bundleTargetMap.get(item.bundleTargetRef) ?? [];
      sources.push({ ref: item.ref, name: item.product.displayName ?? item.ref });
      bundleTargetMap.set(item.bundleTargetRef, sources);
    }
  }
  for (const item of result) {
    const sources = bundleTargetMap.get(item.ref);
    if (sources && sources.length > 0) {
      item.bundleSources = sources;
    }
  }

  return result;
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
  bareProducts: number;
}

export function getExtraFlagStats(items: ClassifiedProduct[]): ExtraFlagStats {
  return {
    combos: items.filter((i) => i.flags.isCombo).length,
    modifierGroupProducts: items.filter((i) => i.flags.hasModifierGroupRefs).length,
    bundleLinks: items.filter((i) => i.flags.hasBundleLink).length,
    bareProducts: items.filter((i) => !i.flags.hasIngredientRefs && !i.flags.hasModifierGroupRefs).length,
  };
}

/** Count of products per structural tag */
export interface StructuralTagStats {
  tagId: string;
  tag: StructuralTagDef;
  count: number;
}

export function getStructuralTagStats(items: ClassifiedProduct[]): StructuralTagStats[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const tag of item.structuralTags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return STRUCTURAL_TAGS
    .filter((t) => (counts.get(t.id) ?? 0) > 0)
    .map((t) => ({
      tagId: t.id,
      tag: t,
      count: counts.get(t.id) ?? 0,
    }));
}

/** Main category stats (products grouped by top-level category) */
export interface MainCategoryStats {
  ref: string;
  name: string;
  count: number;
}

export function getMainCategoryStats(items: ClassifiedProduct[]): MainCategoryStats[] {
  const map = new Map<string, { name: string; count: number }>();
  const order: string[] = [];
  for (const item of items) {
    const ref = item.mainCategoryRef ?? 'unknown';
    const name = item.mainCategoryName ?? 'Unknown';
    if (!map.has(ref)) {
      map.set(ref, { name, count: 0 });
      order.push(ref);
    }
    map.get(ref)!.count++;
  }
  return order.map((ref) => ({
    ref,
    name: map.get(ref)!.name,
    count: map.get(ref)!.count,
  }));
}

// ─────────────────────────────────────────────
// Product Schema Skeleton — actual JSON structure analysis
// ─────────────────────────────────────────────

/** A single field in the product schema with presence stats */
export interface SchemaField {
  key: string;
  /** How many products have this field (non-null, non-empty) */
  presentCount: number;
  /** Percentage of products in the group that have this field */
  pct: number;
  /** 'always' (100%), 'common' (≥60%), 'sometimes' (≥20%), 'rare' (<20%) */
  frequency: 'always' | 'common' | 'sometimes' | 'rare';
  /** Most common value type(s) — e.g. "string", "object(3)", "bool" */
  valueTypes: { type: string; count: number }[];
  /** Whether this field carries structural significance (refs, flags, nesting) */
  isStructural: boolean;
}

/** A distinct schema shape derived from the structural keys present */
export interface SchemaShape {
  /** Fingerprint code, e.g. "I(3)+R(1)+N+T+Q" */
  fingerprint: string;
  /** Human-readable shape name, e.g. "Sized Customizable w/ Nutrition" */
  shapeName: string;
  /** Number of products with this exact fingerprint */
  count: number;
  /** Percentage of category products */
  pct: number;
  /** Example product names */
  examples: string[];
}

/** Full skeleton analysis for one top-level category */
export interface CategorySkeleton {
  ref: string;
  name: string;
  productCount: number;
  /** All fields present across products, sorted by frequency */
  fields: SchemaField[];
  /** Distinct schema shapes found in this category */
  shapes: SchemaShape[];
  /** The dominant (most common) shape */
  dominantShape: SchemaShape;
  /** Whether all products share the same shape */
  isHomogeneous: boolean;
  /** Short code for the dominant shape */
  skeletonCode: string;
  /** Human-readable skeleton name */
  skeletonName: string;
  /** Count of distinct shapes */
  shapeCount: number;
}

/** Keys that define structural significance (affect product behavior) */
const STRUCTURAL_KEYS = new Set([
  'ingredientRefs',
  'relatedProducts',
  'modifierGroupRefs',
  'productGroupIds',
  'isVirtual',
  'isCombo',
  'isRecipe',
  'nutrition',
  'operationHours',
  'quantity',
  'tags',
  'volumePrices',
]);

/** Keys used for fingerprinting (structural + behavioral markers) */
const FINGERPRINT_KEYS = [
  'ingredientRefs',
  'relatedProducts',
  'modifierGroupRefs',
  'isVirtual',
  'isCombo',
  'nutrition',
  'operationHours',
  'tags',
  'quantity',
  'volumePrices',
  'productGroupIds',
] as const;

/**
 * Compute a schema fingerprint for a product based on which structural
 * keys are present with meaningful (non-null, non-empty) values.
 */
function computeFingerprint(product: Product): string {
  const parts: string[] = [];
  const p = product as Record<string, unknown>;

  for (const key of FINGERPRINT_KEYS) {
    const v = p[key];
    if (v == null) continue;

    switch (key) {
      case 'ingredientRefs':
        if (typeof v === 'object' && Object.keys(v as object).length > 0)
          parts.push(`I(${Object.keys(v as object).length})`);
        break;
      case 'relatedProducts':
        if (typeof v === 'object' && Object.keys(v as object).length > 0)
          parts.push(`R(${Object.keys(v as object).length})`);
        break;
      case 'modifierGroupRefs':
        if (typeof v === 'object' && Object.keys(v as object).length > 0)
          parts.push(`M(${Object.keys(v as object).length})`);
        break;
      case 'isVirtual':
        if (v === true) parts.push('V');
        break;
      case 'isCombo':
        if (v === true) parts.push('C');
        break;
      case 'nutrition':
        if (typeof v === 'object' && Object.keys(v as object).length > 0)
          parts.push('N');
        break;
      case 'operationHours':
        if (typeof v === 'object' && Object.keys(v as object).length > 0)
          parts.push('OH');
        break;
      case 'tags':
        if (Array.isArray(v) && v.length > 0) parts.push('T');
        break;
      case 'quantity':
        if (typeof v === 'object' && Object.keys(v as object).length > 0)
          parts.push('Q');
        break;
      case 'volumePrices':
        if (Array.isArray(v) && v.length > 0) parts.push('VP');
        break;
      case 'productGroupIds':
        if (Array.isArray(v) && v.length > 0) parts.push(`PG(${v.length})`);
        break;
    }
  }

  return parts.length > 0 ? parts.join('+') : 'BARE';
}

/** Fingerprint legend for readable names */
const FP_LABELS: Record<string, string> = {
  I: 'Ingredients',
  R: 'Sizes/Alternatives',
  M: 'Modifiers',
  V: 'Virtual',
  C: 'Combo',
  N: 'Nutrition',
  OH: 'Op Hours',
  T: 'Tags',
  Q: 'Quantity',
  VP: 'Volume Pricing',
  PG: 'Product Groups',
};

/**
 * Convert a fingerprint code into a human-readable shape name.
 * e.g. "I(3)+R(1)+N+T" → "Customizable + Sized + Nutrition + Tags"
 */
function fingerprintToName(fp: string): string {
  if (fp === 'BARE') return 'Bare (minimal fields only)';

  const segments = fp.split('+');
  const labels: string[] = [];

  for (const seg of segments) {
    // Extract the key letter(s) — before any parenthesized count
    const match = seg.match(/^([A-Z]+)/);
    if (match) {
      const key = match[1];
      const label = FP_LABELS[key] ?? key;
      // Include count if present
      const countMatch = seg.match(/\((\d+)\)/);
      if (countMatch) {
        labels.push(`${label}(${countMatch[1]})`);
      } else {
        labels.push(label);
      }
    }
  }

  return labels.join(' + ');
}

/** Determine value type description for a product field value */
function describeValueType(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return 'bool';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'string') return 'string';
  if (Array.isArray(v)) return `array(${v.length})`;
  if (typeof v === 'object') return `object(${Object.keys(v).length})`;
  return typeof v;
}

/**
 * Analyze the actual JSON schema of products in each top-level category.
 * Computes field presence, value types, schema fingerprints, and dominant shapes.
 */
export function getCategorySkeletons(items: ClassifiedProduct[]): CategorySkeleton[] {
  // Group by mainCategoryRef
  const grouped = new Map<string, { name: string; products: ClassifiedProduct[] }>();
  const order: string[] = [];

  for (const item of items) {
    const ref = item.mainCategoryRef ?? 'unknown';
    const name = item.mainCategoryName ?? 'Unknown';
    if (!grouped.has(ref)) {
      grouped.set(ref, { name, products: [] });
      order.push(ref);
    }
    grouped.get(ref)!.products.push(item);
  }

  const skeletons: CategorySkeleton[] = [];

  for (const ref of order) {
    const { name, products } = grouped.get(ref)!;
    const count = products.length;
    if (count === 0) continue;

    // ── Field presence analysis ──
    const fieldPresence = new Map<string, number>();
    const fieldTypes = new Map<string, Map<string, number>>();

    for (const item of products) {
      const raw = item.product as Record<string, unknown>;
      for (const [key, value] of Object.entries(raw)) {
        // Skip null/undefined for presence counting
        if (value == null) continue;
        // For objects/arrays, skip empty ones
        if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) continue;
        if (Array.isArray(value) && value.length === 0) continue;

        fieldPresence.set(key, (fieldPresence.get(key) ?? 0) + 1);

        if (!fieldTypes.has(key)) fieldTypes.set(key, new Map());
        const typeDesc = describeValueType(value);
        const bucket = fieldTypes.get(key)!;
        bucket.set(typeDesc, (bucket.get(typeDesc) ?? 0) + 1);
      }
    }

    const fields: SchemaField[] = [];
    for (const [key, presentCount] of fieldPresence.entries()) {
      const pct = Math.round((presentCount / count) * 100);
      const frequency: SchemaField['frequency'] =
        pct === 100 ? 'always' : pct >= 60 ? 'common' : pct >= 20 ? 'sometimes' : 'rare';

      const types = fieldTypes.get(key)!;
      const valueTypes = [...types.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([type, cnt]) => ({ type, count: cnt }));

      fields.push({
        key,
        presentCount,
        pct,
        frequency,
        valueTypes,
        isStructural: STRUCTURAL_KEYS.has(key),
      });
    }
    fields.sort((a, b) => b.pct - a.pct);

    // ── Schema fingerprinting ──
    const fpCounts = new Map<string, { count: number; examples: string[] }>();

    for (const item of products) {
      const fp = computeFingerprint(item.product);
      if (!fpCounts.has(fp)) fpCounts.set(fp, { count: 0, examples: [] });
      const entry = fpCounts.get(fp)!;
      entry.count++;
      if (entry.examples.length < 3) {
        entry.examples.push(item.product.displayName ?? item.ref);
      }
    }

    const shapes: SchemaShape[] = [...fpCounts.entries()]
      .map(([fingerprint, { count: fpCount, examples }]) => ({
        fingerprint,
        shapeName: fingerprintToName(fingerprint),
        count: fpCount,
        pct: Math.round((fpCount / count) * 100),
        examples,
      }))
      .sort((a, b) => b.count - a.count);

    const dominantShape = shapes[0];
    const isHomogeneous = shapes.length === 1 || dominantShape.pct >= 80;

    skeletons.push({
      ref,
      name,
      productCount: count,
      fields,
      shapes,
      dominantShape,
      isHomogeneous,
      skeletonCode: dominantShape.fingerprint,
      skeletonName: dominantShape.shapeName,
      shapeCount: shapes.length,
    });
  }

  return skeletons;
}

/** Filter products by primary type, behavioral tag, structural tag, search, mainCategory */
export function filterProducts(
  items: ClassifiedProduct[],
  opts: {
    primaryType?: string | null;
    primaryTypes?: Set<string> | null;
    behavioralTag?: string | null;
    structuralTag?: string | null;
    structuralTags?: Set<string> | null;
    extraFlag?: string | null;
    mainCategory?: string | null;
    productTags?: Set<string> | null;
    search?: string;
  },
): ClassifiedProduct[] {
  let result = items;

  if (opts.mainCategory) {
    result = result.filter((i) => i.mainCategoryRef === opts.mainCategory);
  }

  // Multi-select primary types (AND — product must match ANY of the selected)
  if (opts.primaryTypes && opts.primaryTypes.size > 0) {
    const types = opts.primaryTypes;
    result = result.filter((i) => types.has(i.primaryType));
  } else if (opts.primaryType) {
    result = result.filter((i) => i.primaryType === opts.primaryType);
  }

  if (opts.behavioralTag) {
    result = result.filter((i) => i.behavioralTags.includes(opts.behavioralTag!));
  }

  // Multi-select structural tags (AND — product must have ALL selected tags)
  if (opts.structuralTags && opts.structuralTags.size > 0) {
    const tags = opts.structuralTags;
    result = result.filter((i) => {
      for (const t of tags) {
        if (!i.structuralTags.includes(t)) return false;
      }
      return true;
    });
  } else if (opts.structuralTag) {
    result = result.filter((i) => i.structuralTags.includes(opts.structuralTag!));
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
      case 'bare':
        result = result.filter((i) => !i.flags.hasIngredientRefs && !i.flags.hasModifierGroupRefs);
        break;
    }
  }

  if (opts.productTags && opts.productTags.size > 0) {
    const tags = opts.productTags;
    result = result.filter((i) => {
      const pTags = i.product.tags ?? [];
      return pTags.some((t) => tags.has(t));
    });
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
