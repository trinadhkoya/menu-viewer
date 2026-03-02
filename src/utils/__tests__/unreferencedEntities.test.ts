import { describe, it, expect } from 'vitest';
import { getUnreferencedEntities } from '../menuHelpers';
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

describe('getUnreferencedEntities', () => {
  it('returns empty for a completely empty menu', () => {
    expect(getUnreferencedEntities(makeMenu())).toEqual([]);
  });

  it('returns empty when all productGroups are referenced by products', () => {
    const menu = makeMenu({
      products: {
        'products.coffee': {
          displayName: 'Coffee',
          isVirtual: true,
          relatedProducts: { alternatives: { 'productGroups.sizes': {} } },
        },
      } as unknown as Menu['products'],
      productGroups: {
        'productGroups.sizes': {
          displayName: 'Sizes',
          childRefs: { 'products.sm': {}, 'products.lg': {} },
        },
      } as unknown as Menu['productGroups'],
    });
    expect(getUnreferencedEntities(menu)).toEqual([]);
  });

  it('detects unreferenced productGroup', () => {
    const menu = makeMenu({
      productGroups: {
        'productGroups.orphan-pg': {
          displayName: 'Orphan PG',
          childRefs: { 'products.x': {} },
        },
      } as unknown as Menu['productGroups'],
    });
    const results = getUnreferencedEntities(menu);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      ref: 'productGroups.orphan-pg',
      name: 'Orphan PG',
      entityType: 'productGroup',
      childCount: 1,
    });
  });

  it('detects unreferenced category', () => {
    const menu = makeMenu({
      rootCategoryRef: 'categories.root',
      categories: {
        'categories.root': {
          displayName: 'Root',
          childRefs: { 'categories.used': {} },
        },
        'categories.used': {
          displayName: 'Used',
          childRefs: { 'products.a': {} },
        },
        'categories.stale': {
          displayName: 'Stale Menu',
          childRefs: { 'products.b': {} },
        },
      } as unknown as Menu['categories'],
    });
    const results = getUnreferencedEntities(menu);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      ref: 'categories.stale',
      name: 'Stale Menu',
      entityType: 'category',
    });
  });

  it('does not flag rootCategoryRef as unreferenced', () => {
    const menu = makeMenu({
      rootCategoryRef: 'categories.root',
      categories: {
        'categories.root': {
          displayName: 'Root',
          childRefs: {},
        },
      } as unknown as Menu['categories'],
    });
    expect(getUnreferencedEntities(menu)).toEqual([]);
  });

  it('recognizes PG referenced from product ingredientRefs', () => {
    const menu = makeMenu({
      products: {
        'products.burger': {
          displayName: 'Burger',
          ingredientRefs: { 'productGroups.toppings': {} },
        },
      } as unknown as Menu['products'],
      productGroups: {
        'productGroups.toppings': {
          displayName: 'Toppings',
          childRefs: { 'products.lettuce': {} },
        },
      } as unknown as Menu['productGroups'],
    });
    expect(getUnreferencedEntities(menu)).toEqual([]);
  });

  it('recognizes PG referenced from category childRefs', () => {
    const menu = makeMenu({
      categories: {
        'categories.root': {
          displayName: 'Root',
          childRefs: { 'productGroups.featured': {} },
        },
      } as unknown as Menu['categories'],
      productGroups: {
        'productGroups.featured': {
          displayName: 'Featured',
          childRefs: {},
        },
      } as unknown as Menu['productGroups'],
    });
    expect(getUnreferencedEntities(menu)).toEqual([]);
  });

  it('detects multiple unreferenced entities of mixed types', () => {
    const menu = makeMenu({
      rootCategoryRef: 'categories.root',
      categories: {
        'categories.root': {
          displayName: 'Root',
          childRefs: { 'categories.active': {} },
        },
        'categories.active': {
          displayName: 'Active',
          childRefs: { 'products.a': {} },
        },
        'categories.dead1': { displayName: 'Dead 1', childRefs: {} },
        'categories.dead2': { displayName: 'Dead 2', childRefs: { 'products.x': {} } },
      } as unknown as Menu['categories'],
      productGroups: {
        'productGroups.orphan1': { displayName: 'Orphan PG 1', childRefs: {} },
        'productGroups.orphan2': { displayName: 'Orphan PG 2', childRefs: { 'products.y': {} } },
      } as unknown as Menu['productGroups'],
    });
    const results = getUnreferencedEntities(menu);
    expect(results).toHaveLength(4);
    const pgResults = results.filter(r => r.entityType === 'productGroup');
    const catResults = results.filter(r => r.entityType === 'category');
    expect(pgResults).toHaveLength(2);
    expect(catResults).toHaveLength(2);
  });

  it('reports childCount correctly', () => {
    const menu = makeMenu({
      productGroups: {
        'productGroups.big': {
          displayName: 'Big PG',
          childRefs: { 'products.a': {}, 'products.b': {}, 'products.c': {} },
        },
      } as unknown as Menu['productGroups'],
    });
    const results = getUnreferencedEntities(menu);
    expect(results[0].childCount).toBe(3);
  });

  it('handles PG with no childRefs', () => {
    const menu = makeMenu({
      productGroups: {
        'productGroups.empty': {
          displayName: 'Empty PG',
        },
      } as unknown as Menu['productGroups'],
    });
    const results = getUnreferencedEntities(menu);
    expect(results[0].childCount).toBe(0);
  });

  it('uses key as name when displayName is missing', () => {
    const menu = makeMenu({
      productGroups: {
        'productGroups.noname': {},
      } as unknown as Menu['productGroups'],
    });
    const results = getUnreferencedEntities(menu);
    expect(results[0].name).toBe('productGroups.noname');
  });

  it('recognizes PG referenced from modifierGroupRefs inline childRefs', () => {
    const menu = makeMenu({
      products: {
        'products.burger': {
          displayName: 'Burger',
          modifierGroupRefs: {
            'modifierGroups.toppings': {
              displayName: 'Toppings',
              childRefs: { 'products.lettuce': {}, 'productGroups.sauces': {} },
              selectionQuantity: {},
            },
          },
        },
      } as unknown as Menu['products'],
      productGroups: {
        'productGroups.sauces': {
          displayName: 'Sauces',
          childRefs: {},
        },
      } as unknown as Menu['productGroups'],
    });
    expect(getUnreferencedEntities(menu)).toEqual([]);
  });

  it('recognizes PG referenced from product.groupIds', () => {
    const menu = makeMenu({
      products: {
        'products.chicken': {
          displayName: 'Chicken',
          groupIds: ['productGroups.entrees'],
        },
      } as unknown as Menu['products'],
      productGroups: {
        'productGroups.entrees': {
          displayName: 'Entrees',
          childRefs: {},
        },
      } as unknown as Menu['productGroups'],
    });
    expect(getUnreferencedEntities(menu)).toEqual([]);
  });

  it('recognizes category referenced from product.groupIds', () => {
    const menu = makeMenu({
      rootCategoryRef: 'categories.root',
      categories: {
        'categories.root': {
          displayName: 'Root',
          childRefs: {},
        },
        'categories.hot-drinks': {
          displayName: 'Hot Drinks',
          childRefs: {},
        },
      } as unknown as Menu['categories'],
      products: {
        'products.latte': {
          displayName: 'Latte',
          groupIds: ['categories.hot-drinks'],
        },
      } as unknown as Menu['products'],
    });
    expect(getUnreferencedEntities(menu)).toEqual([]);
  });

  it('recognizes PG referenced from product.parentIds', () => {
    const menu = makeMenu({
      products: {
        'products.sm-coffee': {
          displayName: 'Small Coffee',
          parentIds: ['productGroups.coffee-sizes'],
        },
      } as unknown as Menu['products'],
      productGroups: {
        'productGroups.coffee-sizes': {
          displayName: 'Coffee Sizes',
          childRefs: { 'products.sm-coffee': {} },
        },
      } as unknown as Menu['productGroups'],
    });
    expect(getUnreferencedEntities(menu)).toEqual([]);
  });

  it('recognizes PG referenced from product.productGroupIds', () => {
    const menu = makeMenu({
      products: {
        'products.burger': {
          displayName: 'Burger',
          productGroupIds: ['productGroups.signature-burgers'],
        },
      } as unknown as Menu['products'],
      productGroups: {
        'productGroups.signature-burgers': {
          displayName: 'Signature Burgers',
          childRefs: {},
        },
      } as unknown as Menu['productGroups'],
    });
    expect(getUnreferencedEntities(menu)).toEqual([]);
  });

  it('recognizes MG referenced from modifier.modifierGroupRefs', () => {
    const menu = makeMenu({
      products: {
        'products.burger': {
          displayName: 'Burger',
          modifierGroupRefs: { 'modifierGroups.toppings': {} },
        },
      } as unknown as Menu['products'],
      modifierGroups: {
        'modifierGroups.toppings': {
          displayName: 'Toppings',
          childRefs: { 'modifiers.cheese': {} },
        },
        'modifierGroups.nested-sauces': {
          displayName: 'Nested Sauces',
          childRefs: {},
        },
      } as unknown as Menu['modifierGroups'],
      modifiers: {
        'modifiers.cheese': {
          displayName: 'Cheese',
          modifierGroupRefs: { 'modifierGroups.nested-sauces': {} },
        },
      } as unknown as Menu['modifiers'],
    });
    expect(getUnreferencedEntities(menu)).toEqual([]);
  });
});
