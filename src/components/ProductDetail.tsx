import { useMemo, useState, useRef, useCallback } from 'react';
import type { Menu, Product, ModifierGroup as ModifierGroupType, Modifier, ProductGroup, DisplayableItem, ChildRefOverride } from '../types/menu';
import {
  getProductIngredients,
  getProductModifierGroups,
  getProductGroups,
  getVirtualProductAlternatives,
  getParentVirtualProducts,
  getRefId,
  resolveRef,
  isProductRef,
  mergeWithOverrides,
  hasOverrides,
} from '../utils/menuHelpers';

interface ProductDetailProps {
  menu: Menu;
  productRef: string;
  onProductSelect?: (productRef: string) => void;
}

export function ProductDetail({ menu, productRef, onProductSelect }: ProductDetailProps) {
  const productId = getRefId(productRef);
  const product = menu.products?.[productId] as Product | undefined;
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['info', 'ingredients', 'modifiers', 'nutrition', 'sizeVariants']),
  );

  const ingredients = useMemo(
    () => (product ? getProductIngredients(menu, product) : []),
    [menu, product],
  );

  const modifierGroups = useMemo(
    () => (product ? getProductModifierGroups(menu, product) : []),
    [menu, product],
  );

  const productGroups = useMemo(
    () => (product ? getProductGroups(menu, product, productRef) : []),
    [menu, product, productRef],
  );

  const sizeVariants = useMemo(
    () => (product ? getVirtualProductAlternatives(menu, product) : []),
    [menu, product],
  );

  const parentVirtualProducts = useMemo(
    () => (product && !product.isVirtual ? getParentVirtualProducts(menu, productRef) : []),
    [menu, product, productRef],
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

  return (
    <div className="product-detail">
      {/* Header */}
      <div className="detail-header">
        {product.imageUrl && (
          <img src={product.imageUrl} alt={product.displayName ?? ''} className="detail-image" />
        )}
        <div className="detail-title-area">
          <h2 className="detail-title">{product.displayName}</h2>
          <code className="detail-ref">{productRef}</code>
          <div className="detail-badges">
            <span className={`badge ${product.isAvailable ? 'badge--available' : 'badge--unavailable'}`}>
              {product.isAvailable ? '✓ Available' : '✗ Unavailable'}
            </span>
            {product.isCombo && <span className="badge badge--combo">Combo</span>}
            {product.isRecipe && <span className="badge badge--recipe">Recipe</span>}
            {product.isVirtual && <span className="badge badge--virtual">Virtual</span>}
            {product.isExclusive && <span className="badge badge--exclusive">Exclusive</span>}
          </div>
        </div>
      </div>

      {/* Parent Virtual Product Banner (sized product → virtual) */}
      {parentVirtualProducts.length > 0 && (
        <div className="virtual-parent-banner">
          <span className="virtual-parent-icon">↩</span>
          <div className="virtual-parent-content">
            <span className="virtual-parent-label">Size variant of</span>
            {parentVirtualProducts.map(({ virtualRef, virtualProduct, groupName }) => (
              <button
                key={virtualRef}
                className="virtual-parent-link"
                onClick={() => onProductSelect?.(virtualRef)}
                title={`Navigate to ${virtualProduct.displayName}`}
              >
                {virtualProduct.imageUrl && (
                  <img src={virtualProduct.imageUrl} alt="" className="virtual-parent-thumb" />
                )}
                <span className="virtual-parent-name">{virtualProduct.displayName}</span>
                <span className="badge badge--virtual" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>Virtual</span>
                <span className="virtual-parent-arrow">→</span>
              </button>
            ))}
          </div>
        </div>
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
                    <code className="modifier-ref">{getRefId(groupRef)}</code>
                    {group.selectionQuantity && (
                      <span className="quantity-badge">
                        Select {group.selectionQuantity.min ?? 0}–{group.selectionQuantity.max ?? '∞'}
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
                        {sizeProduct.imageUrl && (
                          <img src={sizeProduct.imageUrl} alt={sizeProduct.displayName ?? ''} className="size-variant-image" />
                        )}
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
                              <span className={`mini-badge ${sizeProduct.isAvailable ? 'available' : 'unavailable'}`}>
                                {sizeProduct.isAvailable ? '✓' : '✗'}
                              </span>
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
                  <tr>
                    <td className="info-label">PLU</td>
                    <td><code>{product.PLU}</code></td>
                  </tr>
                )}
                {product.id && (
                  <tr>
                    <td className="info-label">ID</td>
                    <td><code>{product.id}</code></td>
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
                {product.productGroupIds && product.productGroupIds.length > 0 && (
                  <tr>
                    <td className="info-label">Product Groups</td>
                    <td>
                      {product.productGroupIds.map((id) => (
                        <code key={id} className="ref-chip">{id}</code>
                      ))}
                    </td>
                  </tr>
                )}
                {product.quantity && (
                  <tr>
                    <td className="info-label">Quantity</td>
                    <td>
                      Min: {product.quantity.min ?? '-'} | Max: {product.quantity.max ?? '-'} | Default: {product.quantity.default ?? '-'}
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

      {/* Product Groups */}
      {productGroups.length > 0 && (
        <section className="detail-section">
          <div className="section-header" onClick={() => toggleSection('productGroups')}>
            <h3>
              {expandedSections.has('productGroups') ? '▼' : '▶'} Product Groups
              <span className="section-count">{productGroups.length}</span>
            </h3>
          </div>
          {expandedSections.has('productGroups') && (
            <div className="section-body">
              {productGroups.map(({ ref, group, children }) => (
                <ProductGroupCard key={ref} ref_={ref} group={group} children_={children} />
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
            <pre className="raw-json">{JSON.stringify(product, null, 2)}</pre>
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
    <div className="ingredient-card" onClick={() => setExpanded(!expanded)}>
      <div className="ingredient-header">
        <span className={`ingredient-type-badge ingredient-type--${type}`}>{type}</span>
        <span className="ingredient-name">{name}</span>
        <code className="ingredient-ref">{getRefId(ref_)}</code>
      </div>
      {item && (
        <div className="ingredient-meta">
          {item.isAvailable != null && (
            <span className={`mini-badge ${item.isAvailable ? 'available' : 'unavailable'}`}>
              {item.isAvailable ? '✓' : '✗'}
            </span>
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
                <code className="ingredient-child-id">{getRefId(ref)}</code>
              </div>
              {product.price != null && <span className="ingredient-price">${product.price.toFixed(2)}</span>}
              {product.isDefault && <span className="mini-badge default">Default</span>}
              {overrides && <OverrideBadge overrides={overrides} />}
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

  return (
    <div className="modifier-group-card">
      <div className="modifier-group-header" onClick={() => setExpanded(!expanded)}>
        <div>
          <strong>{group.displayName}</strong>
          <code className="modifier-ref">{getRefId(ref_)}</code>
        </div>
        <div className="modifier-group-meta">
          {group.selectionQuantity && (
            <span className="quantity-badge">
              Select {group.selectionQuantity.min ?? 0}–{group.selectionQuantity.max ?? '∞'}
            </span>
          )}
          <span className="sidebar-badge">{modifiers.length}</span>
          <span>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {expanded && (
        <div className="modifier-list">
          {modifiers
            .sort((a, b) => (a.modifier.displayOrder ?? 0) - (b.modifier.displayOrder ?? 0))
            .map(({ ref, modifier }) => (
              <div key={ref} className="modifier-item">
                <span className={`availability-dot ${modifier.isAvailable ? 'available' : 'unavailable'}`} />
                <span className="modifier-name">{modifier.displayName}</span>
                {modifier.isDefault && <span className="mini-badge default">Default</span>}
                {modifier.price > 0 && <span className="modifier-price">+${modifier.price.toFixed(2)}</span>}
                {modifier.nutrition?.totalCalories != null && (
                  <span className="modifier-cal">{modifier.nutrition.totalCalories} cal</span>
                )}
                <code className="modifier-plu">PLU: {modifier.PLU}</code>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function ProductGroupCard({
  ref_,
  group,
  children_,
}: {
  ref_: string;
  group: ProductGroup;
  children_: Array<{ ref: string; name: string; item: DisplayableItem | undefined; isCurrentProduct: boolean; overrides?: ChildRefOverride }>;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="modifier-group-card">
      <div className="modifier-group-header" onClick={() => setExpanded(!expanded)}>
        <div>
          <strong>{group.displayName}</strong>
          <code className="modifier-ref">{getRefId(ref_)}</code>
          {group.description && (
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
              {group.description}
            </div>
          )}
        </div>
        <div className="modifier-group-meta">
          {group.selectionQuantity && (
            <span className="quantity-badge">
              Select {group.selectionQuantity.min ?? 0}–{group.selectionQuantity.max ?? '∞'}
            </span>
          )}
          <span className="sidebar-badge">{children_.length}</span>
          <span>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {expanded && (
        <div className="modifier-list">
          {children_.map(({ ref, name, item, isCurrentProduct, overrides }) => (
            <div
              key={ref}
              className="modifier-item"
              style={isCurrentProduct ? { background: 'rgba(99, 102, 241, 0.08)', borderLeft: '3px solid var(--color-accent)' } : {}}
            >
              {item?.isAvailable != null && (
                <span className={`availability-dot ${item.isAvailable ? 'available' : 'unavailable'}`} />
              )}
              <span className="modifier-name">
                {name}
                {isCurrentProduct && <span className="mini-badge default" style={{ marginLeft: 6 }}>Current</span>}
              </span>
              {item?.isDefault && <span className="mini-badge default">Default</span>}
              {item?.price != null && item.price > 0 && (
                <span className="modifier-price">${item.price.toFixed(2)}</span>
              )}
              {item?.calories != null && (
                <span className="modifier-cal">{item.calories} cal</span>
              )}
              {overrides && <OverrideBadge overrides={overrides} />}
              <code className="modifier-plu">{getRefId(ref)}</code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OverrideBadge({ overrides }: { overrides: ChildRefOverride }) {
  const [showDetail, setShowDetail] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const badgeRef = useRef<HTMLSpanElement>(null);
  const keys = Object.keys(overrides);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showDetail && badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect();
      setPopoverStyle({
        top: rect.top - 8,
        left: rect.left,
        transform: 'translateY(-100%)',
      });
    }
    setShowDetail((prev) => !prev);
  }, [showDetail]);

  return (
    <span className="override-badge-wrapper">
      <span
        ref={badgeRef}
        className="mini-badge override"
        onClick={handleToggle}
        title={`Overrides: ${keys.join(', ')}`}
      >
        ⚡ {keys.length} override{keys.length > 1 ? 's' : ''}
      </span>
      {showDetail && (
        <div className="override-detail" style={popoverStyle} onClick={(e) => e.stopPropagation()}>
          <div className="override-detail-title">Overridden Properties</div>
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
