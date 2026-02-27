/**
 * Menu Diff Engine
 *
 * Compares two menus (same brand, different environments) and produces
 * a structured diff at the product, category, and productGroup level.
 *
 * Matching strategy:
 *   1. Match by entity ID (primary key — same across environments)
 *   2. Fallback: match by displayName when IDs differ
 */

import type { Menu, Product, Category } from '../types/menu';

// ─────────────────────────────────────────────
// Diff Result Types
// ─────────────────────────────────────────────

export type DiffStatus = 'added' | 'removed' | 'changed' | 'unchanged';

export interface FieldDiff {
  field: string;
  left: unknown;
  right: unknown;
}

export interface EntityDiff {
  id: string;
  displayName: string;
  status: DiffStatus;
  /** only when status === 'changed' */
  fields: FieldDiff[];
  /** matched via displayName fallback instead of ID */
  matchedById: boolean;
  /** the matched right-side ID when matched by name */
  matchedRightId?: string;
}

export interface MenuDiffResult {
  leftLabel: string;
  rightLabel: string;
  products: EntityDiff[];
  categories: EntityDiff[];
  summary: DiffSummary;
}

export interface DiffSummary {
  products: { added: number; removed: number; changed: number; unchanged: number; total: number };
  categories: { added: number; removed: number; changed: number; unchanged: number; total: number };
}

// ─────────────────────────────────────────────
// Field comparison helpers
// ─────────────────────────────────────────────

/** Fields to compare on products */
const PRODUCT_FIELDS: (keyof Product)[] = [
  'displayName',
  'description',
  'isAvailable',
  'isVirtual',
  'isCombo',
  'isRecipe',
  'price',
  'PLU',
  'calories',
  'ctaLabel',
  'isDefault',
  'isExclusive',
];

/** Fields where we do deep structural comparison (refs, nutrition, etc.) */
const PRODUCT_REF_FIELDS: (keyof Product)[] = [
  'ingredientRefs',
  'modifierGroupRefs',
  'relatedProducts',
  'tags',
  'productGroupIds',
  'nutrition',
  'quantity',
  'operationHours',
];

const CATEGORY_FIELDS: (keyof Category)[] = [
  'displayName',
  'description',
  'isAvailable',
  'displayOrder',
  'bannerText',
  'type',
  'imageUrl',
];

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => isEqual(v, b[i]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a as Record<string, unknown>);
    const bKeys = Object.keys(b as Record<string, unknown>);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((k) =>
      isEqual(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
      ),
    );
  }

  return false;
}

/**
 * Deep-sort object keys so that structurally identical objects produce
 * the same JSON string regardless of insertion order.
 */
function sortKeys(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  if (Array.isArray(val)) return val.map(sortKeys);
  if (typeof val === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(val as Record<string, unknown>).sort()) {
      sorted[k] = sortKeys((val as Record<string, unknown>)[k]);
    }
    return sorted;
  }
  return val;
}

/**
 * Pretty-print any value as deterministic, formatted JSON.
 * – Primitives render as simple strings.
 * – Objects/arrays are serialised with 2-space indent and sorted keys
 *   so that two structurally-equal values always produce the same text.
 */
function formatValue(v: unknown): string {
  if (v === undefined || v === null) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  // Arrays & objects → pretty JSON with sorted keys
  if (typeof v === 'object') {
    try {
      return JSON.stringify(sortKeys(v), null, 2);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

/** Check whether a formatted string is multi-line (i.e. JSON block) */
function isJsonBlock(s: string): boolean {
  return s.includes('\n');
}

export { formatValue, isJsonBlock, sortKeys };

// ─────────────────────────────────────────────
// Entity-level diff
// ─────────────────────────────────────────────

function diffEntity<T extends Record<string, unknown>>(
  left: T,
  right: T,
  scalarFields: string[],
  refFields: string[],
): FieldDiff[] {
  const diffs: FieldDiff[] = [];

  for (const field of scalarFields) {
    const lv = left[field];
    const rv = right[field];
    if (!isEqual(lv, rv)) {
      diffs.push({ field, left: lv, right: rv });
    }
  }

  for (const field of refFields) {
    const lv = left[field];
    const rv = right[field];
    if (!isEqual(lv, rv)) {
      // For refs, show a summary rather than the deep object
      const lKeys = lv != null && typeof lv === 'object' && !Array.isArray(lv)
        ? Object.keys(lv) : null;
      const rKeys = rv != null && typeof rv === 'object' && !Array.isArray(rv)
        ? Object.keys(rv) : null;

      if (lKeys && rKeys) {
        const added = rKeys.filter((k) => !lKeys.includes(k));
        const removed = lKeys.filter((k) => !rKeys.includes(k));
        const changed = lKeys.filter((k) =>
          rKeys.includes(k) &&
          !isEqual((lv as Record<string, unknown>)[k], (rv as Record<string, unknown>)[k]),
        );
        const parts: string[] = [];
        if (added.length) parts.push(`+${added.length} added`);
        if (removed.length) parts.push(`-${removed.length} removed`);
        if (changed.length) parts.push(`~${changed.length} modified`);
        diffs.push({
          field,
          left: `${lKeys.length} refs`,
          right: parts.length ? parts.join(', ') : `${rKeys.length} refs`,
        });
      } else {
        diffs.push({ field, left: lv, right: rv });
      }
    }
  }

  return diffs;
}

// ─────────────────────────────────────────────
// Main diff function
// ─────────────────────────────────────────────

export function diffMenus(
  leftMenu: Menu,
  rightMenu: Menu,
  leftLabel: string,
  rightLabel: string,
): MenuDiffResult {
  const productDiffs = diffMap(
    leftMenu.products ?? {},
    rightMenu.products ?? {},
    PRODUCT_FIELDS as string[],
    PRODUCT_REF_FIELDS as string[],
  );

  const categoryDiffs = diffMap(
    leftMenu.categories ?? {},
    rightMenu.categories ?? {},
    CATEGORY_FIELDS as string[],
    ['childRefs', 'selectionQuantity'],
  );

  const summary: DiffSummary = {
    products: countStatuses(productDiffs),
    categories: countStatuses(categoryDiffs),
  };

  return { leftLabel, rightLabel, products: productDiffs, categories: categoryDiffs, summary };
}

function diffMap<T extends Record<string, unknown>>(
  leftMap: Record<string, T>,
  rightMap: Record<string, T>,
  scalarFields: string[],
  refFields: string[],
): EntityDiff[] {
  const results: EntityDiff[] = [];
  const leftIds = Object.keys(leftMap);
  const rightIds = new Set(Object.keys(rightMap));

  // Build a displayName → id index for the right side (for fallback matching)
  const rightByName = new Map<string, string>();
  for (const [id, entity] of Object.entries(rightMap)) {
    const name = (entity as Record<string, unknown>).displayName;
    if (typeof name === 'string' && name) {
      rightByName.set(name.toLowerCase(), id);
    }
  }

  const matchedRightIds = new Set<string>();

  for (const id of leftIds) {
    const leftEntity = leftMap[id];
    const displayName = String((leftEntity as Record<string, unknown>).displayName ?? id);

    // Try ID match first
    if (rightIds.has(id)) {
      matchedRightIds.add(id);
      const rightEntity = rightMap[id];
      const fields = diffEntity(leftEntity, rightEntity, scalarFields, refFields);
      results.push({
        id,
        displayName,
        status: fields.length > 0 ? 'changed' : 'unchanged',
        fields,
        matchedById: true,
      });
    } else {
      // Fallback: try matching by displayName
      const nameKey = displayName.toLowerCase();
      const matchedRightId = rightByName.get(nameKey);
      if (matchedRightId && !matchedRightIds.has(matchedRightId)) {
        matchedRightIds.add(matchedRightId);
        const rightEntity = rightMap[matchedRightId];
        const fields = diffEntity(leftEntity, rightEntity, scalarFields, refFields);
        results.push({
          id,
          displayName,
          status: fields.length > 0 ? 'changed' : 'unchanged',
          fields,
          matchedById: false,
          matchedRightId,
        });
      } else {
        // Only in left (removed in right)
        results.push({
          id,
          displayName,
          status: 'removed',
          fields: [],
          matchedById: false,
        });
      }
    }
  }

  // Items only in right (added)
  for (const id of rightIds) {
    if (!matchedRightIds.has(id)) {
      const rightEntity = rightMap[id];
      const displayName = String((rightEntity as Record<string, unknown>).displayName ?? id);
      results.push({
        id,
        displayName,
        status: 'added',
        fields: [],
        matchedById: false,
      });
    }
  }

  return results;
}

function countStatuses(diffs: EntityDiff[]): {
  added: number; removed: number; changed: number; unchanged: number; total: number;
} {
  let added = 0, removed = 0, changed = 0, unchanged = 0;
  for (const d of diffs) {
    if (d.status === 'added') added++;
    else if (d.status === 'removed') removed++;
    else if (d.status === 'changed') changed++;
    else unchanged++;
  }
  return { added, removed, changed, unchanged, total: diffs.length };
}
