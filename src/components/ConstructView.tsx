import { useMemo, useState, useCallback, useRef, memo } from 'react';
import type { Menu } from '../types/menu';
import type { ClassifiedProduct } from '../utils/constructClassifier';
import {
  CONSTRUCTS,
  classifyAllProducts,
  getPrimaryTypeStats,
  getStructuralTagStats,
  getMainCategoryStats,
  getCategorySkeletons,
  filterProducts,
  getConstruct,
  getStructuralTag,
} from '../utils/constructClassifier';
import type { CategorySkeleton } from '../utils/constructClassifier';
import { getRefId } from '../utils/menuHelpers';
import { ConstructTypePill } from './ConstructBadge';
import { OptimizedImage } from './OptimizedImage';
import { CopyRef } from './CopyRef';
import type { BrandId } from './MenuUploader';
import { getProductPlaceholder } from '../utils/placeholderImage';

interface ConstructViewProps {
  menu: Menu;
  onProductSelect: (productRef: string) => void;
  activeBrand?: BrandId | null;
}

// ─── Tag-group helpers (moved from Sidebar) ───

interface TagGroup {
  prefix: string;
  label: string;
  icon: string;
  tags: { raw: string; label: string; count: number }[];
}

const TAG_ORDER: [string, string, string][] = [
  ['is.', 'Type', '🏷️'],
  ['protein.', 'Protein', '🥩'],
  ['spicelevel.', 'Spice', '🌶️'],
  ['allergen.', 'Allergen', '⚠️'],
  ['has.', 'Feature', '✦'],
];

function buildTagGroups(items: ClassifiedProduct[]): TagGroup[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const t of item.product.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  }

  const groups: Record<string, { label: string; icon: string; tags: { raw: string; label: string; count: number }[] }> = {};

  for (const [raw, count] of counts) {
    if (raw.startsWith('core_product_') || raw.startsWith('dmbSizeGroup.') || raw.startsWith('sizeBadge.')) continue;

    let matched = false;
    for (const [prefix, label, icon] of TAG_ORDER) {
      if (raw.startsWith(prefix)) {
        if (!groups[prefix]) groups[prefix] = { label, icon, tags: [] };
        const tagLabel = raw.slice(prefix.length).replace(/([a-z])([A-Z])/g, '$1 $2');
        groups[prefix].tags.push({ raw, label: tagLabel, count });
        matched = true;
        break;
      }
    }
    if (!matched && count >= 3) {
      const key = '_other';
      if (!groups[key]) groups[key] = { label: 'Other', icon: '📌', tags: [] };
      groups[key].tags.push({ raw, label: raw, count });
    }
  }

  const result: TagGroup[] = [];
  for (const [prefix] of TAG_ORDER) {
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

// ────────────────────────────────────────────

const INITIAL_LIMIT = 120;
const LOAD_BATCH = 120;

export function ConstructView({ menu, onProductSelect, activeBrand }: ConstructViewProps) {
  const productGridRef = useRef<HTMLDivElement>(null);

  const scrollToProducts = useCallback(() => {
    requestAnimationFrame(() => {
      productGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const [activeMainCategory, setActiveMainCategory] = useState<string | null>(null);
  const [activePrimary, setActivePrimary] = useState<string | null>(null);
  const [activePrimarySet, setActivePrimarySet] = useState<Set<string>>(new Set());
  const [activeBehavioral, setActiveBehavioral] = useState<string | null>(null);
  const [activeStructuralTag, setActiveStructuralTag] = useState<string | null>(null);
  const [activeStructuralSet, setActiveStructuralSet] = useState<Set<string>>(new Set());
  const [activeProductTags, setActiveProductTags] = useState<Set<string>>(new Set());
  const [andMode, setAndMode] = useState(false);
  const [primaryOpen, setPrimaryOpen] = useState(false);
  const [structuralOpen, setStructuralOpen] = useState(false);
  const [tagSectionOpen, setTagSectionOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [inspecting, setInspecting] = useState<ClassifiedProduct | null>(null);
  const [showReference, setShowReference] = useState(false);

  // Auto-expand accordion when filter is active
  const isPrimaryExpanded = primaryOpen || !!activePrimary || activePrimarySet.size > 0;
  const isStructuralExpanded = structuralOpen || !!activeStructuralTag || activeStructuralSet.size > 0;
  const isTagsExpanded = tagSectionOpen || activeProductTags.size > 0;

  // Classify all products once
  const classified = useMemo(() => classifyAllProducts(menu), [menu]);
  const mainCategoryStats = useMemo(() => getMainCategoryStats(classified), [classified]);
  const primaryStats = useMemo(() => getPrimaryTypeStats(classified), [classified]);
  const structuralTagStats = useMemo(() => getStructuralTagStats(classified), [classified]);
  const tagGroups = useMemo(() => buildTagGroups(classified), [classified]);
  const categorySkeletons = useMemo(() => getCategorySkeletons(classified), [classified]);

  // Build a lookup map from category ref → skeleton
  const skeletonMap = useMemo(() => {
    const map = new Map<string, CategorySkeleton>();
    for (const sk of categorySkeletons) map.set(sk.ref, sk);
    return map;
  }, [categorySkeletons]);

  // Which skeleton detail panel is expanded
  const [expandedSkeleton, setExpandedSkeleton] = useState<string | null>(null);

  // Progressive product loading
  const [displayLimit, setDisplayLimit] = useState(INITIAL_LIMIT);

  const toggleProductTag = useCallback((tag: string) => {
    setActiveProductTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
    setInspecting(null);
    setDisplayLimit(INITIAL_LIMIT);
    scrollToProducts();
  }, [scrollToProducts]);

  const clearProductTags = useCallback(() => {
    setActiveProductTags(new Set());
    setInspecting(null);
    setDisplayLimit(INITIAL_LIMIT);
  }, []);

  // Filtered products
  const filtered = useMemo(
    () =>
      filterProducts(classified, {
        mainCategory: activeMainCategory,
        primaryType: andMode ? null : activePrimary,
        primaryTypes: andMode && activePrimarySet.size > 0 ? activePrimarySet : null,
        behavioralTag: activeBehavioral,
        structuralTag: andMode ? null : activeStructuralTag,
        structuralTags: andMode && activeStructuralSet.size > 0 ? activeStructuralSet : null,
        productTags: activeProductTags.size > 0 ? activeProductTags : null,
        search: searchTerm.trim(),
      }),
    [classified, activeMainCategory, activePrimary, activePrimarySet, activeBehavioral, activeStructuralTag, activeStructuralSet, activeProductTags, searchTerm, andMode],
  );

  const toggleMainCategory = useCallback((ref: string) => {
    setActiveMainCategory((prev) => (prev === ref ? null : ref));
    setInspecting(null);
    setDisplayLimit(INITIAL_LIMIT);
    scrollToProducts();
  }, [scrollToProducts]);

  const togglePrimary = useCallback((id: string) => {
    if (andMode) {
      setActivePrimarySet((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    } else {
      setActivePrimary((prev) => (prev === id ? null : id));
      setActiveBehavioral(null);
      setActiveStructuralTag(null);
    }
    setInspecting(null);
    setDisplayLimit(INITIAL_LIMIT);
    scrollToProducts();
  }, [scrollToProducts, andMode]);

  const toggleBehavioral = useCallback((id: string) => {
    setActiveBehavioral((prev) => (prev === id ? null : id));
    if (!andMode) {
      setActivePrimary(null);
      setActiveStructuralTag(null);
    }
    setInspecting(null);
    setDisplayLimit(INITIAL_LIMIT);
    scrollToProducts();
  }, [scrollToProducts, andMode]);

  const toggleStructuralTag = useCallback((tag: string) => {
    if (andMode) {
      setActiveStructuralSet((prev) => {
        const next = new Set(prev);
        if (next.has(tag)) next.delete(tag); else next.add(tag);
        return next;
      });
    } else {
      setActiveStructuralTag((prev) => (prev === tag ? null : tag));
      setActivePrimary(null);
      setActiveBehavioral(null);
    }
    setInspecting(null);
    setDisplayLimit(INITIAL_LIMIT);
    scrollToProducts();
  }, [scrollToProducts, andMode]);

  // Toggle AND mode — migrate current single selection into set, or vice-versa
  const handleAndModeToggle = useCallback(() => {
    setAndMode((prev) => {
      const next = !prev;
      if (next) {
        // switching to AND mode — move single selections into sets
        if (activePrimary) {
          setActivePrimarySet(new Set([activePrimary]));
          setActivePrimary(null);
        }
        if (activeStructuralTag) {
          setActiveStructuralSet(new Set([activeStructuralTag]));
          setActiveStructuralTag(null);
        }
      } else {
        // switching back to single mode — take first from set
        setActivePrimarySet((s) => { if (s.size > 0) setActivePrimary([...s][0]); return new Set(); });
        setActiveStructuralSet((s) => { if (s.size > 0) setActiveStructuralTag([...s][0]); return new Set(); });
      }
      return next;
    });
  }, [activePrimary, activeStructuralTag]);

  const clearAll = useCallback(() => {
    setActiveMainCategory(null);
    setActivePrimary(null);
    setActivePrimarySet(new Set());
    setActiveBehavioral(null);
    setActiveStructuralTag(null);
    setActiveStructuralSet(new Set());
    setActiveProductTags(new Set());
    setSearchTerm('');
    setInspecting(null);
    setDisplayLimit(INITIAL_LIMIT);
  }, []);

  const hasActiveFilters = activeMainCategory || activePrimary || activePrimarySet.size > 0 || activeBehavioral || activeStructuralTag || activeStructuralSet.size > 0 || activeProductTags.size > 0 || searchTerm;

  return (
    <div className="construct-view">
      {/* ── Top bar: title + count + search ── */}
      <div className="cv-topbar">
        <div className="cv-topbar-left">
          <h2 className="cv-title">Menu Constructs</h2>
          <span className="cv-item-count">{filtered.length} items</span>
        </div>
        <div className="cv-topbar-right">
          <div className="cv-search-bar">
            <span className="cv-search-icon">⌕</span>
            <input
              type="text"
              placeholder="Search products…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="cv-search-input"
            />
          </div>
        </div>
      </div>

      {/* ── Quick filter pills bar — only visible when filters are active ── */}
      {hasActiveFilters && (
        <div className="cv-quick-bar">
          <span className="cv-quick-label">FILTERS</span>
          {activePrimary && primaryStats.filter(s => s.constructId === activePrimary).map((s) => (
            <button
              key={s.constructId}
              className="cv-quick-pill cv-quick-pill--active"
              onClick={() => togglePrimary(s.constructId)}
            >
              {s.construct.icon} {s.construct.shortName}
              <span className="cv-quick-pill-chevron">✕</span>
            </button>
          ))}
          {[...activePrimarySet].map((id) => {
            const s = primaryStats.find(p => p.constructId === id);
            return s ? (
              <button
                key={id}
                className="cv-quick-pill cv-quick-pill--active"
                onClick={() => togglePrimary(id)}
              >
                {s.construct.icon} {s.construct.shortName}
                <span className="cv-quick-pill-chevron">✕</span>
              </button>
            ) : null;
          })}
          {activeStructuralTag && structuralTagStats.filter(s => s.tagId === activeStructuralTag).map((s) => (
            <button
              key={s.tagId}
              className="cv-quick-pill cv-quick-pill--active"
              onClick={() => toggleStructuralTag(s.tagId)}
            >
              {s.tag.icon} {s.tag.shortName}
              <span className="cv-quick-pill-chevron">✕</span>
            </button>
          ))}
          {[...activeStructuralSet].map((id) => {
            const s = structuralTagStats.find(st => st.tagId === id);
            return s ? (
              <button
                key={id}
                className="cv-quick-pill cv-quick-pill--active"
                onClick={() => toggleStructuralTag(id)}
              >
                {s.tag.icon} {s.tag.shortName}
                <span className="cv-quick-pill-chevron">✕</span>
              </button>
            ) : null;
          })}
          {[...activeProductTags].map((tag) => (
            <button
              key={tag}
              className="cv-quick-pill cv-quick-pill--active"
              onClick={() => toggleProductTag(tag)}
            >
              {tag.replace(/^[^:]+:/, '')}
              <span className="cv-quick-pill-chevron">✕</span>
            </button>
          ))}
          {searchTerm && (
            <span className="cv-quick-pill cv-quick-pill--active" onClick={() => setSearchTerm('')}>
              "{searchTerm}"
              <span className="cv-quick-pill-chevron">✕</span>
            </span>
          )}
          <button className="cv-quick-clear" onClick={clearAll}>✕ Clear All</button>
        </div>
      )}

      {/* ── Two-column layout: filters left, grid right ── */}
      <div className="cv-layout">
        {/* ── Left: Filter Sidebar ── */}
        <aside className="cv-filter-sidebar">
          {/* AND / Multi-select toggle */}
          <div className="cvf-mode-toggle">
            <label className="cv-and-toggle" title="Enable multi-select (intersection) filtering">
              <span className={`cv-and-label ${!andMode ? 'cv-and-label--active' : ''}`}>Single</span>
              <span className={`cv-toggle-switch ${andMode ? 'cv-toggle-switch--on' : ''}`} onClick={handleAndModeToggle}>
                <span className="cv-toggle-knob" />
              </span>
              <span className={`cv-and-label ${andMode ? 'cv-and-label--active' : ''}`}>Multi</span>
            </label>
          </div>

          {/* Construct Reference — highlighted at top */}
          <div className="cvf-section cvf-section--highlight">
            <button
              className="cvf-section-header cvf-section-header--toggle"
              onClick={() => setShowReference((p) => !p)}
            >
              📋 REFERENCE
              <span className="cvf-toggle-arrow">{showReference ? '▴' : '▾'}</span>
            </button>
            {showReference && (
              <div className="cvf-reference-content">
                <ConstructReference
                  classified={classified}
                  activePrimary={activePrimary}
                  activeBehavioral={activeBehavioral}
                  onSelectPrimary={togglePrimary}
                  onSelectBehavioral={toggleBehavioral}
                />
              </div>
            )}
          </div>

          {/* Primary Type — accordion */}
          <div className="cvf-section">
            <button
              className="cvf-section-header cvf-section-header--toggle"
              onClick={() => setPrimaryOpen((v) => !v)}
            >
              PRIMARY TYPE
              {(activePrimary || activePrimarySet.size > 0) && (
                <span className="cvf-active-badge">{andMode ? activePrimarySet.size : 1}</span>
              )}
              <span className="cvf-toggle-arrow">{isPrimaryExpanded ? '▴' : '▾'}</span>
            </button>
            {isPrimaryExpanded && (
              <div className="cvf-checkbox-list">
                {primaryStats.map((s) => {
                  const isChecked = andMode ? activePrimarySet.has(s.constructId) : activePrimary === s.constructId;
                  return (
                    <label key={s.constructId} className={`cvf-checkbox-item ${isChecked ? 'cvf-checkbox-item--active' : ''}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => togglePrimary(s.constructId)}
                      />
                      <span className="cvf-checkbox-icon">{s.construct.icon}</span>
                      <span className="cvf-checkbox-label">{s.construct.shortName}</span>
                      <span className="cvf-checkbox-count">({s.count})</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Structural Tags — accordion */}
          <div className="cvf-section">
            <button
              className="cvf-section-header cvf-section-header--toggle"
              onClick={() => setStructuralOpen((v) => !v)}
            >
              STRUCTURAL TAGS
              {(activeStructuralTag || activeStructuralSet.size > 0) && (
                <span className="cvf-active-badge">{andMode ? activeStructuralSet.size : 1}</span>
              )}
              <span className="cvf-toggle-arrow">{isStructuralExpanded ? '▴' : '▾'}</span>
            </button>
            {isStructuralExpanded && (
              <div className="cvf-checkbox-list">
                {structuralTagStats.map((s) => {
                  const isChecked = andMode ? activeStructuralSet.has(s.tagId) : activeStructuralTag === s.tagId;
                  return (
                    <label key={s.tagId} className={`cvf-checkbox-item ${isChecked ? 'cvf-checkbox-item--active' : ''}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleStructuralTag(s.tagId)}
                      />
                      <span className="cvf-checkbox-icon">{s.tag.icon}</span>
                      <span className="cvf-checkbox-label">{s.tag.shortName}</span>
                      <span className="cvf-checkbox-count">({s.count})</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Product Tags — accordion */}
          {tagGroups.length > 0 && (
            <div className="cvf-section">
              <button
                className="cvf-section-header cvf-section-header--toggle"
                onClick={() => setTagSectionOpen((v) => !v)}
              >
                PRODUCT TAGS
                {activeProductTags.size > 0 && (
                  <span className="cvf-active-badge">{activeProductTags.size}</span>
                )}
                <span className="cvf-toggle-arrow">{isTagsExpanded ? '▴' : '▾'}</span>
              </button>
              {isTagsExpanded && (
                <div className="cvf-tag-groups">
                  {tagGroups.map((group) => (
                    <div key={group.prefix} className="cvf-tag-group">
                      <div className="cvf-tag-group-label">
                        <span>{group.icon}</span> {group.label}
                      </div>
                      <div className="cvf-checkbox-list">
                        {group.tags.map((tag) => (
                          <label key={tag.raw} className={`cvf-checkbox-item ${activeProductTags.has(tag.raw) ? 'cvf-checkbox-item--active' : ''}`}>
                            <input
                              type="checkbox"
                              checked={activeProductTags.has(tag.raw)}
                              onChange={() => toggleProductTag(tag.raw)}
                            />
                            <span className="cvf-checkbox-label">{tag.label}</span>
                            <span className="cvf-checkbox-count">({tag.count})</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  {activeProductTags.size > 0 && (
                    <button className="cvf-clear-link" onClick={clearProductTags}>
                      ✕ Clear tag filters
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </aside>

        {/* ── Right: Product Grid ── */}
        <div className="cv-content">
          {/* Product Inspector */}
          {inspecting && (
            <ProductInspector
              item={inspecting}
              onClose={() => setInspecting(null)}
              onProductSelect={onProductSelect}
            />
          )}

          {/* Product Grid */}
          <div ref={productGridRef} className="construct-product-grid">
            {filtered.slice(0, displayLimit).map((item) => (
              <ProductCard
                key={item.ref}
                item={item}
                onSelect={onProductSelect}
                onInspect={setInspecting}
                activeBrand={activeBrand}
              />
            ))}
            {filtered.length > displayLimit && (
              <button
                className="construct-more construct-more--interactive"
                onClick={() => setDisplayLimit((prev) => prev + LOAD_BATCH)}
              >
                <span className="construct-more-icon">▼</span>
                Show {Math.min(LOAD_BATCH, filtered.length - displayLimit)} more
                <span className="construct-more-remaining">
                  ({filtered.length - displayLimit} remaining)
                </span>
              </button>
            )}
            {filtered.length > INITIAL_LIMIT && displayLimit > INITIAL_LIMIT && filtered.length <= displayLimit && (
              <button
                className="construct-more construct-more--interactive construct-more--collapse"
                onClick={() => setDisplayLimit(INITIAL_LIMIT)}
              >
                <span className="construct-more-icon">▲</span>
                Show less
              </button>
            )}
            {filtered.length === 0 && (
              <div className="construct-empty">No products match the current filters.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Construct Reference Table — shows all 25 MBDP constructs
// ─────────────────────────────────────────────

interface ConstructReferenceProps {
  classified: ClassifiedProduct[];
  activePrimary: string | null;
  activeBehavioral: string | null;
  onSelectPrimary: (id: string) => void;
  onSelectBehavioral: (id: string) => void;
}

const ConstructReference = memo(function ConstructReference({
  classified,
  activePrimary,
  activeBehavioral,
  onSelectPrimary,
  onSelectBehavioral,
}: ConstructReferenceProps) {
  // Compute counts for primary types
  const primaryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of classified) {
      counts.set(item.primaryType, (counts.get(item.primaryType) ?? 0) + 1);
    }
    return counts;
  }, [classified]);

  // Compute counts for behavioral tags
  const behavioralCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of classified) {
      for (const tag of item.behavioralTags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return counts;
  }, [classified]);

  return (
    <div className="construct-reference">
      <div className="construct-reference-section">
        <h3>Single Product Constructs</h3>
        <div className="construct-reference-grid">
          {CONSTRUCTS.filter((c) => c.category === 'single' && !c.id.startsWith('#'))
            .sort((a, b) => (primaryCounts.get(b.id) ?? 0) - (primaryCounts.get(a.id) ?? 0))
            .map((c) => {
            const count = primaryCounts.get(c.id) ?? 0;
            const isActive = activePrimary === c.id;
            return (
              <button
                key={c.id}
                className={`construct-reference-card ${isActive ? 'construct-reference-card--active' : ''} ${count === 0 ? 'construct-reference-card--empty' : ''}`}
                onClick={() => count > 0 && onSelectPrimary(c.id)}
                type="button"
                title={`${c.engineeringTerm}\n${c.description}`}
              >
                <div className="construct-ref-card-header">
                  <span className="construct-ref-card-icon">{c.icon}</span>
                  <span className="construct-ref-card-id">{c.id}</span>
                  <span className="construct-ref-card-short">{c.shortName}</span>
                  {count > 0 && <span className="construct-ref-card-count">{count}</span>}
                </div>
                <div className="construct-ref-card-name">{c.name}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="construct-reference-section">
        <h3>Behavioral Sub-Constructs</h3>
        <div className="construct-reference-grid">
          {CONSTRUCTS.filter((c) => c.category === 'single' && c.id.startsWith('#'))
            .sort((a, b) => (behavioralCounts.get(b.id) ?? 0) - (behavioralCounts.get(a.id) ?? 0))
            .map((c) => {
            const count = behavioralCounts.get(c.id) ?? 0;
            const isActive = activeBehavioral === c.id;
            return (
              <button
                key={c.id}
                className={`construct-reference-card construct-reference-card--behavioral ${isActive ? 'construct-reference-card--active' : ''} ${count === 0 ? 'construct-reference-card--empty' : ''}`}
                onClick={() => count > 0 && onSelectBehavioral(c.id)}
                type="button"
                title={`${c.engineeringTerm}\n${c.description}`}
              >
                <div className="construct-ref-card-header">
                  <span className="construct-ref-card-icon">{c.icon}</span>
                  <span className="construct-ref-card-id">{c.id}</span>
                  <span className="construct-ref-card-short">{c.shortName}</span>
                  {count > 0 && <span className="construct-ref-card-count">{count}</span>}
                </div>
                <div className="construct-ref-card-name">{c.name}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="construct-reference-section">
        <h3>Combo / Meal / Bundle Constructs</h3>
        <div className="construct-reference-grid">
          {CONSTRUCTS.filter((c) => c.category === 'combo').map((c) => (
            <div
              key={c.id}
              className="construct-reference-card construct-reference-card--combo"
              title={`${c.engineeringTerm}\n${c.description}`}
            >
              <div className="construct-ref-card-header">
                <span className="construct-ref-card-icon">{c.icon}</span>
                <span className="construct-ref-card-id">{c.id}</span>
                <span className="construct-ref-card-short">{c.shortName}</span>
              </div>
              <div className="construct-ref-card-name">{c.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────
// Product Card
// ─────────────────────────────────────────────

const ProductCard = memo(function ProductCard({
  item,
  onSelect,
  onInspect,
  activeBrand,
}: {
  item: ClassifiedProduct;
  onSelect: (ref: string) => void;
  onInspect: (item: ClassifiedProduct) => void;
  activeBrand?: BrandId | null;
}) {
  const { product } = item;

  const handleSelect = useCallback(() => onSelect(item.ref), [onSelect, item.ref]);
  const handleInspect = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onInspect(item);
  }, [onInspect, item]);

  return (
    <div className="construct-product-card" onClick={handleSelect}>
      <OptimizedImage
        src={product.imageUrl || getProductPlaceholder(activeBrand)}
        alt={product.displayName ?? ''}
        className="construct-card-image"
        isCombo={product.isCombo}
      />
      <div className="construct-card-body">
        <div className="construct-card-header">
          <span
            className={`availability-dot ${product.isAvailable ? 'available' : 'unavailable'}`}
          />
          <span className="construct-card-name">
            {product.displayName || getRefId(item.ref)}
          </span>
        </div>
        <CopyRef
          value={item.ref}
          display={getRefId(item.ref)}
          className="construct-card-ref"
        />
        <div className="construct-card-meta">
          {product.price != null && (
            <span className="construct-card-price">
              ${product.price.toFixed(2)}
            </span>
          )}
          {product.calories != null && (
            <span className="construct-card-cal">{product.calories} cal</span>
          )}
          {item.bundleTargetRef && (
            <span className="construct-card-bundle" title={`Bundle → ${item.bundleTargetName}`}>
              🔗 {item.bundleTargetName || 'Meal'}
            </span>
          )}
          {item.bundleSources && item.bundleSources.length > 0 && (
            <span className="construct-card-bundle construct-card-bundle--target" title={`Bundled from ${item.bundleSources.length} product(s)`}>
              🍱 {item.bundleSources.length} source{item.bundleSources.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          className="construct-inspect-btn"
          onClick={handleInspect}
          title="Inspect construct details"
        >
          🔍
        </button>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────
// Product Inspector — detailed construct analysis
// ─────────────────────────────────────────────

function ProductInspector({
  item,
  onClose,
  onProductSelect,
}: {
  item: ClassifiedProduct;
  onClose: () => void;
  onProductSelect: (ref: string) => void;
}) {
  const { product, primaryConstruct, behavioralTags, structuralTags, flags } = item;

  return (
    <div className="construct-inspector-overlay" onClick={onClose}>
      <div className="construct-inspector" onClick={(e) => e.stopPropagation()}>
        <button className="construct-inspector-close" onClick={onClose}>
          ✕
        </button>

        {/* Title */}
        <div className="construct-inspector-title">
          <h3>{product.displayName || getRefId(item.ref)}</h3>
          <CopyRef value={item.ref} display={getRefId(item.ref)} />
        </div>

        {/* Primary Type */}
        <section className="inspector-section">
          <h4>Primary Construct Type</h4>
          <div className="inspector-construct-match">
            <span
              className="inspector-construct-badge"
              style={{ '--construct-color': primaryConstruct.color } as React.CSSProperties}
            >
              {primaryConstruct.icon} {primaryConstruct.id}: {primaryConstruct.shortName}
            </span>
            <p className="inspector-construct-name">{primaryConstruct.name}</p>
            <p className="inspector-construct-desc">{primaryConstruct.description}</p>
            <p className="inspector-construct-eng">
              <strong>Engineering Term:</strong> {primaryConstruct.engineeringTerm}
            </p>
          </div>
        </section>

        {/* Structural Flags */}
        <section className="inspector-section">
          <h4>Structural Flags</h4>
          <div className="inspector-flags-grid">
            {Object.entries(flags).map(([key, value]) => (
              <div
                key={key}
                className={`inspector-flag-item ${value ? 'inspector-flag-item--on' : 'inspector-flag-item--off'}`}
              >
                <span className="inspector-flag-label">{key}</span>
                <span className="inspector-flag-value">
                  {value ? '✓ true' : '✕ false'}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Classification Reasoning */}
        <section className="inspector-section">
          <h4>Why {primaryConstruct.id}?</h4>
          <div className="inspector-reasoning">
            {flags.isVirtual ? (
              <p>
                <strong>isVirtual = true</strong> → Construct <strong>2</strong> (Virtual Product).
                This product does not exist in the POS and houses multiple PLUs.
              </p>
            ) : (
              <>
                <p>
                  <strong>Has alternatives (relatedProducts):</strong>{' '}
                  {flags.hasAlternatives ? '✓ Yes' : '✕ No'} →{' '}
                  {flags.hasAlternatives ? 'Sized (1B__)' : 'No Size (1A__)'}
                </p>
                <p>
                  <strong>Has ingredientRefs:</strong>{' '}
                  {flags.hasIngredientRefs ? '✓ Yes' : '✕ No'} →{' '}
                  {flags.hasIngredientRefs ? 'Customizable (__BB)' : 'Not Customizable (__AA)'}
                </p>
                <p>
                  Combined: <strong>{primaryConstruct.id}</strong> — {primaryConstruct.shortName}
                </p>
                {flags.hasBundleLink && (
                  <p>
                    <strong>🔗 Bundle link:</strong> This product has a <code>relatedProducts.bundle</code> reference linking it to a combo/meal counterpart.
                  </p>
                )}
              </>
            )}
          </div>
        </section>

        {/* Bundle Reference Links */}
        {(item.bundleTargetRef || (item.bundleSources && item.bundleSources.length > 0)) && (
          <section className="inspector-section">
            <h4>🔗 Bundle References</h4>
            <div className="inspector-bundle-links">
              {item.bundleTargetRef && (
                <div className="inspector-bundle-link">
                  <span className="inspector-bundle-label">Bundle target (meal/combo):</span>
                  <button
                    className="inspector-bundle-ref-btn"
                    onClick={() => onProductSelect(item.bundleTargetRef!)}
                    title={`Navigate to ${item.bundleTargetName}`}
                  >
                    🍱 {item.bundleTargetName || item.bundleTargetRef}
                    <span className="inspector-bundle-ref-id">
                      {item.bundleTargetRef.replace('products.', '')}
                    </span>
                    <span className="inspector-bundle-arrow">→</span>
                  </button>
                </div>
              )}
              {item.bundleSources && item.bundleSources.length > 0 && (
                <div className="inspector-bundle-link">
                  <span className="inspector-bundle-label">
                    Bundled from ({item.bundleSources.length} source{item.bundleSources.length > 1 ? 's' : ''}):
                  </span>
                  <div className="inspector-bundle-sources">
                    {item.bundleSources.map((src) => (
                      <button
                        key={src.ref}
                        className="inspector-bundle-ref-btn"
                        onClick={() => onProductSelect(src.ref)}
                        title={`Navigate to ${src.name}`}
                      >
                        🔙 {src.name}
                        <span className="inspector-bundle-ref-id">
                          {src.ref.replace('products.', '')}
                        </span>
                        <span className="inspector-bundle-arrow">→</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Behavioral Tags */}
        {behavioralTags.length > 0 && (
          <section className="inspector-section">
            <h4>Detected Behavioral Constructs</h4>
            <div className="inspector-behavioral-list">
              {behavioralTags.map((tag) => {
                const c = getConstruct(tag);
                if (!c) return null;
                return (
                  <div key={tag} className="inspector-behavioral-item">
                    <span
                      className="inspector-behavioral-badge"
                      style={{ '--construct-color': c.color } as React.CSSProperties}
                    >
                      {c.icon} {c.id}: {c.shortName}
                    </span>
                    <p className="inspector-behavioral-desc">{c.description}</p>
                    <p className="inspector-behavioral-eng">
                      <em>Eng: {c.engineeringTerm}</em>
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Structural Tags */}
        {structuralTags.length > 0 && (
          <section className="inspector-section">
            <h4>Structural Tags</h4>
            <div className="inspector-behavioral-list">
              {structuralTags.map((tagId) => {
                const t = getStructuralTag(tagId);
                if (!t) return null;
                return (
                  <div key={tagId} className="inspector-behavioral-item">
                    <span
                      className="inspector-behavioral-badge"
                      style={{ '--construct-color': t.color } as React.CSSProperties}
                    >
                      {t.icon} {t.shortName}
                    </span>
                    <p className="inspector-behavioral-desc">{t.description}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Quick Data Summary */}
        <section className="inspector-section">
          <h4>Product Data</h4>
          <div className="inspector-data-grid">
            <DataItem label="Price" value={product.price != null ? `$${product.price.toFixed(2)}` : '—'} />
            <DataItem label="Calories" value={product.calories != null ? `${product.calories} cal` : '—'} />
            <DataItem label="PLU" value={product.PLU != null ? String(product.PLU) : '—'} />
            <DataItem label="Available" value={product.isAvailable != null ? String(product.isAvailable) : '—'} />
            <DataItem label="Ingredients" value={product.ingredientRefs ? `${Object.keys(product.ingredientRefs).length} groups` : '—'} />
            <DataItem label="Related" value={product.relatedProducts ? `${Object.keys(product.relatedProducts).length} products` : '—'} />
            <DataItem label="Modifiers" value={product.modifierGroupRefs ? `${Object.keys(product.modifierGroupRefs).length} groups` : '—'} />
            <DataItem label="Tags" value={product.tags?.length ? product.tags.join(', ') : '—'} />
          </div>
        </section>

        {/* Actions */}
        <div className="inspector-actions">
          <button
            className="inspector-action-btn"
            onClick={() => onProductSelect(item.ref)}
          >
            View Full Detail →
          </button>
        </div>
      </div>
    </div>
  );
}

function DataItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="inspector-data-item">
      <span className="inspector-data-label">{label}</span>
      <span className="inspector-data-value">{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton Detail Panel — shows product schema analysis for a category
// ─────────────────────────────────────────────

const FREQ_COLORS: Record<string, string> = {
  always: '#22c55e',
  common: '#3b82f6',
  sometimes: '#f59e0b',
  rare: '#ef4444',
};

function SkeletonDetailPanel({
  skeleton,
  onClose,
}: {
  skeleton: CategorySkeleton;
  onClose: () => void;
}) {
  const [showAllFields, setShowAllFields] = useState(false);
  const visibleFields = showAllFields ? skeleton.fields : skeleton.fields.slice(0, 12);

  return (
    <div className="skeleton-detail-panel">
      <div className="skeleton-detail-header">
        <div className="skeleton-detail-title">
          <span className="skeleton-detail-icon">🧬</span>
          <div>
            <h4>{skeleton.name} — Product Schema</h4>
            <span className="skeleton-detail-code">{skeleton.skeletonCode}</span>
          </div>
        </div>
        <button className="skeleton-detail-close" onClick={onClose}>✕</button>
      </div>

      <div className="skeleton-detail-name">
        <span className={`skeleton-name-tag ${skeleton.isHomogeneous ? 'skeleton-name-tag--homo' : 'skeleton-name-tag--mixed'}`}>
          {skeleton.isHomogeneous ? '✓ Homogeneous' : `⚠ ${skeleton.shapeCount} distinct shapes`}
        </span>
        <span className="skeleton-product-count">{skeleton.productCount} products</span>
        <span className="skeleton-product-count">{skeleton.fields.length} fields detected</span>
      </div>

      {/* ── Schema Shapes ── */}
      <div className="skeleton-section">
        <div className="skeleton-section-label">Schema Shapes (product fingerprints)</div>
        <div className="skeleton-shapes">
          {skeleton.shapes.slice(0, 8).map((shape) => (
            <div
              key={shape.fingerprint}
              className={`skeleton-shape-row ${shape.fingerprint === skeleton.dominantShape.fingerprint ? 'skeleton-shape-row--dominant' : ''}`}
            >
              <div className="skeleton-shape-header">
                <code className="skeleton-shape-fp">{shape.fingerprint}</code>
                <span className="skeleton-shape-pct-badge">{shape.pct}%</span>
                <span className="skeleton-shape-count">{shape.count} products</span>
              </div>
              <div className="skeleton-shape-name">{shape.shapeName}</div>
              <div className="skeleton-shape-bar-track">
                <div
                  className="skeleton-shape-bar-fill"
                  style={{ width: `${shape.pct}%` }}
                />
              </div>
              <div className="skeleton-shape-examples">
                {shape.examples.map((ex, i) => (
                  <span key={i} className="skeleton-shape-example">{ex}</span>
                ))}
              </div>
            </div>
          ))}
          {skeleton.shapes.length > 8 && (
            <div className="skeleton-shape-more">+{skeleton.shapes.length - 8} more shapes</div>
          )}
        </div>
      </div>

      {/* ── Field Presence Table ── */}
      <div className="skeleton-section">
        <div className="skeleton-section-label">Field Presence</div>
        <div className="skeleton-field-table">
          <div className="skeleton-field-header-row">
            <span className="skeleton-field-col-name">Field</span>
            <span className="skeleton-field-col-freq">Frequency</span>
            <span className="skeleton-field-col-bar">Presence</span>
            <span className="skeleton-field-col-type">Type(s)</span>
          </div>
          {visibleFields.map((f) => (
            <div
              key={f.key}
              className={`skeleton-field-row ${f.isStructural ? 'skeleton-field-row--structural' : ''}`}
            >
              <span className="skeleton-field-name">
                {f.isStructural && <span className="skeleton-structural-dot" />}
                {f.key}
              </span>
              <span
                className="skeleton-field-freq"
                style={{ color: FREQ_COLORS[f.frequency] }}
              >
                {f.frequency}
              </span>
              <div className="skeleton-field-bar-track">
                <div
                  className="skeleton-field-bar-fill"
                  style={{
                    width: `${f.pct}%`,
                    backgroundColor: FREQ_COLORS[f.frequency],
                  }}
                />
                <span className="skeleton-field-pct-label">{f.pct}%</span>
              </div>
              <span className="skeleton-field-types">
                {f.valueTypes.map((vt, i) => (
                  <code key={i} className="skeleton-type-tag">{vt.type}</code>
                ))}
              </span>
            </div>
          ))}
        </div>
        {skeleton.fields.length > 12 && (
          <button
            className="skeleton-show-more-btn"
            onClick={() => setShowAllFields((p) => !p)}
          >
            {showAllFields ? 'Show Less' : `Show All ${skeleton.fields.length} Fields`}
          </button>
        )}
      </div>
    </div>
  );
}
