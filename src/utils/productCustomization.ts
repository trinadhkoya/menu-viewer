/**
 * Product Customization Engine
 *
 * Ported from the mobile app's Product module utilities.
 * Handles modifier selections, upcharge calculation, quantity constraints,
 * intensity options, combo slot selection, and total price/calorie computation.
 *
 * Upcharge Cases (from IDP Tech Doc):
 *  1. Default item with intensity mods → upcharge = max(selectedModPrice - defaultModPrice, 0)
 *  2. Non-default chargeable modifier  → upcharge = modifier.price (displayed directly)
 *  3. Combo size upgrade (segmented)   → upcharge = max(selectedSize.price - defaultSize.price, 0)
 *  4. Sides/Drink group swap (min=1,max=1) → upcharge = max(selectedProduct.price - defaultProduct.price, 0)
 */

import type {
  Menu,
  Product,
  Modifier,
  ModifierGroup,
  ProductGroup,
  ChildRefOverride,
  Quantity,
} from '../types/menu';
import { resolveRef, getRefId, isProductRef, isProductGroupRef, getVirtualProductAlternatives } from './menuHelpers';
import type { VirtualVariantEntry } from './menuHelpers';

/* ──────────────────────────────────────────────
   Selection State Types
   ────────────────────────────────────────────── */

export interface SelectedGroupItem {
  quantity: number;
  subItemId?: string;   // intensity modifier ID or dropdown sub-item
  groupId?: string;     // the modifier group ID (for intensities)
  selection?: SelectedModifiers; // nested sub-selections
}

export type SelectedGroup = Record<string, SelectedGroupItem>;
export type SelectedModifiers = Record<string, SelectedGroup>;

export interface ComboSelection {
  product?: Product;
  productRef?: string;
  modifiers: SelectedModifiers;
  index: number;
  groupName?: string;
  groupId?: string;
}

export interface ComboGroupOption {
  groupTitle: string;
  groupId?: string;
  products: Array<Product & { _ref: string }>;
  isEntree: boolean;
}

export type ComboOptions = ComboGroupOption[];

/* ──────────────────────────────────────────────
   Action Types for modifier cards
   ────────────────────────────────────────────── */

export const ActionType = {
  RADIO: 'RADIO',
  CHECK_BOX: 'CHECK_BOX',
  STATIC: 'STATIC',
  ACCORDION: 'ACCORDION',
} as const;

export type ActionType = (typeof ActionType)[keyof typeof ActionType];

/* ──────────────────────────────────────────────
   Predicate Helpers
   ────────────────────────────────────────────── */

export function isExclusiveTag(product: Product | Modifier): boolean {
  return product?.isExclusive === true || (product?.tags?.some((t) => t === 'is.exclusive') ?? false);
}

export function isExclusiveRef(menu: Menu, ref: string): boolean {
  const entity = resolveRef(menu, ref) as Product | Modifier | undefined;
  return entity ? isExclusiveTag(entity) : false;
}

export function productHasIntensities(product: Product, menu: Menu): boolean {
  const modGroupRefs = product?.modifierGroupRefs;
  if (!modGroupRefs || Object.keys(modGroupRefs).length === 0) return false;
  if (product?.ingredientRefs && Object.keys(product.ingredientRefs).length > 0) return false;
  const firstGroupRef = Object.keys(modGroupRefs)[0];
  return !!resolveRef(menu, firstGroupRef);
}

function isStaticQuantity(override: ChildRefOverride | undefined, menuItem: Product | Modifier | undefined): boolean {
  const qty = override?.quantity ?? (menuItem as Product)?.quantity;
  if (!qty) return false;
  return qty.min != null && qty.max != null && qty.min === qty.max;
}

function isSingleSelectionGroup(menu: Menu, groupRef: string): boolean {
  const group = resolveRef(menu, groupRef) as ProductGroup | ModifierGroup | undefined;
  if (!group) return false;
  const sq = (group as ProductGroup).selectionQuantity ?? (group as ModifierGroup).selectionQuantity;
  return sq?.min === 1 && sq?.max === 1;
}

/* ──────────────────────────────────────────────
   Virtual Product Price Resolution
   ────────────────────────────────────────────── */

/**
 * Internal: resolves the size variants for a virtual product.
 * Returns the first alternative group's variants, or an empty array.
 * Centralised to avoid repeated getVirtualProductAlternatives calls.
 */
function resolveVirtualVariants(
  menu: Menu,
  product: Product | Modifier | undefined,
): VirtualVariantEntry[] {
  if (!product || !(product as Product).isVirtual) return [];
  const alts = getVirtualProductAlternatives(menu, product as Product);
  return alts.length > 0 ? alts[0].variants : [];
}

/**
 * Resolves the effective price of a product.
 * For virtual products, walks relatedProducts.alternatives → finds the default
 * size variant → returns that variant's price (matching mobile getProductGroupItems).
 * For concrete products, returns the product's own price.
 */
export function getDefaultSizeVariantPrice(
  menu: Menu,
  product: Product | Modifier | undefined,
): number | undefined {
  if (!product) return undefined;
  if (!(product as Product).isVirtual) return product.price;

  const variants = resolveVirtualVariants(menu, product);
  if (variants.length === 0) return product.price;

  const defaultVariant = variants.find((v) => v.isDefault);
  return defaultVariant?.product?.price ?? variants[0]?.product?.price ?? product.price;
}

/**
 * Gets the price of a specific size variant of a virtual product.
 * Used when a user selects a non-default size (e.g., Large instead of Medium).
 */
export function getSizeVariantPrice(
  menu: Menu,
  virtualProduct: Product | Modifier | undefined,
  sizeRef: string,
): number | undefined {
  if (!virtualProduct || !(virtualProduct as Product).isVirtual) return virtualProduct?.price;

  const variants = resolveVirtualVariants(menu, virtualProduct);
  if (variants.length === 0) return virtualProduct?.price;

  const variant = variants.find((v) => v.ref === sizeRef);
  return variant?.product?.price ?? virtualProduct?.price;
}

/**
 * Case 3 — Size variant upcharge (Y-X).
 * Calculates the premium of a selected size relative to the default size.
 * Returns 0 if no upcharge or if prices aren't available.
 */
export function getSizeVariantUpcharge(
  menu: Menu,
  virtualProduct: Product | Modifier | undefined,
  selectedSizeRef: string,
): number {
  if (!virtualProduct || !(virtualProduct as Product).isVirtual) return 0;

  const variants = resolveVirtualVariants(menu, virtualProduct);
  if (variants.length === 0) return 0;

  const defaultVariant = variants.find((v) => v.isDefault);
  const selectedVariant = variants.find((v) => v.ref === selectedSizeRef);
  if (!defaultVariant || !selectedVariant) return 0;

  const defaultPrice = defaultVariant.product?.price;
  const selectedPrice = selectedVariant.product?.price;
  if (defaultPrice == null || selectedPrice == null) return 0;

  return Math.max(selectedPrice - defaultPrice, 0);
}

/**
 * Case 4 — Product group upcharge (Y-X).
 * For a product group with min=1,max=1 (forced single-select),
 * calculates the upcharge of selecting a non-default product.
 * Reuses getProductGroupItems to avoid duplicate resolution logic.
 */
export function getProductGroupUpcharge(
  menu: Menu,
  groupRef: string,
  selectedItemRef: string,
  selectedSizeRef?: string,
): number {
  if (!isSingleSelectionGroup(menu, groupRef)) return 0;

  const items = getProductGroupItems(menu, groupRef);
  if (items.length === 0) return 0;

  // Default product price (already resolved through virtual → default size)
  const defaultItem = items.find((p) => p.isDefault);
  const defaultPrice = defaultItem?.price;
  if (defaultPrice == null) return 0;

  // Selected product price — handle optional size override for virtual
  const selectedItem = items.find((p) => p._ref === selectedItemRef);
  if (!selectedItem) return 0;

  let selectedPrice = selectedItem.price;
  if (selectedSizeRef && selectedItem.isVirtual) {
    // User picked a specific size within the virtual product
    selectedPrice = getSizeVariantPrice(menu, selectedItem, selectedSizeRef) ?? selectedPrice;
  }

  return Math.max((selectedPrice ?? 0) - defaultPrice, 0);
}

/* ──────────────────────────────────────────────
   Virtual Product Drill-down Helpers
   ────────────────────────────────────────────── */

export interface VirtualSizeVariant {
  ref: string;
  product: Product;
  isDefault: boolean;
  overrides?: ChildRefOverride;
}

export interface VirtualAlternatives {
  groupRef: string;
  groupName: string;
  variants: VirtualSizeVariant[];
}

/**
 * Returns size alternatives for a virtual product, or null if it has none.
 * Used to determine if a product in the customizer should show a "Customize" drill-down.
 */
export function getVirtualSizeAlternatives(
  menu: Menu,
  product: Product | Modifier | undefined,
): VirtualAlternatives | null {
  if (!product || !(product as Product).isVirtual) return null;
  const alts = getVirtualProductAlternatives(menu, product as Product);
  if (alts.length === 0) return null;
  const first = alts[0];
  return {
    groupRef: first.groupRef,
    groupName: first.group.displayName ?? 'Size',
    variants: first.variants.map((v) => ({
      ref: v.ref,
      product: v.product,
      isDefault: v.isDefault,
      overrides: v.overrides,
    })),
  };
}

/**
 * Build the initial nested state for a virtual product's default size variant.
 * Returns { selectedSizeRef, sizeModifiers } for the default size.
 */
export function getInitialVirtualSizeState(
  menu: Menu,
  product: Product | Modifier | undefined,
): { selectedSizeRef: string; sizeModifiers: SelectedModifiers } | null {
  const alts = getVirtualSizeAlternatives(menu, product);
  if (!alts || alts.variants.length === 0) return null;
  const defaultVariant = alts.variants.find((v) => v.isDefault) ?? alts.variants[0];
  return {
    selectedSizeRef: defaultVariant.ref,
    sizeModifiers: getInitialSelectedIngredients(menu, defaultVariant.product),
  };
}

/** Determine the control type for a modifier item */
export function getModifierActionType(menu: Menu, groupRef: string, itemRef: string): ActionType {
  if (isProductGroupRef(itemRef)) return ActionType.ACCORDION;

  const group = resolveRef(menu, groupRef) as ProductGroup | ModifierGroup | undefined;
  const override = group && 'childRefs' in group ? (group.childRefs?.[itemRef] as ChildRefOverride) : undefined;
  const menuItem = resolveRef(menu, itemRef) as Product | Modifier | undefined;

  if (isStaticQuantity(override, menuItem)) return ActionType.STATIC;
  if (isSingleSelectionGroup(menu, groupRef)) return ActionType.RADIO;
  return ActionType.CHECK_BOX;
}

/* ──────────────────────────────────────────────
   Default Quantity Helpers
   ────────────────────────────────────────────── */

function getDefaultQuantity(override: ChildRefOverride | undefined, menuItem: Product | Modifier | undefined): number {
  const isDefault = override?.isDefault ?? (menuItem as Product)?.isDefault ?? false;
  const qty = override?.quantity ?? (menuItem as Product)?.quantity;
  return qty?.default ?? (isDefault ? 1 : 0);
}

function isDefaultInGroup(override: ChildRefOverride | undefined, menuItem: Product | Modifier | undefined): boolean {
  return override?.isDefault ?? (menuItem as Product)?.isDefault ?? false;
}

/* ──────────────────────────────────────────────
   Intensity Helpers
   ────────────────────────────────────────────── */

/** Get the default intensity modifier ID for a product that has intensities */
function getDefaultIntensityId(modGroup: ModifierGroup, menu: Menu): string | undefined {
  if (!modGroup?.childRefs) return undefined;
  for (const [ref, override] of Object.entries(modGroup.childRefs)) {
    const menuMod = resolveRef(menu, ref) as Modifier | undefined;
    if ((override as ChildRefOverride)?.isDefault || menuMod?.isDefault) return ref;
  }
  return Object.keys(modGroup.childRefs)[0]; // fallback to first
}

/** Get the exclusive ("None") intensity modifier ID */
function getExclusiveIntensityId(modGroup: ModifierGroup, menu: Menu): string | undefined {
  if (!modGroup?.childRefs) return undefined;
  for (const ref of Object.keys(modGroup.childRefs)) {
    if (isExclusiveRef(menu, ref)) return ref;
  }
  return undefined;
}

/**
 * Toggle intensity assignment:
 * - No previous → assign default
 * - Previous was "None"/exclusive → assign default
 * - Previous was real intensity → assign "None"/exclusive
 */
export function getModifierGroupSubItemId(
  menu: Menu,
  productRef: string,
  prevIntensity?: string,
): string | undefined {
  const product = resolveRef(menu, productRef) as Product | undefined;
  if (!product?.modifierGroupRefs) return undefined;
  const firstGroupRef = Object.keys(product.modifierGroupRefs)[0];
  if (!firstGroupRef) return undefined;
  const modGroup = resolveRef(menu, firstGroupRef) as ModifierGroup | undefined;
  if (!modGroup?.childRefs) return undefined;

  const defaultId = getDefaultIntensityId(modGroup, menu);
  const exclusiveId = getExclusiveIntensityId(modGroup, menu);

  if (!prevIntensity) return defaultId;
  if (prevIntensity === exclusiveId) return defaultId;
  return exclusiveId ?? defaultId;
}

/* ──────────────────────────────────────────────
   Initial Selection Builder
   ────────────────────────────────────────────── */

/**
 * Builds the initial selected ingredients state for a product (matches mobile getInitialSelectedIngredients).
 */
export function getInitialSelectedIngredients(menu: Menu, product?: Product): SelectedModifiers {
  if (!product) return {};

  const allGroupRefs = [
    ...Object.keys(product.ingredientRefs ?? {}),
    ...Object.keys(product.modifierGroupRefs ?? {}),
  ];

  const result: SelectedModifiers = {};

  for (const groupRef of allGroupRefs) {
    const group = resolveRef(menu, groupRef) as ProductGroup | ModifierGroup | undefined;
    if (!group?.childRefs) continue;

    const groupItems: SelectedGroup = {};
    const isSingleSelect = isSingleSelectionGroup(menu, groupRef);
    let singleSelectFilled = false; // tracks if one default was already assigned qty 1

    for (const [itemRef, overrideRaw] of Object.entries(group.childRefs)) {
      const menuItem = resolveRef(menu, itemRef) as Product | Modifier | undefined;
      if (!menuItem) continue;

      const override = (overrideRaw ?? {}) as ChildRefOverride;
      let defaultQty = getDefaultQuantity(override, menuItem);

      // For single-selection groups (min=1, max=1), only the first default gets qty 1.
      // Subsequent defaults are set to 0 to avoid exceeding the max.
      if (isSingleSelect && defaultQty > 0) {
        if (singleSelectFilled) {
          defaultQty = 0;
        } else {
          singleSelectFilled = true;
        }
      }

      if (isProductGroupRef(itemRef)) {
        // Dropdown-style selection: find default child
        const subGroup = resolveRef(menu, itemRef) as ProductGroup | undefined;
        if (subGroup?.childRefs) {
          const children = Object.entries(subGroup.childRefs);
          const defaultChild = children.find(([childRef, childOverride]) => {
            const childMenu = resolveRef(menu, childRef) as Product | undefined;
            return (childOverride as ChildRefOverride)?.isDefault || childMenu?.isDefault;
          });
          groupItems[itemRef] = {
            subItemId: defaultChild?.[0] ?? children[0]?.[0],
            quantity: 1,
          };
        }
      } else if (productHasIntensities(menuItem as Product, menu)) {
        // Product with intensity options
        const intensityGroupRef = Object.keys((menuItem as Product).modifierGroupRefs ?? {})[0];
        const modGroup = intensityGroupRef ? resolveRef(menu, intensityGroupRef) as ModifierGroup : undefined;
        let defaultIntensityId: string | undefined;

        if (modGroup?.childRefs) {
          if (defaultQty === 0) {
            // deselected by default → assign exclusive/"None"
            defaultIntensityId = getExclusiveIntensityId(modGroup, menu) ?? getDefaultIntensityId(modGroup, menu);
          } else {
            defaultIntensityId = getDefaultIntensityId(modGroup, menu);
          }
        }

        groupItems[itemRef] = {
          subItemId: defaultIntensityId,
          quantity: defaultQty,
          groupId: modGroup?.id,
        };
      } else {
        groupItems[itemRef] = { quantity: defaultQty };
      }

      // Nested ingredient selections (recursive)
      if ((menuItem as Product).ingredientRefs && Object.keys((menuItem as Product).ingredientRefs!).length > 0) {
        groupItems[itemRef].selection = getInitialSelectedIngredients(menu, menuItem as Product);
      }
    }

    result[groupRef] = groupItems;
  }

  return result;
}

/* ──────────────────────────────────────────────
   Selection Toggle Logic
   ────────────────────────────────────────────── */

export function toggleIngredientSelection(
  prev: SelectedModifiers,
  menu: Menu,
  groupRef: string,
  itemRef: string,
  initialIngredients: SelectedModifiers,
): SelectedModifiers {
  const actionType = getModifierActionType(menu, groupRef, itemRef);
  const groupItems = prev[groupRef] ?? {};
  const itemState = groupItems[itemRef];
  const isCurrentlySelected = (itemState?.quantity ?? 0) >= 1;
  const isExclusive = isExclusiveRef(menu, itemRef);
  const isRadio = actionType === ActionType.RADIO;

  // ── Group max guard: block new selections when group is at capacity ──
  if (!isCurrentlySelected && !isRadio) {
    const groupSQ = getGroupSelectionQuantity(menu, groupRef);
    const maxGroup = groupSQ.max;
    if (maxGroup != null) {
      const totalSelected = getGroupSelectedCount(groupItems);
      if (totalSelected >= maxGroup) return prev; // at capacity → do nothing
    }
  }

  // Exclusive item: deselect everything else in the group
  if (!isRadio && isExclusive && !isCurrentlySelected) {
    const updatedGroup: SelectedGroup = {};
    for (const [key, data] of Object.entries(groupItems)) {
      updatedGroup[key] = {
        ...data,
        quantity: key === itemRef ? 1 : 0,
        selection: key === itemRef ? data.selection : initialIngredients[groupRef]?.[key]?.selection,
      };
    }
    return { ...prev, [groupRef]: updatedGroup };
  }

  // Radio: already selected → no-op
  if (isRadio && isCurrentlySelected) return prev;

  // Radio: deselect all, then select new
  const updatedGroup = isRadio
    ? Object.fromEntries(
        Object.entries(groupItems).map(([key, data]) => [
          key,
          { ...data, quantity: 0, selection: initialIngredients[groupRef]?.[key]?.selection },
        ]),
      )
    : { ...groupItems };

  // If an exclusive item was selected and we're selecting non-exclusive, deselect the exclusive
  if (!isExclusive) {
    for (const [key, data] of Object.entries(updatedGroup)) {
      if (isExclusiveRef(menu, key) && data.quantity >= 1) {
        updatedGroup[key] = { ...data, quantity: 0 };
      }
    }
  }

  const newQty = (!isCurrentlySelected || isRadio) ? 1 : 0;
  const newSelection = (!isCurrentlySelected || isRadio)
    ? itemState?.selection
    : initialIngredients[groupRef]?.[itemRef]?.selection;

  updatedGroup[itemRef] = {
    ...itemState,
    quantity: newQty,
    selection: newSelection,
    subItemId: getModifierGroupSubItemId(menu, itemRef, itemState?.subItemId),
  };

  return { ...prev, [groupRef]: updatedGroup };
}

/* ──────────────────────────────────────────────
   Quantity Helpers
   ────────────────────────────────────────────── */

export function getGroupSelectionQuantity(menu: Menu, groupRef: string): Quantity {
  const group = resolveRef(menu, groupRef) as ProductGroup | ModifierGroup | undefined;
  return (group as ProductGroup)?.selectionQuantity ?? {};
}

export function getGroupSelectedCount(group: SelectedGroup): number {
  return Object.values(group).reduce((sum, item) => sum + (item.quantity ?? 0), 0);
}

export function getMaxSelectionQuantity(
  menu: Menu,
  groupRef: string,
  itemRef: string,
  group: SelectedGroup,
): number {
  const groupSQ = getGroupSelectionQuantity(menu, groupRef);
  const maxGroup = groupSQ.max ?? Infinity;

  const entity = resolveRef(menu, groupRef) as ProductGroup | ModifierGroup | undefined;
  const override = entity && 'childRefs' in entity ? (entity.childRefs?.[itemRef] as ChildRefOverride) : undefined;
  const menuItem = resolveRef(menu, itemRef) as Product | Modifier | undefined;
  const maxItem = override?.quantity?.max ?? (menuItem as Product)?.quantity?.max ?? 1;

  const totalSelected = getGroupSelectedCount(group);
  const currentQty = group[itemRef]?.quantity ?? 0;
  const remaining = maxGroup - totalSelected + currentQty;

  return Math.min(maxGroup, maxItem, remaining);
}

export function increaseQuantity(
  prev: SelectedModifiers,
  menu: Menu,
  groupRef: string,
  itemRef: string,
): SelectedModifiers {
  const group = prev[groupRef] ?? {};
  const maxQty = getMaxSelectionQuantity(menu, groupRef, itemRef, group);
  const currentQty = group[itemRef]?.quantity ?? 0;
  const newQty = Math.min(currentQty + 1, maxQty);
  return {
    ...prev,
    [groupRef]: {
      ...group,
      [itemRef]: { ...group[itemRef], quantity: newQty },
    },
  };
}

export function decreaseQuantity(
  prev: SelectedModifiers,
  groupRef: string,
  itemRef: string,
): SelectedModifiers {
  const group = prev[groupRef] ?? {};
  const currentQty = group[itemRef]?.quantity ?? 0;
  return {
    ...prev,
    [groupRef]: {
      ...group,
      [itemRef]: { ...group[itemRef], quantity: Math.max(0, currentQty - 1) },
    },
  };
}

/* ──────────────────────────────────────────────
   Validation
   ────────────────────────────────────────────── */

export function isRequiredSelectionComplete(menu: Menu, selected: SelectedModifiers): boolean {
  for (const [groupRef, group] of Object.entries(selected)) {
    const sq = getGroupSelectionQuantity(menu, groupRef);
    const minRequired = sq.min ?? 0;
    const total = getGroupSelectedCount(group);
    if (total < minRequired) return false;
  }
  return true;
}

export function getUnsatisfiedGroups(menu: Menu, selected: SelectedModifiers): string[] {
  return Object.entries(selected)
    .filter(([groupRef, group]) => {
      const sq = getGroupSelectionQuantity(menu, groupRef);
      const minRequired = sq.min ?? 0;
      return getGroupSelectedCount(group) < minRequired;
    })
    .map(([groupRef]) => groupRef);
}

/* ──────────────────────────────────────────────
   Pricing — Upcharge Calculation
   ────────────────────────────────────────────── */

export interface ModifierPriceAndCalories {
  price: number;
  calories: number;
  defaultCalories: number;
  isDefault: boolean;
}

/**
 * Calculates the price/calorie delta for a single modifier selection.
 * Implements all 4 upcharge cases from the IDP Tech Doc.
 */
export function getModifierPriceAndCalories(
  menu: Menu,
  groupRef: string,
  itemRef: string,
  subItemId: string | undefined,
  quantity: number,
): ModifierPriceAndCalories {
  const group = resolveRef(menu, groupRef) as ProductGroup | undefined;
  if (!group) return { price: 0, calories: 0, defaultCalories: 0, isDefault: false };

  const menuProduct = resolveRef(menu, itemRef) as Product | undefined;
  const groupOverride = group.childRefs?.[itemRef] as ChildRefOverride | undefined;
  const isVirtual = !!(menuProduct as Product)?.isVirtual;

  // Resolve intensity modifier group
  const modGroupRef = menuProduct?.modifierGroupRefs ? Object.keys(menuProduct.modifierGroupRefs)[0] : undefined;
  const modGroup = modGroupRef ? resolveRef(menu, modGroupRef) as ModifierGroup : undefined;
  const childRefs = modGroup?.childRefs ?? {};
  const hasChildRefs = Object.keys(childRefs).length > 0;

  // Selected modifier price/calories
  const selectedModifierOverride = subItemId ? (childRefs[subItemId] as ChildRefOverride) : undefined;
  const selectedModifier = subItemId ? resolveRef(menu, subItemId) as Modifier | undefined : undefined;
  const selectedModifierPrice = selectedModifierOverride?.price ?? selectedModifier?.price;

  // For virtual products, resolve price via size variants.
  // If a specific size is selected (subItemId = size ref), use that size's price.
  // Otherwise, use the default size variant's price.
  let resolvedProductPrice: number;
  if (isVirtual && subItemId && !hasChildRefs) {
    // Virtual product with a selected size variant (Case 3: segmented button)
    resolvedProductPrice = groupOverride?.price
      ?? getSizeVariantPrice(menu, menuProduct as Product, subItemId)
      ?? getDefaultSizeVariantPrice(menu, menuProduct)
      ?? menuProduct?.price ?? 0;
  } else if (isVirtual) {
    // Virtual product at default size
    resolvedProductPrice = groupOverride?.price
      ?? getDefaultSizeVariantPrice(menu, menuProduct)
      ?? menuProduct?.price ?? 0;
  } else {
    resolvedProductPrice = groupOverride?.price ?? menuProduct?.price ?? 0;
  }

  const selectedPrice = selectedModifierPrice ?? resolvedProductPrice;

  const menuProductCal = menuProduct?.nutrition?.totalCalories ?? 0;
  const subItemCal = selectedModifier?.nutrition?.totalCalories ?? 0;
  const selectedCalories = hasChildRefs ? menuProductCal + subItemCal : menuProductCal;

  // Default modifier in the intensity group
  const defaultModEntry = Object.entries(childRefs).find(([key, mod]) => {
    const menuMod = resolveRef(menu, key) as Modifier | undefined;
    return (mod as ChildRefOverride)?.isDefault || menuMod?.isDefault;
  });
  const defaultKey = defaultModEntry?.[0];

  // Default product in the ingredient/product group — single pass to find default
  let defaultProductEntry: [string, unknown] | undefined;
  if (group.childRefs) {
    for (const entry of Object.entries(group.childRefs)) {
      const ov = (entry[1] ?? {}) as ChildRefOverride;
      if (ov.isDefault) { defaultProductEntry = entry; break; }
      if (!defaultProductEntry) {
        const p = resolveRef(menu, entry[0]) as Product | undefined;
        if (p?.isDefault) defaultProductEntry = entry;
      }
    }
  }
  const defaultProductRef = defaultProductEntry?.[0];
  const defaultProduct = defaultProductRef ? resolveRef(menu, defaultProductRef) as Product : undefined;
  // Resolve default product price through virtual → default size variant
  const defaultProductPrice = (defaultProductEntry?.[1] as ChildRefOverride)?.price
    ?? getDefaultSizeVariantPrice(menu, defaultProduct)
    ?? defaultProduct?.price ?? 0;

  const defaultModifier = defaultKey ? resolveRef(menu, defaultKey) as Modifier : undefined;
  const defaultModPrice = defaultModifier?.price ?? 0;

  const defaultCalories = hasChildRefs
    ? menuProductCal + (defaultModifier?.nutrition?.totalCalories ?? 0)
    : menuProductCal;

  const isDefault = isDefaultInGroup(groupOverride, menuProduct);
  const isExclusive = subItemId ? isExclusiveRef(menu, subItemId) : false;

  // Case 1: Default item with NO intensity mods → free
  // Case 2: Default item WITH intensity mods → upcharge = max(selectedModPrice - defaultModPrice, 0)
  if (isDefault) {
    if (!hasChildRefs && !isVirtual) {
      return { price: 0, calories: defaultCalories, defaultCalories: 0, isDefault: true };
    }
    // For default virtual products: if user upgraded size, show size upcharge (Case 3)
    if (isVirtual && subItemId) {
      const sizeUpcharge = getSizeVariantUpcharge(menu, menuProduct, subItemId);
      return {
        price: sizeUpcharge,
        calories: selectedCalories,
        defaultCalories,
        isDefault: true,
      };
    }
    if (!hasChildRefs) {
      return { price: 0, calories: defaultCalories, defaultCalories: 0, isDefault: true };
    }
    return {
      price: Math.max(selectedPrice - defaultModPrice, 0),
      calories: isExclusive ? 0 : selectedCalories,
      defaultCalories,
      isDefault: true,
    };
  }

  // Case 4: Non-default product in upcharge-applicable group (min=1, max=1) → Y-X delta pricing
  // For virtual products: resolvedProductPrice already uses the selected size's price
  if (!hasChildRefs) {
    const isUpchargeGroup = isSingleSelectionGroup(menu, groupRef);
    const upchargePrice = isUpchargeGroup
      ? Math.max(resolvedProductPrice - defaultProductPrice, 0)
      : resolvedProductPrice;
    return {
      price: upchargePrice,
      calories: defaultCalories || selectedCalories,
      defaultCalories: 0,
      isDefault: false,
    };
  }

  return {
    price: selectedPrice,
    calories: quantity > 0 ? selectedCalories : defaultCalories,
    defaultCalories: 0,
    isDefault: false,
  };
}

/* ──────────────────────────────────────────────
   Total Price Calculation — Single PDP
   ────────────────────────────────────────────── */

export interface PriceAndCalories {
  price: number;
  calories: number | undefined;
}

/**
 * Computes the total modifier upcharge price and calorie delta for a single product's selections.
 */
export function getSinglePDPPriceAndCalories(
  modifiers: SelectedModifiers,
  menu: Menu,
): PriceAndCalories {
  let totalPrice = 0;
  let totalCalories: number | undefined = 0;

  for (const [groupRef, group] of Object.entries(modifiers)) {
    for (const [itemRef, item] of Object.entries(group)) {
      const isExclusive = item.subItemId ? isExclusiveRef(menu, item.subItemId) : false;
      const qty = isExclusive ? 1 : item.quantity;

      const { price, calories, defaultCalories, isDefault } = getModifierPriceAndCalories(
        menu, groupRef, itemRef, item.subItemId, qty,
      );
      const calDelta = (calories != null && defaultCalories != null) ? calories - defaultCalories : undefined;

      // Deselected default → subtract
      if (qty === 0 && isDefault) {
        totalPrice -= price;
        if (totalCalories != null && calDelta != null) totalCalories -= calDelta;
      }
      // Selected non-default, or default with changed intensity
      else if (qty > 0 && (!isDefault || (isDefault && item.subItemId))) {
        totalPrice += qty * price;
        if (totalCalories != null && calDelta != null) totalCalories += qty * calDelta;
      }

      // Nested sub-selections (recursive)
      if (qty > 0 && item.selection) {
        const sub = getSinglePDPPriceAndCalories(item.selection, menu);
        totalPrice += item.quantity * sub.price;
        if (totalCalories != null && sub.calories != null) {
          totalCalories += item.quantity * sub.calories;
        }
      }
    }
  }

  return { price: totalPrice, calories: totalCalories };
}

/* ──────────────────────────────────────────────
   Total Price Calculation — Combo PDP
   ────────────────────────────────────────────── */

/**
 * Resolves a product group's children with overrides (matching mobile getProductGroupItems).
 * For virtual products, resolves price through the default size variant.
 */
export function getProductGroupItems(
  menu: Menu,
  groupRef: string,
): Array<Product & { _ref: string }> {
  const group = resolveRef(menu, groupRef) as ProductGroup | undefined;
  if (!group?.childRefs) return [];

  return Object.entries(group.childRefs).map(([childRef, overrideRaw]) => {
    const override = (overrideRaw ?? {}) as ChildRefOverride;
    const menuProduct = resolveRef(menu, childRef) as Product | undefined;

    // For virtual products, resolve price via default size variant (matching mobile logic)
    const resolvedPrice = override.price
      ?? getDefaultSizeVariantPrice(menu, menuProduct)
      ?? menuProduct?.price
      ?? 0;

    return {
      ...menuProduct,
      _ref: childRef,
      price: resolvedPrice,
      isDefault: override.isDefault ?? menuProduct?.isDefault ?? false,
    } as Product & { _ref: string };
  });
}

/**
 * Generates combo options from a combo product's ingredientRefs.
 */
export function getComboOptions(menu: Menu, product: Product): ComboOptions {
  if (!product.ingredientRefs) return [];

  const entreeRefs = Object.keys(product.ingredientRefs).filter(isProductRef);
  const sideGroupRefs = Object.keys(product.ingredientRefs).filter(isProductGroupRef);

  const entreeOptions: ComboGroupOption[] = entreeRefs.map((ref) => {
    const entreeProduct = resolveRef(menu, ref) as Product | undefined;
    return {
      groupTitle: entreeProduct?.displayName ?? getRefId(ref),
      groupId: undefined,
      products: entreeProduct ? [{ ...entreeProduct, _ref: ref }] : [],
      isEntree: true,
    };
  });

  const sideOptions: ComboGroupOption[] = sideGroupRefs.map((ref) => {
    const group = resolveRef(menu, ref) as ProductGroup | undefined;
    return {
      groupTitle: group?.displayName ?? getRefId(ref),
      groupId: ref,
      products: getProductGroupItems(menu, ref),
      isEntree: false,
    };
  });

  return [...entreeOptions, ...sideOptions];
}

/**
 * Generates initial combo selections.
 */
export function getInitialComboSelection(menu: Menu, comboOptions: ComboOptions): ComboSelection[] {
  return comboOptions.map((option, index) => {
    let defaultProduct: (Product & { _ref: string }) | undefined;

    if (option.isEntree) {
      defaultProduct = option.products[0];
    } else {
      const defaults = option.products.filter((p) => p.isDefault);
      defaultProduct = defaults.length === 1 ? defaults[0] : undefined;
    }

    return {
      product: defaultProduct,
      productRef: defaultProduct?._ref,
      modifiers: defaultProduct ? getInitialSelectedIngredients(menu, defaultProduct) : {},
      index,
      groupName: option.groupTitle,
      groupId: option.groupId,
    };
  });
}

/**
 * Checks if upcharge should be skipped for a default product in a group with multiple defaults.
 */
function shouldSkipUpchargeForDefault(
  _menu: Menu,
  selectedProduct: Product | undefined,
  products: Array<Product & { _ref: string }>,
): boolean {
  if (!selectedProduct || !products.length) return false;
  const defaults = products.filter((p) => p.isDefault);
  if (defaults.length <= 1) return false;
  return defaults.some((d) => d._ref === (selectedProduct as Product & { _ref: string })._ref);
}

/**
 * Computes total combo upcharge price and calories.
 */
export function getComboPDPPriceAndCalories(
  comboSelection: ComboSelection[],
  menu: Menu,
): { totalPrice: number; totalCalories: number | undefined } {
  let totalPrice = 0;
  let totalCalories: number | undefined = 0;

  for (const slot of comboSelection) {
    const { product, modifiers, groupId } = slot;

    // Modifier upcharge for this slot
    const { price: modPrice, calories: modCal } = getSinglePDPPriceAndCalories(modifiers, menu);

    // Product upcharge for this slot (sides/drinks swap)
    let upCharge = 0;
    if (groupId && product) {
      const productsInGroup = getProductGroupItems(menu, groupId);
      if (!shouldSkipUpchargeForDefault(menu, product, productsInGroup)) {
        const defaultPrice = productsInGroup.find((p) => p.isDefault)?.price;
        if (defaultPrice != null) {
          upCharge = Math.max((product.price ?? 0) - defaultPrice, 0);
        }
      }
    }

    totalPrice += modPrice + upCharge;
    if (totalCalories != null && modCal != null && product?.nutrition?.totalCalories != null) {
      totalCalories += product.nutrition.totalCalories + modCal;
    }
  }

  // Round to avoid float issues
  totalPrice = Number(totalPrice.toFixed(2));

  return { totalPrice, totalCalories };
}

/* ──────────────────────────────────────────────
   Full Product Price Calculation
   ────────────────────────────────────────────── */

export interface FullPriceResult {
  basePrice: number;
  modifierUpcharge: number;
  totalPrice: number;
  totalCalories: number | undefined;
}

/**
 * Calculates the full price for a product with all customizations.
 */
export function calculateFullPrice(
  menu: Menu,
  product: Product,
  selectedModifiers: SelectedModifiers | ComboSelection[],
  isCombo: boolean,
): FullPriceResult {
  const basePrice = product.price ?? 0;
  const baseCal = product.nutrition?.totalCalories;

  if (isCombo) {
    const { totalPrice: comboUpcharge, totalCalories } = getComboPDPPriceAndCalories(
      selectedModifiers as ComboSelection[],
      menu,
    );
    return {
      basePrice,
      modifierUpcharge: comboUpcharge,
      totalPrice: Number((basePrice + comboUpcharge).toFixed(2)),
      totalCalories: totalCalories ?? baseCal,
    };
  }

  const { price: modUpcharge, calories: modCal } = getSinglePDPPriceAndCalories(
    selectedModifiers as SelectedModifiers,
    menu,
  );

  return {
    basePrice,
    modifierUpcharge: modUpcharge,
    totalPrice: Number((basePrice + modUpcharge).toFixed(2)),
    totalCalories: baseCal != null && modCal != null ? baseCal + modCal : baseCal,
  };
}

/* ──────────────────────────────────────────────
   Summary Helpers (for display)
   ────────────────────────────────────────────── */

export interface ModificationSummaryItem {
  action: 'ADD' | 'REMOVE' | 'CHANGE';
  displayName: string;
  price?: number;
  quantity: number;
}

/**
 * Snapshot of customizer state, carried back to the Product Detail Page.
 */
export interface SavedCustomization {
  selectedIngredients: SelectedModifiers;
  comboSelection: ComboSelection[];
  priceResult: FullPriceResult;
  isCombo: boolean;
  modifications: ModificationSummaryItem[];
}

/**
 * Generates a human-readable list of modification actions (add/remove/change intensity).
 */
export function getModificationSummary(
  menu: Menu,
  selected: SelectedModifiers,
  initial: SelectedModifiers,
): ModificationSummaryItem[] {
  const items: ModificationSummaryItem[] = [];

  /** Push an intensity-CHANGE pill if subItemId differs from initial. */
  const pushIntensityChange = (
    item: SelectedGroupItem,
    initialItem: SelectedGroupItem | undefined,
    name: string,
  ) => {
    if (item.subItemId && item.subItemId !== initialItem?.subItemId && item.quantity > 0) {
      const intensityMod = resolveRef(menu, item.subItemId) as Modifier | undefined;
      const intensityName = intensityMod?.displayName ?? getRefId(item.subItemId);
      items.push({ action: 'CHANGE', displayName: `${intensityName} ${name}`, quantity: item.quantity });
    }
  };

  for (const [groupRef, group] of Object.entries(selected)) {
    const groupEntity = resolveRef(menu, groupRef) as ProductGroup | ModifierGroup | undefined;
    const isRecipe = !!(groupEntity as ProductGroup)?.isRecipe;

    for (const [itemRef, item] of Object.entries(group)) {
      const initialItem = initial[groupRef]?.[itemRef];
      const menuItem = resolveRef(menu, itemRef) as Product | Modifier | undefined;
      const name = menuItem?.displayName ?? getRefId(itemRef);

      // For recipe groups: skip ADD/REMOVE pills — recipe items are expected.
      // Only report intensity CHANGE modifications.
      if (isRecipe) {
        pushIntensityChange(item, initialItem, name);
        // Recipe item completely removed (quantity went to 0)
        if (item.quantity === 0 && (initialItem?.quantity ?? 0) > 0) {
          items.push({ action: 'REMOVE', displayName: name, quantity: initialItem?.quantity ?? 1 });
        }
        // Recipe item re-added after being removed
        if (item.quantity > 0 && (initialItem?.quantity ?? 0) === 0 && initialItem == null) {
          items.push({ action: 'ADD', displayName: name, quantity: item.quantity });
        }
        continue;
      }

      // Non-recipe groups: normal ADD/REMOVE logic
      if (item.quantity !== (initialItem?.quantity ?? 0)) {
        if (item.quantity === 0 && (initialItem?.quantity ?? 0) > 0) {
          items.push({ action: 'REMOVE', displayName: name, quantity: initialItem?.quantity ?? 1 });
        } else if (item.quantity > 0 && (initialItem?.quantity ?? 0) === 0) {
          items.push({ action: 'ADD', displayName: name, quantity: item.quantity });
        }
      }

      // Intensity changed (non-recipe)
      pushIntensityChange(item, initialItem, name);
    }
  }

  return items;
}
