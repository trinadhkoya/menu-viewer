import { describe, it, expect } from 'vitest';
import type { Menu } from '../../types/menu';
import { getProductGroupsMissingDefault } from '../menuHelpers';

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
// DOVS-5556: Virtual products with groups missing isDefault
// The check is virtual-product-centric: for each isVirtual=true product,
// traces relatedProducts → productGroups and modifierGroupRefs → modifierGroups,
// and flags groups where no child has isDefault=true.
// ─────────────────────────────────────────────

describe('getProductGroupsMissingDefault', () => {
  // ── Pathway 1: relatedProducts → productGroups ──

  it('returns empty when virtual product\'s productGroup has a default child (override)', () => {
    const menu = buildMenu({
      productGroups: {
        'size-abc': {
          displayName: 'Size',
          childRefs: {
            'products.small': { isDefault: true },
            'products.large': {},
          },
        },
      },
      products: {
        'cola': {
          displayName: 'Cola',
          isVirtual: true,
          relatedProducts: {
            alternatives: { 'productGroups.size-abc': {} },
          },
        },
        small: { displayName: 'Small' },
        large: { displayName: 'Large' },
      },
    });
    expect(getProductGroupsMissingDefault(menu)).toEqual([]);
  });

  it('detects virtual product with productGroup missing isDefault', () => {
    const menu = buildMenu({
      productGroups: {
        'flavor-xyz': {
          displayName: 'Flavor',
          childRefs: {
            'products.vanilla': {},
            'products.chocolate': {},
          },
        },
      },
      products: {
        'virtual-drink': {
          displayName: 'Virtual Drink',
          isVirtual: true,
          relatedProducts: {
            alternatives: { 'productGroups.flavor-xyz': {} },
          },
        },
        vanilla: { displayName: 'Vanilla' },
        chocolate: { displayName: 'Chocolate' },
      },
    });
    const results = getProductGroupsMissingDefault(menu);
    expect(results).toHaveLength(1);
    expect(results[0].productRef).toBe('products.virtual-drink');
    expect(results[0].productName).toBe('Virtual Drink');
    expect(results[0].groups).toHaveLength(1);
    expect(results[0].groups[0].groupRef).toBe('productGroups.flavor-xyz');
    expect(results[0].groups[0].groupName).toBe('Flavor');
    expect(results[0].groups[0].sourceType).toBe('productGroup');
    expect(results[0].groups[0].childCount).toBe(2);
    expect(results[0].groups[0].children.every(c => !c.isDefault)).toBe(true);
  });

  it('respects isDefault on the product entity itself (not just override)', () => {
    const menu = buildMenu({
      productGroups: {
        'size-abc': {
          displayName: 'Size',
          childRefs: {
            'products.small': {},
            'products.large': {},
          },
        },
      },
      products: {
        'virtual-cola': {
          displayName: 'Cola',
          isVirtual: true,
          relatedProducts: {
            alternatives: { 'productGroups.size-abc': {} },
          },
        },
        small: { displayName: 'Small', isDefault: true },
        large: { displayName: 'Large' },
      },
    });
    expect(getProductGroupsMissingDefault(menu)).toEqual([]);
  });

  it('detects recipe groups missing isDefault via virtual product', () => {
    const menu = buildMenu({
      productGroups: {
        'carrier-abc': {
          displayName: 'Carrier',
          isRecipe: true,
          childRefs: {
            'products.bun': {},
            'products.wrap': {},
          },
        },
      },
      products: {
        'virtual-sandwich': {
          displayName: 'Virtual Sandwich',
          isVirtual: true,
          relatedProducts: {
            'productGroups.carrier-abc': {},
          },
        },
        bun: { displayName: 'Bun' },
        wrap: { displayName: 'Wrap' },
      },
    });
    const results = getProductGroupsMissingDefault(menu);
    expect(results).toHaveLength(1);
    expect(results[0].groups[0].isRecipe).toBe(true);
    expect(results[0].groups[0].sourceType).toBe('productGroup');
  });

  it('skips productGroups with empty childRefs', () => {
    const menu = buildMenu({
      productGroups: {
        'empty-group': {
          displayName: 'Empty',
          childRefs: {},
        },
      },
      products: {
        'virtual-item': {
          displayName: 'Virtual',
          isVirtual: true,
          relatedProducts: {
            'productGroups.empty-group': {},
          },
        },
      },
    });
    expect(getProductGroupsMissingDefault(menu)).toEqual([]);
  });

  it('ignores non-virtual products even if their groups lack isDefault', () => {
    const menu = buildMenu({
      productGroups: {
        'flavor-xyz': {
          displayName: 'Flavor',
          childRefs: {
            'products.vanilla': {},
            'products.chocolate': {},
          },
        },
      },
      products: {
        'non-virtual-drink': {
          displayName: 'Regular Drink',
          isVirtual: false,
          relatedProducts: {
            alternatives: { 'productGroups.flavor-xyz': {} },
          },
        },
        vanilla: { displayName: 'Vanilla' },
        chocolate: { displayName: 'Chocolate' },
      },
    });
    expect(getProductGroupsMissingDefault(menu)).toEqual([]);
  });

  // ── Pathway 2: modifierGroupRefs → modifierGroups (Sonic intensity) ──

  it('detects virtual product with modifierGroup missing isDefault', () => {
    const menu = buildMenu({
      modifierGroups: {
        'intensity-abc': {
          displayName: 'Intensity',
          childRefs: {
            'modifiers.easy': {},
            'modifiers.regular': {},
            'modifiers.extra': {},
          },
          selectionQuantity: { min: 1, max: 1 },
        },
      },
      modifiers: {
        easy: { displayName: 'Easy' },
        regular: { displayName: 'Regular' },
        extra: { displayName: 'Extra' },
      },
      products: {
        'virtual-sonic-item': {
          displayName: 'Sonic Slush',
          isVirtual: true,
          modifierGroupRefs: {
            'modifierGroups.intensity-abc': null,
          },
        },
      },
    });
    const results = getProductGroupsMissingDefault(menu);
    expect(results).toHaveLength(1);
    expect(results[0].productRef).toBe('products.virtual-sonic-item');
    expect(results[0].groups).toHaveLength(1);
    expect(results[0].groups[0].groupRef).toBe('modifierGroups.intensity-abc');
    expect(results[0].groups[0].sourceType).toBe('modifierGroup');
    expect(results[0].groups[0].isRecipe).toBe(false);
    expect(results[0].groups[0].childCount).toBe(3);
  });

  it('returns empty when virtual product\'s modifierGroup has a default (override)', () => {
    const menu = buildMenu({
      modifierGroups: {
        'intensity-abc': {
          displayName: 'Intensity',
          childRefs: {
            'modifiers.easy': {},
            'modifiers.regular': { isDefault: true },
            'modifiers.extra': {},
          },
          selectionQuantity: { min: 1, max: 1 },
        },
      },
      modifiers: {
        easy: { displayName: 'Easy' },
        regular: { displayName: 'Regular' },
        extra: { displayName: 'Extra' },
      },
      products: {
        'virtual-sonic-item': {
          displayName: 'Sonic Slush',
          isVirtual: true,
          modifierGroupRefs: {
            'modifierGroups.intensity-abc': null,
          },
        },
      },
    });
    expect(getProductGroupsMissingDefault(menu)).toEqual([]);
  });

  it('respects isDefault on the modifier entity itself', () => {
    const menu = buildMenu({
      modifierGroups: {
        'intensity-abc': {
          displayName: 'Intensity',
          childRefs: {
            'modifiers.easy': {},
            'modifiers.regular': {},
            'modifiers.extra': {},
          },
          selectionQuantity: { min: 1, max: 1 },
        },
      },
      modifiers: {
        easy: { displayName: 'Easy' },
        regular: { displayName: 'Regular', isDefault: true },
        extra: { displayName: 'Extra' },
      },
      products: {
        'virtual-sonic-item': {
          displayName: 'Sonic Slush',
          isVirtual: true,
          modifierGroupRefs: {
            'modifierGroups.intensity-abc': null,
          },
        },
      },
    });
    expect(getProductGroupsMissingDefault(menu)).toEqual([]);
  });

  // ── Mixed: both pathways on same virtual product ──

  it('detects both productGroup and modifierGroup issues on a single virtual product', () => {
    const menu = buildMenu({
      productGroups: {
        'size-bad': {
          displayName: 'Size',
          childRefs: {
            'products.small': {},
            'products.large': {},
          },
        },
      },
      modifierGroups: {
        'intensity-bad': {
          displayName: 'Intensity',
          childRefs: {
            'modifiers.easy': {},
            'modifiers.regular': {},
          },
          selectionQuantity: { min: 1, max: 1 },
        },
      },
      products: {
        'virtual-combo': {
          displayName: 'Virtual Combo',
          isVirtual: true,
          relatedProducts: {
            alternatives: { 'productGroups.size-bad': {} },
          },
          modifierGroupRefs: {
            'modifierGroups.intensity-bad': null,
          },
        },
        small: { displayName: 'Small' },
        large: { displayName: 'Large' },
      },
      modifiers: {
        easy: { displayName: 'Easy' },
        regular: { displayName: 'Regular' },
      },
    });
    const results = getProductGroupsMissingDefault(menu);
    expect(results).toHaveLength(1);
    expect(results[0].productRef).toBe('products.virtual-combo');
    expect(results[0].groups).toHaveLength(2);
    const sourceTypes = results[0].groups.map(g => g.sourceType);
    expect(sourceTypes).toContain('productGroup');
    expect(sourceTypes).toContain('modifierGroup');
  });

  it('skips groups that have defaults even when mixed with bad groups', () => {
    const menu = buildMenu({
      productGroups: {
        'size-good': {
          displayName: 'Size OK',
          childRefs: {
            'products.small': { isDefault: true },
            'products.large': {},
          },
        },
        'flavor-bad': {
          displayName: 'Flavor',
          childRefs: {
            'products.vanilla': {},
            'products.chocolate': {},
          },
        },
      },
      products: {
        'virtual-drink': {
          displayName: 'Virtual Drink',
          isVirtual: true,
          relatedProducts: {
            alternatives: {
              'productGroups.size-good': {},
              'productGroups.flavor-bad': {},
            },
          },
        },
        small: { displayName: 'Small' },
        large: { displayName: 'Large' },
        vanilla: { displayName: 'Vanilla' },
        chocolate: { displayName: 'Chocolate' },
      },
    });
    const results = getProductGroupsMissingDefault(menu);
    expect(results).toHaveLength(1);
    expect(results[0].groups).toHaveLength(1);
    expect(results[0].groups[0].groupRef).toBe('productGroups.flavor-bad');
  });

  // ── DOVS-5556 specific: Dunkin' virtual products ──

  it('detects Dunkin-style virtual product with productGroups from DOVS-5556', () => {
    const menu = buildMenu({
      productGroups: {
        'carrier-1df9458b--bacon-jam-grilled-cheese-5e392fef': {
          displayName: 'Carrier - Bacon Jam Grilled Cheese',
          isRecipe: true,
          childRefs: {
            'products.sourdough': {},
            'products.croissant': {},
          },
        },
        'cold-foam-80728ad7': {
          displayName: 'Cold Foam',
          childRefs: {
            'products.vanilla-foam': {},
            'products.chocolate-foam': {},
          },
        },
        'variety-1a9b4471': {
          displayName: 'Variety Pack',
          childRefs: {
            'products.assorted-6': { isDefault: true },
            'products.assorted-12': {},
          },
        },
      },
      products: {
        'bacon-jam-grilled-cheese': {
          displayName: 'Bacon Jam Grilled Cheese',
          isVirtual: true,
          relatedProducts: {
            'productGroups.carrier-1df9458b--bacon-jam-grilled-cheese-5e392fef': {},
          },
        },
        'nitro-cold-brew': {
          displayName: 'Nitro Cold Brew',
          isVirtual: true,
          relatedProducts: {
            alternatives: {
              'productGroups.cold-foam-80728ad7': {},
              'productGroups.variety-1a9b4471': {},
            },
          },
        },
        sourdough: { displayName: 'Sourdough' },
        croissant: { displayName: 'Croissant' },
        'vanilla-foam': { displayName: 'Vanilla Cold Foam' },
        'chocolate-foam': { displayName: 'Chocolate Cold Foam' },
        'assorted-6': { displayName: '6 Pack Assorted' },
        'assorted-12': { displayName: '12 Pack Assorted' },
      },
    });

    const results = getProductGroupsMissingDefault(menu);
    // Both virtual products should be flagged; variety-1a9b4471 has a default so nitro-cold-brew only has 1 bad group
    expect(results).toHaveLength(2);

    const baconJam = results.find(r => r.productRef === 'products.bacon-jam-grilled-cheese');
    expect(baconJam).toBeDefined();
    expect(baconJam!.groups).toHaveLength(1);
    expect(baconJam!.groups[0].groupRef).toBe('productGroups.carrier-1df9458b--bacon-jam-grilled-cheese-5e392fef');
    expect(baconJam!.groups[0].isRecipe).toBe(true);

    const nitroColdBrew = results.find(r => r.productRef === 'products.nitro-cold-brew');
    expect(nitroColdBrew).toBeDefined();
    expect(nitroColdBrew!.groups).toHaveLength(1);
    expect(nitroColdBrew!.groups[0].groupRef).toBe('productGroups.cold-foam-80728ad7');
  });
});
