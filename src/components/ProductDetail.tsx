import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import type { Menu, Product, ModifierGroup as ModifierGroupType, Modifier, ProductGroup, DisplayableItem, ChildRefOverride, Quantity } from '../types/menu';
import { OptimizedImage } from './OptimizedImage';
import { CopyRef } from './CopyRef';
import { ProductCompare } from './ProductCompare';
import { ProductCustomizer } from './ProductCustomizer';
import type { BrandId } from './MenuUploader';
import type { SavedCustomization } from '../utils/productCustomization';
import { getProductPlaceholder } from '../utils/placeholderImage';
import {
  getProductIngredients,
  getProductModifierGroups,
  getVirtualProductAlternatives,
  getParentVirtualProducts,
  getBundleTarget,
  getRefId,
  resolveRef,
  isProductRef,
  mergeWithOverrides,
  hasOverrides,
  isRecipeGroup,
} from '../utils/menuHelpers';

/**
 * Convert selectionQuantity { min, max } into human-readable text.
 */
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

/**
 * Check if any modifier in the list is marked as default.
 */
function hasDefaultModifier(modifiers: Array<{ ref: string; modifier: Modifier }>): boolean {
  return modifiers.some(({ modifier }) => modifier.isDefault);
}

interface ProductDetailProps {
  menu: Menu;
  productRef: string;
  activeBrand?: BrandId | null;
  onProductSelect?: (productRef: string) => void;
}

export function ProductDetail({ menu, productRef, activeBrand, onProductSelect }: ProductDetailProps) {
  const productId = getRefId(productRef);
  const product = menu.products?.[productId] as Product | undefined;
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['info', 'ingredients', 'modifiers', 'nutrition', 'sizeVariants', 'bundleRef', 'customization']),
  );
  const [compareMode, setCompareMode] = useState(false);
  const [customizeMode, setCustomizeMode] = useState(false);
  const [savedCustomization, setSavedCustomization] = useState<SavedCustomization | null>(null);

  // Clear saved customization when navigating to a different product
  useEffect(() => {
    setSavedCustomization(null);
    setCustomizeMode(false);
  }, [productRef]);

  const ingredients = useMemo(
    () => (product ? getProductIngredients(menu, product) : []),
    [menu, product],
  );

  const modifierGroups = useMemo(
    () => (product ? getProductModifierGroups(menu, product) : []),
    [menu, product],
  );

  const sizeVariants = useMemo(
    () => (product ? getVirtualProductAlternatives(menu, product) : []),
    [menu, product],
  );

  const parentVirtualProducts = useMemo(
    () => (product && !product.isVirtual ? getParentVirtualProducts(menu, productRef) : []),
    [menu, product, productRef],
  );

  const bundleTarget = useMemo(
    () => (product ? getBundleTarget(menu, product) : null),
    [menu, product],
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  if (!product) {
    return (
      <div className="detail-empty">
        <p>Product not found: <code>{productRef}</code></p>
      </div>
    );
  }

  if (compareMode) {
    return (
      <ProductCompare
        menu={menu}
        productRef={productRef}
        activeBrand={activeBrand ?? null}
        onClose={() => setCompareMode(false)}
      />
    );
  }

  if (customizeMode) {
    return (
      <ProductCustomizer
        menu={menu}
        product={product}
        productRef={productRef}
        onClose={() => setCustomizeMode(false)}
        onSave={(data) => {
          setSavedCustomization(data);
          setCustomizeMode(false);
        }}
        savedSelections={savedCustomization?.selectedIngredients}
        savedComboSelection={savedCustomization?.comboSelection}
        onProductSelect={onProductSelect}
      />
    );
  }

  return (
    <div className="product-detail">
      {/* Header */}
      <div className="detail-header">
        {product.imageUrl ? (
          <OptimizedImage src={product.imageUrl} alt={product.displayName ?? ''} className="detail-image" width={160} height={160} isCombo={product.isCombo} />
        ) : (
          <div className="detail-image-placeholder">
            <img src={getProductPlaceholder(activeBrand)} alt="Product placeholder" className="detail-placeholder-img" />
          </div>
        )}
        <div className="detail-title-area">
          <h2 className="detail-title">{product.displayName}</h2>
          <CopyRef value={productRef} className="detail-ref" />
          <div className="detail-badges">
            <span className={`availability-dot ${product.isAvailable ? 'available' : 'unavailable'}`} title={product.isAvailable ? 'Available' : 'Unavailable'} />
            {product.isCombo && <span className="badge badge--combo">Combo</span>}
            {product.isRecipe && <span className="badge badge--recipe">Recipe</span>}
            {product.isVirtual && <span className="badge badge--virtual">Virtual</span>}
            {product.isExclusive && <span className="badge badge--exclusive">Exclusive</span>}
            <button className="detail-compare-btn" onClick={() => setCompareMode(true)} title="Compare this product across environments">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Compare
            </button>
            {(modifierGroups.length > 0 || ingredients.length > 0 || product.isCombo) && (
              <button className="detail-customize-btn" onClick={() => setCustomizeMode(true)} title="Interactive product customization">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Customize
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Combo info banner */}
      {product.isCombo && (
        <div className="combo-banner">
          <span className="combo-banner-icon">🍔+🍟</span>
          <div className="combo-banner-content">
            <span className="combo-banner-title">Combo Meal</span>
            <span className="combo-banner-desc">This product is a combo — it bundles multiple items together at a combined price.</span>
          </div>
        </div>
      )}

      {/* Parent Virtual Product Banner (sized product → virtual) */}
      {parentVirtualProducts.length > 0 && (
        <div className="virtual-parent-banner">
          <span className="virtual-parent-icon">↩</span>
          <div className="virtual-parent-content">
            <span className="virtual-parent-label">Size variant of</span>
            {parentVirtualProducts.map(({ virtualRef, virtualProduct }) => (
              <button
                key={virtualRef}
                className="virtual-parent-link"
                onClick={() => onProductSelect?.(virtualRef)}
                title={`Navigate to ${virtualProduct.displayName}`}
              >
                <OptimizedImage src={virtualProduct.imageUrl || getProductPlaceholder(activeBrand)} alt="" className="virtual-parent-thumb" width={32} height={32} />
                <span className="virtual-parent-name">{virtualProduct.displayName}</span>
                <span className="badge badge--virtual" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>Virtual</span>
                <span className="virtual-parent-arrow">→</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Customization Summary (carried over from Customizer) ─── */}
      {savedCustomization && (
        <section className="detail-section customization-summary-section">
          <div className="section-header" onClick={() => toggleSection('customization')}>
            <h3>
              {expandedSections.has('customization') ? '▼' : '▶'} Your Customization
              <span className="section-count">{savedCustomization.modifications.length}</span>
            </h3>
          </div>
          {expandedSections.has('customization') !== false && (
            <div className="section-body">
              {/* Price summary row */}
              <div className="customization-price-row">
                <div className="customization-price-item">
                  <span className="customization-price-label">Base</span>
                  <span className="customization-price-value">${savedCustomization.priceResult.basePrice.toFixed(2)}</span>
                </div>
                {savedCustomization.priceResult.modifierUpcharge !== 0 && (
                  <div className="customization-price-item">
                    <span className="customization-price-label">Upcharge</span>
                    <span className={`customization-price-value ${savedCustomization.priceResult.modifierUpcharge > 0 ? 'up' : 'down'}`}>
                      {savedCustomization.priceResult.modifierUpcharge > 0 ? '+' : ''}${savedCustomization.priceResult.modifierUpcharge.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="customization-price-item customization-price-total">
                  <span className="customization-price-label">Total</span>
                  <span className="customization-price-value">${savedCustomization.priceResult.totalPrice.toFixed(2)}</span>
                </div>
                {savedCustomization.priceResult.totalCalories != null && (
                  <div className="customization-price-item">
                    <span className="customization-price-label">Calories</span>
                    <span className="customization-price-value">{savedCustomization.priceResult.totalCalories} cal</span>
                  </div>
                )}
              </div>

              {/* Modification pills */}
              {savedCustomization.modifications.length > 0 ? (
                <div className="customization-pills">
                  {savedCustomization.modifications.map((mod, i) => (
                    <span
                      key={`${mod.action}-${mod.displayName}-${i}`}
                      className={`customization-pill customization-pill--${mod.action.toLowerCase()}`}
                    >
                      <span className="customization-pill-action">
                        {mod.action === 'ADD' ? '+' : mod.action === 'REMOVE' ? '−' : '~'}
                      </span>
                      <span className="customization-pill-name">{mod.displayName}</span>
                      {mod.quantity > 1 && (
                        <span className="customization-pill-qty">×{mod.quantity}</span>
                      )}
                      {mod.price != null && mod.price > 0 && (
                        <span className="customization-pill-price">+${mod.price.toFixed(2)}</span>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="customization-no-changes">No modifications — using default selections.</p>
              )}

              {/* Action buttons */}
              <div className="customization-actions">
                <button
                  className="customization-edit-btn"
                  onClick={() => setCustomizeMode(true)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Edit Customization
                </button>
                <button
                  className="customization-clear-btn"
                  onClick={() => setSavedCustomization(null)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Clear
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Size Variants (Virtual Products) */}
      {sizeVariants.length > 0 && (
        <section className="detail-section size-variants-section">
          <div className="section-header" onClick={() => toggleSection('sizeVariants')}>
            <h3>
              {expandedSections.has('sizeVariants') ? '▼' : '▶'} 🥤 Size Variants
              <span className="section-count">
                {sizeVariants.reduce((acc, g) => acc + g.variants.length, 0)}
              </span>
            </h3>
          </div>
          {expandedSections.has('sizeVariants') && (
            <div className="section-body">
              <p className="size-variants-hint">
                This is a virtual product (price $0.00). The actual products with pricing are below — tap to navigate.
              </p>
              {sizeVariants.map(({ groupRef, group, variants }) => (
                <div key={groupRef} className="size-group">
                  <div className="size-group-header">
                    <strong>{group.displayName || 'Size'}</strong>
                    <CopyRef value={groupRef} display={getRefId(groupRef)} className="modifier-ref" />
                    {group.selectionQuantity && (
                      <span className="quantity-badge">
                        {formatSelectionQty(group.selectionQuantity)}
                      </span>
                    )}
                  </div>
                  <div className="size-variants-grid">
                    {variants.map(({ ref, product: sizeProduct, isDefault, overrides }) => (
                      <div
                        key={ref}
                        className={`size-variant-card ${isDefault ? 'size-variant-card--default' : ''}`}
                        onClick={() => onProductSelect?.(ref)}
                        title={`Navigate to ${sizeProduct.displayName}`}
                      >
                        <OptimizedImage src={sizeProduct.imageUrl || getProductPlaceholder(activeBrand)} alt={sizeProduct.displayName ?? ''} className="size-variant-image" width={64} height={64} />
                        <div className="size-variant-body">
                          <span className="size-variant-label">
                            {sizeProduct.ctaLabel || sizeProduct.displayName}
                          </span>
                          {sizeProduct.ctaLabel && sizeProduct.displayName && (
                            <span className="size-variant-name">{sizeProduct.displayName}</span>
                          )}
                          <span className="size-variant-price">
                            ${(sizeProduct.price ?? 0).toFixed(2)}
                          </span>
                          {sizeProduct.calories != null && (
                            <span className="size-variant-cal">{sizeProduct.calories} cal</span>
                          )}
                          <div className="size-variant-badges">
                            {isDefault && <span className="mini-badge default">Default</span>}
                            {sizeProduct.isAvailable != null && (
                              <span className={`availability-dot ${sizeProduct.isAvailable ? 'available' : 'unavailable'}`} title={sizeProduct.isAvailable ? 'Available' : 'Unavailable'} />
                            )}
                            {overrides && <OverrideBadge overrides={overrides} />}
                          </div>
                        </div>
                        <span className="size-variant-arrow">→</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Bundle Reference — only show on source products (forward link to meal/combo) */}
      {bundleTarget && (
        <section className="detail-section bundle-ref-section">
          <div className="section-header" onClick={() => toggleSection('bundleRef')}>
            <h3>
              {expandedSections.has('bundleRef') ? '▼' : '▶'} 🔗 Bundle Reference
              <span className="section-count">1</span>
            </h3>
          </div>
          {expandedSections.has('bundleRef') && (
            <div className="section-body">
              <div className="bundle-ref-block">
                <p className="bundle-ref-hint">
                  This product has a meal/combo counterpart — tap to navigate.
                </p>
                <div className="bundle-ref-grid">
                  <div
                    className="bundle-ref-card"
                    onClick={() => onProductSelect?.(bundleTarget.ref)}
                    title={`Navigate to ${bundleTarget.displayName}`}
                  >
                    <OptimizedImage
                        src={bundleTarget.product.imageUrl || getProductPlaceholder(activeBrand)}
                        alt={bundleTarget.displayName}
                        className="bundle-ref-image"
                        width={64}
                        height={64}
                      />
                    <div className="bundle-ref-body">
                      <span className="bundle-ref-label">🍱 Meal / Combo</span>
                      <span className="bundle-ref-name">{bundleTarget.displayName}</span>
                      <CopyRef value={bundleTarget.ref} display={getRefId(bundleTarget.ref)} className="bundle-ref-id" />
                      {bundleTarget.product.price != null && (
                        <span className="bundle-ref-price">${bundleTarget.product.price.toFixed(2)}</span>
                      )}
                      {bundleTarget.product.calories != null && (
                        <span className="bundle-ref-cal">{bundleTarget.product.calories} cal</span>
                      )}
                    </div>
                    <span className="bundle-ref-arrow">→</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Basic Info */}
      <section className="detail-section">
        <div className="section-header" onClick={() => toggleSection('info')}>
          <h3>{expandedSections.has('info') ? '▼' : '▶'} Product Info</h3>
        </div>
        {expandedSections.has('info') && (
          <div className="section-body">
            <table className="info-table">
              <tbody>
                {product.description && (
                  <tr>
                    <td className="info-label">Description</td>
                    <td>{product.description}</td>
                  </tr>
                )}
                {product.price != null && (
                  <tr>
                    <td className="info-label">Price</td>
                    <td className="info-price">${product.price.toFixed(2)}</td>
                  </tr>
                )}
                {product.calories != null && (
                  <tr>
                    <td className="info-label">Calories</td>
                    <td>{product.calories} cal</td>
                  </tr>
                )}
                {product.PLU != null && (
                  <tr className="info-row-ref">
                    <td className="info-label">PLU</td>
                    <td><CopyRef value={String(product.PLU)} /></td>
                  </tr>
                )}
                {product.id && (
                  <tr className="info-row-ref">
                    <td className="info-label">ID</td>
                    <td><CopyRef value={product.id} /></td>
                  </tr>
                )}
                {product.tags && product.tags.length > 0 && (
                  <tr>
                    <td className="info-label">Tags</td>
                    <td>
                      {product.tags.map((tag) => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </td>
                  </tr>
                )}
                {product.quantity && (
                  <tr>
                    <td className="info-label">Quantity</td>
                    <td>
                      <span className="qty-chips">
                        <span className="qty-chip">
                          <span className="qty-chip-label">min</span>
                          <span className="qty-chip-value">{product.quantity.min ?? 0}</span>
                        </span>
                        <span className="qty-chip">
                          <span className="qty-chip-label">max</span>
                          <span className="qty-chip-value">{product.quantity.max ?? '∞'}</span>
                        </span>
                        {product.quantity.default != null && (
                          <span className="qty-chip qty-chip--default">
                            <span className="qty-chip-label">default</span>
                            <span className="qty-chip-value">{product.quantity.default}</span>
                          </span>
                        )}
                      </span>
                    </td>
                  </tr>
                )}
                {product.operationHours && (
                  <tr>
                    <td className="info-label">Operation Hours</td>
                    <td>
                      {Object.entries(product.operationHours).map(([day, hours]) => (
                        <div key={day} className="op-hours-row">
                          <strong>{day}:</strong>{' '}
                          {hours
                            ? hours.map((h, i) => <span key={i}>{h.start} - {h.end}</span>)
                            : 'Closed'}
                        </div>
                      ))}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Ingredients */}
      {ingredients.length > 0 && (
        <section className="detail-section">
          <div className="section-header" onClick={() => toggleSection('ingredients')}>
            <h3>
              {expandedSections.has('ingredients') ? '▼' : '▶'} Ingredients
              <span className="section-count">{ingredients.length}</span>
            </h3>
          </div>
          {expandedSections.has('ingredients') && (
            <div className="section-body">
              <div className="ingredient-grid">
                {ingredients.map(({ ref, name, type, item }) => (
                  <IngredientCard key={ref} ref_={ref} name={name} type={type} item={item} menu={menu} />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Modifier Groups */}
      {modifierGroups.length > 0 && (
        <section className="detail-section">
          <div className="section-header" onClick={() => toggleSection('modifiers')}>
            <h3>
              {expandedSections.has('modifiers') ? '▼' : '▶'} Modifier Groups
              <span className="section-count">{modifierGroups.length}</span>
            </h3>
          </div>
          {expandedSections.has('modifiers') && (
            <div className="section-body">
              {modifierGroups.map(({ ref, group, modifiers }) => (
                <ModifierGroupCard key={ref} ref_={ref} group={group} modifiers={modifiers} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Nutrition */}
      {product.nutrition && (
        <section className="detail-section">
          <div className="section-header" onClick={() => toggleSection('nutrition')}>
            <h3>{expandedSections.has('nutrition') ? '▼' : '▶'} Nutrition</h3>
          </div>
          {expandedSections.has('nutrition') && (
            <div className="section-body">
              <NutritionPanel nutrition={product.nutrition} />
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
                  navigator.clipboard.writeText(JSON.stringify(product, null, 2));
                  const btn = document.activeElement as HTMLButtonElement;
                  const prev = btn.innerHTML;
                  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
                  setTimeout(() => { btn.innerHTML = prev; }, 1200);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2"/></svg>
              </button>
              <pre className="raw-json">{JSON.stringify(product, null, 2)}</pre>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// Sub-components

function IngredientCard({
  ref_,
  name,
  type,
  item,
  menu,
}: {
  ref_: string;
  name: string;
  type: string;
  item: DisplayableItem | undefined;
  menu: Menu;
}) {
  const [expanded, setExpanded] = useState(false);

  // If this is a productGroup ref, resolve its children with overrides
  const children = useMemo(() => {
    if (type === 'productGroups' && item?.childRefs) {
      return Object.entries(item.childRefs)
        .filter(([ref]) => isProductRef(ref))
        .map(([ref, override]) => {
          const base = resolveRef(menu, ref) as Product;
          const merged = base ? mergeWithOverrides(base, (override ?? {}) as ChildRefOverride) : undefined;
          return {
            ref,
            product: merged as Product & { _overrides?: ChildRefOverride },
            overrides: override && hasOverrides(override as ChildRefOverride) ? (override as ChildRefOverride) : undefined,
          };
        })
        .filter((c) => c.product);
    }
    return [];
  }, [type, item, menu]);

  return (
    <div className={`ingredient-card ${type === 'productGroups' && item && 'isRecipe' in item && isRecipeGroup(item as ProductGroup) ? 'ingredient-card--recipe' : ''}`} onClick={() => setExpanded(!expanded)}>
      <div className="ingredient-header">
        <span className={`ingredient-type-badge ingredient-type--${type}`}>{type}</span>
        <span className="ingredient-name">{name}</span>
        {type === 'productGroups' && item && 'isRecipe' in item && isRecipeGroup(item as ProductGroup) && (
          <span className="mini-badge recipe">🍳 Recipe</span>
        )}
        <CopyRef value={ref_} display={getRefId(ref_)} className="ingredient-ref" />
      </div>
      {item && (
        <div className="ingredient-meta">
          {item.isAvailable != null && (
            <span className={`availability-dot ${item.isAvailable ? 'available' : 'unavailable'}`} title={item.isAvailable ? 'Available' : 'Unavailable'} />
          )}
          {item.price != null && item.price > 0 && (
            <span className="ingredient-price">+${item.price.toFixed(2)}</span>
          )}
          {item.isDefault && <span className="mini-badge default">Default</span>}
          {children.length > 0 && (
            <span className="ingredient-children-count">{children.length} options {expanded ? '▲' : '▼'}</span>
          )}
        </div>
      )}
      {expanded && children.length > 0 && (
        <div className="ingredient-children">
          {children.map(({ ref, product, overrides }) => (
            <div key={ref} className="ingredient-child">
              <span className={`availability-dot ${product.isAvailable ? 'available' : 'unavailable'}`} />
              <div className="ingredient-child-info">
                <span>{product.displayName || getRefId(ref)}</span>
                <CopyRef value={ref} display={getRefId(ref)} className="ingredient-child-id" />
              </div>
              <div className="ingredient-child-meta">
                {product.isDefault && <span className="mini-badge default">Default</span>}
                {overrides && <OverrideBadge overrides={overrides} />}
                {product.price != null && <span className="ingredient-price">${product.price.toFixed(2)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ModifierGroupCard({
  ref_,
  group,
  modifiers,
}: {
  ref_: string;
  group: ModifierGroupType;
  modifiers: Array<{ ref: string; modifier: Modifier }>;
}) {
  const [expanded, setExpanded] = useState(true);
  const sq = group.selectionQuantity;
  const isRequired = sq != null && (sq.min ?? 0) >= 1 && !hasDefaultModifier(modifiers);

  return (
    <div className={`modifier-group-card ${isRequired ? 'modifier-group-card--required' : ''}`}>
      <div className="modifier-group-header" onClick={() => setExpanded(!expanded)}>
        <div>
          <strong>{group.displayName}</strong>
          <CopyRef value={ref_} display={getRefId(ref_)} className="modifier-ref" />
        </div>
        <div className="modifier-group-meta">
          {sq && (
            <span className={`quantity-badge ${isRequired ? 'quantity-badge--required' : ''}`}>
              {formatSelectionQty(sq)}
            </span>
          )}
          {isRequired && <span className="required-badge">Required</span>}
          <span className="sidebar-badge">{modifiers.length}</span>
          <span>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {expanded && (
        <div className="modifier-list">
          {[...modifiers]
            .sort((a, b) => (a.modifier.displayOrder ?? 0) - (b.modifier.displayOrder ?? 0))
            .map(({ ref, modifier }) => (
              <div key={ref} className="modifier-item">
                <span className={`availability-dot ${modifier.isAvailable ? 'available' : 'unavailable'}`} />
                <span className="modifier-name">{modifier.displayName}</span>
                <CopyRef value={ref} display={getRefId(ref)} className="modifier-ref" />
                {modifier.isDefault && <span className="mini-badge default">Default</span>}
                {modifier.price > 0 && <span className="modifier-price">+${modifier.price.toFixed(2)}</span>}
                {modifier.nutrition?.totalCalories != null && (
                  <span className="modifier-cal">{modifier.nutrition.totalCalories} cal</span>
                )}
                {modifier.PLU != null && modifier.PLU !== undefined && (
                  <CopyRef value={String(modifier.PLU)} display={`PLU: ${modifier.PLU}`} className="modifier-plu" />
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

let _overrideBadgeCounter = 0;

function OverrideBadge({ overrides }: { overrides: ChildRefOverride }) {
  const [showDetail, setShowDetail] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const badgeRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const instanceId = useRef(`ob-${++_overrideBadgeCounter}`);
  const keys = Object.keys(overrides);

  const positionPopover = useCallback(() => {
    if (!badgeRef.current) return;
    const rect = badgeRef.current.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    // Position above if enough room, else below
    if (spaceAbove > 120 || spaceAbove > spaceBelow) {
      setPopoverStyle({
        position: 'fixed',
        top: rect.top - 8,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 280)),
        transform: 'translateY(-100%)',
      });
    } else {
      setPopoverStyle({
        position: 'fixed',
        top: rect.bottom + 8,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 280)),
      });
    }
  }, []);

  // Close this popover when another OverrideBadge opens
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail;
      if (id !== instanceId.current) setShowDetail(false);
    };
    window.addEventListener('override-badge-open', handler);
    return () => window.removeEventListener('override-badge-open', handler);
  }, []);

  // Close on outside click + escape key + scroll tracking
  useEffect(() => {
    if (!showDetail) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        badgeRef.current && !badgeRef.current.contains(target) &&
        popoverRef.current && !popoverRef.current.contains(target)
      ) {
        setShowDetail(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowDetail(false);
    };
    const handleScroll = () => positionPopover();

    document.addEventListener('mousedown', handleOutsideClick, true);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick, true);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [showDetail, positionPopover]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!showDetail) {
      positionPopover();
      window.dispatchEvent(new CustomEvent('override-badge-open', { detail: instanceId.current }));
    }
    setShowDetail((prev) => !prev);
  }, [showDetail, positionPopover]);

  // Stop the wrapper from letting clicks through to parent cards
  const stopProp = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

  return (
    <span className="override-badge-wrapper" onClick={stopProp}>
      <span
        ref={badgeRef}
        className="mini-badge override"
        role="button"
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle(e as unknown as React.MouseEvent); } }}
        title={`Click to see overrides: ${keys.join(', ')}`}
      >
        ⚡ {keys.length} override{keys.length > 1 ? 's' : ''}
      </span>
      {showDetail && (
        <div ref={popoverRef} className="override-detail" style={popoverStyle} onClick={stopProp}>
          <div className="override-detail-header">
            <span className="override-detail-title">Overridden Properties</span>
            <button className="override-detail-close" onClick={() => setShowDetail(false)}>✕</button>
          </div>
          {keys.map((key) => (
            <div key={key} className="override-detail-row">
              <span className="override-key">{key}</span>
              <code className="override-value">{JSON.stringify(overrides[key])}</code>
            </div>
          ))}
        </div>
      )}
    </span>
  );
}

function NutritionPanel({ nutrition }: { nutrition: NonNullable<Product['nutrition']> }) {
  return (
    <div className="nutrition-panel">
      {nutrition.totalCalories != null && (
        <div className="nutrition-calories">
          <span className="cal-number">{nutrition.totalCalories}</span>
          <span className="cal-label">Calories</span>
        </div>
      )}
      {nutrition.macroNutrients && Object.keys(nutrition.macroNutrients).length > 0 && (
        <table className="nutrition-table">
          <thead>
            <tr>
              <th>Nutrient</th>
              <th>Value</th>
              <th>Unit</th>
              <th>% Daily</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(nutrition.macroNutrients).map(([key, nutrient]) => (
              <tr key={key}>
                <td>{nutrient.name || key}</td>
                <td>{nutrient.value ?? '-'}</td>
                <td>{nutrient.unit ?? '-'}</td>
                <td>{nutrient.dailyValue != null ? `${nutrient.dailyValue}%` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {nutrition.allergicInformation && (
        <div className="allergy-info">
          <strong>Allergen Info:</strong> {nutrition.allergicInformation}
        </div>
      )}
    </div>
  );
}
