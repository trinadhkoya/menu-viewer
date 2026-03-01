import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import type { Menu, Product } from '../types/menu';
import type { BrandId } from './MenuUploader';
import { OptimizedImage } from './OptimizedImage';
import { CopyRef } from './CopyRef';
import { getProductPlaceholder } from '../utils/placeholderImage';
import {
  getMenuStats,
  getTopLevelCategories,
  resolveRef,
  isCategoryRef,
  isProductRef,
  getRefId,
  resolveVirtualToDefault,
} from '../utils/menuHelpers';

interface MenuStatsProps {
  menu: Menu;
  selectedCategoryRef: string | null;
  onProductSelect: (productRef: string, categoryName?: string) => void;
  onCategorySelect?: (categoryRef: string) => void;
  onNavigate?: (tab: 'constructs' | 'data-quality' | 'diff') => void;
  activeBrand?: BrandId | null;
}

export function MenuStats({ menu, selectedCategoryRef, onProductSelect, onCategorySelect, onNavigate, activeBrand }: MenuStatsProps) {
  const stats = useMemo(() => getMenuStats(menu), [menu]);
  const topCategories = useMemo(() => getTopLevelCategories(menu), [menu]);

  // If a category is selected, show its products
  const categoryEntity = selectedCategoryRef ? resolveRef(menu, selectedCategoryRef) : null;
  const categoryData = categoryEntity as (import('../types/menu').Category | null);

  const categoryProducts = useMemo(() => {
    if (!categoryData?.childRefs) return [];
    const products: Array<{ ref: string; product: Product; subCategory?: string }> = [];

    const collectProducts = (
      childRefs: Record<string, unknown>,
      parentCategoryName?: string,
    ) => {
      for (const childRef of Object.keys(childRefs)) {
        if (isProductRef(childRef)) {
          const rawProduct = resolveRef(menu, childRef) as Product;
          if (!rawProduct) continue;

          // Resolve virtual products to their default sized variant
          let finalRef = childRef;
          let product = rawProduct;
          if (rawProduct.isVirtual) {
            const resolved = resolveVirtualToDefault(menu, rawProduct);
            if (resolved) {
              finalRef = resolved.ref;
              product = resolved.product;
            }
          }

          products.push({ ref: finalRef, product, subCategory: parentCategoryName });
        } else if (isCategoryRef(childRef)) {
          // Resolve the subcategory and read ITS childRefs — not the parent override value
          const subCat = resolveRef(menu, childRef) as import('../types/menu').Category | undefined;
          if (subCat?.childRefs) {
            collectProducts(
              subCat.childRefs as Record<string, unknown>,
              subCat.displayName || getRefId(childRef),
            );
          }
        }
      }
    };

    collectProducts(categoryData.childRefs as Record<string, unknown>);
    return products;
  }, [categoryData, menu]);

  // These hooks MUST be above any conditional return (Rules of Hooks)
  const catSectionRef = useRef<HTMLDivElement>(null);

  const statCards = useMemo(() => [
    { key: 'products', label: 'Products', value: stats.totalProducts },
    { key: 'categories', label: 'Categories', value: stats.totalCategories, action: () => catSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) },
    { key: 'modifiers', label: 'Modifiers', value: stats.totalModifiers },
    { key: 'modifierGroups', label: 'Modifier Groups', value: stats.totalModifierGroups },
    { key: 'productGroups', label: 'Product Groups', value: stats.totalProductGroups },
  ], [stats]);

  if (selectedCategoryRef && categoryData) {
    return (
      <div className="menu-stats">
        <div className="category-overview">
          <h2>{categoryData.displayName || getRefId(selectedCategoryRef)}</h2>
          <p className="category-ref">
            <CopyRef value={selectedCategoryRef} />
          </p>
          {categoryData.hasSubCategories && (
            <span className="mini-badge">Has Subcategories</span>
          )}
          <span className="products-count">{categoryProducts.length} products</span>
        </div>

        {categoryProducts.length === 0 ? (
          <div className="category-empty">
            <svg className="category-empty-icon" viewBox="0 0 64 64" fill="none" width="56" height="56">
              <rect x="8" y="14" width="48" height="36" rx="4" stroke="currentColor" strokeWidth="2" />
              <path d="M8 24h48" stroke="currentColor" strokeWidth="2" opacity="0.3" />
              <circle cx="32" cy="38" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
              <line x1="29" y1="38" x2="35" y2="38" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
            </svg>
            <p className="category-empty-title">No products in this category</p>
            <p className="category-empty-hint">This category may only contain subcategories, or it&rsquo;s currently empty.</p>
          </div>
        ) : (
        <div className="product-grid">
          {categoryProducts.map(({ ref, product }) => (
            <ProductCard
              key={ref}
              ref_={ref}
              product={product}
              onClick={() => onProductSelect(ref, categoryData.displayName ?? undefined)}              activeBrand={activeBrand}            />
          ))}
        </div>
        )}
      </div>
    );
  }

  // Default: show menu overview
  return (
    <div className="menu-stats">
      {/* ── Unified hero banner ── */}
      <div className="ms-hero">
        <div className="ms-hero-top">
          <div className="ms-hero-text">
            <h2 className="ms-hero-title">Menu Overview</h2>
            <p className="ms-hero-name">{stats.menuType}</p>
          </div>
          <span className={`ms-availability ms-availability--${stats.isAvailable ? 'on' : 'off'}`}>
            <span className="ms-availability-dot" />
            {stats.isAvailable ? 'Available' : 'Unavailable'}
          </span>
        </div>

        {/* Stat pills — inline */}
        <div className="ms-stat-pills">
          {statCards.map((s) => (
            <button
              key={s.key}
              className={`ms-stat-pill ${s.value === 0 ? 'ms-stat-pill--zero' : ''}`}
              onClick={s.action}
              tabIndex={s.action ? 0 : -1}
              style={{ cursor: s.action ? 'pointer' : 'default' }}
            >
              <span className="ms-stat-pill-value">{s.value}</span>
              <span className="ms-stat-pill-label">{s.label}</span>
            </button>
          ))}
        </div>

        {/* Quick actions row */}
        <div className="ms-hero-actions">
          <button className="ms-hero-action ms-hero-action--quality" onClick={() => onNavigate?.('data-quality')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
            Quality Check
            <svg className="ms-hero-action-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
          <button className="ms-hero-action ms-hero-action--constructs" onClick={() => onNavigate?.('constructs')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" />
              <path d="M13 6h3a2 2 0 012 2v7" /><path d="M6 9v12" />
            </svg>
            Constructs
            <svg className="ms-hero-action-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      </div>

      {/* ── Category grid ── */}
      <div ref={catSectionRef}>
        <h3 className="ms-section-heading">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>
          Top-Level Categories
          <span className="ms-section-count">{topCategories.length}</span>
        </h3>
      </div>
      <div className="ms-category-grid">
        {topCategories.map(({ ref, category }, i) => {
          const childCount = category.childRefs ? Object.keys(category.childRefs).length : 0;
          return (
            <div
              key={ref}
              className="ms-cat-card"
              onClick={() => onCategorySelect?.(ref)}
              style={{ '--cat-i': i } as React.CSSProperties}
            >
              <div className="ms-cat-card-img">
                <OptimizedImage src={category.imageUrl || getProductPlaceholder(activeBrand)} alt={category.displayName} className="ms-cat-image" width={280} height={110} />
                <span className="ms-cat-count-overlay">{childCount} items</span>
                {category.hasSubCategories && <span className="ms-cat-sub-badge">Sub&thinsp;↓</span>}
              </div>
              <div className="ms-cat-card-body">
                <strong className="ms-cat-name">{category.displayName}</strong>
                <CopyRef value={ref} display={getRefId(ref)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Product card with hover preview tooltip ── */
interface ProductCardProps {
  ref_: string;
  product: Product;
  onClick: () => void;
  activeBrand?: BrandId | null;
}

/** CSS-safe view-transition-name from a product ref */
function vtName(ref: string, suffix: string) {
  return `product-${ref.replace(/[^a-zA-Z0-9]/g, '-')}-${suffix}`;
}

function ProductCard({ ref_, product, onClick, activeBrand }: ProductCardProps) {
  const [showTip, setShowTip] = useState(false);
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTipPos({ x: rect.left + rect.width / 2, y: rect.top });
    setShowTip(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    hideTimer.current = setTimeout(() => setShowTip(false), 120);
  }, []);

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  const hasInfo = product.price != null || product.calories != null || product.isAvailable != null || product.isCombo;

  return (
    <div
      ref={cardRef}
      className="product-card"
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="product-card-image-wrapper" style={{ viewTransitionName: vtName(ref_, 'img') }}>
        <OptimizedImage src={product.imageUrl || getProductPlaceholder(activeBrand)} alt={product.displayName ?? ''} className="product-card-image" width={280} height={120} isCombo={product.isCombo} />
      </div>
      <div className="product-card-body">
        <div className="product-card-name-row">
          <span className={`availability-dot ${product.isAvailable ? 'available' : 'unavailable'}`} />
          <span className="product-card-name" style={{ viewTransitionName: vtName(ref_, 'name') }}>{product.displayName || getRefId(ref_)}</span>
        </div>
        <CopyRef value={ref_} display={getRefId(ref_)} />
        {(product.price != null || product?.nutrition?.totalCalories != null) && (
          <div className="product-card-meta">
            {product.price != null && (
              <span className="product-card-price">${product.price.toFixed(2)}</span>
            )}
            {product.price != null && product?.nutrition?.totalCalories != null && (
              <span className="product-card-dot">·</span>
            )}
            {product?.nutrition?.totalCalories != null && (
              <span className="product-card-cal">{product.nutrition.totalCalories} cal</span>
            )}
          </div>
        )}
      </div>

      {/* Hover preview tooltip */}
      {showTip && hasInfo && tipPos && (
        <div
          className="product-tooltip"
          style={{ left: '50%', transform: 'translateX(-50%)' }}
        >
          <div className="product-tooltip-row">
            {product.isAvailable != null && (
              <span className={`availability-dot ${product.isAvailable ? 'available' : 'unavailable'}`} />
            )}
            {product.price != null && (
              <span className="tooltip-price">${product.price.toFixed(2)}</span>
            )}
            {product.calories != null && (
              <span className="tooltip-cal">{product.calories} cal</span>
            )}
            {product.isCombo && (
              <span className="tooltip-combo">Combo</span>
            )}
          </div>
          {product.description && (
            <p className="tooltip-desc">{product.description.slice(0, 90)}{product.description.length > 90 ? '…' : ''}</p>
          )}
        </div>
      )}
    </div>
  );
}
