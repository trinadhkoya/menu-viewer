import { describe, it, expect } from 'vitest';
import { getOrphanedVirtualProducts } from '../menuHelpers';
import type { Menu } from '../../types/menu';

/** Minimal menu builder for testing */
function makeMenu(products: Record<string, Record<string, unknown>>): Menu {
  return { products } as unknown as Menu;
}

describe('getOrphanedVirtualProducts', () => {
  it('returns empty for a menu with no products', () => {
    expect(getOrphanedVirtualProducts(makeMenu({}))).toEqual([]);
  });

  it('skips non-virtual products', () => {
    const menu = makeMenu({
      'products.burger': { displayName: 'Burger', isVirtual: false },
      'products.fries': { displayName: 'Fries' }, // isVirtual undefined
    });
    expect(getOrphanedVirtualProducts(menu)).toEqual([]);
  });

  it('skips virtuals that have relatedProducts.alternatives', () => {
    const menu = makeMenu({
      'products.munchkins': {
        displayName: 'Munchkins',
        isVirtual: true,
        relatedProducts: { alternatives: { 'productGroups.munchkins-sizes': {} } },
      },
    });
    expect(getOrphanedVirtualProducts(menu)).toEqual([]);
  });

  it('skips virtuals that have modifierGroupRefs', () => {
    const menu = makeMenu({
      'products.custom-burger': {
        displayName: 'Custom Burger',
        isVirtual: true,
        modifierGroupRefs: { 'modifierGroups.toppings': {} },
      },
    });
    expect(getOrphanedVirtualProducts(menu)).toEqual([]);
  });

  it('skips virtuals that have both alternatives and modifierGroupRefs', () => {
    const menu = makeMenu({
      'products.combo': {
        displayName: 'Combo',
        isVirtual: true,
        relatedProducts: { alternatives: { 'productGroups.sizes': {} } },
        modifierGroupRefs: { 'modifierGroups.sides': {} },
      },
    });
    expect(getOrphanedVirtualProducts(menu)).toEqual([]);
  });

  it('detects virtual with neither alternatives nor modifierGroupRefs', () => {
    const menu = makeMenu({
      'products.orphan': {
        displayName: 'Orphan Drink',
        isVirtual: true,
      },
    });
    const results = getOrphanedVirtualProducts(menu);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      productRef: 'products.orphan',
      productName: 'Orphan Drink',
      hasIngredientRefs: false,
      ingredientRefCount: 0,
    });
  });

  it('detects virtual with empty alternatives object', () => {
    const menu = makeMenu({
      'products.empty-alt': {
        displayName: 'Empty Alt',
        isVirtual: true,
        relatedProducts: { alternatives: {} },
      },
    });
    const results = getOrphanedVirtualProducts(menu);
    expect(results).toHaveLength(1);
    expect(results[0].productRef).toBe('products.empty-alt');
  });

  it('detects virtual with empty modifierGroupRefs object', () => {
    const menu = makeMenu({
      'products.empty-mod': {
        displayName: 'Empty Mod',
        isVirtual: true,
        modifierGroupRefs: {},
      },
    });
    const results = getOrphanedVirtualProducts(menu);
    expect(results).toHaveLength(1);
    expect(results[0].productRef).toBe('products.empty-mod');
  });

  it('reports hasIngredientRefs=true when ingredientRefs exist', () => {
    const menu = makeMenu({
      'products.weird': {
        displayName: 'Weird Virtual',
        isVirtual: true,
        ingredientRefs: { 'ingredientGroups.sauce': {}, 'ingredientGroups.cheese': {} },
      },
    });
    const results = getOrphanedVirtualProducts(menu);
    expect(results).toHaveLength(1);
    expect(results[0].hasIngredientRefs).toBe(true);
    expect(results[0].ingredientRefCount).toBe(2);
  });

  it('normalizes product ref with products. prefix', () => {
    const menu = makeMenu({
      'burger': {
        displayName: 'Burger',
        isVirtual: true,
      },
    });
    const results = getOrphanedVirtualProducts(menu);
    expect(results[0].productRef).toBe('products.burger');
  });

  it('handles multiple orphaned virtuals mixed with valid ones', () => {
    const menu = makeMenu({
      'products.valid': {
        displayName: 'Valid',
        isVirtual: true,
        relatedProducts: { alternatives: { 'productGroups.sizes': {} } },
      },
      'products.orphan1': {
        displayName: 'Orphan 1',
        isVirtual: true,
      },
      'products.regular': {
        displayName: 'Regular',
        isVirtual: false,
      },
      'products.orphan2': {
        displayName: 'Orphan 2',
        isVirtual: true,
        ingredientRefs: { 'ingredientGroups.x': {} },
      },
    });
    const results = getOrphanedVirtualProducts(menu);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.productName).sort()).toEqual(['Orphan 1', 'Orphan 2']);
  });

  it('uses product id as name when displayName is missing', () => {
    const menu = makeMenu({
      'products.noname': {
        isVirtual: true,
      },
    });
    const results = getOrphanedVirtualProducts(menu);
    expect(results[0].productName).toBe('products.noname');
  });
});
