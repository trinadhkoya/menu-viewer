import { useState, useMemo } from 'react';
import type { Menu, Category, Product } from '../types/menu';
import {
  getTopLevelCategories,
  isCategoryRef,
  isProductRef,
  resolveRef,
  getRefId,
} from '../utils/menuHelpers';

interface SidebarProps {
  menu: Menu;
  selectedCategoryRef: string | null;
  selectedProductRef: string | null;
  onCategorySelect: (categoryRef: string) => void;
  onProductSelect: (productRef: string, categoryName?: string) => void;
}

export function Sidebar({
  menu,
  selectedCategoryRef,
  selectedProductRef,
  onCategorySelect,
  onProductSelect,
}: SidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const topCategories = useMemo(() => getTopLevelCategories(menu), [menu]);

  const toggleExpand = (ref: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) {
        next.delete(ref);
      } else {
        next.add(ref);
      }
      return next;
    });
  };

  const renderCategoryChildren = (category: Category, categoryRef: string, depth: number = 0) => {
    if (!category.childRefs) return null;
    const childKeys = Object.keys(category.childRefs);

    return (
      <ul className="sidebar-children" style={{ paddingLeft: depth > 0 ? 12 : 0 }}>
        {childKeys.map((childRef) => {
          if (isCategoryRef(childRef)) {
            const subCat = resolveRef(menu, childRef) as Category;
            if (!subCat) return null;
            const isExpanded = expandedCategories.has(childRef);
            // Use the subcategory's own childRefs for counting/listing — NOT the parent's override value
            const subCatChildRefs = subCat.childRefs;
            const productCount = subCatChildRefs ? Object.keys(subCatChildRefs).filter(isProductRef).length : 0;

            return (
              <li key={childRef} className="sidebar-subcategory">
                <div
                  className={`sidebar-item sidebar-item--subcategory ${selectedCategoryRef === childRef ? 'sidebar-item--active' : ''}`}
                  onClick={() => {
                    toggleExpand(childRef);
                    onCategorySelect(childRef);
                  }}
                >
                  <span className="sidebar-expand-icon">{isExpanded ? '▼' : '▶'}</span>
                  <span className="sidebar-item-name">{subCat.displayName || getRefId(childRef)}</span>
                  <span className="sidebar-badge">{productCount}</span>
                </div>
                {isExpanded && subCatChildRefs && renderCategoryChildren(subCat, childRef, depth + 1)}
              </li>
            );
          } else if (isProductRef(childRef)) {
            const product = resolveRef(menu, childRef) as Product;
            if (!product) return null;
            return (
              <li
                key={childRef}
                className={`sidebar-item sidebar-item--product ${selectedProductRef === childRef ? 'sidebar-item--active' : ''}`}
                onClick={() => onProductSelect(childRef, category.displayName)}
              >
                <span className={`availability-dot ${product.isAvailable ? 'available' : 'unavailable'}`} />
                <span className="sidebar-item-name">{product.displayName || getRefId(childRef)}</span>
                {product.price != null && <span className="sidebar-price">${product.price.toFixed(2)}</span>}
              </li>
            );
          }
          return null;
        })}
      </ul>
    );
  };

  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <h2>Categories</h2>
        <span className="sidebar-count">{topCategories.length}</span>
      </div>
      <ul className="sidebar-list">
        {topCategories.map(({ ref, category }) => {
          const isExpanded = expandedCategories.has(ref);
          const childCount = category.childRefs ? Object.keys(category.childRefs).length : 0;

          return (
            <li key={ref} className="sidebar-category">
              <div
                className={`sidebar-item sidebar-item--category ${selectedCategoryRef === ref ? 'sidebar-item--active' : ''}`}
                onClick={() => {
                  toggleExpand(ref);
                  onCategorySelect(ref);
                }}
              >
                <span className="sidebar-expand-icon">{isExpanded ? '▼' : '▶'}</span>
                <span className="sidebar-item-name">{category.displayName || getRefId(ref)}</span>
                <span className="sidebar-badge">{childCount}</span>
              </div>
              {isExpanded && renderCategoryChildren(category, ref, 1)}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
