/**
 * Product Compare Helpers
 *
 * Pure functions extracted from ProductCompare.tsx for testability.
 * Handles field extraction, comparison, and modifier-group deep diffs.
 */

import type { Menu, Product } from '../types/menu';
import { sortKeys } from './menuDiff';

// ─── Types ─────────────────────────────────────

export interface CompareField {
  key: string;
  label: string;
  left: string | null;
  right: string | null;
  isDiff: boolean;
}

export interface ModGroupDiff {
  groupName: string;
  groupId: string;
  status: 'same' | 'changed' | 'only-left' | 'only-right';
  leftCount: number;
  rightCount: number;
  modifierDiffs: {
    name: string;
    id: string;
    status: 'same' | 'changed' | 'only-left' | 'only-right';
    fields: { key: string; left: string | null; right: string | null }[];
  }[];
}

// ─── Field labels ──────────────────────────────

export const FIELD_LABELS: Record<string, string> = {
  displayName: 'Display Name',
  description: 'Description',
  price: 'Price',
  calories: 'Calories',
  isAvailable: 'Available',
  isCombo: 'Combo',
  isVirtual: 'Virtual',
  isExclusive: 'Exclusive',
  isDefault: 'Default',
  PLU: 'PLU',
  ctaLabel: 'CTA Label',
  imageUrl: 'Image URL',
  tags: 'Tags',
  productGroupIds: 'Product Groups',
  parentIds: 'Parent IDs',
  relatedProducts: 'Related Products',
  nutrition: 'Nutrition',
  ingredientRefs: 'Ingredients',
  modifierGroupRefs: 'Modifier Groups',
  operationHours: 'Operation Hours',
  quantity: 'Quantity',
};

// ─── Pretty-print helper ──────────────────────

/** Pretty-print a value: primitives as-is, objects/arrays as sorted JSON. */
export function fmt(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') {
    try { return JSON.stringify(sortKeys(v), null, 2); } catch { return String(v); }
  }
  return String(v);
}

/** Detect multi-line (JSON-block) values */
export function isBlock(s: string | null): boolean {
  return s != null && s.includes('\n');
}

// ─── Field extraction ─────────────────────────

export function extractFields(product: Product | undefined): Record<string, string | null> {
  if (!product) return {};
  const m: Record<string, string | null> = {};

  // ── Scalars ────────────────────────────
  m['displayName'] = product.displayName ?? null;
  m['description'] = product.description ?? null;
  m['price'] = product.price != null ? `$${product.price.toFixed(2)}` : null;
  m['calories'] = product.calories != null ? `${product.calories}` : null;
  m['isAvailable'] = product.isAvailable != null ? String(product.isAvailable) : null;
  m['isCombo'] = product.isCombo != null ? String(product.isCombo) : null;
  m['isVirtual'] = product.isVirtual != null ? String(product.isVirtual) : null;
  m['isExclusive'] = product.isExclusive != null ? String(product.isExclusive) : null;
  m['isDefault'] = product.isDefault != null ? String(product.isDefault) : null;
  m['PLU'] = product.PLU != null ? String(product.PLU) : null;
  m['ctaLabel'] = product.ctaLabel ?? null;
  m['imageUrl'] = product.imageUrl ?? product.image ?? null;

  // ── Arrays → sorted JSON ───────────────
  m['tags'] = fmt(product.tags);
  m['productGroupIds'] = fmt(product.productGroupIds);
  m['parentIds'] = fmt(product.parentIds);
  m['relatedProducts'] = fmt(product.relatedProducts);

  // ── Deep objects → sorted JSON ─────────
  m['nutrition'] = fmt(product.nutrition);
  m['ingredientRefs'] = fmt(product.ingredientRefs);
  m['modifierGroupRefs'] = fmt(product.modifierGroupRefs);
  m['operationHours'] = fmt(product.operationHours);
  m['quantity'] = fmt(product.quantity);

  // Strip null-only entries so they don't clutter the table
  for (const k of Object.keys(m)) {
    if (m[k] === null) delete m[k];
  }

  return m;
}

// ─── Build compare fields ─────────────────────

export function buildCompareFields(left: Product | undefined, right: Product | undefined): CompareField[] {
  const leftFields = extractFields(left);
  const rightFields = extractFields(right);
  const allKeys = new Set([...Object.keys(leftFields), ...Object.keys(rightFields)]);

  const fields: CompareField[] = [];
  for (const key of allKeys) {
    const l = leftFields[key] ?? null;
    const r = rightFields[key] ?? null;
    fields.push({
      key,
      label: FIELD_LABELS[key] || key,
      left: l,
      right: r,
      isDiff: l !== r,
    });
  }
  // Sort: diffs first, then alphabetical
  fields.sort((a, b) => {
    if (a.isDiff !== b.isDiff) return a.isDiff ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
  return fields;
}

// ─── Modifier-group deep diff ─────────────────

export function diffModifierGroups(
  leftMenu: Menu,
  rightMenu: Menu,
  leftProd: Product | undefined,
  rightProd: Product | undefined,
): ModGroupDiff[] {
  if (!leftProd && !rightProd) return [];
  const leftGroups = leftProd?.modifierGroupRefs ?? {};
  const rightGroups = rightProd?.modifierGroupRefs ?? {};
  const allGroupIds = new Set([...Object.keys(leftGroups), ...Object.keys(rightGroups)]);
  const results: ModGroupDiff[] = [];

  for (const gid of allGroupIds) {
    const lg = leftGroups[gid] ?? leftMenu.modifierGroups?.[gid];
    const rg = rightGroups[gid] ?? rightMenu.modifierGroups?.[gid];
    const groupName = lg?.displayName ?? rg?.displayName ?? gid;

    if (!lg) {
      results.push({ groupName, groupId: gid, status: 'only-right', leftCount: 0, rightCount: Object.keys(rg?.childRefs ?? {}).length, modifierDiffs: [] });
      continue;
    }
    if (!rg) {
      results.push({ groupName, groupId: gid, status: 'only-left', leftCount: Object.keys(lg.childRefs ?? {}).length, rightCount: 0, modifierDiffs: [] });
      continue;
    }

    // Compare child modifiers
    const leftChildIds = new Set(Object.keys(lg.childRefs ?? {}));
    const rightChildIds = new Set(Object.keys(rg.childRefs ?? {}));
    const allChildIds = new Set([...leftChildIds, ...rightChildIds]);
    const modDiffs: ModGroupDiff['modifierDiffs'] = [];

    for (const cid of allChildIds) {
      const lm = leftMenu.modifiers?.[cid];
      const rm = rightMenu.modifiers?.[cid];
      const name = lm?.displayName ?? rm?.displayName ?? cid;

      if (!leftChildIds.has(cid)) {
        modDiffs.push({ name, id: cid, status: 'only-right', fields: [] });
        continue;
      }
      if (!rightChildIds.has(cid)) {
        modDiffs.push({ name, id: cid, status: 'only-left', fields: [] });
        continue;
      }

      // Both exist — compare fields
      const fields: { key: string; left: string | null; right: string | null }[] = [];
      const lPrice = lm?.price != null ? `$${lm.price.toFixed(2)}` : null;
      const rPrice = rm?.price != null ? `$${rm.price.toFixed(2)}` : null;
      if (lPrice !== rPrice) fields.push({ key: 'price', left: lPrice, right: rPrice });

      const lCal = lm?.nutrition?.totalCalories != null ? String(lm.nutrition.totalCalories) : null;
      const rCal = rm?.nutrition?.totalCalories != null ? String(rm.nutrition.totalCalories) : null;
      if (lCal !== rCal) fields.push({ key: 'calories', left: lCal, right: rCal });

      const lAvail = lm?.isAvailable != null ? String(lm.isAvailable) : null;
      const rAvail = rm?.isAvailable != null ? String(rm.isAvailable) : null;
      if (lAvail !== rAvail) fields.push({ key: 'available', left: lAvail, right: rAvail });

      const lName = lm?.displayName ?? null;
      const rName = rm?.displayName ?? null;
      if (lName !== rName) fields.push({ key: 'name', left: lName, right: rName });

      modDiffs.push({
        name,
        id: cid,
        status: fields.length > 0 ? 'changed' : 'same',
        fields,
      });
    }

    const hasChanges = modDiffs.some(m => m.status !== 'same');
    results.push({
      groupName,
      groupId: gid,
      status: hasChanges ? 'changed' : 'same',
      leftCount: leftChildIds.size,
      rightCount: rightChildIds.size,
      modifierDiffs: modDiffs,
    });
  }

  // Sort: changed first
  results.sort((a, b) => {
    const order = { 'changed': 0, 'only-left': 1, 'only-right': 2, 'same': 3 };
    return order[a.status] - order[b.status];
  });
  return results;
}
