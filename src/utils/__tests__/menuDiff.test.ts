import { describe, it, expect } from 'vitest';
import {
  diffMenus,
  formatValue,
  isJsonBlock,
  sortKeys,
} from '../menuDiff';
import type { Menu, Product, Category } from '../../types/menu';

// ─────────────────────────────────────────────
// Helpers to build minimal Menu objects
// ─────────────────────────────────────────────

function makeMenu(overrides: Partial<Menu> = {}): Menu {
  return {
    displayName: 'Test Menu',
    rootCategoryRef: 'cat-root',
    categories: {},
    productGroups: {},
    products: {},
    modifierGroups: {},
    modifiers: {},
    isAvailable: true,
    ...overrides,
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    displayName: 'Test Product',
    isAvailable: true,
    price: 5.99,
    calories: 250,
    PLU: 1001,
    ...overrides,
  };
}

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    displayName: 'Test Category',
    childRefs: {},
    selectionQuantity: { min: 1, max: 1 },
    ...overrides,
  };
}

// ═════════════════════════════════════════════
// sortKeys
// ═════════════════════════════════════════════

describe('sortKeys', () => {
  it('returns primitives unchanged', () => {
    expect(sortKeys(42)).toBe(42);
    expect(sortKeys('hello')).toBe('hello');
    expect(sortKeys(true)).toBe(true);
    expect(sortKeys(null)).toBe(null);
    expect(sortKeys(undefined)).toBe(undefined);
  });

  it('sorts object keys alphabetically', () => {
    const input = { z: 1, a: 2, m: 3 };
    const result = sortKeys(input) as Record<string, number>;
    expect(Object.keys(result)).toEqual(['a', 'm', 'z']);
  });

  it('sorts nested object keys recursively', () => {
    const input = { b: { z: 1, a: 2 }, a: { y: 3, x: 4 } };
    const result = sortKeys(input) as Record<string, Record<string, number>>;
    expect(Object.keys(result)).toEqual(['a', 'b']);
    expect(Object.keys(result.a)).toEqual(['x', 'y']);
    expect(Object.keys(result.b)).toEqual(['a', 'z']);
  });

  it('handles arrays by mapping each element', () => {
    const input = [{ b: 1, a: 2 }, { d: 3, c: 4 }];
    const result = sortKeys(input) as Record<string, number>[];
    expect(Object.keys(result[0])).toEqual(['a', 'b']);
    expect(Object.keys(result[1])).toEqual(['c', 'd']);
  });

  it('produces identical JSON for differently ordered objects', () => {
    const a = { name: 'Burger', price: 5, tags: ['lunch'] };
    const b = { tags: ['lunch'], price: 5, name: 'Burger' };
    expect(JSON.stringify(sortKeys(a))).toBe(JSON.stringify(sortKeys(b)));
  });
});

// ═════════════════════════════════════════════
// formatValue
// ═════════════════════════════════════════════

describe('formatValue', () => {
  it('returns "—" for null and undefined', () => {
    expect(formatValue(null)).toBe('—');
    expect(formatValue(undefined)).toBe('—');
  });

  it('returns strings as-is', () => {
    expect(formatValue('hello')).toBe('hello');
  });

  it('converts booleans to "true" / "false"', () => {
    expect(formatValue(true)).toBe('true');
    expect(formatValue(false)).toBe('false');
  });

  it('converts numbers to strings', () => {
    expect(formatValue(42)).toBe('42');
    expect(formatValue(0)).toBe('0');
    expect(formatValue(3.14)).toBe('3.14');
  });

  it('pretty-prints objects as JSON with sorted keys', () => {
    const val = { z: 1, a: 2 };
    const formatted = formatValue(val);
    expect(formatted).toBe('{\n  "a": 2,\n  "z": 1\n}');
  });

  it('pretty-prints arrays as JSON', () => {
    const val = ['c', 'a', 'b'];
    const formatted = formatValue(val);
    expect(formatted).toBe('[\n  "c",\n  "a",\n  "b"\n]');
  });

  it('pretty-prints nested objects with sorted keys', () => {
    const val = { beta: { y: 1, x: 2 }, alpha: 3 };
    const formatted = formatValue(val);
    const parsed = JSON.parse(formatted);
    expect(Object.keys(parsed)).toEqual(['alpha', 'beta']);
    expect(Object.keys(parsed.beta)).toEqual(['x', 'y']);
  });
});

// ═════════════════════════════════════════════
// isJsonBlock
// ═════════════════════════════════════════════

describe('isJsonBlock', () => {
  it('returns true for multi-line strings', () => {
    expect(isJsonBlock('{\n  "a": 1\n}')).toBe(true);
  });

  it('returns false for single-line strings', () => {
    expect(isJsonBlock('hello')).toBe(false);
    expect(isJsonBlock('42')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isJsonBlock('')).toBe(false);
  });
});

// ═════════════════════════════════════════════
// diffMenus — Identical menus
// ═════════════════════════════════════════════

describe('diffMenus — identical menus', () => {
  it('produces all-unchanged when comparing identical product maps', () => {
    const products: Record<string, Product> = {
      'prod-1': makeProduct({ displayName: 'Burger' }),
      'prod-2': makeProduct({ displayName: 'Fries' }),
    };
    const menu = makeMenu({ products });
    const result = diffMenus(menu, menu, 'ENV A', 'ENV B');

    expect(result.leftLabel).toBe('ENV A');
    expect(result.rightLabel).toBe('ENV B');
    expect(result.products).toHaveLength(2);
    expect(result.products.every((p) => p.status === 'unchanged')).toBe(true);
    expect(result.summary.products.unchanged).toBe(2);
    expect(result.summary.products.added).toBe(0);
    expect(result.summary.products.removed).toBe(0);
    expect(result.summary.products.changed).toBe(0);
  });

  it('produces zero field diffs for unchanged products', () => {
    const products = { 'p1': makeProduct() };
    const menu = makeMenu({ products });
    const result = diffMenus(menu, menu, 'A', 'B');

    expect(result.products[0].fields).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════
// diffMenus — Added / Removed
// ═════════════════════════════════════════════

describe('diffMenus — added & removed', () => {
  it('detects products only in the right menu as "added"', () => {
    const left = makeMenu({ products: {} });
    const right = makeMenu({
      products: { 'new-prod': makeProduct({ displayName: 'New Burger' }) },
    });
    const result = diffMenus(left, right, 'A', 'B');

    expect(result.products).toHaveLength(1);
    expect(result.products[0].status).toBe('added');
    expect(result.products[0].displayName).toBe('New Burger');
    expect(result.summary.products.added).toBe(1);
  });

  it('detects products only in the left menu as "removed"', () => {
    const left = makeMenu({
      products: { 'old-prod': makeProduct({ displayName: 'Old Burger' }) },
    });
    const right = makeMenu({ products: {} });
    const result = diffMenus(left, right, 'A', 'B');

    expect(result.products).toHaveLength(1);
    expect(result.products[0].status).toBe('removed');
    expect(result.products[0].displayName).toBe('Old Burger');
    expect(result.summary.products.removed).toBe(1);
  });

  it('detects categories only in right menu as "added"', () => {
    const left = makeMenu({ categories: {} });
    const right = makeMenu({
      categories: { 'cat-1': makeCategory({ displayName: 'Desserts' }) },
    });
    const result = diffMenus(left, right, 'A', 'B');

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].status).toBe('added');
    expect(result.summary.categories.added).toBe(1);
  });

  it('handles mixed: some added, some removed, some unchanged', () => {
    const left = makeMenu({
      products: {
        'p1': makeProduct({ displayName: 'Stays' }),
        'p2': makeProduct({ displayName: 'Goes Away' }),
      },
    });
    const right = makeMenu({
      products: {
        'p1': makeProduct({ displayName: 'Stays' }),
        'p3': makeProduct({ displayName: 'Brand New' }),
      },
    });
    const result = diffMenus(left, right, 'A', 'B');

    const statuses = result.products.map((p) => p.status).sort();
    expect(statuses).toEqual(['added', 'removed', 'unchanged']);
    expect(result.summary.products.added).toBe(1);
    expect(result.summary.products.removed).toBe(1);
    expect(result.summary.products.unchanged).toBe(1);
    expect(result.summary.products.total).toBe(3);
  });
});

// ═════════════════════════════════════════════
// diffMenus — Changed fields
// ═════════════════════════════════════════════

describe('diffMenus — field changes', () => {
  it('detects scalar field changes on matching products', () => {
    const left = makeMenu({
      products: { 'p1': makeProduct({ displayName: 'Burger', price: 5.99 }) },
    });
    const right = makeMenu({
      products: { 'p1': makeProduct({ displayName: 'Burger', price: 7.49 }) },
    });
    const result = diffMenus(left, right, 'A', 'B');

    expect(result.products).toHaveLength(1);
    expect(result.products[0].status).toBe('changed');
    expect(result.products[0].fields).toHaveLength(1);
    expect(result.products[0].fields[0].field).toBe('price');
    expect(result.products[0].fields[0].left).toBe(5.99);
    expect(result.products[0].fields[0].right).toBe(7.49);
  });

  it('detects multiple field changes on the same product', () => {
    const left = makeMenu({
      products: {
        'p1': makeProduct({
          displayName: 'Wings',
          price: 10.99,
          calories: 800,
          isAvailable: true,
        }),
      },
    });
    const right = makeMenu({
      products: {
        'p1': makeProduct({
          displayName: 'Wings',
          price: 12.99,
          calories: 900,
          isAvailable: false,
        }),
      },
    });
    const result = diffMenus(left, right, 'A', 'B');

    expect(result.products[0].status).toBe('changed');
    const changedFields = result.products[0].fields.map((f) => f.field).sort();
    expect(changedFields).toEqual(['calories', 'isAvailable', 'price']);
  });

  it('detects displayName changes', () => {
    const left = makeMenu({
      products: { 'p1': makeProduct({ displayName: 'Old Name' }) },
    });
    const right = makeMenu({
      products: { 'p1': makeProduct({ displayName: 'New Name' }) },
    });
    const result = diffMenus(left, right, 'A', 'B');

    expect(result.products[0].status).toBe('changed');
    expect(result.products[0].fields.find((f) => f.field === 'displayName')).toBeTruthy();
  });

  it('detects boolean field changes (isAvailable)', () => {
    const left = makeMenu({
      products: { 'p1': makeProduct({ isAvailable: true }) },
    });
    const right = makeMenu({
      products: { 'p1': makeProduct({ isAvailable: false }) },
    });
    const result = diffMenus(left, right, 'A', 'B');

    expect(result.products[0].status).toBe('changed');
    const avail = result.products[0].fields.find((f) => f.field === 'isAvailable');
    expect(avail).toBeTruthy();
    expect(avail!.left).toBe(true);
    expect(avail!.right).toBe(false);
  });

  it('treats null and undefined equally (no diff)', () => {
    const left = makeMenu({
      products: { 'p1': makeProduct({ description: null }) },
    });
    const right = makeMenu({
      products: { 'p1': makeProduct({ description: undefined }) },
    });
    const result = diffMenus(left, right, 'A', 'B');

    expect(result.products[0].status).toBe('unchanged');
  });
});

// ═════════════════════════════════════════════
// diffMenus — ref field changes (deep objects)
// ═════════════════════════════════════════════

describe('diffMenus — ref field diffs', () => {
  it('detects added refs in modifierGroupRefs', () => {
    const left = makeMenu({
      products: {
        'p1': makeProduct({
          modifierGroupRefs: {
            'mg-1': { displayName: 'Sizes', childRefs: {}, selectionQuantity: { min: 1, max: 1 } },
          },
        }),
      },
    });
    const right = makeMenu({
      products: {
        'p1': makeProduct({
          modifierGroupRefs: {
            'mg-1': { displayName: 'Sizes', childRefs: {}, selectionQuantity: { min: 1, max: 1 } },
            'mg-2': { displayName: 'Sauces', childRefs: {}, selectionQuantity: { min: 0, max: 3 } },
          },
        }),
      },
    });
    const result = diffMenus(left, right, 'A', 'B');

    expect(result.products[0].status).toBe('changed');
    const refField = result.products[0].fields.find((f) => f.field === 'modifierGroupRefs');
    expect(refField).toBeTruthy();
    expect(refField!.left).toBe('1 refs');
    expect(String(refField!.right)).toContain('+1 added');
  });

  it('detects removed refs in ingredientRefs', () => {
    const left = makeMenu({
      products: {
        'p1': makeProduct({
          ingredientRefs: {
            'ing-1': {},
            'ing-2': {},
            'ing-3': {},
          },
        }),
      },
    });
    const right = makeMenu({
      products: {
        'p1': makeProduct({
          ingredientRefs: {
            'ing-1': {},
          },
        }),
      },
    });
    const result = diffMenus(left, right, 'A', 'B');

    expect(result.products[0].status).toBe('changed');
    const refField = result.products[0].fields.find((f) => f.field === 'ingredientRefs');
    expect(refField).toBeTruthy();
    expect(String(refField!.right)).toContain('-2 removed');
  });

  it('detects tags array changes', () => {
    const left = makeMenu({
      products: { 'p1': makeProduct({ tags: ['lunch', 'dinner'] }) },
    });
    const right = makeMenu({
      products: { 'p1': makeProduct({ tags: ['lunch', 'dinner', 'breakfast'] }) },
    });
    const result = diffMenus(left, right, 'A', 'B');

    expect(result.products[0].status).toBe('changed');
    const tagField = result.products[0].fields.find((f) => f.field === 'tags');
    expect(tagField).toBeTruthy();
  });
});

// ═════════════════════════════════════════════
// diffMenus — Fallback name matching
// ═════════════════════════════════════════════

describe('diffMenus — name-based fallback matching', () => {
  it('matches products by displayName when IDs differ', () => {
    const left = makeMenu({
      products: { 'prod-old-id': makeProduct({ displayName: 'Classic Burger', price: 5.99 }) },
    });
    const right = makeMenu({
      products: { 'prod-new-id': makeProduct({ displayName: 'Classic Burger', price: 6.99 }) },
    });
    const result = diffMenus(left, right, 'A', 'B');

    // Should match by name, not create added+removed
    expect(result.products).toHaveLength(1);
    expect(result.products[0].status).toBe('changed');
    expect(result.products[0].matchedById).toBe(false);
    expect(result.products[0].matchedRightId).toBe('prod-new-id');
  });

  it('name matching is case-insensitive', () => {
    const left = makeMenu({
      products: { 'p1': makeProduct({ displayName: 'CHEESEBURGER' }) },
    });
    const right = makeMenu({
      products: { 'p2': makeProduct({ displayName: 'cheeseburger' }) },
    });
    const result = diffMenus(left, right, 'A', 'B');

    expect(result.products).toHaveLength(1);
    expect(result.products[0].matchedById).toBe(false);
  });

  it('ID match takes priority over name match', () => {
    const left = makeMenu({
      products: { 'p1': makeProduct({ displayName: 'Burger', price: 5 }) },
    });
    const right = makeMenu({
      products: {
        'p1': makeProduct({ displayName: 'Burger Deluxe', price: 5 }),  // same ID
        'p2': makeProduct({ displayName: 'Burger', price: 7 }),        // same name
      },
    });
    const result = diffMenus(left, right, 'A', 'B');

    const matched = result.products.find((p) => p.id === 'p1');
    expect(matched).toBeTruthy();
    expect(matched!.matchedById).toBe(true);
    // p2 should be 'added'
    const added = result.products.find((p) => p.id === 'p2');
    expect(added).toBeTruthy();
    expect(added!.status).toBe('added');
  });
});

// ═════════════════════════════════════════════
// diffMenus — Category diffs
// ═════════════════════════════════════════════

describe('diffMenus — category diffs', () => {
  it('detects category displayName change', () => {
    const left = makeMenu({
      categories: { 'c1': makeCategory({ displayName: 'Appetizers' }) },
    });
    const right = makeMenu({
      categories: { 'c1': makeCategory({ displayName: 'Starters' }) },
    });
    const result = diffMenus(left, right, 'A', 'B');

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].status).toBe('changed');
    expect(result.categories[0].fields[0].field).toBe('displayName');
  });

  it('detects category displayOrder change', () => {
    const left = makeMenu({
      categories: { 'c1': makeCategory({ displayName: 'Mains', displayOrder: 1 }) },
    });
    const right = makeMenu({
      categories: { 'c1': makeCategory({ displayName: 'Mains', displayOrder: 3 }) },
    });
    const result = diffMenus(left, right, 'A', 'B');

    expect(result.categories[0].status).toBe('changed');
    const field = result.categories[0].fields.find((f) => f.field === 'displayOrder');
    expect(field).toBeTruthy();
    expect(field!.left).toBe(1);
    expect(field!.right).toBe(3);
  });

  it('detects category isAvailable change', () => {
    const left = makeMenu({
      categories: { 'c1': makeCategory({ displayName: 'Drinks', isAvailable: true }) },
    });
    const right = makeMenu({
      categories: { 'c1': makeCategory({ displayName: 'Drinks', isAvailable: false }) },
    });
    const result = diffMenus(left, right, 'A', 'B');

    expect(result.categories[0].status).toBe('changed');
  });
});

// ═════════════════════════════════════════════
// diffMenus — Summary counts
// ═════════════════════════════════════════════

describe('diffMenus — summary counts', () => {
  it('correctly counts totals in summary', () => {
    const left = makeMenu({
      products: {
        'p1': makeProduct({ displayName: 'A', price: 1 }),
        'p2': makeProduct({ displayName: 'B' }),
        'p3': makeProduct({ displayName: 'C' }),
      },
    });
    const right = makeMenu({
      products: {
        'p1': makeProduct({ displayName: 'A', price: 2 }),  // changed
        'p2': makeProduct({ displayName: 'B' }),             // unchanged
        'p4': makeProduct({ displayName: 'D' }),             // added
      },
    });
    const result = diffMenus(left, right, 'A', 'B');

    expect(result.summary.products.changed).toBe(1);
    expect(result.summary.products.unchanged).toBe(1);
    expect(result.summary.products.removed).toBe(1);
    expect(result.summary.products.added).toBe(1);
    expect(result.summary.products.total).toBe(4);
  });

  it('handles empty menus gracefully', () => {
    const left = makeMenu({});
    const right = makeMenu({});
    const result = diffMenus(left, right, 'A', 'B');

    expect(result.summary.products.total).toBe(0);
    expect(result.summary.categories.total).toBe(0);
    expect(result.products).toHaveLength(0);
    expect(result.categories).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════
// diffMenus — Edge cases
// ═════════════════════════════════════════════

describe('diffMenus — edge cases', () => {
  it('handles large product counts', () => {
    const products: Record<string, Product> = {};
    for (let i = 0; i < 500; i++) {
      products[`p-${i}`] = makeProduct({ displayName: `Product ${i}`, price: i });
    }
    const left = makeMenu({ products });

    // Right side: all same except first 10 have different prices
    const rightProducts = { ...products };
    for (let i = 0; i < 10; i++) {
      rightProducts[`p-${i}`] = makeProduct({ displayName: `Product ${i}`, price: i + 100 });
    }
    const right = makeMenu({ products: rightProducts });

    const result = diffMenus(left, right, 'A', 'B');
    expect(result.summary.products.changed).toBe(10);
    expect(result.summary.products.unchanged).toBe(490);
    expect(result.summary.products.total).toBe(500);
  });

  it('handles products with no displayName', () => {
    const left = makeMenu({
      products: { 'p1': makeProduct({ displayName: undefined }) },
    });
    const right = makeMenu({
      products: { 'p1': makeProduct({ displayName: undefined }) },
    });
    const result = diffMenus(left, right, 'A', 'B');

    expect(result.products[0].status).toBe('unchanged');
  });

  it('handles nutrition object changes', () => {
    const left = makeMenu({
      products: {
        'p1': makeProduct({
          nutrition: { totalCalories: 500, allergicInformation: 'Contains nuts' },
        }),
      },
    });
    const right = makeMenu({
      products: {
        'p1': makeProduct({
          nutrition: { totalCalories: 600, allergicInformation: 'Contains nuts' },
        }),
      },
    });
    const result = diffMenus(left, right, 'A', 'B');

    expect(result.products[0].status).toBe('changed');
    const nutritionDiff = result.products[0].fields.find((f) => f.field === 'nutrition');
    expect(nutritionDiff).toBeTruthy();
  });
});
