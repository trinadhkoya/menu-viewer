import type { Menu } from '../types/menu';
import type { BrandId } from '../components/MenuUploader';

interface DetectionResult {
  brand: BrandId;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * Auto-detect which Inspire brand a menu JSON belongs to.
 *
 * Strategy (in priority order):
 * 1. Literal brand name in category displayNames  ("Dunkin'", "Arby's")
 * 2. Structural fingerprint  (operationHours → Dunkin', no modifierGroups → Arby's)
 * 3. Category naming conventions  (ALL-CAPS → BWW)
 * 4. Product-key slug patterns  (slush/coney → Sonic, roast-beef → Arby's, wing/sauce → BWW)
 */
export function detectBrand(menu: Menu): DetectionResult | null {
  const catNames = Object.values(menu.categories ?? {}).map((c) => c.displayName ?? '');
  const catNamesJoined = catNames.join(' ');
  const productKeys = Object.keys(menu.products ?? {});
  const productKeysJoined = productKeys.join(' ').toLowerCase();

  // ── 1. Literal brand strings in categories ──
  if (catNames.some((n) => /dunkin/i.test(n))) {
    return { brand: 'dunkin', confidence: 'high', reason: "Category contains \"Dunkin'\"" };
  }
  if (catNames.some((n) => /arby'?s/i.test(n))) {
    return { brand: 'arbys', confidence: 'high', reason: "Category contains \"Arby's\"" };
  }

  // Also check product displayNames for brand mentions
  const sampleProducts = Object.values(menu.products ?? {}).slice(0, 200);
  const productNamesSample = sampleProducts.map((p) => p.displayName ?? '').join(' ');
  if (/dunkin/i.test(productNamesSample)) {
    return { brand: 'dunkin', confidence: 'high', reason: "Product name contains \"Dunkin'\"" };
  }
  if (/arby'?s/i.test(productNamesSample)) {
    return { brand: 'arbys', confidence: 'high', reason: "Product name contains \"Arby's\"" };
  }

  // ── 2. Structural fingerprints ──
  const raw = menu as unknown as Record<string, unknown>;
  if ('operationHours' in raw && raw.operationHours != null) {
    return { brand: 'dunkin', confidence: 'high', reason: 'Has operationHours field (Dunkin\' specific)' };
  }

  // ── 3. Category casing conventions ──
  // BWW uses ALL-CAPS category names like "DIPS", "PARTY", "EXTRAS", "SALADS"
  const nonRoot = catNames.filter((n) => n.length > 2);
  const allCapsCount = nonRoot.filter((n) => n === n.toUpperCase() && /^[A-Z\s&\-']+$/.test(n)).length;
  if (nonRoot.length > 3 && allCapsCount / nonRoot.length > 0.5) {
    return { brand: 'bww', confidence: 'high', reason: 'Majority of categories are ALL-CAPS (BWW convention)' };
  }

  // ── 4. Product key slug patterns ──
  const sonicSignals = (productKeysJoined.match(/slush|coney|blast|sonic|cherry-limeade/g) ?? []).length;
  const arbysSignals = (productKeysJoined.match(/roast-beef|curly-fries|jamocha|gyro|arbys/g) ?? []).length;
  const bwwSignals = (productKeysJoined.match(/wing|b-dubs|buffalo|boneless|traditional/g) ?? []).length;
  const dunkinSignals = (productKeysJoined.match(/donut|munchkin|coolatta|latte|dunkin/g) ?? []).length;

  const scores: [BrandId, number][] = [
    ['sonic', sonicSignals],
    ['arbys', arbysSignals],
    ['bww', bwwSignals],
    ['dunkin', dunkinSignals],
  ];
  scores.sort((a, b) => b[1] - a[1]);

  if (scores[0][1] >= 5 && scores[0][1] > scores[1][1] * 2) {
    return {
      brand: scores[0][0],
      confidence: 'medium',
      reason: `Product key slugs match ${scores[0][0]} (${scores[0][1]} signals)`,
    };
  }

  // ── 5. Category name keyword heuristic ──
  const catLower = catNamesJoined.toLowerCase();
  if (/hot dogs|slushes|combos|carhop|tots/.test(catLower) && /sonic|drive.?in/i.test(catLower + ' ' + productNamesSample)) {
    return { brand: 'sonic', confidence: 'medium', reason: 'Category keywords match Sonic' };
  }
  if (/slow roasted|crafted sandwich|meat.*box|roast beef/i.test(catLower)) {
    return { brand: 'arbys', confidence: 'medium', reason: "Category keywords match Arby's" };
  }
  if (/donuts|bakery|refresher|brew at home/i.test(catLower)) {
    return { brand: 'dunkin', confidence: 'medium', reason: "Category keywords match Dunkin'" };
  }
  if (/dips|party|shareables|wings|sauces/i.test(catLower)) {
    return { brand: 'bww', confidence: 'medium', reason: 'Category keywords match BWW' };
  }

  // ── 6. Structural fallback ──
  if (!('modifierGroups' in raw) || !raw.modifierGroups || Object.keys(raw.modifierGroups as object).length === 0) {
    return { brand: 'arbys', confidence: 'low', reason: "No modifierGroups present (typical for Arby's)" };
  }

  // ── 7. Slug count with lower threshold ──
  if (scores[0][1] >= 2) {
    return {
      brand: scores[0][0],
      confidence: 'low',
      reason: `Best slug match: ${scores[0][0]} (${scores[0][1]} signals)`,
    };
  }

  return null;
}
