import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import type { Menu, Product } from '../types/menu';
import { OptimizedImage } from './OptimizedImage';
import { CopyRef } from './CopyRef';
import {
  getMenuStats,
  getTopLevelCategories,
  resolveRef,
  isCategoryRef,
  isProductRef,
  getRefId,
} from '../utils/menuHelpers';

interface MenuStatsProps {
  menu: Menu;
  selectedCategoryRef: string | null;
  onProductSelect: (productRef: string, categoryName?: string) => void;
  onCategorySelect?: (categoryRef: string) => void;
}

export function MenuStats({ menu, selectedCategoryRef, onProductSelect, onCategorySelect }: MenuStatsProps) {
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
          const product = resolveRef(menu, childRef) as Product;
          if (product) products.push({ ref: childRef, product, subCategory: parentCategoryName });
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
              onClick={() => onProductSelect(ref, categoryData.displayName ?? undefined)}
            />
          ))}
        </div>
        )}
      </div>
    );
  }

  // Default: show menu overview
  return (
    <div className="menu-stats">
      <h2>Menu Overview</h2>
      <p className="menu-name">{stats.menuType}</p>
      <span className={`badge ${stats.isAvailable ? 'badge--available' : 'badge--unavailable'}`}>
        {stats.isAvailable ? '✓ Available' : '✗ Unavailable'}
      </span>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-number">{stats.totalProducts}</span>
          <span className="stat-label">Products</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{stats.totalCategories}</span>
          <span className="stat-label">Categories</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{stats.totalModifiers}</span>
          <span className="stat-label">Modifiers</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{stats.totalModifierGroups}</span>
          <span className="stat-label">Modifier Groups</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{stats.totalProductGroups}</span>
          <span className="stat-label">Product Groups</span>
        </div>
      </div>

      <h3 className="categories-heading">Top-Level Categories</h3>
      <div className="category-grid">
        {topCategories.map(({ ref, category }) => {
          const childCount = category.childRefs ? Object.keys(category.childRefs).length : 0;
          return (
            <div
              key={ref}
              className="category-card"
              onClick={() => onCategorySelect?.(ref)}
            >
              {category.imageUrl && (
                <OptimizedImage src={category.imageUrl} alt={category.displayName} className="category-card-image" width={280} height={100} />
              )}
              <div className="category-card-body">
                <strong>{category.displayName}</strong>
                <CopyRef value={ref} display={getRefId(ref)} />
                <span>{childCount} items</span>
                {category.hasSubCategories && <span className="mini-badge">Subcategories</span>}
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
}

function ProductCard({ ref_, product, onClick }: ProductCardProps) {
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
      {product.imageUrl ? (
        <OptimizedImage src={product.imageUrl} alt={product.displayName ?? ''} className="product-card-image" width={280} height={120} isCombo={product.isCombo} />
      ) : (
        <div className="product-card-placeholder">
          <svg viewBox="0 0 48 48" fill="none" width="32" height="32">
            <rect x="6" y="10" width="36" height="28" rx="3" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="17" cy="21" r="3.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M6 34l10-8 5 4 8-10 13 14" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </div>
      )}
      <div className="product-card-body">
        <span className="product-card-name">{product.displayName || getRefId(ref_)}</span>
      </div>

      {/* Hover preview tooltip */}
      {showTip && hasInfo && tipPos && (
        <div
          className="product-tooltip"
          style={{ left: '50%', transform: 'translateX(-50%)' }}
        >
          <div className="product-tooltip-row">
            {product.isAvailable != null && (
              <span className={`tooltip-dot ${product.isAvailable ? 'available' : 'unavailable'}`} />
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
