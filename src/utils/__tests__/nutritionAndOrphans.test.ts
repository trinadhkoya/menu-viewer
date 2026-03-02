import { describe, it, expect } from 'vitest';
import { getProductsMissingNutrition, getProductsWithZeroCalories, getOrphanedProducts } from '../menuHelpers';
import type { Menu } from '../../types/menu';

function makeMenu(overrides: Partial<Menu> = {}): Menu {
  return {
    displayName: 'Test',
    rootCategoryRef: 'categories.root',
    categories: {},
    productGroups: {},
    products: {},
    modifierGroups: {},
    modifiers: {},
    isAvailable: true,
    ...overrides,
  } as Menu;
}

// ─────────────────────────────────────────────
// A: Missing nutrition
// ─────────────────────────────────────────────
describe('getProductsMissingNutrition', () => {
  it('returns empty for a menu with no products', () => {
    expect(getProductsMissingNutrition(makeMenu())).toEqual([]);
  });

  it('returns empty when all products have nutrition', () => {
    const menu = makeMenu({
      products: {
        burger: { displayName: 'Burger', nutrition: { totalCalories: 500 } },
        fries: { displayName: 'Fries', nutrition: { totalCalories: 300, macroNutrients: {} } },
      } as unknown as Menu['products'],
    });
    expect(getProductsMissingNutrition(menu)).toEqual([]);
  });

  it('detects products with no nutrition object', () => {
    const menu = makeMenu({
      products: {
        burger: { displayName: 'Burger', nutrition: { totalCalories: 500 } },
        sauce: { displayName: 'Sauce' },
      } as unknown as Menu['products'],
    });
    const results = getProductsMissingNutrition(menu);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      productRef: 'products.sauce',
      productName: 'Sauce',
    });
  });

  it('detects products with empty nutrition object', () => {
    const menu = makeMenu({
      products: {
        water: { displayName: 'Water', nutrition: {} },
      } as unknown as Menu['products'],
    });
    expect(getProductsMissingNutrition(menu)).toHaveLength(1);
  });

  it('detects products with null nutrition', () => {
    const menu = makeMenu({
      products: {
        water: { displayName: 'Water', nutrition: null },
      } as unknown as Menu['products'],
    });
    expect(getProductsMissingNutrition(menu)).toHaveLength(1);
  });

  it('skips virtual products', () => {
    const menu = makeMenu({
      products: {
        virtual: { displayName: 'Virtual', isVirtual: true },
        normal: { displayName: 'Normal' },
      } as unknown as Menu['products'],
    });
    const results = getProductsMissingNutrition(menu);
    expect(results).toHaveLength(1);
    expect(results[0].productRef).toBe('products.normal');
  });
});

// ─────────────────────────────────────────────
// B: Calories = 0
// ─────────────────────────────────────────────
describe('getProductsWithZeroCalories', () => {
  it('returns empty for a menu with no products', () => {
    expect(getProductsWithZeroCalories(makeMenu())).toEqual([]);
  });

  it('returns empty when all products have nonzero calories', () => {
    const menu = makeMenu({
      products: {
        burger: { displayName: 'Burger', nutrition: { totalCalories: 500 } },
      } as unknown as Menu['products'],
    });
    expect(getProductsWithZeroCalories(menu)).toEqual([]);
  });

  it('detects products with totalCalories = 0', () => {
    const menu = makeMenu({
      products: {
        sauce: { displayName: 'Sauce', nutrition: { totalCalories: 0 } },
        burger: { displayName: 'Burger', nutrition: { totalCalories: 500 } },
      } as unknown as Menu['products'],
    });
    const results = getProductsWithZeroCalories(menu);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      productRef: 'products.sauce',
      productName: 'Sauce',
      totalCalories: 0,
    });
  });

  it('does not flag products with no nutrition at all', () => {
    const menu = makeMenu({
      products: {
        water: { displayName: 'Water' },
      } as unknown as Menu['products'],
    });
    expect(getProductsWithZeroCalories(menu)).toEqual([]);
  });

  it('does not flag products with undefined totalCalories', () => {
    const menu = makeMenu({
      products: {
        item: { displayName: 'Item', nutrition: { macroNutrients: {} } },
      } as unknown as Menu['products'],
    });
    expect(getProductsWithZeroCalories(menu)).toEqual([]);
  });

  it('skips virtual products', () => {
    const menu = makeMenu({
      products: {
        virtual: { displayName: 'Virtual', isVirtual: true, nutrition: { totalCalories: 0 } },
        normal: { displayName: 'Normal', nutrition: { totalCalories: 0 } },
      } as unknown as Menu['products'],
    });
    const results = getProductsWithZeroCalories(menu);
    expect(results).toHaveLength(1);
    expect(results[0].productRef).toBe('products.normal');
  });
});

// ─────────────────────────────────────────────
// C: Orphaned products
// ─────────────────────────────────────────────
describe('getOrphanedProducts', () => {
  it('returns empty for a menu with no products', () => {
    expect(getOrphanedProducts(makeMenu())).toEqual([]);
  });

  it('returns empty when all products are reachable from categories', () => {
    const menu = makeMenu({
      rootCategoryRef: 'categories.root',
      categories: {
        root: { displayName: 'Root', childRefs: { 'products.burger': {} } },
      } as unknown as Menu['categories'],
      products: {
        burger: { displayName: 'Burger' },
      } as unknown as Menu['products'],
    });
    expect(getOrphanedProducts(menu)).toEqual([]);
  });

  it('detects products not in any category', () => {
    const menu = makeMenu({
      rootCategoryRef: 'categories.root',
      categories: {
        root: { displayName: 'Root', childRefs: { 'products.burger': {} } },
      } as unknown as Menu['categories'],
      products: {
        burger: { displayName: 'Burger' },
        orphan: { displayName: 'Orphan Sauce' },
      } as unknown as Menu['products'],
    });
    const results = getOrphanedProducts(menu);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      productRef: 'products.orphan',
      productName: 'Orphan Sauce',
      foundIn: 'nowhere',
    });
  });

  it('walks nested categories', () => {
    const menu = makeMenu({
      rootCategoryRef: 'categories.root',
      categories: {
        root: { displayName: 'Root', childRefs: { 'categories.sub': {} } },
        sub: { displayName: 'Sub', childRefs: { 'products.item': {} } },
      } as unknown as Menu['categories'],
      products: {
        item: { displayName: 'Item' },
      } as unknown as Menu['products'],
    });
    expect(getOrphanedProducts(menu)).toEqual([]);
  });

  it('labels orphans found in productGroups', () => {
    const menu = makeMenu({
      rootCategoryRef: 'categories.root',
      categories: {
        root: { displayName: 'Root', childRefs: { 'products.virtual': {} } },
      } as unknown as Menu['categories'],
      products: {
        virtual: { displayName: 'Virtual', isVirtual: true },
        sized: { displayName: 'Sized Item' },
      } as unknown as Menu['products'],
      productGroups: {
        sizes: { displayName: 'Sizes', childRefs: { sized: {} } },
      } as unknown as Menu['productGroups'],
    });
    const results = getOrphanedProducts(menu);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      productRef: 'products.sized',
      foundIn: 'productGroup',
      foundInRef: 'productGroups.sizes',
    });
  });

  it('labels orphans found in modifierGroups', () => {
    const menu = makeMenu({
      rootCategoryRef: 'categories.root',
      categories: {
        root: { displayName: 'Root', childRefs: { 'products.burger': {} } },
      } as unknown as Menu['categories'],
      products: {
        burger: { displayName: 'Burger' },
        cheese: { displayName: 'Cheese' },
      } as unknown as Menu['products'],
      modifierGroups: {
        toppings: { displayName: 'Toppings', childRefs: { cheese: {} }, selectionQuantity: { min: 0, max: 3 } },
      } as unknown as Menu['modifierGroups'],
    });
    const results = getOrphanedProducts(menu);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      productRef: 'products.cheese',
      foundIn: 'modifierGroup',
      foundInRef: 'modifierGroups.toppings',
    });
  });

  it('does not walk into productGroups as reachable (only categories)', () => {
    const menu = makeMenu({
      rootCategoryRef: 'categories.root',
      categories: {
        root: { displayName: 'Root', childRefs: {} },
      } as unknown as Menu['categories'],
      products: {
        sized: { displayName: 'Sized Item' },
      } as unknown as Menu['products'],
      productGroups: {
        sizes: { displayName: 'Sizes', childRefs: { 'products.sized': {} } },
      } as unknown as Menu['productGroups'],
    });
    // sized is in a PG but NOT in category tree → orphaned
    const results = getOrphanedProducts(menu);
    expect(results).toHaveLength(1);
    expect(results[0].foundIn).toBe('productGroup');
  });

  it('handles products with no rootCategoryRef', () => {
    const menu = makeMenu({
      rootCategoryRef: undefined as unknown as string,
      products: {
        item: { displayName: 'Item' },
      } as unknown as Menu['products'],
    });
    const results = getOrphanedProducts(menu);
    expect(results).toHaveLength(1);
    expect(results[0].foundIn).toBe('nowhere');
  });

  it('sets isVirtual correctly on orphans', () => {
    const menu = makeMenu({
      rootCategoryRef: 'categories.root',
      categories: {
        root: { displayName: 'Root', childRefs: {} },
      } as unknown as Menu['categories'],
      products: {
        v: { displayName: 'V', isVirtual: true },
        n: { displayName: 'N' },
      } as unknown as Menu['products'],
    });
    const results = getOrphanedProducts(menu);
    const vr = results.find(r => r.productRef === 'products.v');
    const nr = results.find(r => r.productRef === 'products.n');
    expect(vr?.isVirtual).toBe(true);
    expect(nr?.isVirtual).toBe(false);
  });
});
