import { describe, it, expect } from 'vitest';
import type { Menu } from '../../types/menu';
import { getVirtualProductsWithIngredientRefs } from '../menuHelpers';

// ─────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────

function buildMenu(overrides: Partial<Menu> = {}): Menu {
  return {
    displayName: 'Test Menu',
    rootCategoryRef: 'categories.main',
    isAvailable: true,
    categories: {
      main: { displayName: 'Main', childRefs: {} },
    },
    productGroups: {},
    products: {},
    modifierGroups: {},
    modifiers: {},
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// Unintentional Construct U1:
// Virtual products should NOT have ingredientRefs.
// ─────────────────────────────────────────────

describe('getVirtualProductsWithIngredientRefs (U1)', () => {
  it('returns empty when no products exist', () => {
    const menu = buildMenu();
    expect(getVirtualProductsWithIngredientRefs(menu)).toEqual([]);
  });

  it('returns empty when no virtual products exist', () => {
    const menu = buildMenu({
      products: {
        'burger-sm': {
          displayName: 'Small Burger',
          ingredientRefs: { 'modifiers.lettuce': {} },
        },
      },
    });
    expect(getVirtualProductsWithIngredientRefs(menu)).toEqual([]);
  });

  it('returns empty when virtual product has no ingredientRefs', () => {
    const menu = buildMenu({
      products: {
        'burger-v': {
          displayName: 'Burger',
          isVirtual: true,
          relatedProducts: { alternatives: { 'productGroups.sizes': {} } },
        },
      },
    });
    expect(getVirtualProductsWithIngredientRefs(menu)).toEqual([]);
  });

  it('returns empty when virtual product has empty ingredientRefs', () => {
    const menu = buildMenu({
      products: {
        'burger-v': {
          displayName: 'Burger',
          isVirtual: true,
          ingredientRefs: {},
        },
      },
    });
    expect(getVirtualProductsWithIngredientRefs(menu)).toEqual([]);
  });

  it('detects a virtual product with ingredientRefs', () => {
    const menu = buildMenu({
      modifierGroups: {
        'toppings-grp': { displayName: 'Toppings', childRefs: {} },
      },
      products: {
        'burger-v': {
          displayName: 'Burger Virtual',
          isVirtual: true,
          ingredientRefs: { 'modifierGroups.toppings-grp': {} },
        },
      },
    });

    const result = getVirtualProductsWithIngredientRefs(menu);
    expect(result).toHaveLength(1);
    expect(result[0].productRef).toBe('products.burger-v');
    expect(result[0].productName).toBe('Burger Virtual');
    expect(result[0].ingredientRefKeys).toEqual(['modifierGroups.toppings-grp']);
    expect(result[0].ingredientGroups).toEqual([
      { ref: 'modifierGroups.toppings-grp', name: 'Toppings' },
    ]);
    expect(result[0].hasAlternatives).toBe(false);
    expect(result[0].hasModifierGroupRefs).toBe(false);
  });

  it('detects multiple ingredientRefs on a single virtual product', () => {
    const menu = buildMenu({
      modifierGroups: {
        'grp-a': { displayName: 'Group A', childRefs: {} },
        'grp-b': { displayName: 'Group B', childRefs: {} },
      },
      products: {
        'prod-v': {
          displayName: 'Virtual Prod',
          isVirtual: true,
          ingredientRefs: {
            'modifierGroups.grp-a': {},
            'modifierGroups.grp-b': {},
          },
        },
      },
    });

    const result = getVirtualProductsWithIngredientRefs(menu);
    expect(result).toHaveLength(1);
    expect(result[0].ingredientRefKeys).toHaveLength(2);
    expect(result[0].ingredientGroups).toHaveLength(2);
  });

  it('correctly flags hasAlternatives when relatedProducts.alternatives exists', () => {
    const menu = buildMenu({
      productGroups: {
        'sizes-pg': { displayName: 'Sizes', childRefs: { 'products.sm': {} } },
      },
      products: {
        'prod-v': {
          displayName: 'Prod',
          isVirtual: true,
          ingredientRefs: { 'modifierGroups.grp-a': {} },
          relatedProducts: { alternatives: { 'productGroups.sizes-pg': {} } },
        },
        sm: { displayName: 'Small' },
      },
    });

    const result = getVirtualProductsWithIngredientRefs(menu);
    expect(result).toHaveLength(1);
    expect(result[0].hasAlternatives).toBe(true);
    expect(result[0].hasModifierGroupRefs).toBe(false);
  });

  it('correctly flags hasModifierGroupRefs', () => {
    const menu = buildMenu({
      modifierGroups: {
        'mgr-1': { displayName: 'Sauces', childRefs: {} },
      },
      products: {
        'prod-v': {
          displayName: 'Prod',
          isVirtual: true,
          ingredientRefs: { 'modifierGroups.mgr-1': {} },
          modifierGroupRefs: { 'modifierGroups.mgr-1': {} },
        },
      },
    });

    const result = getVirtualProductsWithIngredientRefs(menu);
    expect(result).toHaveLength(1);
    expect(result[0].hasModifierGroupRefs).toBe(true);
  });

  it('ignores non-virtual products even with ingredientRefs', () => {
    const menu = buildMenu({
      products: {
        'regular-prod': {
          displayName: 'Regular Product',
          isVirtual: false,
          ingredientRefs: { 'modifierGroups.grp': {} },
        },
        'no-flag-prod': {
          displayName: 'No Flag',
          ingredientRefs: { 'modifierGroups.grp': {} },
        },
      },
    });

    expect(getVirtualProductsWithIngredientRefs(menu)).toEqual([]);
  });

  it('detects multiple virtual products across the menu', () => {
    const menu = buildMenu({
      products: {
        'v1': {
          displayName: 'Virtual 1',
          isVirtual: true,
          ingredientRefs: { 'modifierGroups.grp-a': {} },
        },
        'v2': {
          displayName: 'Virtual 2',
          isVirtual: true,
          ingredientRefs: { 'modifierGroups.grp-b': {} },
        },
        'normal': {
          displayName: 'Normal',
          ingredientRefs: { 'modifierGroups.grp-c': {} },
        },
      },
    });

    const result = getVirtualProductsWithIngredientRefs(menu);
    expect(result).toHaveLength(2);
    const names = result.map((r) => r.productName);
    expect(names).toContain('Virtual 1');
    expect(names).toContain('Virtual 2');
  });

  it('falls back to ref key when ingredient group cannot be resolved', () => {
    const menu = buildMenu({
      products: {
        'v1': {
          displayName: 'V1',
          isVirtual: true,
          ingredientRefs: { 'modifierGroups.nonexistent': {} },
        },
      },
    });

    const result = getVirtualProductsWithIngredientRefs(menu);
    expect(result).toHaveLength(1);
    expect(result[0].ingredientGroups[0].name).toBe('modifierGroups.nonexistent');
  });
});
