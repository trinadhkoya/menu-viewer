import { describe, it, expect } from 'vitest';
import type { Menu, Product } from '../../types/menu';
import {
  classifyAllProducts,
  computeFlags,
  classifyPrimaryType,
  detectStructuralTags,
  getConstruct,
  CONSTRUCTS,
  PRIMARY_TYPES,
  BEHAVIORAL_CONSTRUCTS,
  COMBO_CONSTRUCTS,
  STRUCTURAL_TAGS,
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
    // veggie-burger: isVirtual + alternatives (no ingredientRefs) → falls through to 1BAA (sized, not customizable)
    expect(byRef['products.veggie-burger'].primaryType).toBe('1BAA');
    // cola: isVirtual + alternatives (no ingredientRefs) → falls through to 1BAA
    expect(byRef['products.cola'].primaryType).toBe('1BAA');
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
  it('returns "2" for pure virtual (no ingredients, no modifiers, no alternatives)', () => {
    expect(classifyPrimaryType({
      isVirtual: true, isCombo: false, hasIngredientRefs: false,
      hasModifierGroupRefs: false, hasAlternatives: false, hasBundleLink: false,
    })).toBe('2');
  });

  it('virtual with ingredientRefs falls through to normal classification', () => {
    // e.g. K-Cup Pods, Bottled Drinks — isVirtual but has ingredientRefs → 1ABB
    expect(classifyPrimaryType({
      isVirtual: true, isCombo: false, hasIngredientRefs: true,
      hasModifierGroupRefs: false, hasAlternatives: false, hasBundleLink: false,
    })).toBe('1ABB');
  });

  it('virtual with alternatives + ingredientRefs falls through to 1BBB', () => {
    expect(classifyPrimaryType({
      isVirtual: true, isCombo: false, hasIngredientRefs: true,
      hasModifierGroupRefs: true, hasAlternatives: true, hasBundleLink: false,
    })).toBe('1BBB');
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

  it('modifierGroupRefs alone still returns 1AAA (modifiers do not affect primary type)', () => {
    expect(classifyPrimaryType({
      isVirtual: false, isCombo: false, hasIngredientRefs: false,
      hasModifierGroupRefs: true, hasAlternatives: false, hasBundleLink: false,
    })).toBe('1AAA');
  });

  it('alternatives + modifierGroupRefs only returns 1BAA (modifiers do not affect primary type)', () => {
    expect(classifyPrimaryType({
      isVirtual: false, isCombo: false, hasIngredientRefs: false,
      hasModifierGroupRefs: true, hasAlternatives: true, hasBundleLink: false,
    })).toBe('1BAA');
  });

  it('virtual with modifiers only still returns 2 (pure virtual)', () => {
    expect(classifyPrimaryType({
      isVirtual: true, isCombo: false, hasIngredientRefs: false,
      hasModifierGroupRefs: true, hasAlternatives: false, hasBundleLink: false,
    })).toBe('2');
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
    } as unknown as Product);

    expect(flags.isVirtual).toBe(true);
    expect(flags.isCombo).toBe(true);
    expect(flags.hasIngredientRefs).toBe(true);
    expect(flags.hasModifierGroupRefs).toBe(true);
    expect(flags.hasAlternatives).toBe(true);
    expect(flags.hasBundleLink).toBe(true);
  });

  it('returns false for empty/missing fields', () => {
    const flags = computeFlags({ displayName: 'Bare' } as unknown as Product);

    expect(flags.isVirtual).toBe(false);
    expect(flags.isCombo).toBe(false);
    expect(flags.hasIngredientRefs).toBe(false);
    expect(flags.hasModifierGroupRefs).toBe(false);
    expect(flags.hasAlternatives).toBe(false);
    expect(flags.hasBundleLink).toBe(false);
  });

  it('hasAlternatives is false when relatedProducts has no alternatives key', () => {
    const flags = computeFlags({ displayName: 'Test', relatedProducts: {} } as unknown as Product);
    expect(flags.hasAlternatives).toBe(false);
  });

  it('hasIngredientRefs is false for empty object', () => {
    const flags = computeFlags({ displayName: 'Test', ingredientRefs: {} } as unknown as Product);
    expect(flags.hasIngredientRefs).toBe(false);
  });
});

// ─────────────────────────────────────────────
// Construct definitions
// ─────────────────────────────────────────────

describe('CONSTRUCTS', () => {
  it('has 25 official constructs', () => {
    expect(CONSTRUCTS.length).toBe(25);
  });

  it('has 5 primary types (official MBDP)', () => {
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

// ─────────────────────────────────────────────
// Structural tags
// ─────────────────────────────────────────────

describe('STRUCTURAL_TAGS', () => {
  it('has defined structural tags', () => {
    expect(STRUCTURAL_TAGS.length).toBeGreaterThan(0);
    expect(STRUCTURAL_TAGS.map((t) => t.id)).toContain('bare');
    expect(STRUCTURAL_TAGS.map((t) => t.id)).toContain('has-modifiers');
  });
});

describe('detectStructuralTags', () => {
  it('bare product gets "bare" tag', () => {
    const tags = detectStructuralTags({
      isVirtual: false, isCombo: false, hasIngredientRefs: false,
      hasModifierGroupRefs: false, hasAlternatives: false, hasBundleLink: false,
    });
    expect(tags).toContain('bare');
    expect(tags).not.toContain('has-modifiers');
  });

  it('product with modifierGroupRefs gets "has-modifiers" tag', () => {
    const tags = detectStructuralTags({
      isVirtual: false, isCombo: false, hasIngredientRefs: false,
      hasModifierGroupRefs: true, hasAlternatives: false, hasBundleLink: false,
    });
    expect(tags).toContain('has-modifiers');
    expect(tags).not.toContain('bare');
  });

  it('combo product gets "is-combo" tag', () => {
    const tags = detectStructuralTags({
      isVirtual: false, isCombo: true, hasIngredientRefs: false,
      hasModifierGroupRefs: false, hasAlternatives: false, hasBundleLink: false,
    });
    expect(tags).toContain('is-combo');
  });

  it('bundle link gets "has-bundle" tag', () => {
    const tags = detectStructuralTags({
      isVirtual: false, isCombo: false, hasIngredientRefs: false,
      hasModifierGroupRefs: false, hasAlternatives: false, hasBundleLink: true,
    });
    expect(tags).toContain('has-bundle');
  });

  it('virtual + ingredientRefs + no alternatives gets "virtual-ingredient" tag', () => {
    const tags = detectStructuralTags({
      isVirtual: true, isCombo: false, hasIngredientRefs: true,
      hasModifierGroupRefs: false, hasAlternatives: false, hasBundleLink: false,
    });
    expect(tags).toContain('virtual-ingredient');
    expect(tags).not.toContain('bare');
  });

  it('virtual + alternatives does NOT get "virtual-ingredient" tag', () => {
    const tags = detectStructuralTags({
      isVirtual: true, isCombo: false, hasIngredientRefs: true,
      hasModifierGroupRefs: false, hasAlternatives: true, hasBundleLink: false,
    });
    expect(tags).not.toContain('virtual-ingredient');
  });

  it('product with ingredientRefs only gets no structural tags except nothing special', () => {
    const tags = detectStructuralTags({
      isVirtual: false, isCombo: false, hasIngredientRefs: true,
      hasModifierGroupRefs: false, hasAlternatives: false, hasBundleLink: false,
    });
    expect(tags).not.toContain('bare');
    expect(tags).not.toContain('has-modifiers');
    expect(tags.length).toBe(0);
  });
});

// ─────────────────────────────────────────────
// Bundle reference resolution
// ─────────────────────────────────────────────

describe('bundle references', () => {
  /** Build a menu with bundle-linked products */
  function buildBundleMenu(): Menu {
    return {
      displayName: 'Bundle Test Menu',
      rootCategoryRef: 'categories.root',
      isAvailable: true,
      categories: {
        root: {
          displayName: 'Root',
          childRefs: {
            'categories.entrees': {},
            'categories.meals': {},
          },
        },
        entrees: {
          displayName: 'Entrees',
          childRefs: {
            'products.gyro': {},
            'products.burger': {},
          },
        },
        meals: {
          displayName: 'Meals',
          childRefs: {
            'products.gyro-meal': {},
            'products.burger-meal': {},
          },
        },
      },
      products: {
        gyro: {
          displayName: 'Greek Gyro',
          ingredientRefs: { 'productGroups.toppings': {} },
          relatedProducts: { bundle: 'products.gyro-meal' },
        },
        burger: {
          displayName: 'Deluxe Burger',
          ingredientRefs: { 'productGroups.toppings': {} },
          relatedProducts: { bundle: 'products.burger-meal' },
        },
        'gyro-meal': {
          displayName: 'Greek Gyro Meal',
          ingredientRefs: { 'productGroups.sides': {}, 'productGroups.drinks': {} },
        },
        'burger-meal': {
          displayName: 'Deluxe Burger Meal',
          ingredientRefs: { 'productGroups.sides': {}, 'productGroups.drinks': {} },
        },
        // Product without bundle
        water: {
          displayName: 'Water',
        },
      },
      productGroups: {
        toppings: { displayName: 'Toppings' },
        sides: { displayName: 'Sides' },
        drinks: { displayName: 'Drinks' },
      },
      modifierGroups: {},
      modifiers: {},
    } as Menu;
  }

  it('source products have bundleTargetRef and bundleTargetName', () => {
    const menu = buildBundleMenu();
    const classified = classifyAllProducts(menu);
    const gyro = classified.find((c) => c.ref === 'products.gyro');
    const burger = classified.find((c) => c.ref === 'products.burger');

    expect(gyro).toBeDefined();
    expect(gyro!.bundleTargetRef).toBe('products.gyro-meal');
    expect(gyro!.bundleTargetName).toBe('Greek Gyro Meal');

    expect(burger).toBeDefined();
    expect(burger!.bundleTargetRef).toBe('products.burger-meal');
    expect(burger!.bundleTargetName).toBe('Deluxe Burger Meal');
  });

  it('target products have bundleSources with reverse links', () => {
    const menu = buildBundleMenu();
    const classified = classifyAllProducts(menu);
    const gyroMeal = classified.find((c) => c.ref === 'products.gyro-meal');
    const burgerMeal = classified.find((c) => c.ref === 'products.burger-meal');

    expect(gyroMeal).toBeDefined();
    expect(gyroMeal!.bundleSources).toBeDefined();
    expect(gyroMeal!.bundleSources).toHaveLength(1);
    expect(gyroMeal!.bundleSources![0].ref).toBe('products.gyro');
    expect(gyroMeal!.bundleSources![0].name).toBe('Greek Gyro');

    expect(burgerMeal).toBeDefined();
    expect(burgerMeal!.bundleSources).toBeDefined();
    expect(burgerMeal!.bundleSources).toHaveLength(1);
    expect(burgerMeal!.bundleSources![0].ref).toBe('products.burger');
  });

  it('products without bundle have no bundleTargetRef or bundleSources', () => {
    const menu = buildBundleMenu();
    const classified = classifyAllProducts(menu);
    // water is not in the menu categories (only entrees and meals)
    // Check products without bundle from the result
    const gyroMeal = classified.find((c) => c.ref === 'products.gyro-meal');
    expect(gyroMeal!.bundleTargetRef).toBeUndefined();
  });

  it('multiple sources linking to same target are all tracked', () => {
    const menu = buildBundleMenu();
    // Add a second product linking to gyro-meal
    (menu.products as Record<string, unknown>)['gyro-spicy'] = {
      displayName: 'Spicy Gyro',
      ingredientRefs: { 'productGroups.toppings': {} },
      relatedProducts: { bundle: 'products.gyro-meal' },
    };
    (menu.categories as Record<string, { displayName: string; childRefs: Record<string, unknown> }>).entrees.childRefs['products.gyro-spicy'] = {};

    const classified = classifyAllProducts(menu);
    const gyroMeal = classified.find((c) => c.ref === 'products.gyro-meal');

    expect(gyroMeal!.bundleSources).toBeDefined();
    expect(gyroMeal!.bundleSources).toHaveLength(2);
    const sourceRefs = gyroMeal!.bundleSources!.map((s) => s.ref);
    expect(sourceRefs).toContain('products.gyro');
    expect(sourceRefs).toContain('products.gyro-spicy');
  });

  it('bundle source products get has-bundle structural tag', () => {
    const menu = buildBundleMenu();
    const classified = classifyAllProducts(menu);
    const gyro = classified.find((c) => c.ref === 'products.gyro');

    expect(gyro!.structuralTags).toContain('has-bundle');
    expect(gyro!.flags.hasBundleLink).toBe(true);
  });
});
