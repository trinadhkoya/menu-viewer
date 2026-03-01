import { useState, useMemo, useCallback } from 'react';
import type { Menu, Category, Product } from '../types/menu';
import {
  getTopLevelCategories,
  isCategoryRef,
  isProductRef,
  resolveRef,
  getRefId,
  getVirtualProductAlternatives,
  resolveVirtualToDefault,
} from '../utils/menuHelpers';

/** Normalized tag group extracted from product tags */
interface TagGroup {
  prefix: string;
  label: string;
  icon: string;
  tags: { raw: string; label: string; count: number }[];
}

/** Build grouped tag stats from all products */
function buildTagGroups(menu: Menu): TagGroup[] {
  const counts = new Map<string, number>();
  for (const p of Object.values(menu.products ?? {})) {
    for (const t of p.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  }

  // Group prefixes
  const groups: Record<string, { label: string; icon: string; tags: { raw: string; label: string; count: number }[] }> = {};

  const ORDER: [string, string, string][] = [
    ['is.', 'Type', '🏷️'],
    ['protein.', 'Protein', '🥩'],
    ['spicelevel.', 'Spice', '🌶️'],
    ['allergen.', 'Allergen', '⚠️'],
    ['has.', 'Feature', '✦'],
  ];

  for (const [raw, count] of counts) {
    // skip noisy tags
    if (raw.startsWith('core_product_') || raw.startsWith('dmbSizeGroup.') || raw.startsWith('sizeBadge.')) continue;

    let matched = false;
    for (const [prefix, label, icon] of ORDER) {
      if (raw.startsWith(prefix)) {
        if (!groups[prefix]) groups[prefix] = { label, icon, tags: [] };
        // Pretty-print: "is.Drink" → "Drink", "protein.Beef" → "Beef"
        const tagLabel = raw.slice(prefix.length).replace(/([a-z])([A-Z])/g, '$1 $2');
        groups[prefix].tags.push({ raw, label: tagLabel, count });
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Ungrouped tags — only include if they're common enough
      if (count >= 3) {
        const key = '_other';
        if (!groups[key]) groups[key] = { label: 'Other', icon: '📌', tags: [] };
        groups[key].tags.push({ raw, label: raw, count });
      }
    }
  }

  // Sort tags within each group by count desc
  const result: TagGroup[] = [];
  for (const [prefix, gLabel, gIcon] of ORDER) {
    if (groups[prefix]) {
      groups[prefix].tags.sort((a, b) => b.count - a.count);
      result.push({ prefix, ...groups[prefix] });
    }
  }
  if (groups['_other']) {
    groups['_other'].tags.sort((a, b) => b.count - a.count);
    result.push({ prefix: '_other', ...groups['_other'] });
  }
  return result;
}

/** Check if a product matches the active tag filters */
function productMatchesTags(product: Product, activeTags: Set<string>): boolean {
  if (activeTags.size === 0) return true;
  const productTags = new Set(product.tags ?? []);
  for (const tag of activeTags) {
    if (productTags.has(tag)) return true;
  }
  return false;
}

interface SidebarProps {
  menu: Menu;
  selectedCategoryRef: string | null;
  selectedProductRef: string | null;
  onCategorySelect: (categoryRef: string) => void;
  onProductSelect: (productRef: string, categoryName?: string) => void;
}

export function Sidebar({
  menu,
  selectedCategoryRef,
  selectedProductRef,
  onCategorySelect,
  onProductSelect,
}: SidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [tagSectionOpen, setTagSectionOpen] = useState(false);

  const topCategories = useMemo(() => getTopLevelCategories(menu), [menu]);
  const tagGroups = useMemo(() => buildTagGroups(menu), [menu]);

  const toggleTag = useCallback((tag: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  const clearTags = useCallback(() => setActiveTags(new Set()), []);

  const toggleExpand = (ref: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) {
        next.delete(ref);
      } else {
        next.add(ref);
      }
      return next;
    });
  };

  const renderCategoryChildren = (category: Category, _categoryRef: string, depth: number = 0) => {
    if (!category.childRefs) return null;
    const childKeys = Object.keys(category.childRefs);

    return (
      <ul className="sidebar-children" style={{ paddingLeft: depth > 0 ? 12 : 0 }}>
        {childKeys.map((childRef) => {
          if (isCategoryRef(childRef)) {
            const subCat = resolveRef(menu, childRef) as Category;
            if (!subCat) return null;
            const isExpanded = expandedCategories.has(childRef);
            // Use the subcategory's own childRefs for counting/listing — NOT the parent's override value
            const subCatChildRefs = subCat.childRefs;
            const productCount = subCatChildRefs ? Object.keys(subCatChildRefs).filter(isProductRef).length : 0;

            return (
              <li key={childRef} className="sidebar-subcategory">
                <div
                  className={`sidebar-item sidebar-item--subcategory ${selectedCategoryRef === childRef ? 'sidebar-item--active' : ''}`}
                  onClick={() => {
                    toggleExpand(childRef);
                    onCategorySelect(childRef);
                  }}
                >
                  <span className="sidebar-expand-icon">{isExpanded ? '▼' : '▶'}</span>
                  <span className="sidebar-item-name">{subCat.displayName || getRefId(childRef)}</span>
                  <span className="sidebar-badge">{productCount}</span>
                </div>
                {isExpanded && subCatChildRefs && renderCategoryChildren(subCat, childRef, depth + 1)}
              </li>
            );
          } else if (isProductRef(childRef)) {
            const rawProduct = resolveRef(menu, childRef) as Product;
            if (!rawProduct) return null;

            // Filter by active tags
            if (!productMatchesTags(rawProduct, activeTags)) return null;

            // Resolve virtual products to their default sized variant
            let displayRef = childRef;
            let product = rawProduct;
            if (rawProduct.isVirtual) {
              const resolved = resolveVirtualToDefault(menu, rawProduct);
              if (resolved) {
                displayRef = resolved.ref;
                product = resolved.product;
              }
            }

            return (
              <li
                key={childRef}
                className={`sidebar-item sidebar-item--product ${selectedProductRef === displayRef ? 'sidebar-item--active' : ''}`}
                onClick={() => onProductSelect(displayRef, category.displayName)}
              >
                <span className={`availability-dot ${product.isAvailable ? 'available' : 'unavailable'}`} />
                {product.isCombo && <span className="sidebar-combo-icon">🍔+🍟</span>}
                <span className="sidebar-item-name">{product.displayName || getRefId(displayRef)}</span>
                {product.price != null && <span className="sidebar-price">${product.price.toFixed(2)}</span>}
              </li>
            );
          }
          return null;
        })}
      </ul>
    );
  };

  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <h2>Categories</h2>
        <span className="sidebar-count">{topCategories.length}</span>
      </div>

      {/* ── Tag Filter Section ── */}
      {tagGroups.length > 0 && (
        <div className="sidebar-tag-filter">
          <button
            className={`sidebar-tag-toggle ${tagSectionOpen ? 'sidebar-tag-toggle--open' : ''}`}
            onClick={() => setTagSectionOpen((v) => !v)}
          >
            <span className="sidebar-tag-toggle-icon">{tagSectionOpen ? '▾' : '▸'}</span>
            <span>Filter by Tag</span>
            {activeTags.size > 0 && (
              <span className="sidebar-tag-active-count">{activeTags.size}</span>
            )}
          </button>
          {tagSectionOpen && (
            <div className="sidebar-tag-groups">
              {tagGroups.map((group) => (
                <div key={group.prefix} className="sidebar-tag-group">
                  <div className="sidebar-tag-group-label">
                    <span>{group.icon}</span> {group.label}
                  </div>
                  <div className="sidebar-tag-pills">
                    {group.tags.map((tag) => (
                      <button
                        key={tag.raw}
                        className={`sidebar-tag-pill ${activeTags.has(tag.raw) ? 'sidebar-tag-pill--active' : ''}`}
                        onClick={() => toggleTag(tag.raw)}
                        title={tag.raw}
                      >
                        {tag.label}
                        <span className="sidebar-tag-pill-count">{tag.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {activeTags.size > 0 && (
                <button className="sidebar-tag-clear" onClick={clearTags}>
                  ✕ Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <ul className="sidebar-list">
        {topCategories.map(({ ref, category }) => {
          const isExpanded = expandedCategories.has(ref);
          const childCount = category.childRefs ? Object.keys(category.childRefs).length : 0;

          return (
            <li key={ref} className="sidebar-category">
              <div
                className={`sidebar-item sidebar-item--category ${selectedCategoryRef === ref ? 'sidebar-item--active' : ''}`}
                onClick={() => {
                  toggleExpand(ref);
                  onCategorySelect(ref);
                }}
              >
                <span className="sidebar-expand-icon">{isExpanded ? '▼' : '▶'}</span>
                <span className="sidebar-item-name">{category.displayName || getRefId(ref)}</span>
                <span className="sidebar-badge">{childCount}</span>
              </div>
              {isExpanded && renderCategoryChildren(category, ref, 1)}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
