import { useMemo, useState, useCallback } from 'react';
import type { Menu} from '../types/menu';
import type { ConstructTag } from '../utils/constructClassifier';
import {
  classifyAllProducts,
  groupByPrimary,
  getActiveFilterTags,
  filterByTags,
  TAG_INFO,
} from '../utils/constructClassifier';
import { getRefId } from '../utils/menuHelpers';
import { ConstructBadge, ConstructTagBadge } from './ConstructBadge';
import { OptimizedImage } from './OptimizedImage';
import { CopyRef } from './CopyRef';

interface ConstructViewProps {
  menu: Menu;
  onProductSelect: (productRef: string) => void;
}

export function ConstructView({ menu, onProductSelect }: ConstructViewProps) {
  const [activeTags, setActiveTags] = useState<Set<ConstructTag>>(new Set());
  const [viewMode, setViewMode] = useState<'primary' | 'tags'>('primary');
  const [searchTerm, setSearchTerm] = useState('');

  // Classify all products once
  const classified = useMemo(() => classifyAllProducts(menu), [menu]);

  // Filter tags that actually appear in the dataset
  const filterTags = useMemo(() => getActiveFilterTags(classified), [classified]);

  // Filtered products
  const filtered = useMemo(() => {
    let items = filterByTags(classified, activeTags);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      items = items.filter(
        (c) =>
          c.product.displayName?.toLowerCase().includes(q) ||
          c.ref.toLowerCase().includes(q),
      );
    }
    return items;
  }, [classified, activeTags, searchTerm]);

  // Group by primary classification
  const primaryGroups = useMemo(() => groupByPrimary(filtered), [filtered]);

  const toggleTag = useCallback((tag: ConstructTag) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setActiveTags(new Set());
    setSearchTerm('');
  }, []);

  // Primary-group ordering
  const primaryOrder: Array<'simple' | 'customizable' | 'virtual' | 'combo-like'> = [
    'combo-like',
    'customizable',
    'virtual',
    'simple',
  ];

  const primaryMeta: Record<string, { label: string; color: string; icon: string }> = {
    simple: { label: 'Simple Products', color: '#22c55e', icon: '🧁' },
    customizable: { label: 'Customizable Products', color: '#3b82f6', icon: '🎛️' },
    virtual: { label: 'Virtual Products', color: '#f97316', icon: '👻' },
    'combo-like': { label: 'Combos / Meals', color: '#8b5cf6', icon: '🍔🍟' },
  };

  return (
    <div className="construct-view">
      {/* Header */}
      <div className="construct-view-header">
        <div className="construct-view-title-row">
          <h2>Product Constructs</h2>
          <span className="construct-view-count">
            {filtered.length} / {classified.length} products
          </span>
        </div>
        <p className="construct-view-desc">
          Products classified by their structural properties — brand-agnostic, data-driven.
        </p>
      </div>

      {/* Toolbar */}
      <div className="construct-toolbar">
        <div className="construct-search-bar">
          <input
            type="text"
            placeholder="Filter by name…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="construct-search-input"
          />
        </div>
        <div className="construct-view-toggle">
          <button
            className={`construct-view-btn ${viewMode === 'primary' ? 'active' : ''}`}
            onClick={() => setViewMode('primary')}
          >
            By Type
          </button>
          <button
            className={`construct-view-btn ${viewMode === 'tags' ? 'active' : ''}`}
            onClick={() => setViewMode('tags')}
          >
            By Tags
          </button>
        </div>
        {activeTags.size > 0 && (
          <button className="construct-clear-btn" onClick={clearFilters}>
            Clear Filters ({activeTags.size})
          </button>
        )}
      </div>

      {/* Tag filter panel */}
      <div className="construct-filter-panel">
        {filterTags.map(({ tag, count }) => (
          <ConstructTagBadge
            key={tag}
            tag={tag}
            count={count}
            isActive={activeTags.has(tag)}
            onClick={() => toggleTag(tag)}
          />
        ))}
      </div>

      {/* Content */}
      {viewMode === 'primary' ? (
        <div className="construct-primary-groups">
          {primaryOrder.map((key) => {
            const items = primaryGroups.get(key);
            if (!items || items.length === 0) return null;
            const meta = primaryMeta[key];
            return (
              <div key={key} className="construct-group">
                <div
                  className="construct-group-header"
                  style={{ '--group-color': meta.color } as React.CSSProperties}
                >
                  <span className="construct-group-icon">{meta.icon}</span>
                  <h3 className="construct-group-title">{meta.label}</h3>
                  <span className="construct-group-count">{items.length}</span>
                </div>
                <div className="construct-product-grid">
                  {items.slice(0, 50).map((item) => (
                    <ProductCard
                      key={item.ref}
                      item={item}
                      onSelect={() => onProductSelect(item.ref)}
                    />
                  ))}
                  {items.length > 50 && (
                    <div className="construct-more">
                      +{items.length - 50} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Tags view: show products grouped by each active filterable tag
        <div className="construct-tag-groups">
          {filterTags
            .filter(({ tag }) => activeTags.size === 0 || activeTags.has(tag))
            .map(({ tag, info, count }) => {
              const items = filtered.filter((c) =>
                c.classification.tags.includes(tag),
              );
              if (items.length === 0) return null;
              return (
                <div key={tag} className="construct-group">
                  <div
                    className="construct-group-header"
                    style={{ '--group-color': info.color } as React.CSSProperties}
                  >
                    <span className="construct-group-icon">{info.icon}</span>
                    <h3 className="construct-group-title">{info.label}</h3>
                    <span className="construct-group-count">{count}</span>
                  </div>
                  <p className="construct-group-desc">{info.description}</p>
                  <div className="construct-product-grid">
                    {items.slice(0, 30).map((item) => (
                      <ProductCard
                        key={item.ref}
                        item={item}
                        onSelect={() => onProductSelect(item.ref)}
                      />
                    ))}
                    {items.length > 30 && (
                      <div className="construct-more">
                        +{items.length - 30} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Product card used in the grid
// ─────────────────────────────────────────────

function ProductCard({
  item,
  onSelect,
}: {
  item: { ref: string; product: import('../types/menu').Product; classification: import('../utils/constructClassifier').ConstructClassification };
  onSelect: () => void;
}) {
  const { product, classification } = item;

  return (
    <div
      className={`construct-product-card ${product.isCombo ? 'construct-product-card--combo' : ''}`}
      onClick={onSelect}
    >
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
        <CopyRef value={item.ref} display={getRefId(item.ref)} className="construct-card-ref" />
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
        <ConstructBadge classification={classification} compact />
        <div className="construct-card-tags">
          {classification.tags
            .filter((t) => TAG_INFO[t]?.isFilterable)
            .slice(0, 4)
            .map((t) => (
              <span
                key={t}
                className="construct-mini-tag"
                style={{ borderColor: TAG_INFO[t].color, color: TAG_INFO[t].color }}
                title={TAG_INFO[t].description}
              >
                {TAG_INFO[t].icon} {TAG_INFO[t].label}
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}
