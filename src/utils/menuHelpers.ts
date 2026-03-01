import type { Menu, Product, Modifier, ModifierGroup, Category, ProductGroup, MenuEntity, DisplayableItem, ChildRefOverride } from '../types/menu';

/**
 * Checks if a childRef override object has any actual override properties.
 * Returns true when the value is non-empty ({} with keys).
 */
export function hasOverrides(override: ChildRefOverride): boolean {
  return Object.keys(override).length > 0;
}

/**
 * Merges a resolved base entity with override properties from a childRef value.
 * Override properties take precedence over the base entity.
 */
export function mergeWithOverrides(
  base: DisplayableItem | undefined,
  override: ChildRefOverride,
): DisplayableItem & { _overrides?: ChildRefOverride } {
  if (!base) return { ...override, _overrides: hasOverrides(override) ? override : undefined } as DisplayableItem & { _overrides?: ChildRefOverride };
  if (!hasOverrides(override)) return { ...base };
  return { ...base, ...override, _overrides: override };
}

/**
 * Resolves a ref to its object from the menu.
 * Handles refs like "products.american-cheese-burger", "categories.burgers", etc.
 */
export function resolveRef(menu: Menu, ref: string): MenuEntity | undefined {
  const dotIndex = ref.indexOf('.');
  if (dotIndex < 0) return undefined;
  const namespace = ref.substring(0, dotIndex);
  const id = ref.substring(dotIndex + 1);

  switch (namespace) {
    case 'products': return menu.products?.[id];
    case 'categories': return menu.categories?.[id];
    case 'productGroups': return menu.productGroups?.[id];
    case 'modifierGroups': return menu.modifierGroups?.[id];
    case 'modifiers': return menu.modifiers?.[id];
    default: return undefined;
  }
}

/**
 * Gets the ID from a ref (e.g., "burger" from "products.burger")
 */
export function getRefId(ref: string): string {
  const dotIndex = ref.indexOf('.');
  return dotIndex < 0 ? ref : ref.substring(dotIndex + 1);
}

/**
 * Gets the namespace from a ref (e.g., "products" from "products.burger")
 */
export function getRefNamespace(ref: string): string {
  const dotIndex = ref.indexOf('.');
  return dotIndex < 0 ? ref : ref.substring(0, dotIndex);
}

/**
 * Checks if a ref is a category ref
 */
export function isCategoryRef(ref: string): boolean {
  return ref.startsWith('categories.');
}

/**
 * Checks if a ref is a product ref
 */
export function isProductRef(ref: string): boolean {
  return ref.startsWith('products.');
}

/**
 * Checks if a ref is a modifier group ref
 */
export function isModifierGroupRef(ref: string): boolean {
  return ref.startsWith('modifierGroups.');
}

/**
 * Checks if a ref is a modifier ref
 */
export function isModifierRef(ref: string): boolean {
  return ref.startsWith('modifiers.');
}

/**
 * Checks if a ref is a product group ref
 */
export function isProductGroupRef(ref: string): boolean {
  return ref.startsWith('productGroups.');
}

/**
 * Checks if a ProductGroup is a recipe group.
 * The isRecipe field can be a boolean or a Python-style string ("True"/"False").
 */
export function isRecipeGroup(group: ProductGroup): boolean {
  return group.isRecipe === true || group.isRecipe === 'True';
}

/**
 * Gets the root category from the menu.
 * rootCategoryRef is a full ref like "categories.main-menu-39c0dc58".
 */
export function getRootCategory(menu: Menu): Category | undefined {
  return resolveRef(menu, menu.rootCategoryRef) as Category | undefined;
}

/**
 * Gets top-level categories from the menu
 */
export function getTopLevelCategories(menu: Menu): Array<{ ref: string; category: Category }> {
  const root = getRootCategory(menu);
  if (!root?.childRefs) return [];

  return Object.keys(root.childRefs)
    .filter(isCategoryRef)
    .map((ref) => ({
      ref,
      category: resolveRef(menu, ref) as Category,
    }))
    .filter((item) => item.category);
}

/**
 * Get all products from a category (including from subcategories)
 */
export function getCategoryProducts(
  menu: Menu,
  categoryRef: string,
): Array<{ ref: string; product: Product }> {
  const category = resolveRef(menu, categoryRef) as Category;
  if (!category?.childRefs) return [];

  const products: Array<{ ref: string; product: Product }> = [];

  for (const childRef of Object.keys(category.childRefs)) {
    if (isProductRef(childRef)) {
      const product = resolveRef(menu, childRef) as Product;
      if (product) {
        products.push({ ref: childRef, product });
      }
    } else if (isCategoryRef(childRef)) {
      // Subcategory — look at its childRefs which are inlined in the parent
      const subCatProducts = category.childRefs[childRef];
      if (subCatProducts && typeof subCatProducts === 'object') {
        for (const prodRef of Object.keys(subCatProducts)) {
          if (isProductRef(prodRef)) {
            const product = resolveRef(menu, prodRef) as Product;
            if (product) {
              products.push({ ref: prodRef, product });
            }
          }
        }
      }
    }
  }

  return products;
}

/**
 * Returns true when a product offers customisation.
 * A product is customisable when it has at least one non-empty
 * `ingredientRefs` *or* `modifierGroupRefs` map, or is a combo.
 */
export function isCustomizable(product: Product): boolean {
  const hasIngredients =
    !!product.ingredientRefs &&
    Object.keys(product.ingredientRefs).length > 0;
  const hasModifiers =
    !!product.modifierGroupRefs &&
    Object.keys(product.modifierGroupRefs).length > 0;
  return hasIngredients || hasModifiers || !!product.isCombo;
}

/**
 * Gets the ingredient details for a product
 */
export function getProductIngredients(
  menu: Menu,
  product: Product,
): Array<{ ref: string; name: string; type: string; item: DisplayableItem | undefined; overrides?: ChildRefOverride }> {
  if (!product.ingredientRefs) return [];

  return Object.keys(product.ingredientRefs).map((ref) => {
    const resolved = resolveRef(menu, ref);
    const override = product.ingredientRefs![ref] ?? {};
    const namespace = getRefNamespace(ref);
    const merged = resolved ? mergeWithOverrides(resolved, override) : undefined;
    return {
      ref,
      name: merged?.displayName ?? resolved?.displayName ?? getRefId(ref),
      type: namespace,
      item: merged ?? resolved,
      overrides: hasOverrides(override) ? override : undefined,
    };
  });
}

/**
 * Gets modifier groups for a product
 */
export function getProductModifierGroups(
  menu: Menu,
  product: Product,
): Array<{ ref: string; group: ModifierGroup; modifiers: Array<{ ref: string; modifier: Modifier }> }> {
  if (!product.modifierGroupRefs) return [];

  return Object.keys(product.modifierGroupRefs)
    .map((ref) => {
      const group = resolveRef(menu, ref) as ModifierGroup;
      if (!group) return null;

      const modifiers = group.childRefs
        ? Object.keys(group.childRefs).map((modRef) => ({
            ref: modRef,
            modifier: resolveRef(menu, modRef) as Modifier,
          })).filter((m) => m.modifier)
        : [];

      return { ref, group, modifiers };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

/**
 * Gets product groups that a product belongs to, along with their childRefs resolved
 */
export function getProductGroups(
  menu: Menu,
  product: Product,
  productRef: string,
): Array<{
  ref: string;
  group: ProductGroup;
  children: Array<{ ref: string; name: string; item: DisplayableItem | undefined; isCurrentProduct: boolean; overrides?: ChildRefOverride }>;
}> {
  const results: Array<{
    ref: string;
    group: ProductGroup;
    children: Array<{ ref: string; name: string; item: DisplayableItem | undefined; isCurrentProduct: boolean; overrides?: ChildRefOverride }>;
  }> = [];

  // 1. Check productGroupIds on the product
  const groupIds = product.productGroupIds ?? [];
  const seenRefs = new Set<string>();

  for (const id of groupIds) {
    const ref = id.startsWith('productGroups.') ? id : `productGroups.${id}`;
    if (seenRefs.has(ref)) continue;
    seenRefs.add(ref);

    const group = resolveRef(menu, ref) as ProductGroup | undefined;
    if (!group) continue;

    const children = resolveProductGroupChildren(menu, group, productRef);
    results.push({ ref, group, children });
  }

  // 2. Also scan all productGroups for any that contain this product in childRefs
  for (const [pgRef, pg] of Object.entries(menu.productGroups || {})) {
    if (seenRefs.has(pgRef)) continue;
    if (pg.childRefs && productRef in pg.childRefs) {
      seenRefs.add(pgRef);
      const children = resolveProductGroupChildren(menu, pg, productRef);
      results.push({ ref: pgRef, group: pg, children });
    }
  }

  return results;
}

function resolveProductGroupChildren(
  menu: Menu,
  group: ProductGroup,
  currentProductRef: string,
): Array<{ ref: string; name: string; item: DisplayableItem | undefined; isCurrentProduct: boolean; overrides?: ChildRefOverride }> {
  if (!group.childRefs) return [];

  return Object.keys(group.childRefs).map((childRef) => {
    const resolved = resolveRef(menu, childRef);
    const override = group.childRefs![childRef] ?? {};
    const merged = resolved ? mergeWithOverrides(resolved, override) : undefined;
    return {
      ref: childRef,
      name: merged?.displayName ?? resolved?.displayName ?? getRefId(childRef),
      item: merged ?? resolved,
      isCurrentProduct: childRef === currentProductRef,
      overrides: hasOverrides(override) ? override : undefined,
    };
  });
}

/**
 * Search across all products and modifiers
 */
// ── Fuzzy Search Engine ──────────────────────────────────────────────
//
// Scoring tiers:
//   100  exact substring match on displayName
//    90  exact substring match on ref / description / PLU
//    80  all query words appear (prefix ok) in displayName
//    70  all query words appear in ref / description
//  0-60  character-sequence fuzzy match (scaled by match density)
//     0  no match

/** Score a single target string against the full query and query words. */
function fuzzyScore(target: string, query: string, queryWords: string[]): number {
  if (!target) return 0;
  const t = target.toLowerCase();
  const q = query;

  // Tier 1: exact substring
  if (t.includes(q)) return 100;

  // Tier 2: all query words present (supports prefix matching)
  if (queryWords.length > 1) {
    const allPresent = queryWords.every((w) => t.includes(w));
    if (allPresent) return 80;

    // Prefix word matching: "chk sand" matches "chicken sandwich"
    const words = t.split(/[\s\-_./]+/);
    const allPrefix = queryWords.every((qw) => words.some((tw) => tw.startsWith(qw)));
    if (allPrefix) return 75;
  }

  // Tier 3: character-sequence fuzzy
  // Walk through query chars in order, finding them in target
  let qi = 0;
  let consecutiveBonus = 0;
  let totalBonus = 0;
  let prevMatchIdx = -2;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      // Bonus for consecutive matches
      if (ti === prevMatchIdx + 1) {
        consecutiveBonus++;
        totalBonus += consecutiveBonus;
      } else {
        consecutiveBonus = 0;
      }
      // Bonus for matching at word boundary
      if (ti === 0 || /[\s\-_./]/.test(t[ti - 1])) {
        totalBonus += 2;
      }
      prevMatchIdx = ti;
      qi++;
    }
  }

  // All query chars must be found in order
  if (qi < q.length) return 0;

  // Scale: longer matches relative to target = better
  const coverage = q.length / t.length;
  const density = (q.length + totalBonus) / t.length;
  const raw = Math.min(60, Math.round(density * 60 + coverage * 20));

  // Require minimum quality to avoid garbage matches
  return raw >= 15 ? raw : 0;
}

/** Best fuzzy score across multiple target strings. */
function bestScore(targets: string[], query: string, queryWords: string[]): number {
  let best = 0;
  for (const t of targets) {
    const s = fuzzyScore(t, query, queryWords);
    if (s === 100) return 100; // short-circuit on exact match
    if (s > best) best = s;
  }
  return best;
}

export interface SearchResult<T> {
  ref: string;
  item: T;
  score: number;
}

export function searchMenu(
  menu: Menu,
  query: string,
): {
  products: Array<{ ref: string; product: Product; score: number }>;
  modifiers: Array<{ ref: string; modifier: Modifier; score: number }>;
  categories: Array<{ ref: string; category: Category; score: number }>;
} {
  const q = query.toLowerCase().trim();
  if (!q) return { products: [], modifiers: [], categories: [] };

  const queryWords = q.split(/\s+/).filter(Boolean);

  const products: Array<{ ref: string; product: Product; score: number }> = [];
  for (const [ref, p] of Object.entries(menu.products || {})) {
    const score = bestScore(
      [p.displayName ?? '', ref, p.description ?? ''],
      q,
      queryWords,
    );
    if (score > 0) products.push({ ref: `products.${ref}`, product: p, score });
  }
  products.sort((a, b) => b.score - a.score);

  const modifiers: Array<{ ref: string; modifier: Modifier; score: number }> = [];
  for (const [ref, m] of Object.entries(menu.modifiers || {})) {
    const score = bestScore(
      [m.displayName ?? '', ref, m.PLU != null ? String(m.PLU) : ''],
      q,
      queryWords,
    );
    if (score > 0) modifiers.push({ ref: `modifiers.${ref}`, modifier: m, score });
  }
  modifiers.sort((a, b) => b.score - a.score);

  const categories: Array<{ ref: string; category: Category; score: number }> = [];
  for (const [ref, c] of Object.entries(menu.categories || {})) {
    const score = bestScore(
      [c.displayName ?? '', ref],
      q,
      queryWords,
    );
    if (score > 0) categories.push({ ref: `categories.${ref}`, category: c, score });
  }
  categories.sort((a, b) => b.score - a.score);

  return { products, modifiers, categories };
}

/** Exported for testing */
export { fuzzyScore as _fuzzyScore };

/** Resolved size variant for a virtual product's alternative group. */
export interface VirtualVariantEntry {
  ref: string;
  product: Product;
  overrides?: ChildRefOverride;
  isDefault: boolean;
}

/** A product group of size variants for a virtual product. */
export interface AlternativeGroup {
  groupRef: string;
  group: ProductGroup;
  variants: VirtualVariantEntry[];
}

/**
 * For virtual products, resolves size variants from relatedProducts.alternatives.
 * Pattern: virtual product → relatedProducts.alternatives → productGroup → childRefs (actual sized products)
 * Returns the size productGroups with their resolved children (real products with prices, ctaLabels).
 */
export function getVirtualProductAlternatives(
  menu: Menu,
  product: Product,
): AlternativeGroup[] {
  if (!product.isVirtual || !product.relatedProducts) return [];

  const results: AlternativeGroup[] = [];

  // relatedProducts is Record<string, ChildRefOverride> where keys can be like "alternatives"
  // or can be refs like "productGroups.size-xxx"
  for (const [key, override] of Object.entries(product.relatedProducts)) {
    // Check if the key itself is a productGroup ref
    if (isProductGroupRef(key)) {
      const group = resolveRef(menu, key) as ProductGroup | undefined;
      if (group?.childRefs) {
        const variants = resolveAlternativeChildren(menu, group);
        results.push({ groupRef: key, group, variants });
      }
    }
    // Also check if it's a named relation like "alternatives" containing refs
    if (override && typeof override === 'object') {
      for (const innerRef of Object.keys(override)) {
        if (isProductGroupRef(innerRef)) {
          const group = resolveRef(menu, innerRef) as ProductGroup | undefined;
          if (group?.childRefs) {
            const variants = resolveAlternativeChildren(menu, group);
            results.push({ groupRef: innerRef, group, variants });
          }
        }
      }
    }
  }

  return results;
}

function resolveAlternativeChildren(
  menu: Menu,
  group: ProductGroup,
): Array<{ ref: string; product: Product; overrides?: ChildRefOverride; isDefault: boolean }> {
  if (!group.childRefs) return [];
  return Object.entries(group.childRefs)
    .map(([ref, override]) => {
      const base = resolveRef(menu, ref) as Product | undefined;
      if (!base) return null;
      const merged = hasOverrides(override) ? { ...base, ...override } as Product : base;
      return {
        ref,
        product: merged,
        overrides: hasOverrides(override) ? override : undefined,
        isDefault: Boolean(override.isDefault || base.isDefault),
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);
}

/**
 * For a virtual product, resolve to the default sized product (or the first child).
 * Returns { ref, product } of the real product to display, or null if resolution fails.
 */
export function resolveVirtualToDefault(
  menu: Menu,
  product: Product,
): { ref: string; product: Product } | null {
  const alternatives = getVirtualProductAlternatives(menu, product);
  if (alternatives.length === 0) return null;

  // Look for a variant marked isDefault across all groups
  for (const { variants } of alternatives) {
    const defaultVariant = variants.find((v) => v.isDefault);
    if (defaultVariant) return { ref: defaultVariant.ref, product: defaultVariant.product };
  }

  // Fallback: return the first variant from the first group
  const firstVariant = alternatives[0]?.variants[0];
  return firstVariant ? { ref: firstVariant.ref, product: firstVariant.product } : null;
}

/**
 * Get the bundle target for a product.
 * Products can have relatedProducts.bundle = "products.<id>" pointing to a meal/combo counterpart.
 * Returns the target product ref, product, and display name, or null if no bundle link.
 */
export function getBundleTarget(
  menu: Menu,
  product: Product,
): { ref: string; product: Product; displayName: string } | null {
  const rp = product.relatedProducts as Record<string, unknown> | undefined;
  if (!rp) return null;
  const bundleVal = rp.bundle;
  if (bundleVal == null) return null;

  const bundleRef = typeof bundleVal === 'string' ? bundleVal : String(bundleVal);
  if (!bundleRef.startsWith('products.')) return null;

  const target = resolveRef(menu, bundleRef) as Product | undefined;
  if (!target) return null;

  return {
    ref: bundleRef,
    product: target,
    displayName: target.displayName ?? bundleRef,
  };
}

/**
 * Reverse bundle lookup: find all products whose relatedProducts.bundle
 * points to the given productRef.
 */
export function getBundleSources(
  menu: Menu,
  productRef: string,
): Array<{ ref: string; product: Product; displayName: string }> {
  const results: Array<{ ref: string; product: Product; displayName: string }> = [];
  for (const [pId, p] of Object.entries(menu.products || {})) {
    const rp = p.relatedProducts as Record<string, unknown> | undefined;
    if (!rp) continue;
    const bundleVal = rp.bundle;
    if (bundleVal == null) continue;
    const bundleRef = typeof bundleVal === 'string' ? bundleVal : String(bundleVal);
    if (bundleRef === productRef) {
      results.push({
        ref: `products.${pId}`,
        product: p,
        displayName: p.displayName ?? pId,
      });
    }
  }
  return results;
}

/**
 * Reverse lookup: given a product ref, find the parent virtual product(s) that
 * reference it via relatedProducts → productGroup → childRefs.
 * Returns array of { virtualRef, virtualProduct, sizeName } for navigation.
 */
export function getParentVirtualProducts(
  menu: Menu,
  productRef: string,
): Array<{ virtualRef: string; virtualProduct: Product; groupName: string }> {
  // 1. Find all productGroups that contain this product in their childRefs
  const parentGroupRefs: string[] = [];
  for (const [pgId, pg] of Object.entries(menu.productGroups || {})) {
    if (pg.childRefs) {
      for (const childRef of Object.keys(pg.childRefs)) {
        if (childRef === productRef) {
          parentGroupRefs.push(`productGroups.${pgId}`);
          break;
        }
      }
    }
  }
  if (parentGroupRefs.length === 0) return [];

  // 2. Find virtual products whose relatedProducts reference any of those groups
  const results: Array<{ virtualRef: string; virtualProduct: Product; groupName: string }> = [];
  for (const [pId, p] of Object.entries(menu.products || {})) {
    if (!p.isVirtual || !p.relatedProducts) continue;
    for (const [key, override] of Object.entries(p.relatedProducts)) {
      // Direct productGroup ref
      if (isProductGroupRef(key) && parentGroupRefs.includes(key)) {
        const group = resolveRef(menu, key) as ProductGroup | undefined;
        results.push({
          virtualRef: `products.${pId}`,
          virtualProduct: p,
          groupName: group?.displayName || 'Size',
        });
      }
      // Nested inside a named relation like "alternatives"
      if (override && typeof override === 'object') {
        for (const innerRef of Object.keys(override)) {
          if (isProductGroupRef(innerRef) && parentGroupRefs.includes(innerRef)) {
            const group = resolveRef(menu, innerRef) as ProductGroup | undefined;
            results.push({
              virtualRef: `products.${pId}`,
              virtualProduct: p,
              groupName: group?.displayName || 'Size',
            });
          }
        }
      }
    }
  }
  return results;
}

/**
 * Get stats about the menu
 */
export function getMenuStats(menu: Menu) {
  const root = getRootCategory(menu);
  const topLevelCategoryCount = root?.childRefs
    ? Object.keys(root.childRefs).filter(isCategoryRef).length
    : 0;

  return {
    totalProducts: Object.keys(menu.products || {}).length,
    totalCategories: topLevelCategoryCount,
    totalModifiers: Object.keys(menu.modifiers || {}).length,
    totalModifierGroups: Object.keys(menu.modifierGroups || {}).length,
    totalProductGroups: Object.keys(menu.productGroups || {}).length,
    menuType: menu.displayName,
    isAvailable: menu.isAvailable,
  };
}

// ─────────────────────────────────────────────
// Data Quality: Recipe group missing default
// ─────────────────────────────────────────────

export interface RecipeNoDefaultChild {
  ref: string;
  name: string;
  isDefault: boolean;
}

export interface RecipeNoDefaultGroup {
  groupRef: string;
  groupName: string;
  children: RecipeNoDefaultChild[];
}

export interface RecipeNoDefaultMismatch {
  productRef: string;
  productName: string;
  groups: RecipeNoDefaultGroup[];
}

/**
 * Find products whose ingredientRefs include a productGroup with
 * isRecipe=true where none of the child products have isDefault=true.
 *
 * This indicates a recipe ingredient group that has no default selection,
 * which can cause issues in the mobile app's customization flow.
 */
export function getRecipeNoDefaultMismatches(menu: Menu): RecipeNoDefaultMismatch[] {
  const results: RecipeNoDefaultMismatch[] = [];
  const products = menu.products || {};
  const productGroups = menu.productGroups || {};

  for (const [pid, product] of Object.entries(products)) {
    const irefs = product.ingredientRefs;
    if (!irefs) continue;

    const badGroups: RecipeNoDefaultGroup[] = [];

    for (const iref of Object.keys(irefs)) {
      if (!iref.startsWith('productGroups.')) continue;
      const pgId = iref.slice('productGroups.'.length);
      const pg = productGroups[pgId];
      if (!pg) continue;
      if (!isRecipeGroup(pg)) continue;
      if (!pg.childRefs) continue;

      const children: RecipeNoDefaultChild[] = [];
      let hasDefault = false;

      for (const [cref, override] of Object.entries(pg.childRefs)) {
        const cpId = cref.startsWith('products.') ? cref.slice('products.'.length) : cref;
        const cp = products[cpId];
        const isDefaultProduct = cp?.isDefault === true;
        const isDefaultOverride = override != null && typeof override === 'object' &&
          (override as Record<string, unknown>).isDefault === true;
        const isDefault = isDefaultProduct || isDefaultOverride;
        if (isDefault) hasDefault = true;
        children.push({
          ref: cref,
          name: cp?.displayName ?? cpId,
          isDefault,
        });
      }

      if (!hasDefault && children.length > 0) {
        badGroups.push({
          groupRef: iref,
          groupName: pg.displayName ?? pgId,
          children,
        });
      }
    }

    if (badGroups.length > 0) {
      const productRef = pid.startsWith('products.') ? pid : `products.${pid}`;
      results.push({
        productRef,
        productName: product.displayName ?? pid,
        groups: badGroups,
      });
    }
  }

  return results;
}

// ─────────────────────────────────────────────
// Data Quality: Virtual products with missing ctaLabel
// ─────────────────────────────────────────────

export interface CtaMissingSizedProduct {
  ref: string;
  name: string;
  ctaLabel: string | null;
}

export interface CtaMissingSizeGroup {
  groupRef: string;
  groupName: string;
  children: CtaMissingSizedProduct[];
}

export interface VirtualMissingCtaLabel {
  productRef: string;
  productName: string;
  /** Size groups containing children with missing ctaLabel */
  groups: CtaMissingSizeGroup[];
  /** Direct product refs with missing ctaLabel (not via a group) */
  directProducts: CtaMissingSizedProduct[];
}

/**
 * Find virtual products whose sized/related products have ctaLabel
 * missing or set to empty string.
 *
 * Virtual products have `relatedProducts` which can contain:
 *  - Direct `products.*` refs
 *  - Nested groupings (e.g. `alternatives`) containing `productGroups.*`
 *    whose childRefs point to the actual sized products
 *
 * For each final product, we check both the override ctaLabel and the
 * product-level ctaLabel. If both are missing/empty, it's flagged.
 */
export function getVirtualMissingCtaLabel(menu: Menu): VirtualMissingCtaLabel[] {
  const results: VirtualMissingCtaLabel[] = [];
  const products = menu.products || {};
  const productGroups = menu.productGroups || {};

  const isMissing = (val: unknown): boolean =>
    val == null || (typeof val === 'string' && val.trim() === '');

  for (const [pid, product] of Object.entries(products)) {
    if (!product.isVirtual) continue;
    const rp = product.relatedProducts;
    if (!rp) continue;

    const badGroups: CtaMissingSizeGroup[] = [];
    const badDirect: CtaMissingSizedProduct[] = [];

    for (const [rkey, rval] of Object.entries(rp)) {
      if (rkey.startsWith('products.')) {
        // Direct product ref
        const rpId = rkey.slice('products.'.length);
        const rProduct = products[rpId];
        const overrideCta = rval != null && typeof rval === 'object'
          ? (rval as Record<string, unknown>).ctaLabel
          : undefined;
        if (isMissing(overrideCta) && isMissing(rProduct?.ctaLabel)) {
          badDirect.push({
            ref: rkey,
            name: rProduct?.displayName ?? rpId,
            ctaLabel: null,
          });
        }
      } else if (rval != null && typeof rval === 'object') {
        // Nested grouping (e.g. 'alternatives')
        for (const [gref, _gval] of Object.entries(rval as Record<string, unknown>)) {
          if (!gref.startsWith('productGroups.')) continue;
          const pgId = gref.slice('productGroups.'.length);
          const pg = productGroups[pgId];
          if (!pg?.childRefs) continue;

          const missing: CtaMissingSizedProduct[] = [];
          for (const [cref, cov] of Object.entries(pg.childRefs)) {
            if (!cref.startsWith('products.')) continue;
            const cpId = cref.slice('products.'.length);
            const cp = products[cpId];
            const overrideCta = cov != null && typeof cov === 'object'
              ? (cov as Record<string, unknown>).ctaLabel
              : undefined;
            const productCta = cp?.ctaLabel;
            if (isMissing(overrideCta) && isMissing(productCta)) {
              missing.push({
                ref: cref,
                name: cp?.displayName ?? cpId,
                ctaLabel: null,
              });
            }
          }

          if (missing.length > 0) {
            badGroups.push({
              groupRef: gref,
              groupName: pg.displayName ?? pgId,
              children: missing,
            });
          }
        }
      }
    }

    if (badGroups.length > 0 || badDirect.length > 0) {
      const productRef = pid.startsWith('products.') ? pid : `products.${pid}`;
      results.push({
        productRef,
        productName: product.displayName ?? pid,
        groups: badGroups,
        directProducts: badDirect,
      });
    }
  }

  return results;
}

// ─────────────────────────────────────────────
// Shared: Collect category-visible products
// ─────────────────────────────────────────────

/**
 * Walk the category tree starting from `rootCategoryRef` and collect
 * every product ref that is reachable. This gives us the "menu-visible"
 * products — the ones customers actually see — filtering out ingredient-
 * level sub-products that only exist inside recipe / modifier groups.
 */
function getVisibleProductRefs(menu: Menu): Set<string> {
  const visible = new Set<string>();
  const visited = new Set<string>();

  function walk(ref: string) {
    if (visited.has(ref)) return;
    visited.add(ref);

    const ns = getRefNamespace(ref);
    const id = getRefId(ref);

    if (ns === 'categories') {
      const cat = menu.categories?.[id];
      if (!cat?.childRefs) return;
      for (const cr of Object.keys(cat.childRefs)) {
        walk(cr);
      }
    } else if (ns === 'productGroups') {
      const pg = menu.productGroups?.[id];
      if (!pg?.childRefs) return;
      for (const cr of Object.keys(pg.childRefs)) {
        walk(cr);
      }
    } else if (ns === 'products') {
      visible.add(id);
    }
  }

  if (menu.rootCategoryRef) walk(menu.rootCategoryRef);
  return visible;
}

// ─────────────────────────────────────────────
// Data Quality: Products missing description
// ─────────────────────────────────────────────

export interface MissingDescSizedProduct {
  ref: string;
  name: string;
}

export interface MissingDescSizeGroup {
  groupRef: string;
  groupName: string;
  children: MissingDescSizedProduct[];
}

export interface ProductMissingDescription {
  productRef: string;
  productName: string;
  isVirtual: boolean;
  /**
   * For virtual products only: true when the virtual parent itself has a
   * description, meaning sized children can inherit it.
   */
  parentHasDescription: boolean;
  /** For virtual products: size groups whose sized children have no description */
  groups: MissingDescSizeGroup[];
  /** For virtual products: direct related product refs missing description */
  directProducts: MissingDescSizedProduct[];
}

/**
 * Internal helper: scan all category-visible products for missing descriptions.
 * Returns every hit regardless of whether the parent can provide inheritance.
 */
function _scanMissingDescriptions(menu: Menu): ProductMissingDescription[] {
  const results: ProductMissingDescription[] = [];
  const products = menu.products || {};
  const productGroups = menu.productGroups || {};
  const visible = getVisibleProductRefs(menu);

  const isEmpty = (val: unknown): boolean =>
    val == null || (typeof val === 'string' && val.trim() === '');

  for (const pid of visible) {
    const product = products[pid];
    if (!product) continue;
    const isVirt = Boolean(product.isVirtual);

    if (isVirt) {
      const rp = product.relatedProducts;
      if (!rp) continue;

      const parentHasDesc = !isEmpty(product.description);
      const badGroups: MissingDescSizeGroup[] = [];
      const badDirect: MissingDescSizedProduct[] = [];

      for (const [rkey, rval] of Object.entries(rp)) {
        if (rkey.startsWith('products.')) {
          const rpId = rkey.slice('products.'.length);
          const rProduct = products[rpId];
          if (isEmpty(rProduct?.description)) {
            badDirect.push({ ref: rkey, name: rProduct?.displayName ?? rpId });
          }
        } else if (rval != null && typeof rval === 'object') {
          for (const [gref] of Object.entries(rval as Record<string, unknown>)) {
            if (!gref.startsWith('productGroups.')) continue;
            const pgId = gref.slice('productGroups.'.length);
            const pg = productGroups[pgId];
            if (!pg?.childRefs) continue;

            const missing: MissingDescSizedProduct[] = [];
            for (const cref of Object.keys(pg.childRefs)) {
              if (!cref.startsWith('products.')) continue;
              const cpId = cref.slice('products.'.length);
              const cp = products[cpId];
              if (isEmpty(cp?.description)) {
                missing.push({ ref: cref, name: cp?.displayName ?? cpId });
              }
            }
            if (missing.length > 0) {
              badGroups.push({ groupRef: gref, groupName: pg.displayName ?? pgId, children: missing });
            }
          }
        }
      }

      if (badGroups.length > 0 || badDirect.length > 0) {
        results.push({
          productRef: `products.${pid}`,
          productName: product.displayName ?? pid,
          isVirtual: true,
          parentHasDescription: parentHasDesc,
          groups: badGroups,
          directProducts: badDirect,
        });
      }
    } else {
      if (isEmpty(product.description)) {
        results.push({
          productRef: `products.${pid}`,
          productName: product.displayName ?? pid,
          isVirtual: false,
          parentHasDescription: false,
          groups: [],
          directProducts: [],
        });
      }
    }
  }

  return results;
}

/**
 * Products with genuinely missing descriptions (warnings).
 *
 * - Non-virtual products with no description.
 * - Virtual products where the parent itself has NO description
 *   AND sized children also have no description (nothing to inherit).
 */
export function getProductsMissingDescription(menu: Menu): ProductMissingDescription[] {
  return _scanMissingDescriptions(menu).filter(
    (m) => !m.isVirtual || !m.parentHasDescription,
  );
}

/**
 * Virtual products whose sized children have no description, but the
 * virtual parent DOES have one — so the description can be inherited.
 *
 * These are not errors, just observations worth noting.
 */
export function getDescriptionInheritableObservations(menu: Menu): ProductMissingDescription[] {
  return _scanMissingDescriptions(menu).filter(
    (m) => m.isVirtual && m.parentHasDescription,
  );
}

// ─────────────────────────────────────────────
// Data Quality: Products missing image
// ─────────────────────────────────────────────

export interface MissingImgSizedProduct {
  ref: string;
  name: string;
}

export interface MissingImgSizeGroup {
  groupRef: string;
  groupName: string;
  children: MissingImgSizedProduct[];
}

export interface ProductMissingImage {
  productRef: string;
  productName: string;
  isVirtual: boolean;
  /** For virtual products: size groups whose sized children have no image */
  groups: MissingImgSizeGroup[];
  /** For virtual products: direct related product refs missing image */
  directProducts: MissingImgSizedProduct[];
}

/**
 * Find category-visible products that have no image.
 *
 * - Non-virtual products: check `image` and `imageUrl` on the product.
 * - Virtual products: follow `relatedProducts` chain to sized products
 *   and check each of their `image` / `imageUrl` fields.
 *
 * Does NOT drill into ingredientRefs.
 */
export function getProductsMissingImage(menu: Menu): ProductMissingImage[] {
  const results: ProductMissingImage[] = [];
  const products = menu.products || {};
  const productGroups = menu.productGroups || {};
  const visible = getVisibleProductRefs(menu);

  const hasImage = (p: Product | undefined): boolean => {
    if (!p) return false;
    const img = p.image || p.imageUrl;
    return typeof img === 'string' && img.trim() !== '';
  };

  for (const pid of visible) {
    const product = products[pid];
    if (!product) continue;
    const isVirt = Boolean(product.isVirtual);

    if (isVirt) {
      const rp = product.relatedProducts;
      if (!rp) continue;

      const badGroups: MissingImgSizeGroup[] = [];
      const badDirect: MissingImgSizedProduct[] = [];

      for (const [rkey, rval] of Object.entries(rp)) {
        if (rkey.startsWith('products.')) {
          const rpId = rkey.slice('products.'.length);
          const rProduct = products[rpId];
          if (!hasImage(rProduct)) {
            badDirect.push({ ref: rkey, name: rProduct?.displayName ?? rpId });
          }
        } else if (rval != null && typeof rval === 'object') {
          for (const [gref] of Object.entries(rval as Record<string, unknown>)) {
            if (!gref.startsWith('productGroups.')) continue;
            const pgId = gref.slice('productGroups.'.length);
            const pg = productGroups[pgId];
            if (!pg?.childRefs) continue;

            const missing: MissingImgSizedProduct[] = [];
            for (const cref of Object.keys(pg.childRefs)) {
              if (!cref.startsWith('products.')) continue;
              const cpId = cref.slice('products.'.length);
              const cp = products[cpId];
              if (!hasImage(cp)) {
                missing.push({ ref: cref, name: cp?.displayName ?? cpId });
              }
            }
            if (missing.length > 0) {
              badGroups.push({ groupRef: gref, groupName: pg.displayName ?? pgId, children: missing });
            }
          }
        }
      }

      if (badGroups.length > 0 || badDirect.length > 0) {
        results.push({
          productRef: `products.${pid}`,
          productName: product.displayName ?? pid,
          isVirtual: true,
          groups: badGroups,
          directProducts: badDirect,
        });
      }
    } else {
      if (!hasImage(product)) {
        results.push({
          productRef: `products.${pid}`,
          productName: product.displayName ?? pid,
          isVirtual: false,
          groups: [],
          directProducts: [],
        });
      }
    }
  }

  return results;
}

// ─────────────────────────────────────────────
// Data Quality: Products missing keywords/tags
// ─────────────────────────────────────────────

export interface MissingTagSizedProduct {
  ref: string;
  name: string;
}

export interface MissingTagSizeGroup {
  groupRef: string;
  groupName: string;
  children: MissingTagSizedProduct[];
}

export interface ProductMissingTags {
  productRef: string;
  productName: string;
  isVirtual: boolean;
  parentHasTags: boolean;
  groups: MissingTagSizeGroup[];
  directProducts: MissingTagSizedProduct[];
}

export interface ProductMissingSearchKeywords {
  productRef: string;
  productName: string;
  isVirtual: boolean;
  parentHasKeywords: boolean;
  groups: MissingTagSizeGroup[];
  directProducts: MissingTagSizedProduct[];
}

/* ── Predicate helpers ── */

function _hasTags(p: Product | undefined): boolean {
  if (!p) return false;
  return Array.isArray(p.tags) && p.tags.length > 0;
}

function _hasSearchKeywords(p: Product | undefined): boolean {
  if (!p) return false;
  const ca = p.customAttributes;
  if (ca) {
    const kw = ca.keywords;
    if (Array.isArray(kw) && kw.length > 0) return true;
  }
  return false;
}

/* ── Generic scanner shared by both checks ── */

interface _MissingFieldResult {
  productRef: string;
  productName: string;
  isVirtual: boolean;
  parentHasField: boolean;
  groups: MissingTagSizeGroup[];
  directProducts: MissingTagSizedProduct[];
}

function _scanMissingField(
  menu: Menu,
  hasField: (p: Product | undefined) => boolean,
): _MissingFieldResult[] {
  const results: _MissingFieldResult[] = [];
  const products = menu.products || {};
  const productGroups = menu.productGroups || {};
  const visible = getVisibleProductRefs(menu);

  for (const pid of visible) {
    const product = products[pid];
    if (!product) continue;
    const isVirt = Boolean(product.isVirtual);

    if (isVirt) {
      const rp = product.relatedProducts;
      if (!rp) continue;

      const parentHas = hasField(product);
      const badGroups: MissingTagSizeGroup[] = [];
      const badDirect: MissingTagSizedProduct[] = [];

      for (const [rkey, rval] of Object.entries(rp)) {
        if (rkey.startsWith('products.')) {
          const rpId = rkey.slice('products.'.length);
          const rProduct = products[rpId];
          if (!hasField(rProduct)) {
            badDirect.push({ ref: rkey, name: rProduct?.displayName ?? rpId });
          }
        } else if (rval != null && typeof rval === 'object') {
          for (const [gref] of Object.entries(rval as Record<string, unknown>)) {
            if (!gref.startsWith('productGroups.')) continue;
            const pgId = gref.slice('productGroups.'.length);
            const pg = productGroups[pgId];
            if (!pg?.childRefs) continue;

            const missing: MissingTagSizedProduct[] = [];
            for (const cref of Object.keys(pg.childRefs)) {
              if (!cref.startsWith('products.')) continue;
              const cpId = cref.slice('products.'.length);
              const cp = products[cpId];
              if (!hasField(cp)) {
                missing.push({ ref: cref, name: cp?.displayName ?? cpId });
              }
            }
            if (missing.length > 0) {
              badGroups.push({ groupRef: gref, groupName: pg.displayName ?? pgId, children: missing });
            }
          }
        }
      }

      if (badGroups.length > 0 || badDirect.length > 0) {
        results.push({
          productRef: `products.${pid}`,
          productName: product.displayName ?? pid,
          isVirtual: true,
          parentHasField: parentHas,
          groups: badGroups,
          directProducts: badDirect,
        });
      }
    } else {
      if (!hasField(product)) {
        results.push({
          productRef: `products.${pid}`,
          productName: product.displayName ?? pid,
          isVirtual: false,
          parentHasField: false,
          groups: [],
          directProducts: [],
        });
      }
    }
  }

  return results;
}

/* ── Tags (classification metadata) ── */

function _toMissingTags(r: _MissingFieldResult): ProductMissingTags {
  return { ...r, parentHasTags: r.parentHasField };
}

export function getProductsMissingTags(menu: Menu): ProductMissingTags[] {
  return _scanMissingField(menu, _hasTags)
    .filter((m) => !m.isVirtual || !m.parentHasField)
    .map(_toMissingTags);
}

export function getTagsInheritableObservations(menu: Menu): ProductMissingTags[] {
  return _scanMissingField(menu, _hasTags)
    .filter((m) => m.isVirtual && m.parentHasField)
    .map(_toMissingTags);
}

/* ── Search keywords (customAttributes.keywords) ── */

function _toMissingKeywords(r: _MissingFieldResult): ProductMissingSearchKeywords {
  return { ...r, parentHasKeywords: r.parentHasField };
}

export function getProductsMissingKeywords(menu: Menu): ProductMissingSearchKeywords[] {
  return _scanMissingField(menu, _hasSearchKeywords)
    .filter((m) => !m.isVirtual || !m.parentHasField)
    .map(_toMissingKeywords);
}

export function getKeywordsInheritableObservations(menu: Menu): ProductMissingSearchKeywords[] {
  return _scanMissingField(menu, _hasSearchKeywords)
    .filter((m) => m.isVirtual && m.parentHasField)
    .map(_toMissingKeywords);
}

// ─────────────────────────────────────────────
// Data Quality: Non-standard tag format
// ─────────────────────────────────────────────
//
// Standard format: "namespace.value"  (e.g. "is.Drink", "allergen.Egg")
// Non-standard:    bare strings, underscored prefixes, missing dot, etc.

/** Regex: at least one non-dot char, then a dot, then at least one non-dot char. */
const STANDARD_TAG_RE = /^[^.]+\.[^.]+$/;

export interface MalformedTagProduct {
  productRef: string;
  productName: string;
  isVirtual: boolean;
  badTags: string[];
}

/**
 * Returns products whose `tags` array contains entries that don't follow
 * the standard `namespace.value` convention (e.g. `is.Drink`, `protein.Beef`).
 *
 * Only considers category-visible products that actually have tags.
 */
export function getProductsWithMalformedTags(menu: Menu): MalformedTagProduct[] {
  const results: MalformedTagProduct[] = [];
  const products = menu.products || {};
  const visible = getVisibleProductRefs(menu);

  for (const pid of visible) {
    const product = products[pid];
    if (!product?.tags || product.tags.length === 0) continue;

    const bad = product.tags.filter((t) => !STANDARD_TAG_RE.test(t));
    if (bad.length > 0) {
      results.push({
        productRef: `products.${pid}`,
        productName: product.displayName ?? pid,
        isVirtual: Boolean(product.isVirtual),
        badTags: bad,
      });
    }
  }

  return results;
}
