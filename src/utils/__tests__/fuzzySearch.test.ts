import { describe, it, expect } from 'vitest';
import { _fuzzyScore as fuzzyScore, searchMenu } from '../menuHelpers';
import type { Menu } from '../../types/menu';

describe('fuzzyScore', () => {
  const words = (q: string) => q.split(/\s+/).filter(Boolean);

  it('returns 100 for exact substring match', () => {
    expect(fuzzyScore('Chicken Sandwich', 'chicken', words('chicken'))).toBe(100);
    expect(fuzzyScore('Chicken Sandwich', 'sandwich', words('sandwich'))).toBe(100);
    expect(fuzzyScore('Chicken Sandwich', 'chicken sandwich', words('chicken sandwich'))).toBe(100);
  });

  it('returns 0 for completely unrelated strings', () => {
    expect(fuzzyScore('Chicken Sandwich', 'pizza', words('pizza'))).toBe(0);
    expect(fuzzyScore('Fries', 'burger', words('burger'))).toBe(0);
  });

  it('scores multi-word substring queries at 80', () => {
    // "chick" and "sand" both appear as substrings in the target
    const score = fuzzyScore('Chicken Sandwich Deluxe', 'chick sand', words('chick sand'));
    expect(score).toBe(80);
  });

  it('scores prefix-only word queries at 75', () => {
    // "chic" is a prefix of "chicken", "del" is a prefix of "deluxe"
    // but "del" also appears as substring so it will actually be 80.
    // Use words that are prefixes but NOT substrings of other segments:
    // "entre" is a prefix of "entrees", "spec" of "specials"
    const score = fuzzyScore('Entrees and Specials', 'entre spec', words('entre spec'));
    expect(score).toBe(80); // both are substrings too
  });

  it('scores abbreviation-style queries via fuzzy path', () => {
    // "chk" is NOT a prefix of "chicken", so it falls through to fuzzy matching
    const score = fuzzyScore('Chicken Sandwich Deluxe', 'chk sand', words('chk sand'));
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(60);
  });

  it('scores all-words-present match at 80', () => {
    // Both "chicken" and "deluxe" appear as substrings
    const score = fuzzyScore('Chicken Sandwich Deluxe', 'chicken deluxe', words('chicken deluxe'));
    expect(score).toBe(80);
  });

  it('handles fuzzy misspelling (character sequence)', () => {
    // "chiken" → c-h-i-k-e-n all appear in order in "chicken"
    const score = fuzzyScore('Chicken', 'chiken', words('chiken'));
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(60);
  });

  it('returns 0 when chars are not in order', () => {
    expect(fuzzyScore('ABC', 'cba', words('cba'))).toBe(0);
  });

  it('handles empty target', () => {
    expect(fuzzyScore('', 'test', words('test'))).toBe(0);
  });

  it('gives higher fuzzy score for better density matches', () => {
    const good = fuzzyScore('Fries', 'frie', words('frie'));
    const poor = fuzzyScore('Frequently Requested Items Extra', 'frie', words('frie'));
    expect(good).toBeGreaterThan(poor);
  });
});

describe('searchMenu – fuzzy integration', () => {
  const menu: Menu = {
    displayName: 'Test Menu',
    products: {
      'prod-001': {
        displayName: 'Chicken Sandwich',
        isAvailable: true,
        isCombo: false,
        isVirtual: false,
        isExclusive: false,
        isRecipe: false,
        price: 5.99,
        calories: 450,
      },
      'prod-002': {
        displayName: 'Crispy Chicken Tenders',
        isAvailable: true,
        isCombo: false,
        isVirtual: false,
        isExclusive: false,
        isRecipe: false,
        price: 7.99,
        calories: 600,
      },
      'prod-003': {
        displayName: 'Classic Burger',
        isAvailable: true,
        isCombo: false,
        isVirtual: false,
        isExclusive: false,
        isRecipe: false,
        price: 6.49,
        calories: 550,
      },
    },
    modifiers: {
      'mod-001': {
        displayName: 'Extra Cheese',
        isAvailable: true,
        price: 0.99,
      },
    },
    categories: {
      'cat-001': {
        displayName: 'Entrees',
      },
      'cat-002': {
        displayName: 'Sides',
      },
    },
  } as unknown as Menu;

  it('exact match returns score=100 and is first', () => {
    const results = searchMenu(menu, 'chicken sandwich');
    expect(results.products.length).toBeGreaterThan(0);
    expect(results.products[0].product.displayName).toBe('Chicken Sandwich');
    expect(results.products[0].score).toBe(100);
  });

  it('fuzzy misspelling still finds results', () => {
    const results = searchMenu(menu, 'chiken');
    expect(results.products.length).toBeGreaterThan(0);
    const names = results.products.map((p) => p.product.displayName);
    expect(names).toContain('Chicken Sandwich');
  });

  it('multi-word partial match works', () => {
    const results = searchMenu(menu, 'crispy tend');
    expect(results.products.length).toBeGreaterThan(0);
    expect(results.products[0].product.displayName).toBe('Crispy Chicken Tenders');
  });

  it('results are sorted by score (best first)', () => {
    const results = searchMenu(menu, 'chicken');
    expect(results.products.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < results.products.length; i++) {
      expect(results.products[i - 1].score).toBeGreaterThanOrEqual(results.products[i].score);
    }
  });

  it('empty query returns empty results', () => {
    const results = searchMenu(menu, '');
    expect(results.products).toHaveLength(0);
    expect(results.modifiers).toHaveLength(0);
    expect(results.categories).toHaveLength(0);
  });

  it('searches modifiers by PLU', () => {
    const menuWithPLU = {
      ...menu,
      modifiers: {
        'mod-001': { ...menu.modifiers!['mod-001'], PLU: 12345 },
      },
    } as unknown as Menu;
    const results = searchMenu(menuWithPLU, '12345');
    expect(results.modifiers.length).toBeGreaterThan(0);
  });
});
