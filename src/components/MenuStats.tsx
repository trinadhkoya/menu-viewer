import { useMemo } from 'react';
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

        <div className="product-grid">
          {categoryProducts.map(({ ref, product, subCategory }) => (
            <div
              key={ref}
              className={`product-card ${product.isCombo ? 'product-card--combo' : ''}`}
              onClick={() => onProductSelect(ref, categoryData.displayName ?? undefined)}
            >
              {product.imageUrl && (
                <OptimizedImage src={product.imageUrl} alt={product.displayName ?? ''} className="product-card-image" width={280} height={120} isCombo={product.isCombo} />
              )}
              <div className="product-card-body">
                <div className="product-card-header">
                  <span className={`availability-dot ${product.isAvailable ? 'available' : 'unavailable'}`} />
                  <span className="product-card-name">{product.displayName || getRefId(ref)}</span>
                </div>
                <CopyRef value={ref} display={getRefId(ref)} className="product-card-ref" />
                {subCategory && <span className="product-card-subcategory">{subCategory}</span>}
                <div className="product-card-meta">
                  {product.price != null && <span className="product-card-price">${product.price.toFixed(2)}</span>}
                  {product.calories != null && <span className="product-card-cal">{product.calories} cal</span>}
                </div>
                {product.description && (
                  <p className="product-card-desc">{product.description.slice(0, 80)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
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
