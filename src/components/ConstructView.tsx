import { useMemo, useState, useCallback } from 'react';
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

interface ConstructViewProps {
  menu: Menu;
  onProductSelect: (productRef: string) => void;
}

export function ConstructView({ menu, onProductSelect }: ConstructViewProps) {
  const [activeMainCategory, setActiveMainCategory] = useState<string | null>(null);
  const [activePrimary, setActivePrimary] = useState<string | null>(null);
  const [activeBehavioral, setActiveBehavioral] = useState<string | null>(null);
  const [activeStructuralTag, setActiveStructuralTag] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [inspecting, setInspecting] = useState<ClassifiedProduct | null>(null);
  const [showReference, setShowReference] = useState(false);

  // Classify all products once
  const classified = useMemo(() => classifyAllProducts(menu), [menu]);
  const mainCategoryStats = useMemo(() => getMainCategoryStats(classified), [classified]);
  const primaryStats = useMemo(() => getPrimaryTypeStats(classified), [classified]);
  const structuralTagStats = useMemo(() => getStructuralTagStats(classified), [classified]);
  const categorySkeletons = useMemo(() => getCategorySkeletons(classified), [classified]);

  // Build a lookup map from category ref → skeleton
  const skeletonMap = useMemo(() => {
    const map = new Map<string, CategorySkeleton>();
    for (const sk of categorySkeletons) map.set(sk.ref, sk);
    return map;
  }, [categorySkeletons]);

  // Which skeleton detail panel is expanded
  const [expandedSkeleton, setExpandedSkeleton] = useState<string | null>(null);

  // Filtered products
  const filtered = useMemo(
    () =>
      filterProducts(classified, {
        mainCategory: activeMainCategory,
        primaryType: activePrimary,
        behavioralTag: activeBehavioral,
        structuralTag: activeStructuralTag,
        search: searchTerm.trim(),
      }),
    [classified, activeMainCategory, activePrimary, activeBehavioral, activeStructuralTag, searchTerm],
  );

  const toggleMainCategory = useCallback((ref: string) => {
    setActiveMainCategory((prev) => (prev === ref ? null : ref));
    setInspecting(null);
  }, []);

  const togglePrimary = useCallback((id: string) => {
    setActivePrimary((prev) => (prev === id ? null : id));
    setActiveBehavioral(null);
    setActiveStructuralTag(null);
    setInspecting(null);
  }, []);

  const toggleBehavioral = useCallback((id: string) => {
    setActiveBehavioral((prev) => (prev === id ? null : id));
    setActivePrimary(null);
    setActiveStructuralTag(null);
    setInspecting(null);
  }, []);

  const toggleStructuralTag = useCallback((tag: string) => {
    setActiveStructuralTag((prev) => (prev === tag ? null : tag));
    setActivePrimary(null);
    setActiveBehavioral(null);
    setInspecting(null);
  }, []);

  const clearAll = useCallback(() => {
    setActiveMainCategory(null);
    setActivePrimary(null);
    setActiveBehavioral(null);
    setActiveStructuralTag(null);
    setSearchTerm('');
    setInspecting(null);
  }, []);

  return (
    <div className="construct-view">
      {/* ── Header ── */}
      <div className="construct-view-header">
        <div className="construct-view-title-row">
          <h2>MBDP Constructs</h2>
          <span className="construct-view-count">
            {filtered.length} / {classified.length} products
          </span>
          <button
            className={`construct-ref-toggle ${showReference ? 'construct-ref-toggle--active' : ''}`}
            onClick={() => setShowReference((p) => !p)}
            title="Toggle construct reference table"
          >
            📋 {showReference ? 'Hide' : 'Show'} Reference
          </button>
        </div>
        <p className="construct-view-desc">
          Products classified using the <strong>official MBDP construct system</strong> — 
          5 primary types based on alternatives &amp; ingredientRefs, enriched with data-driven structural tags.
        </p>
      </div>

      {/* ── Construct Reference (collapsible) ── */}
      {showReference && (
        <ConstructReference
          classified={classified}
          activePrimary={activePrimary}
          activeBehavioral={activeBehavioral}
          onSelectPrimary={togglePrimary}
          onSelectBehavioral={toggleBehavioral}
        />
      )}

      {/* ── Primary Type Filter ── */}
      <div className="construct-toolbar">
        <div className="construct-section-label">Primary Type</div>
        <div className="construct-pills-row">
          {primaryStats.map((s) => (
            <ConstructTypePill
              key={s.constructId}
              construct={s.construct}
              count={s.count}
              isActive={activePrimary === s.constructId}
              onClick={() => togglePrimary(s.constructId)}
            />
          ))}
        </div>

        {/* ── Structural Tags ── */}
        <div className="construct-section-label" style={{ marginTop: 8 }}>Structural Tags</div>
        <div className="construct-extra-flags">
          {structuralTagStats.map((s) => (
            <button
              key={s.tagId}
              className={`construct-extra-flag ${activeStructuralTag === s.tagId ? 'construct-extra-flag--active' : ''}`}
              onClick={() => toggleStructuralTag(s.tagId)}
            >
              {s.tag.icon} {s.tag.shortName} <span className="construct-extra-count">{s.count}</span>
            </button>
          ))}
        </div>

        {/* ── Search & Clear ── */}
        <div className="construct-filter-row">
          <div className="construct-search-bar">
            <input
              type="text"
              placeholder="Search by name…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="construct-search-input"
            />
          </div>
          {(activeMainCategory || activePrimary || activeBehavioral || activeStructuralTag || searchTerm) && (
            <button className="construct-clear-btn" onClick={clearAll}>
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* ── Product Inspector ── */}
      {inspecting && (
        <ProductInspector
          item={inspecting}
          onClose={() => setInspecting(null)}
          onProductSelect={onProductSelect}
        />
      )}

      {/* ── Product Grid ── */}
      <div className="construct-product-grid">
        {filtered.slice(0, 120).map((item) => (
          <ProductCard
            key={item.ref}
            item={item}
            onSelect={() => onProductSelect(item.ref)}
            onInspect={() => setInspecting(item)}
          />
        ))}
        {filtered.length > 120 && (
          <div className="construct-more">+{filtered.length - 120} more</div>
        )}
        {filtered.length === 0 && (
          <div className="construct-empty">No products match the current filters.</div>
        )}
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

function ConstructReference({
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
          {CONSTRUCTS.filter((c) => c.category === 'single' && !c.id.startsWith('#')).map((c) => {
            const count = primaryCounts.get(c.id) ?? 0;
            const isActive = activePrimary === c.id;
            return (
              <button
                key={c.id}
                className={`construct-reference-card ${isActive ? 'construct-reference-card--active' : ''} ${count === 0 ? 'construct-reference-card--empty' : ''}`}
                onClick={() => count > 0 && onSelectPrimary(c.id)}
                type="button"
              >
                <div className="construct-ref-card-header">
                  <span className="construct-ref-card-icon">{c.icon}</span>
                  <span className="construct-ref-card-id">{c.id}</span>
                  <span className="construct-ref-card-short">{c.shortName}</span>
                  {count > 0 && <span className="construct-ref-card-count">{count}</span>}
                </div>
                <div className="construct-ref-card-name">{c.name}</div>
                <div className="construct-ref-card-eng">
                  <span className="construct-ref-card-eng-label">ENG:</span> {c.engineeringTerm}
                </div>
                <div className="construct-ref-card-desc">{c.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="construct-reference-section">
        <h3>Behavioral Sub-Constructs</h3>
        <div className="construct-reference-grid">
          {CONSTRUCTS.filter((c) => c.category === 'single' && c.id.startsWith('#')).map((c) => {
            const count = behavioralCounts.get(c.id) ?? 0;
            const isActive = activeBehavioral === c.id;
            return (
              <button
                key={c.id}
                className={`construct-reference-card construct-reference-card--behavioral ${isActive ? 'construct-reference-card--active' : ''} ${count === 0 ? 'construct-reference-card--empty' : ''}`}
                onClick={() => count > 0 && onSelectBehavioral(c.id)}
                type="button"
              >
                <div className="construct-ref-card-header">
                  <span className="construct-ref-card-icon">{c.icon}</span>
                  <span className="construct-ref-card-id">{c.id}</span>
                  <span className="construct-ref-card-short">{c.shortName}</span>
                  {count > 0 && <span className="construct-ref-card-count">{count}</span>}
                </div>
                <div className="construct-ref-card-name">{c.name}</div>
                <div className="construct-ref-card-eng">
                  <span className="construct-ref-card-eng-label">ENG:</span> {c.engineeringTerm}
                </div>
                <div className="construct-ref-card-desc">{c.description}</div>
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
            >
              <div className="construct-ref-card-header">
                <span className="construct-ref-card-icon">{c.icon}</span>
                <span className="construct-ref-card-id">{c.id}</span>
                <span className="construct-ref-card-short">{c.shortName}</span>
              </div>
              <div className="construct-ref-card-name">{c.name}</div>
              <div className="construct-ref-card-eng">
                <span className="construct-ref-card-eng-label">ENG:</span> {c.engineeringTerm}
              </div>
              <div className="construct-ref-card-desc">{c.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Product Card
// ─────────────────────────────────────────────

function ProductCard({
  item,
  onSelect,
  onInspect,
}: {
  item: ClassifiedProduct;
  onSelect: () => void;
  onInspect: () => void;
}) {
  const { product } = item;

  return (
    <div className="construct-product-card" onClick={onSelect}>
      {product.imageUrl && (
        <OptimizedImage
          src={product.imageUrl}
          alt={product.displayName ?? ''}
          className="construct-card-image"
          isCombo={product.isCombo}
        />
      )}
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
          onClick={(e) => {
            e.stopPropagation();
            onInspect();
          }}
          title="Inspect construct details"
        >
          🔍
        </button>
      </div>
    </div>
  );
}

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
