// Menu types matching the MBDP normalized menu.json structure

export interface Quantity {
  min?: number | null;
  max?: number | null;
  free?: number | null;
  default?: number | null;
}

export interface OperationHours {
  start: string;
  end: string;
}

export interface Nutrient {
  label: string | null;
  weight: Weight;
  dailyValuePercentage?: number;
}

export interface Weight {
  value: number;
  unit: string;
}

export interface Nutrition {
  totalCalories?: number;
  macroNutrients?: Record<string, Nutrient>;
  allergicInformation?: string;
}

export interface Modifier {
  id?: string;
  displayName: string;
  displayOrder: number;
  price: number;
  PLU: number;
  nutrition: Nutrition;
  modifierGroupRefs?: Record<string, ModifierGroup>;
  tags?: string[];
  isAvailable?: boolean;
  imageUrl?: string;
  isExclusive?: boolean;
  quantity?: Quantity;
  isDefault?: boolean;
}

/**
 * Override properties that can appear as childRef values.
 * When a childRef value is non-empty, its properties override the base entity's.
 * e.g. { "isDefault": true, "quantity": { "min": 1, "max": 1 } }
 */
export interface ChildRefOverride {
  isDefault?: boolean;
  isAvailable?: boolean;
  price?: number;
  quantity?: Quantity;
  displayName?: string;
  calories?: number;
  description?: string;
  [key: string]: unknown;
}

export interface ModifierGroup {
  id?: string;
  displayName: string;
  childRefs: Record<string, ChildRefOverride>;
  selectionQuantity: Quantity;
}

export interface ProductGroup {
  id?: string;
  displayName: string;
  description?: string | null;
  selectionQuantity?: Quantity;
  isRecipe?: boolean | string;
  childRefs?: Record<string, ChildRefOverride>;
}

export interface Product {
  displayName?: string | null;
  ctaLabel?: string;
  isAvailable?: boolean | null;
  description?: string | null;
  operationHours?: Record<string, OperationHours[] | null> | null;
  productGroupIds?: string[];
  tags?: string[];
  image?: string;
  imageUrl?: string;
  ingredientRefs?: Record<string, ChildRefOverride> | null;
  relatedProducts?: Record<string, ChildRefOverride>;
  modifierGroupRefs?: Record<string, ModifierGroup | null> | null;
  PLU?: number;
  isRecipe?: boolean;
  nutrition?: Nutrition;
  isCombo?: boolean;
  calories?: number;
  id?: string;
  price?: number;
  isDefault?: boolean;
  groupIds?: string[];
  isVirtual?: boolean;
  parentIds?: string[];
  isExclusive?: boolean;
  quantity?: Quantity;
  customAttributes?: Record<string, string | string[]>;
}

export interface Category extends ProductGroup {
  imageUrl?: string;
  displayOrder?: number;
  bannerText?: string;
  type?: string;
  isAvailable?: boolean;
  operationHours?: Record<string, OperationHours[]> | null;
  hasSubCategories?: boolean;
}

/** Union of all entity types resolved from the menu maps */
export type MenuEntity = Product | Category | ProductGroup | ModifierGroup | Modifier;

/**
 * Common optional display properties found across menu entities.
 * Used when a resolved item needs flexible property access in UI components.
 */
export interface DisplayableItem {
  displayName?: string | null;
  isAvailable?: boolean | null;
  price?: number;
  isDefault?: boolean;
  calories?: number;
  quantity?: Quantity;
  childRefs?: Record<string, ChildRefOverride>;
}

export type MenuType = 'ALL_DAY' | 'MORNING' | 'AFTERNOON' | 'HAPPY_HOUR' | 'EVENING' | 'DELIVERY';

export interface Menu {
  displayName: string;
  rootCategoryRef: string;
  categories: Record<string, Category>;
  productGroups: Record<string, ProductGroup>;
  products: Record<string, Product>;
  modifierGroups: Record<string, ModifierGroup>;
  modifiers: Record<string, Modifier>;
  operationHours?: Record<string, OperationHours[]> | null;
  isAvailable: boolean;
}
