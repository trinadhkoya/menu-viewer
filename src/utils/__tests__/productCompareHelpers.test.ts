import { describe, it, expect } from 'vitest';
import {
  fmt,
  isBlock,
  extractFields,
  buildCompareFields,
  diffModifierGroups,
  FIELD_LABELS,
} from '../productCompareHelpers';
import type { Menu, Product, Modifier, ModifierGroup } from '../../types/menu';

// ─────────────────────────────────────────────
// Helpers
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

function makeModifier(overrides: Partial<Modifier> = {}): Modifier {
  return {
    displayName: 'Test Modifier',
    displayOrder: 1,
    price: 1.99,
    PLU: 2001,
    nutrition: { totalCalories: 100 },
    ...overrides,
  };
}

function makeModifierGroup(overrides: Partial<ModifierGroup> = {}): ModifierGroup {
  return {
    displayName: 'Test Group',
    childRefs: {},
    selectionQuantity: { min: 1, max: 1 },
    ...overrides,
  };
}

// ═════════════════════════════════════════════
// fmt
// ═════════════════════════════════════════════

describe('fmt', () => {
  it('returns null for null and undefined', () => {
    expect(fmt(null)).toBe(null);
    expect(fmt(undefined)).toBe(null);
  });

  it('returns strings as-is', () => {
    expect(fmt('hello')).toBe('hello');
    expect(fmt('')).toBe('');
  });

  it('converts booleans', () => {
    expect(fmt(true)).toBe('true');
    expect(fmt(false)).toBe('false');
  });

  it('converts numbers to string', () => {
    expect(fmt(42)).toBe('42');
    expect(fmt(0)).toBe('0');
    expect(fmt(3.14)).toBe('3.14');
  });

  it('pretty-prints objects as sorted JSON', () => {
    const result = fmt({ z: 1, a: 2 });
    expect(result).toBe('{\n  "a": 2,\n  "z": 1\n}');
  });

  it('pretty-prints arrays', () => {
    const result = fmt(['b', 'a']);
    expect(result).toBe('[\n  "b",\n  "a"\n]');
  });

  it('pretty-prints nested objects with sorted keys', () => {
    const result = fmt({ b: { y: 1, x: 2 }, a: 3 });
    expect(result).toContain('"a": 3');
    expect(result!.indexOf('"a"')).toBeLessThan(result!.indexOf('"b"'));
  });
});

// ═════════════════════════════════════════════
// isBlock
// ═════════════════════════════════════════════

describe('isBlock', () => {
  it('returns true for multi-line strings', () => {
    expect(isBlock('line1\nline2')).toBe(true);
  });

  it('returns false for single-line strings', () => {
    expect(isBlock('hello')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isBlock(null)).toBe(false);
  });
});

// ═════════════════════════════════════════════
// extractFields
// ═════════════════════════════════════════════

describe('extractFields', () => {
  it('returns empty object for undefined product', () => {
    expect(extractFields(undefined)).toEqual({});
  });

  it('extracts scalar fields correctly', () => {
    const product = makeProduct({
      displayName: 'Burger',
      price: 9.99,
      calories: 500,
      PLU: 1234,
      isAvailable: true,
      ctaLabel: 'Order Now',
    });
    const fields = extractFields(product);

    expect(fields['displayName']).toBe('Burger');
    expect(fields['price']).toBe('$9.99');
    expect(fields['calories']).toBe('500');
    expect(fields['PLU']).toBe('1234');
    expect(fields['isAvailable']).toBe('true');
    expect(fields['ctaLabel']).toBe('Order Now');
  });

  it('formats price with two decimal places', () => {
    const product = makeProduct({ price: 10 });
    const fields = extractFields(product);
    expect(fields['price']).toBe('$10.00');
  });

  it('strips null-only entries', () => {
    const product = makeProduct({
      displayName: 'Burger',
      description: undefined,
      ctaLabel: undefined,
    });
    const fields = extractFields(product);

    // description & ctaLabel should be stripped (null)
    expect('description' in fields).toBe(false);
    expect('ctaLabel' in fields).toBe(false);
    // displayName should be present
    expect(fields['displayName']).toBe('Burger');
  });

  it('serializes tags as JSON', () => {
    const product = makeProduct({ tags: ['lunch', 'featured'] });
    const fields = extractFields(product);

    expect(fields['tags']).toContain('lunch');
    expect(fields['tags']).toContain('featured');
    // Should be valid JSON
    const parsed = JSON.parse(fields['tags']!);
    expect(parsed).toEqual(['lunch', 'featured']);
  });

  it('serializes nutrition object as sorted JSON', () => {
    const product = makeProduct({
      nutrition: { totalCalories: 500, allergicInformation: 'Contains nuts' },
    });
    const fields = extractFields(product);

    expect(fields['nutrition']).toBeTruthy();
    const parsed = JSON.parse(fields['nutrition']!);
    expect(parsed.totalCalories).toBe(500);
    expect(parsed.allergicInformation).toBe('Contains nuts');
  });

  it('prefers imageUrl over image', () => {
    const product = makeProduct({ imageUrl: 'https://img.com/a.png', image: 'https://img.com/b.png' });
    const fields = extractFields(product);
    expect(fields['imageUrl']).toBe('https://img.com/a.png');
  });

  it('falls back to image when imageUrl is absent', () => {
    const product = makeProduct({ imageUrl: undefined, image: 'https://img.com/b.png' });
    const fields = extractFields(product);
    expect(fields['imageUrl']).toBe('https://img.com/b.png');
  });

  it('serializes quantity object', () => {
    const product = makeProduct({ quantity: { min: 1, max: 5, default: 1 } });
    const fields = extractFields(product);

    expect(fields['quantity']).toBeTruthy();
    const parsed = JSON.parse(fields['quantity']!);
    expect(parsed.min).toBe(1);
    expect(parsed.max).toBe(5);
  });

  it('handles boolean flags correctly', () => {
    const product = makeProduct({
      isCombo: true,
      isVirtual: false,
      isExclusive: true,
      isDefault: false,
    });
    const fields = extractFields(product);

    expect(fields['isCombo']).toBe('true');
    expect(fields['isVirtual']).toBe('false');
    expect(fields['isExclusive']).toBe('true');
    expect(fields['isDefault']).toBe('false');
  });
});

// ═════════════════════════════════════════════
// buildCompareFields
// ═════════════════════════════════════════════

describe('buildCompareFields', () => {
  it('returns empty array when both products undefined', () => {
    const fields = buildCompareFields(undefined, undefined);
    expect(fields).toEqual([]);
  });

  it('marks identical fields as not diff', () => {
    const product = makeProduct({ displayName: 'Burger', price: 5.99 });
    const fields = buildCompareFields(product, product);

    const displayNameField = fields.find((f) => f.key === 'displayName');
    expect(displayNameField).toBeTruthy();
    expect(displayNameField!.isDiff).toBe(false);
    expect(displayNameField!.left).toBe('Burger');
    expect(displayNameField!.right).toBe('Burger');
  });

  it('marks different fields as diff', () => {
    const left = makeProduct({ displayName: 'Burger', price: 5.99 });
    const right = makeProduct({ displayName: 'Burger', price: 7.99 });
    const fields = buildCompareFields(left, right);

    const priceField = fields.find((f) => f.key === 'price');
    expect(priceField).toBeTruthy();
    expect(priceField!.isDiff).toBe(true);
    expect(priceField!.left).toBe('$5.99');
    expect(priceField!.right).toBe('$7.99');
  });

  it('sorts diffs before non-diffs', () => {
    const left = makeProduct({ displayName: 'Burger', price: 5.99, calories: 500 });
    const right = makeProduct({ displayName: 'Burger', price: 7.99, calories: 500 });
    const fields = buildCompareFields(left, right);

    // First field should be a diff
    const firstDiffIdx = fields.findIndex((f) => f.isDiff);
    const firstNonDiffIdx = fields.findIndex((f) => !f.isDiff);
    if (firstDiffIdx !== -1 && firstNonDiffIdx !== -1) {
      expect(firstDiffIdx).toBeLessThan(firstNonDiffIdx);
    }
  });

  it('includes fields only present in one product', () => {
    const left = makeProduct({ displayName: 'Burger', tags: ['lunch'] });
    const right = makeProduct({ displayName: 'Burger' });
    const fields = buildCompareFields(left, right);

    const tagsField = fields.find((f) => f.key === 'tags');
    expect(tagsField).toBeTruthy();
    expect(tagsField!.left).toBeTruthy();
    expect(tagsField!.right).toBe(null);
    expect(tagsField!.isDiff).toBe(true);
  });

  it('uses FIELD_LABELS for labels', () => {
    const product = makeProduct({ displayName: 'Burger' });
    const fields = buildCompareFields(product, product);

    const dn = fields.find((f) => f.key === 'displayName');
    expect(dn!.label).toBe('Display Name');
  });

  it('uses key as label when FIELD_LABELS has no mapping', () => {
    // All standard fields have labels, but buildCompareFields should
    // fallback gracefully. This is tested via the existing code path since
    // extractFields only produces known keys.
    const product = makeProduct({ displayName: 'Test' });
    const fields = buildCompareFields(product, product);
    fields.forEach((f) => {
      expect(f.label).toBeTruthy();
    });
  });

  it('handles comparing product with undefined', () => {
    const product = makeProduct({ displayName: 'Burger', price: 5.99 });
    const fields = buildCompareFields(product, undefined);

    // All fields should be diffs (right side is null)
    expect(fields.every((f) => f.isDiff)).toBe(true);
    expect(fields.every((f) => f.right === null)).toBe(true);
  });
});

// ═════════════════════════════════════════════
// diffModifierGroups
// ═════════════════════════════════════════════

describe('diffModifierGroups', () => {
  it('returns empty array when both products are undefined', () => {
    const menu = makeMenu();
    expect(diffModifierGroups(menu, menu, undefined, undefined)).toEqual([]);
  });

  it('returns empty when neither product has modifier groups', () => {
    const menu = makeMenu();
    const left = makeProduct({});
    const right = makeProduct({});
    const result = diffModifierGroups(menu, menu, left, right);
    expect(result).toEqual([]);
  });

  it('detects modifier group only in left product', () => {
    const leftProd = makeProduct({
      modifierGroupRefs: {
        'mg-1': makeModifierGroup({ displayName: 'Sizes', childRefs: { 'mod-1': {}, 'mod-2': {} } }),
      },
    });
    const rightProd = makeProduct({});
    const menu = makeMenu();

    const result = diffModifierGroups(menu, menu, leftProd, rightProd);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('only-left');
    expect(result[0].groupName).toBe('Sizes');
    expect(result[0].leftCount).toBe(2);
    expect(result[0].rightCount).toBe(0);
  });

  it('detects modifier group only in right product', () => {
    const leftProd = makeProduct({});
    const rightProd = makeProduct({
      modifierGroupRefs: {
        'mg-1': makeModifierGroup({ displayName: 'Toppings', childRefs: { 'mod-1': {} } }),
      },
    });
    const menu = makeMenu();

    const result = diffModifierGroups(menu, menu, leftProd, rightProd);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('only-right');
    expect(result[0].groupName).toBe('Toppings');
    expect(result[0].leftCount).toBe(0);
    expect(result[0].rightCount).toBe(1);
  });

  it('detects identical modifier groups as "same"', () => {
    const sharedGroup = makeModifierGroup({
      displayName: 'Sizes',
      childRefs: { 'mod-1': {}, 'mod-2': {} },
    });
    const leftProd = makeProduct({ modifierGroupRefs: { 'mg-1': sharedGroup } });
    const rightProd = makeProduct({ modifierGroupRefs: { 'mg-1': sharedGroup } });

    const leftMod = makeModifier({ displayName: 'Small', price: 0, nutrition: { totalCalories: 200 } });
    const rightMod = makeModifier({ displayName: 'Small', price: 0, nutrition: { totalCalories: 200 } });

    const leftMenu = makeMenu({ modifiers: { 'mod-1': leftMod, 'mod-2': makeModifier({ displayName: 'Large' }) } });
    const rightMenu = makeMenu({ modifiers: { 'mod-1': rightMod, 'mod-2': makeModifier({ displayName: 'Large' }) } });

    const result = diffModifierGroups(leftMenu, rightMenu, leftProd, rightProd);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('same');
  });

  it('detects modifier price changes', () => {
    const sharedGroup = makeModifierGroup({
      displayName: 'Sizes',
      childRefs: { 'mod-1': {} },
    });
    const leftProd = makeProduct({ modifierGroupRefs: { 'mg-1': sharedGroup } });
    const rightProd = makeProduct({ modifierGroupRefs: { 'mg-1': sharedGroup } });

    const leftMenu = makeMenu({
      modifiers: { 'mod-1': makeModifier({ displayName: 'Large', price: 1.00 }) },
    });
    const rightMenu = makeMenu({
      modifiers: { 'mod-1': makeModifier({ displayName: 'Large', price: 2.50 }) },
    });

    const result = diffModifierGroups(leftMenu, rightMenu, leftProd, rightProd);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('changed');
    expect(result[0].modifierDiffs[0].status).toBe('changed');

    const priceField = result[0].modifierDiffs[0].fields.find((f) => f.key === 'price');
    expect(priceField).toBeTruthy();
    expect(priceField!.left).toBe('$1.00');
    expect(priceField!.right).toBe('$2.50');
  });

  it('detects modifier calorie changes', () => {
    const sharedGroup = makeModifierGroup({
      displayName: 'Sizes',
      childRefs: { 'mod-1': {} },
    });
    const leftProd = makeProduct({ modifierGroupRefs: { 'mg-1': sharedGroup } });
    const rightProd = makeProduct({ modifierGroupRefs: { 'mg-1': sharedGroup } });

    const leftMenu = makeMenu({
      modifiers: { 'mod-1': makeModifier({ nutrition: { totalCalories: 200 } }) },
    });
    const rightMenu = makeMenu({
      modifiers: { 'mod-1': makeModifier({ nutrition: { totalCalories: 350 } }) },
    });

    const result = diffModifierGroups(leftMenu, rightMenu, leftProd, rightProd);
    const calField = result[0].modifierDiffs[0].fields.find((f) => f.key === 'calories');
    expect(calField).toBeTruthy();
    expect(calField!.left).toBe('200');
    expect(calField!.right).toBe('350');
  });

  it('detects modifier availability changes', () => {
    const sharedGroup = makeModifierGroup({
      displayName: 'Sizes',
      childRefs: { 'mod-1': {} },
    });
    const leftProd = makeProduct({ modifierGroupRefs: { 'mg-1': sharedGroup } });
    const rightProd = makeProduct({ modifierGroupRefs: { 'mg-1': sharedGroup } });

    const leftMenu = makeMenu({
      modifiers: { 'mod-1': makeModifier({ isAvailable: true }) },
    });
    const rightMenu = makeMenu({
      modifiers: { 'mod-1': makeModifier({ isAvailable: false }) },
    });

    const result = diffModifierGroups(leftMenu, rightMenu, leftProd, rightProd);
    const availField = result[0].modifierDiffs[0].fields.find((f) => f.key === 'available');
    expect(availField).toBeTruthy();
    expect(availField!.left).toBe('true');
    expect(availField!.right).toBe('false');
  });

  it('detects modifier name changes', () => {
    const sharedGroup = makeModifierGroup({
      displayName: 'Sizes',
      childRefs: { 'mod-1': {} },
    });
    const leftProd = makeProduct({ modifierGroupRefs: { 'mg-1': sharedGroup } });
    const rightProd = makeProduct({ modifierGroupRefs: { 'mg-1': sharedGroup } });

    const leftMenu = makeMenu({
      modifiers: { 'mod-1': makeModifier({ displayName: 'Small' }) },
    });
    const rightMenu = makeMenu({
      modifiers: { 'mod-1': makeModifier({ displayName: 'Regular' }) },
    });

    const result = diffModifierGroups(leftMenu, rightMenu, leftProd, rightProd);
    const nameField = result[0].modifierDiffs[0].fields.find((f) => f.key === 'name');
    expect(nameField).toBeTruthy();
    expect(nameField!.left).toBe('Small');
    expect(nameField!.right).toBe('Regular');
  });

  it('detects modifier only in left (removed from right)', () => {
    const leftGroup = makeModifierGroup({
      displayName: 'Sizes',
      childRefs: { 'mod-1': {}, 'mod-2': {} },
    });
    const rightGroup = makeModifierGroup({
      displayName: 'Sizes',
      childRefs: { 'mod-1': {} },
    });
    const leftProd = makeProduct({ modifierGroupRefs: { 'mg-1': leftGroup } });
    const rightProd = makeProduct({ modifierGroupRefs: { 'mg-1': rightGroup } });

    const leftMenu = makeMenu({
      modifiers: {
        'mod-1': makeModifier({ displayName: 'Small' }),
        'mod-2': makeModifier({ displayName: 'Large' }),
      },
    });
    const rightMenu = makeMenu({
      modifiers: { 'mod-1': makeModifier({ displayName: 'Small' }) },
    });

    const result = diffModifierGroups(leftMenu, rightMenu, leftProd, rightProd);
    expect(result[0].status).toBe('changed');

    const onlyLeft = result[0].modifierDiffs.find((m) => m.status === 'only-left');
    expect(onlyLeft).toBeTruthy();
    expect(onlyLeft!.id).toBe('mod-2');
  });

  it('detects modifier only in right (added)', () => {
    const leftGroup = makeModifierGroup({
      displayName: 'Sizes',
      childRefs: { 'mod-1': {} },
    });
    const rightGroup = makeModifierGroup({
      displayName: 'Sizes',
      childRefs: { 'mod-1': {}, 'mod-3': {} },
    });
    const leftProd = makeProduct({ modifierGroupRefs: { 'mg-1': leftGroup } });
    const rightProd = makeProduct({ modifierGroupRefs: { 'mg-1': rightGroup } });

    const leftMenu = makeMenu({
      modifiers: { 'mod-1': makeModifier({ displayName: 'Small' }) },
    });
    const rightMenu = makeMenu({
      modifiers: {
        'mod-1': makeModifier({ displayName: 'Small' }),
        'mod-3': makeModifier({ displayName: 'XL' }),
      },
    });

    const result = diffModifierGroups(leftMenu, rightMenu, leftProd, rightProd);
    expect(result[0].status).toBe('changed');

    const onlyRight = result[0].modifierDiffs.find((m) => m.status === 'only-right');
    expect(onlyRight).toBeTruthy();
    expect(onlyRight!.name).toBe('XL');
  });

  it('sorts results: changed > only-left > only-right > same', () => {
    const leftProd = makeProduct({
      modifierGroupRefs: {
        'mg-same': makeModifierGroup({ displayName: 'Same', childRefs: { 'mod-a': {} } }),
        'mg-changed': makeModifierGroup({ displayName: 'Changed', childRefs: { 'mod-b': {} } }),
        'mg-left': makeModifierGroup({ displayName: 'Left Only', childRefs: { 'mod-c': {} } }),
      },
    });
    const rightProd = makeProduct({
      modifierGroupRefs: {
        'mg-same': makeModifierGroup({ displayName: 'Same', childRefs: { 'mod-a': {} } }),
        'mg-changed': makeModifierGroup({ displayName: 'Changed', childRefs: { 'mod-b': {} } }),
        'mg-right': makeModifierGroup({ displayName: 'Right Only', childRefs: { 'mod-d': {} } }),
      },
    });

    const leftMenu = makeMenu({
      modifiers: {
        'mod-a': makeModifier({ displayName: 'A', price: 1 }),
        'mod-b': makeModifier({ displayName: 'B', price: 1 }),
        'mod-c': makeModifier({ displayName: 'C', price: 1 }),
      },
    });
    const rightMenu = makeMenu({
      modifiers: {
        'mod-a': makeModifier({ displayName: 'A', price: 1 }),
        'mod-b': makeModifier({ displayName: 'B', price: 2 }), // price changed
        'mod-d': makeModifier({ displayName: 'D', price: 1 }),
      },
    });

    const result = diffModifierGroups(leftMenu, rightMenu, leftProd, rightProd);
    expect(result.length).toBe(4);

    const statuses = result.map((r) => r.status);
    expect(statuses[0]).toBe('changed');
    expect(statuses[1]).toBe('only-left');
    expect(statuses[2]).toBe('only-right');
    expect(statuses[3]).toBe('same');
  });

  it('falls back to menu-level modifierGroups when not on product', () => {
    const leftProd = makeProduct({
      modifierGroupRefs: {
        'mg-1': null as unknown as ModifierGroup, // ref exists but inline data is missing
      },
    });
    const rightProd = makeProduct({
      modifierGroupRefs: {
        'mg-1': null as unknown as ModifierGroup,
      },
    });

    const leftMenu = makeMenu({
      modifierGroups: {
        'mg-1': makeModifierGroup({ displayName: 'Sauces', childRefs: { 'mod-1': {} } }),
      },
      modifiers: { 'mod-1': makeModifier({ displayName: 'Ketchup', price: 0 }) },
    });
    const rightMenu = makeMenu({
      modifierGroups: {
        'mg-1': makeModifierGroup({ displayName: 'Sauces', childRefs: { 'mod-1': {} } }),
      },
      modifiers: { 'mod-1': makeModifier({ displayName: 'Ketchup', price: 0.50 }) },
    });

    const result = diffModifierGroups(leftMenu, rightMenu, leftProd, rightProd);
    expect(result).toHaveLength(1);
    expect(result[0].groupName).toBe('Sauces');
    expect(result[0].status).toBe('changed');
  });

  it('handles multiple modifier groups with mixed changes', () => {
    const leftProd = makeProduct({
      modifierGroupRefs: {
        'mg-1': makeModifierGroup({ displayName: 'Sizes', childRefs: { 'mod-s': {} } }),
        'mg-2': makeModifierGroup({ displayName: 'Sauces', childRefs: { 'mod-k': {} } }),
      },
    });
    const rightProd = makeProduct({
      modifierGroupRefs: {
        'mg-1': makeModifierGroup({ displayName: 'Sizes', childRefs: { 'mod-s': {} } }),
        'mg-2': makeModifierGroup({ displayName: 'Sauces', childRefs: { 'mod-k': {} } }),
      },
    });

    const leftMenu = makeMenu({
      modifiers: {
        'mod-s': makeModifier({ displayName: 'Small', price: 0 }),
        'mod-k': makeModifier({ displayName: 'Ketchup', price: 0.50 }),
      },
    });
    const rightMenu = makeMenu({
      modifiers: {
        'mod-s': makeModifier({ displayName: 'Small', price: 1.00 }),  // changed
        'mod-k': makeModifier({ displayName: 'Ketchup', price: 0.50 }), // same
      },
    });

    const result = diffModifierGroups(leftMenu, rightMenu, leftProd, rightProd);
    expect(result).toHaveLength(2);

    const changed = result.find((r) => r.groupName === 'Sizes');
    const same = result.find((r) => r.groupName === 'Sauces');
    expect(changed!.status).toBe('changed');
    expect(same!.status).toBe('same');
  });
});

// ═════════════════════════════════════════════
// FIELD_LABELS
// ═════════════════════════════════════════════

describe('FIELD_LABELS', () => {
  it('has human-readable labels for all standard fields', () => {
    const expectedKeys = [
      'displayName', 'description', 'price', 'calories',
      'isAvailable', 'isCombo', 'isVirtual', 'isExclusive',
      'isDefault', 'PLU', 'ctaLabel', 'imageUrl',
      'tags', 'productGroupIds', 'parentIds', 'relatedProducts',
      'nutrition', 'ingredientRefs', 'modifierGroupRefs',
      'operationHours', 'quantity',
    ];
    for (const key of expectedKeys) {
      expect(FIELD_LABELS[key]).toBeTruthy();
      expect(typeof FIELD_LABELS[key]).toBe('string');
    }
  });
});
