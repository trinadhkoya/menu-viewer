import { useMemo, useState } from 'react';
import type { Menu, Product, ProductGroup, ChildRefOverride, Quantity } from '../types/menu';
import { CopyRef } from './CopyRef';
import { OptimizedImage } from './OptimizedImage';
import type { BrandId } from './MenuUploader';
import { getProductPlaceholder } from '../utils/placeholderImage';
import {
  getRefId,
  resolveRef,
  isProductRef,
  mergeWithOverrides,
  hasOverrides,
  isRecipeGroup,
} from '../utils/menuHelpers';

function formatSelectionQty(sq: Quantity): string {
  const min = sq.min ?? 0;
  const max = sq.max ?? null;
  if (min === 0 && max === null) return 'Optional';
  if (min === 0 && max === 1) return 'Select up to 1';
  if (min === 0 && max != null) return `Select up to ${max}`;
  if (min === 1 && max === 1) return 'Select exactly 1';
  if (min === max && min != null) return `Select exactly ${min}`;
  if (min >= 1 && max != null) return `Select ${min}–${max}`;
  if (min >= 1 && max === null) return `Select at least ${min}`;
  return `Select ${min}–${max ?? '∞'}`;
}

interface ProductGroupDetailProps {
  menu: Menu;
  productGroupRef: string;
  activeBrand?: BrandId | null;
  onProductSelect?: (productRef: string) => void;
  onBack?: () => void;
}

export function ProductGroupDetail({ menu, productGroupRef, activeBrand, onProductSelect, onBack }: ProductGroupDetailProps) {
  const groupId = getRefId(productGroupRef);
  const group = menu.productGroups?.[groupId] as ProductGroup | undefined;
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['info', 'children', 'raw']),
  );

  const children = useMemo(() => {
    if (!group?.childRefs) return [];
    return Object.entries(group.childRefs)
      .map(([ref, override]) => {
        const base = resolveRef(menu, ref);
        if (!base) return null;
        const isProd = isProductRef(ref);
        const merged = isProd ? mergeWithOverrides(base as Product, (override ?? {}) as ChildRefOverride) : base;
        return {
          ref,
          entity: merged as Product,
          isProduct: isProd,
          isDefault: (override as ChildRefOverride)?.isDefault ?? false,
          overrides: override && hasOverrides(override as ChildRefOverride) ? (override as ChildRefOverride) : undefined,
        };
      })
      .filter(Boolean) as Array<{
        ref: string;
        entity: Product;
        isProduct: boolean;
        isDefault: boolean;
        overrides: ChildRefOverride | undefined;
      }>;
  }, [group, menu]);

  // Find products that reference this product group
  const referencingProducts = useMemo(() => {
    if (!menu.products) return [];
    return Object.entries(menu.products)
      .filter(([, p]) => p.productGroupIds?.includes(groupId) || p.groupIds?.includes(groupId))
      .map(([id, product]) => ({ ref: `products.${id}`, product }))
      .slice(0, 20);
  }, [menu, groupId]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  if (!group) {
    return (
      <div className="detail-empty">
        <p>Product Group not found: <code>{productGroupRef}</code></p>
      </div>
    );
  }

  const recipe = isRecipeGroup(group);

  return (
    <div className="product-detail group-detail">
      {/* Back button */}
      {onBack && (
        <button className="group-detail-back" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Back
        </button>
      )}

      {/* Header */}
      <div className="detail-header group-detail-header">
        <div className="group-detail-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
        </div>
        <div className="detail-title-area">
          <h2 className="detail-title">{group.displayName}</h2>
          <CopyRef value={productGroupRef} className="detail-ref" />
          <div className="detail-badges">
            {recipe && <span className="badge badge--recipe">🍳 Recipe</span>}
            {group.selectionQuantity && (
              <span className="quantity-badge">
                {formatSelectionQty(group.selectionQuantity)}
              </span>
            )}
            <span className="badge badge--group">
              📦 Product Group
            </span>
          </div>
        </div>
      </div>

      {/* Info section */}
      <section className="detail-section">
        <div className="section-header" onClick={() => toggleSection('info')}>
          <h3>{expandedSections.has('info') ? '▼' : '▶'} Group Info</h3>
        </div>
        {expandedSections.has('info') && (
          <div className="section-body">
            <table className="info-table">
              <tbody>
                {group.description && (
                  <tr>
                    <td className="info-label">Description</td>
                    <td>{group.description}</td>
                  </tr>
                )}
                {group.id && (
                  <tr className="info-row-ref">
                    <td className="info-label">ID</td>
                    <td><CopyRef value={group.id} /></td>
                  </tr>
                )}
                <tr>
                  <td className="info-label">Recipe</td>
                  <td>{recipe ? 'Yes' : 'No'}</td>
                </tr>
                {group.selectionQuantity && (
                  <tr>
                    <td className="info-label">Selection</td>
                    <td>
                      <span className="qty-chips">
                        <span className="qty-chip">
                          <span className="qty-chip-label">min</span>
                          <span className="qty-chip-value">{group.selectionQuantity.min ?? 0}</span>
                        </span>
                        <span className="qty-chip">
                          <span className="qty-chip-label">max</span>
                          <span className="qty-chip-value">{group.selectionQuantity.max ?? '∞'}</span>
                        </span>
                        {group.selectionQuantity.default != null && (
                          <span className="qty-chip qty-chip--default">
                            <span className="qty-chip-label">default</span>
                            <span className="qty-chip-value">{group.selectionQuantity.default}</span>
                          </span>
                        )}
                      </span>
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="info-label">Child Refs</td>
                  <td>{children.length} item{children.length !== 1 ? 's' : ''}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Child Products */}
      {children.length > 0 && (
        <section className="detail-section">
          <div className="section-header" onClick={() => toggleSection('children')}>
            <h3>
              {expandedSections.has('children') ? '▼' : '▶'} Child Items
              <span className="section-count">{children.length}</span>
            </h3>
          </div>
          {expandedSections.has('children') && (
            <div className="section-body">
              <div className="group-children-grid">
                {children.map(({ ref, entity, isProduct, isDefault, overrides }) => (
                  <div
                    key={ref}
                    className={`group-child-card ${isDefault ? 'group-child-card--default' : ''} ${isProduct ? 'group-child-card--clickable' : ''}`}
                    onClick={() => isProduct && onProductSelect?.(ref)}
                    title={isProduct ? `Navigate to ${entity.displayName}` : undefined}
                  >
                    {isProduct && entity.imageUrl ? (
                      <OptimizedImage src={entity.imageUrl} alt={entity.displayName ?? ''} className="group-child-image" width={56} height={56} />
                    ) : isProduct ? (
                      <div className="group-child-placeholder">
                        <img src={getProductPlaceholder(activeBrand)} alt="" className="group-child-placeholder-img" />
                      </div>
                    ) : (
                      <div className="group-child-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><path d="M8 12h8M12 8v8" /></svg>
                      </div>
                    )}
                    <div className="group-child-body">
                      <span className="group-child-name">{entity.displayName || getRefId(ref)}</span>
                      <CopyRef value={ref} display={getRefId(ref)} className="group-child-ref" />
                      <div className="group-child-meta">
                        {entity.isAvailable != null && (
                          <span className={`availability-dot ${entity.isAvailable ? 'available' : 'unavailable'}`} />
                        )}
                        {isDefault && <span className="mini-badge default">Default</span>}
                        {overrides && <OverridePills overrides={overrides} />}
                        {entity.price != null && <span className="group-child-price">${entity.price.toFixed(2)}</span>}
                        {entity.calories != null && <span className="group-child-cal">{entity.calories} cal</span>}
                      </div>
                    </div>
                    {isProduct && <span className="group-child-arrow">→</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Referencing Products */}
      {referencingProducts.length > 0 && (
        <section className="detail-section">
          <div className="section-header" onClick={() => toggleSection('referencing')}>
            <h3>
              {expandedSections.has('referencing') ? '▼' : '▶'} Used By Products
              <span className="section-count">{referencingProducts.length}</span>
            </h3>
          </div>
          {expandedSections.has('referencing') && (
            <div className="section-body">
              <div className="group-children-grid">
                {referencingProducts.map(({ ref, product }) => (
                  <div
                    key={ref}
                    className="group-child-card group-child-card--clickable"
                    onClick={() => onProductSelect?.(ref)}
                    title={`Navigate to ${product.displayName}`}
                  >
                    {product.imageUrl ? (
                      <OptimizedImage src={product.imageUrl} alt={product.displayName ?? ''} className="group-child-image" width={56} height={56} />
                    ) : (
                      <div className="group-child-placeholder">
                        <img src={getProductPlaceholder(activeBrand)} alt="" className="group-child-placeholder-img" />
                      </div>
                    )}
                    <div className="group-child-body">
                      <span className="group-child-name">{product.displayName || getRefId(ref)}</span>
                      <CopyRef value={ref} display={getRefId(ref)} className="group-child-ref" />
                      <div className="group-child-meta">
                        {product.isAvailable != null && (
                          <span className={`availability-dot ${product.isAvailable ? 'available' : 'unavailable'}`} />
                        )}
                        {product.price != null && <span className="group-child-price">${product.price.toFixed(2)}</span>}
                        {product.isCombo && <span className="mini-badge combo">Combo</span>}
                      </div>
                    </div>
                    <span className="group-child-arrow">→</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Raw JSON */}
      <section className="detail-section">
        <div className="section-header" onClick={() => toggleSection('raw')}>
          <h3>{expandedSections.has('raw') ? '▼' : '▶'} Raw JSON</h3>
        </div>
        {expandedSections.has('raw') && (
          <div className="section-body">
            <div className="raw-json-wrapper">
              <button
                className="raw-json-copy"
                title="Copy JSON to clipboard"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(group, null, 2));
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2"/></svg>
              </button>
              <pre className="raw-json">{JSON.stringify(group, null, 2)}</pre>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/** Inline override pills for child items */
function OverridePills({ overrides }: { overrides: ChildRefOverride }) {
  const keys = Object.keys(overrides);
  return (
    <span className="mini-badge override" title={`Overrides: ${keys.join(', ')}`}>
      ⚡ {keys.length} override{keys.length > 1 ? 's' : ''}
    </span>
  );
}
