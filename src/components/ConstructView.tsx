import { useMemo, useState, useCallback } from 'react';
import type { Menu } from '../types/menu';
import type { ClassifiedProduct } from '../utils/constructClassifier';
import {
  CONSTRUCTS,
  classifyAllProducts,
  getPrimaryTypeStats,
  getBehavioralTagStats,
  getExtraFlagStats,
  filterProducts,
  getConstruct,
} from '../utils/constructClassifier';
import { getRefId } from '../utils/menuHelpers';
import { ConstructBadge, ConstructTypePill, BehavioralTag, FlagPills } from './ConstructBadge';
import { OptimizedImage } from './OptimizedImage';
import { CopyRef } from './CopyRef';

interface ConstructViewProps {
  menu: Menu;
  onProductSelect: (productRef: string) => void;
}

export function ConstructView({ menu, onProductSelect }: ConstructViewProps) {
  const [activePrimary, setActivePrimary] = useState<string | null>(null);
  const [activeBehavioral, setActiveBehavioral] = useState<string | null>(null);
  const [activeExtra, setActiveExtra] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [inspecting, setInspecting] = useState<ClassifiedProduct | null>(null);
  const [showReference, setShowReference] = useState(false);

  // Classify all products once
  const classified = useMemo(() => classifyAllProducts(menu), [menu]);
  const primaryStats = useMemo(() => getPrimaryTypeStats(classified), [classified]);
  const behavioralStats = useMemo(() => getBehavioralTagStats(classified), [classified]);
  const extraStats = useMemo(() => getExtraFlagStats(classified), [classified]);

  // Filtered products
  const filtered = useMemo(
    () =>
      filterProducts(classified, {
        primaryType: activePrimary,
        behavioralTag: activeBehavioral,
        extraFlag: activeExtra,
        search: searchTerm.trim(),
      }),
    [classified, activePrimary, activeBehavioral, activeExtra, searchTerm],
  );

  const togglePrimary = useCallback((id: string) => {
    setActivePrimary((prev) => (prev === id ? null : id));
    setActiveBehavioral(null);
    setActiveExtra(null);
    setInspecting(null);
  }, []);

  const toggleBehavioral = useCallback((id: string) => {
    setActiveBehavioral((prev) => (prev === id ? null : id));
    setActivePrimary(null);
    setActiveExtra(null);
    setInspecting(null);
  }, []);

  const toggleExtra = useCallback((flag: string) => {
    setActiveExtra((prev) => (prev === flag ? null : flag));
    setActivePrimary(null);
    setActiveBehavioral(null);
    setInspecting(null);
  }, []);

  const clearAll = useCallback(() => {
    setActivePrimary(null);
    setActiveBehavioral(null);
    setActiveExtra(null);
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
          5 primary types based on alternatives &amp; ingredientRefs,
          plus behavioral sub-constructs (#6–#25).
        </p>
      </div>

      {/* ── Construct Reference (collapsible) ── */}
      {showReference && <ConstructReference />}

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

        {/* ── Extra Structural Flags ── */}
        <div className="construct-extra-flags">
          {extraStats.combos > 0 && (
            <button
              className={`construct-extra-flag ${activeExtra === 'combo' ? 'construct-extra-flag--active' : ''}`}
              onClick={() => toggleExtra('combo')}
            >
              🍔 Combos <span className="construct-extra-count">{extraStats.combos}</span>
            </button>
          )}
          {extraStats.modifierGroupProducts > 0 && (
            <button
              className={`construct-extra-flag ${activeExtra === 'modifierGroups' ? 'construct-extra-flag--active' : ''}`}
              onClick={() => toggleExtra('modifierGroups')}
            >
              🔧 With Modifiers <span className="construct-extra-count">{extraStats.modifierGroupProducts}</span>
            </button>
          )}
          {extraStats.bundleLinks > 0 && (
            <button
              className={`construct-extra-flag ${activeExtra === 'bundleLink' ? 'construct-extra-flag--active' : ''}`}
              onClick={() => toggleExtra('bundleLink')}
            >
              🔗 Bundle Links <span className="construct-extra-count">{extraStats.bundleLinks}</span>
            </button>
          )}
        </div>

        {/* ── Behavioral Tags (only show those with matches) ── */}
        {behavioralStats.length > 0 && (
          <>
            <div className="construct-section-label">Detected Behaviors</div>
            <div className="construct-pills-row">
              {behavioralStats.map((s) => (
                <button
                  key={s.constructId}
                  className={`construct-behavioral-pill ${activeBehavioral === s.constructId ? 'construct-behavioral-pill--active' : ''}`}
                  style={{ '--construct-color': s.construct.color } as React.CSSProperties}
                  onClick={() => toggleBehavioral(s.constructId)}
                  title={`${s.construct.name}\n${s.construct.engineeringTerm}`}
                >
                  {s.construct.icon} {s.construct.shortName}
                  <span className="construct-behavioral-count">{s.count}</span>
                </button>
              ))}
            </div>
          </>
        )}

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
          {(activePrimary || activeBehavioral || activeExtra || searchTerm) && (
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

function ConstructReference() {
  return (
    <div className="construct-reference">
      <div className="construct-reference-section">
        <h3>Single Product Constructs</h3>
        <div className="construct-reference-grid">
          {CONSTRUCTS.filter((c) => c.category === 'single').map((c) => (
            <div
              key={c.id}
              className="construct-reference-card"
              style={{ '--construct-color': c.color } as React.CSSProperties}
            >
              <div className="construct-ref-card-header">
                <span className="construct-ref-card-icon">{c.icon}</span>
                <span className="construct-ref-card-id">{c.id}</span>
                <span className="construct-ref-card-short">{c.shortName}</span>
              </div>
              <div className="construct-ref-card-name">{c.name}</div>
              <div className="construct-ref-card-eng">
                <span className="construct-ref-card-eng-label">Eng:</span> {c.engineeringTerm}
              </div>
              <div className="construct-ref-card-desc">{c.description}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="construct-reference-section">
        <h3>Combo / Meal / Bundle Constructs</h3>
        <div className="construct-reference-grid">
          {CONSTRUCTS.filter((c) => c.category === 'combo').map((c) => (
            <div
              key={c.id}
              className="construct-reference-card"
              style={{ '--construct-color': c.color } as React.CSSProperties}
            >
              <div className="construct-ref-card-header">
                <span className="construct-ref-card-icon">{c.icon}</span>
                <span className="construct-ref-card-id">{c.id}</span>
                <span className="construct-ref-card-short">{c.shortName}</span>
              </div>
              <div className="construct-ref-card-name">{c.name}</div>
              <div className="construct-ref-card-eng">
                <span className="construct-ref-card-eng-label">Eng:</span> {c.engineeringTerm}
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
          width={240}
          height={100}
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
        </div>
        <div className="construct-card-bottom">
          <ConstructBadge constructId={item.primaryType} compact />
          <FlagPills item={item} />
          {item.behavioralTags.map((tag) => (
            <BehavioralTag key={tag} constructId={tag} compact />
          ))}
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
  const { product, primaryConstruct, behavioralTags, flags } = item;

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
