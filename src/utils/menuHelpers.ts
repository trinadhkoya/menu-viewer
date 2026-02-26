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
 * Gets the namespace from a ref (e.g., "products" from "products.burger")
 */
export function getRefNamespace(ref: string): string {
  return ref.split('.')[0];
}

/**
 * Gets the ID from a ref (e.g., "burger" from "products.burger")
 */
export function getRefId(ref: string): string {
  return ref.split('.').slice(1).join('.');
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
export function searchMenu(
  menu: Menu,
  query: string,
): {
  products: Array<{ ref: string; product: Product; categoryRef?: string }>;
  modifiers: Array<{ ref: string; modifier: Modifier }>;
  categories: Array<{ ref: string; category: Category }>;
} {
  const q = query.toLowerCase().trim();
  if (!q) return { products: [], modifiers: [], categories: [] };

  const products = Object.entries(menu.products || {})
    .filter(([ref, p]) => {
      const name = p.displayName?.toLowerCase() ?? '';
      const desc = p.description?.toLowerCase() ?? '';
      const id = getRefId(ref).toLowerCase();
      return name.includes(q) || desc.includes(q) || id.includes(q);
    })
    .map(([ref, product]) => ({ ref, product }));

  const modifiers = Object.entries(menu.modifiers || {})
    .filter(([ref, m]) => {
      const name = m.displayName?.toLowerCase() ?? '';
      const id = getRefId(ref).toLowerCase();
      return name.includes(q) || id.includes(q);
    })
    .map(([ref, modifier]) => ({ ref, modifier }));

  const categories = Object.entries(menu.categories || {})
    .filter(([ref, c]) => {
      const name = c.displayName?.toLowerCase() ?? '';
      const id = getRefId(ref).toLowerCase();
      return name.includes(q) || id.includes(q);
    })
    .map(([ref, category]) => ({ ref, category }));

  return { products, modifiers, categories };
}

/**
 * For virtual products, resolves size variants from relatedProducts.alternatives.
 * Pattern: virtual product → relatedProducts.alternatives → productGroup → childRefs (actual sized products)
 * Returns the size productGroups with their resolved children (real products with prices, ctaLabels).
 */
export function getVirtualProductAlternatives(
  menu: Menu,
  product: Product,
): Array<{
  groupRef: string;
  group: ProductGroup;
  variants: Array<{
    ref: string;
    product: Product;
    overrides?: ChildRefOverride;
    isDefault: boolean;
  }>;
}> {
  if (!product.isVirtual || !product.relatedProducts) return [];

  const results: Array<{
    groupRef: string;
    group: ProductGroup;
    variants: Array<{
      ref: string;
      product: Product;
      overrides?: ChildRefOverride;
      isDefault: boolean;
    }>;
  }> = [];

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
