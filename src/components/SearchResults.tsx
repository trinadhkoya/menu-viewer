import { useMemo } from 'react';
import type { Menu } from '../types/menu';
import { searchMenu, getRefId } from '../utils/menuHelpers';

interface SearchResultsProps {
  menu: Menu;
  query: string;
  onProductSelect: (productRef: string) => void;
  onCategorySelect: (categoryRef: string) => void;
}

export function SearchResults({ menu, query, onProductSelect, onCategorySelect }: SearchResultsProps) {
  const results = useMemo(() => searchMenu(menu, query), [menu, query]);
  const totalResults = results.products.length + results.modifiers.length + results.categories.length;

  if (!query.trim()) return null;

  return (
    <div className="search-results">
      <div className="search-summary">
        <h2>Search Results for "{query}"</h2>
        <span className="search-total">{totalResults} results</span>
      </div>

      {results.categories.length > 0 && (
        <section className="search-section">
          <h3 className="search-section-title">
            📁 Categories <span className="section-count">{results.categories.length}</span>
          </h3>
          <div className="search-grid">
            {results.categories.map(({ ref, category }) => (
              <div
                key={ref}
                className="search-card search-card--category"
                onClick={() => onCategorySelect(ref)}
              >
                <div className="search-card-title">{category.displayName || getRefId(ref)}</div>
                <code className="search-card-ref">{ref}</code>
                {category.childRefs && (
                  <span className="search-card-meta">
                    {Object.keys(category.childRefs).length} items
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {results.products.length > 0 && (
        <section className="search-section">
          <h3 className="search-section-title">
            🍕 Products <span className="section-count">{results.products.length}</span>
          </h3>
          <div className="search-grid">
            {results.products.map(({ ref, product }) => (
              <div
                key={ref}
                className={`search-card search-card--product ${product.isCombo ? 'search-card--combo' : ''}`}
                onClick={() => onProductSelect(ref)}
              >
                <div className="search-card-header">
                  <span className={`availability-dot ${product.isAvailable ? 'available' : 'unavailable'}`} />
                  <span className="search-card-title">{product.displayName || getRefId(ref)}</span>
                </div>
                <code className="search-card-ref">{ref}</code>
                <div className="search-card-details">
                  {product.price != null && <span className="search-card-price">${product.price.toFixed(2)}</span>}
                  {product.calories != null && <span className="search-card-cal">{product.calories} cal</span>}
                  {product.isCombo && <span className="mini-badge combo">Combo</span>}
                </div>
                {product.description && (
                  <p className="search-card-desc">{product.description.slice(0, 100)}...</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {results.modifiers.length > 0 && (
        <section className="search-section">
          <h3 className="search-section-title">
            🔧 Modifiers <span className="section-count">{results.modifiers.length}</span>
          </h3>
          <div className="search-grid">
            {results.modifiers.map(({ ref, modifier }) => (
              <div key={ref} className="search-card search-card--modifier">
                <div className="search-card-header">
                  <span className={`availability-dot ${modifier.isAvailable ? 'available' : 'unavailable'}`} />
                  <span className="search-card-title">{modifier.displayName}</span>
                </div>
                <code className="search-card-ref">{ref}</code>
                <div className="search-card-details">
                  {modifier.price > 0 && <span className="search-card-price">+${modifier.price.toFixed(2)}</span>}
                  {modifier.nutrition?.totalCalories != null && (
                    <span className="search-card-cal">{modifier.nutrition.totalCalories} cal</span>
                  )}
                  <code className="search-card-plu">PLU: {modifier.PLU}</code>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {totalResults === 0 && (
        <div className="search-empty">
          <p>No results found for "{query}"</p>
          <p className="search-empty-hint">Try searching by product name, modifier name, or category</p>
        </div>
      )}
    </div>
  );
}
