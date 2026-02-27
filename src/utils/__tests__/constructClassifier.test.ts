import { describe, it, expect } from 'vitest';
import type { Menu } from '../../types/menu';
import {
  classifyAllProducts,
  computeFlags,
  classifyPrimaryType,
  getConstruct,
  CONSTRUCTS,
  PRIMARY_TYPES,
  BEHAVIORAL_CONSTRUCTS,
  COMBO_CONSTRUCTS,
} from '../constructClassifier';

// ─────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────

/** Build a menu with categories → products hierarchy + virtual traversal */
function buildMenu(overrides: Partial<Menu> = {}): Menu {
  return {
    displayName: 'Test Menu',
    rootCategoryRef: 'categories.main',
    isAvailable: true,
    categories: {
      main: {
        displayName: 'Main Menu',
        childRefs: {
          'categories.burgers': {},
          'categories.drinks': {},
        },
      },
      burgers: {
        displayName: 'Burgers',
        childRefs: {
          'products.cheeseburger': {},
          'products.veggie-burger': {},
        },
      },
      drinks: {
        displayName: 'Drinks',
        childRefs: {
          'products.cola': {},  // virtual with size alternatives
          'products.water': {}, // bare leaf
        },
      },
    },
    products: {
      // Non-virtual, has ingredientRefs → 1ABB
      cheeseburger: {
        displayName: 'Cheeseburger',
        ingredientRefs: { 'productGroups.toppings': {} },
      },
      // Virtual with alternatives → Construct 2
      'veggie-burger': {
        displayName: 'Veggie Burger',
        isVirtual: true,
        relatedProducts: { alternatives: { 'productGroups.size-vb': {} } },
      },
      // Virtual with alternatives → Construct 2
      cola: {
        displayName: 'Cola',
        isVirtual: true,
        relatedProducts: { alternatives: { 'productGroups.size-cola': {} } },
      },
      // Bare leaf → 1AAA
      water: {
        displayName: 'Water',
      },
      // Size variants of veggie-burger (children of productGroups.size-vb)
      'sm-veggie': { displayName: 'Small Veggie Burger' },
      'lg-veggie': {
        displayName: 'Large Veggie Burger',
        ingredientRefs: { 'productGroups.extras': {} },
      },
      // Size variants of cola (children of productGroups.size-cola)
      'sm-cola': { displayName: 'Small Cola' },
      'med-cola': { displayName: 'Medium Cola' },
      'lg-cola': { displayName: 'Large Cola' },
      // NOT reachable from any path (component ingredient)
      lettuce: { displayName: 'Lettuce' },
      tomato: { displayName: 'Tomato' },
    },
    productGroups: {
      'size-vb': {
        displayName: 'Size',
        childRefs: {
          'products.sm-veggie': {},
          'products.lg-veggie': { isDefault: true },
        },
      },
      'size-cola': {
        displayName: 'Size',
        childRefs: {
          'products.sm-cola': {},
          'products.med-cola': { isDefault: true },
          'products.lg-cola': {},
        },
      },
      toppings: { displayName: 'Toppings' },
      extras: { displayName: 'Extras' },
    },
    modifierGroups: {},
    modifiers: {},
    ...overrides,
  } as Menu;
}

// ─────────────────────────────────────────────
// classifyAllProducts — rootCategoryRef traversal
// ─────────────────────────────────────────────

describe('classifyAllProducts', () => {
  it('collects products from category tree + virtual children', () => {
    const menu = buildMenu();
    const classified = classifyAllProducts(menu);

    // 4 from category tree: cheeseburger, veggie-burger, cola, water
    // 2 from veggie-burger virtual → sm-veggie, lg-veggie
    // 3 from cola virtual → sm-cola, med-cola, lg-cola
    // = 9 total
    expect(classified.length).toBe(9);
  });

  it('excludes unreachable products (lettuce, tomato)', () => {
    const menu = buildMenu();
    const classified = classifyAllProducts(menu);
    const refs = classified.map((c) => c.ref);

    expect(refs).not.toContain('products.lettuce');
    expect(refs).not.toContain('products.tomato');
  });

  it('assigns correct primary types to category-level products', () => {
    const menu = buildMenu();
    const classified = classifyAllProducts(menu);
    const byRef = Object.fromEntries(classified.map((c) => [c.ref, c]));

    expect(byRef['products.cheeseburger'].primaryType).toBe('1ABB');
    expect(byRef['products.veggie-burger'].primaryType).toBe('2');
    expect(byRef['products.cola'].primaryType).toBe('2');
    expect(byRef['products.water'].primaryType).toBe('1AAA');
  });

  it('classifies virtual product children correctly', () => {
    const menu = buildMenu();
    const classified = classifyAllProducts(menu);
    const byRef = Object.fromEntries(classified.map((c) => [c.ref, c]));

    // Small veggie: no ingredientRefs → 1AAA
    expect(byRef['products.sm-veggie'].primaryType).toBe('1AAA');
    // Large veggie: has ingredientRefs → 1ABB
    expect(byRef['products.lg-veggie'].primaryType).toBe('1ABB');
    // Cola sizes: all bare → 1AAA
    expect(byRef['products.sm-cola'].primaryType).toBe('1AAA');
    expect(byRef['products.med-cola'].primaryType).toBe('1AAA');
    expect(byRef['products.lg-cola'].primaryType).toBe('1AAA');
  });

  it('tags virtual children with parentVirtualRef and parentVirtualName', () => {
    const menu = buildMenu();
    const classified = classifyAllProducts(menu);
    const byRef = Object.fromEntries(classified.map((c) => [c.ref, c]));

    expect(byRef['products.sm-veggie'].parentVirtualRef).toBe('products.veggie-burger');
    expect(byRef['products.sm-veggie'].parentVirtualName).toBe('Veggie Burger');
    expect(byRef['products.lg-veggie'].parentVirtualRef).toBe('products.veggie-burger');

    expect(byRef['products.sm-cola'].parentVirtualRef).toBe('products.cola');
    expect(byRef['products.sm-cola'].parentVirtualName).toBe('Cola');
  });

  it('includes categoryRef and categoryName on all products', () => {
    const menu = buildMenu();
    const classified = classifyAllProducts(menu);
    const byRef = Object.fromEntries(classified.map((c) => [c.ref, c]));

    expect(byRef['products.cheeseburger'].categoryRef).toBe('categories.burgers');
    expect(byRef['products.cheeseburger'].categoryName).toBe('Burgers');

    expect(byRef['products.water'].categoryRef).toBe('categories.drinks');
    expect(byRef['products.water'].categoryName).toBe('Drinks');

    // Virtual children inherit the category of their parent virtual product
    expect(byRef['products.sm-cola'].categoryRef).toBe('categories.drinks');
    expect(byRef['products.sm-cola'].categoryName).toBe('Drinks');
  });

  it('does not duplicate products appearing in multiple categories', () => {
    const menu = buildMenu({
      categories: {
        main: {
          displayName: 'Main',
          childRefs: { 'categories.a': {}, 'categories.b': {} },
        },
        a: { displayName: 'A', childRefs: { 'products.item1': {} } },
        b: { displayName: 'B', childRefs: { 'products.item1': {} } }, // same product
      },
      products: { item1: { displayName: 'Item 1' } },
      productGroups: {},
    } as Partial<Menu>);

    const classified = classifyAllProducts(menu);
    expect(classified.length).toBe(1);
  });

  it('returns empty for menu with no rootCategoryRef', () => {
    const menu = buildMenu({ rootCategoryRef: '' });
    expect(classifyAllProducts(menu)).toEqual([]);
  });

  it('handles nested sub-categories', () => {
    const menu = buildMenu({
      categories: {
        main: { displayName: 'Main', childRefs: { 'categories.food': {} } },
        food: { displayName: 'Food', childRefs: { 'categories.hot': {} } },
        hot: { displayName: 'Hot Food', childRefs: { 'products.soup': {} } },
      },
      products: { soup: { displayName: 'Soup' } },
      productGroups: {},
    } as Partial<Menu>);

    const classified = classifyAllProducts(menu);
    expect(classified.length).toBe(1);
    expect(classified[0].categoryRef).toBe('categories.hot');
    expect(classified[0].categoryName).toBe('Hot Food');
  });

  it('handles circular category references', () => {
    const menu = buildMenu({
      categories: {
        main: { displayName: 'Main', childRefs: { 'categories.a': {} } },
        a: { displayName: 'A', childRefs: { 'categories.b': {}, 'products.x': {} } },
        b: { displayName: 'B', childRefs: { 'categories.a': {} } }, // circular
      },
      products: { x: { displayName: 'X' } },
      productGroups: {},
    } as Partial<Menu>);

    const classified = classifyAllProducts(menu);
    expect(classified.length).toBe(1);
  });

  it('does not traverse non-virtual products into alternatives', () => {
    const menu = buildMenu({
      categories: {
        main: { displayName: 'Main', childRefs: { 'products.sized-item': {} } },
      },
      products: {
        'sized-item': {
          displayName: 'Sized Item',
          // NOT virtual, but has alternatives → 1BAA
          relatedProducts: { alternatives: { 'productGroups.sizes': {} } },
        },
        'sm-item': { displayName: 'Small Item' },
        'lg-item': { displayName: 'Large Item' },
      },
      productGroups: {
        sizes: {
          displayName: 'Sizes',
          childRefs: { 'products.sm-item': {}, 'products.lg-item': {} },
        },
      },
    } as Partial<Menu>);

    const classified = classifyAllProducts(menu);
    // Only the sized-item itself, NOT its children (since it's not virtual)
    expect(classified.length).toBe(1);
    expect(classified[0].primaryType).toBe('1BAA');
  });
});

// ─────────────────────────────────────────────
// Primary type classification (unit tests)
// ─────────────────────────────────────────────

describe('classifyPrimaryType', () => {
  it('returns "2" for virtual products', () => {
    expect(classifyPrimaryType({
      isVirtual: true, isCombo: false, hasIngredientRefs: false,
      hasModifierGroupRefs: false, hasAlternatives: false, hasBundleLink: false,
    })).toBe('2');
  });

  it('returns "2" for virtual even with alternatives and ingredientRefs', () => {
    expect(classifyPrimaryType({
      isVirtual: true, isCombo: false, hasIngredientRefs: true,
      hasModifierGroupRefs: true, hasAlternatives: true, hasBundleLink: false,
    })).toBe('2');
  });

  it('returns "1BBB" for alternatives + ingredientRefs', () => {
    expect(classifyPrimaryType({
      isVirtual: false, isCombo: false, hasIngredientRefs: true,
      hasModifierGroupRefs: false, hasAlternatives: true, hasBundleLink: false,
    })).toBe('1BBB');
  });

  it('returns "1BAA" for alternatives without ingredientRefs', () => {
    expect(classifyPrimaryType({
      isVirtual: false, isCombo: false, hasIngredientRefs: false,
      hasModifierGroupRefs: false, hasAlternatives: true, hasBundleLink: false,
    })).toBe('1BAA');
  });

  it('returns "1ABB" for ingredientRefs without alternatives', () => {
    expect(classifyPrimaryType({
      isVirtual: false, isCombo: false, hasIngredientRefs: true,
      hasModifierGroupRefs: false, hasAlternatives: false, hasBundleLink: false,
    })).toBe('1ABB');
  });

  it('returns "1AAA" for no alternatives, no ingredientRefs', () => {
    expect(classifyPrimaryType({
      isVirtual: false, isCombo: false, hasIngredientRefs: false,
      hasModifierGroupRefs: false, hasAlternatives: false, hasBundleLink: false,
    })).toBe('1AAA');
  });

  it('modifierGroupRefs alone does not change primary type', () => {
    expect(classifyPrimaryType({
      isVirtual: false, isCombo: false, hasIngredientRefs: false,
      hasModifierGroupRefs: true, hasAlternatives: false, hasBundleLink: false,
    })).toBe('1AAA');
  });
});

// ─────────────────────────────────────────────
// computeFlags
// ─────────────────────────────────────────────

describe('computeFlags', () => {
  it('detects all flags correctly', () => {
    const flags = computeFlags({
      displayName: 'Test',
      isVirtual: true,
      isCombo: true,
      ingredientRefs: { 'productGroups.a': {} },
      modifierGroupRefs: { 'modifierGroups.b': {} },
      relatedProducts: {
        alternatives: { 'productGroups.size': {} },
        bundle: {},
      },
    } as any);

    expect(flags.isVirtual).toBe(true);
    expect(flags.isCombo).toBe(true);
    expect(flags.hasIngredientRefs).toBe(true);
    expect(flags.hasModifierGroupRefs).toBe(true);
    expect(flags.hasAlternatives).toBe(true);
    expect(flags.hasBundleLink).toBe(true);
  });

  it('returns false for empty/missing fields', () => {
    const flags = computeFlags({ displayName: 'Bare' } as any);

    expect(flags.isVirtual).toBe(false);
    expect(flags.isCombo).toBe(false);
    expect(flags.hasIngredientRefs).toBe(false);
    expect(flags.hasModifierGroupRefs).toBe(false);
    expect(flags.hasAlternatives).toBe(false);
    expect(flags.hasBundleLink).toBe(false);
  });

  it('hasAlternatives is false when relatedProducts has no alternatives key', () => {
    const flags = computeFlags({ displayName: 'Test', relatedProducts: {} } as any);
    expect(flags.hasAlternatives).toBe(false);
  });

  it('hasIngredientRefs is false for empty object', () => {
    const flags = computeFlags({ displayName: 'Test', ingredientRefs: {} } as any);
    expect(flags.hasIngredientRefs).toBe(false);
  });
});

// ─────────────────────────────────────────────
// Construct definitions
// ─────────────────────────────────────────────

describe('CONSTRUCTS', () => {
  it('has 25 total constructs', () => {
    expect(CONSTRUCTS.length).toBe(25);
  });

  it('has 5 primary types', () => {
    expect(PRIMARY_TYPES.length).toBe(5);
    expect(PRIMARY_TYPES.map((c) => c.id).sort()).toEqual(['1AAA', '1ABB', '1BAA', '1BBB', '2']);
  });

  it('behavioral constructs are #6-#16', () => {
    expect(BEHAVIORAL_CONSTRUCTS.every((c) => c.id.startsWith('#'))).toBe(true);
    expect(BEHAVIORAL_CONSTRUCTS.length).toBe(11);
  });

  it('combo constructs are #17-#25', () => {
    expect(COMBO_CONSTRUCTS.every((c) => c.category === 'combo')).toBe(true);
    expect(COMBO_CONSTRUCTS.length).toBe(9);
  });

  it('getConstruct returns correct construct by id', () => {
    const c = getConstruct('1AAA');
    expect(c).toBeDefined();
    expect(c!.shortName).toBe('Leaf');
  });

  it('getConstruct returns undefined for unknown id', () => {
    expect(getConstruct('INVALID')).toBeUndefined();
  });
});
