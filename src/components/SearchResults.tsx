import { useMemo } from 'react';
import type { Menu } from '../types/menu';
import { searchMenu, getRefId } from '../utils/menuHelpers';

/** Small pill showing match quality */
function MatchBadge({ score }: { score: number }) {
  if (score >= 90) return null; // exact match — no badge needed
  const label = score >= 70 ? 'Close' : 'Fuzzy';
  const cls = score >= 70 ? 'match-badge--close' : 'match-badge--fuzzy';
  return <span className={`match-badge ${cls}`}>{label}</span>;
}

interface SearchResultsProps {
  menu: Menu;
  query: string;
  onProductSelect: (productRef: string) => void;
  onCategorySelect: (categoryRef: string) => void;
  onProductGroupSelect?: (ref: string) => void;
  onModifierGroupSelect?: (ref: string) => void;
}

export function SearchResults({ menu, query, onProductSelect, onCategorySelect, onProductGroupSelect, onModifierGroupSelect }: SearchResultsProps) {
  const results = useMemo(() => searchMenu(menu, query), [menu, query]);
  const totalResults = results.products.length + results.modifiers.length + results.categories.length + results.modifierGroups.length + results.productGroups.length;

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
            {results.categories.map(({ ref, category, score }) => (
              <div
                key={ref}
                className="search-card search-card--category"
                onClick={() => onCategorySelect(ref)}
              >
                <div className="search-card-title">{category.displayName || getRefId(ref)} <MatchBadge score={score} /></div>
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
            {results.products.map(({ ref, product, score }) => (
              <div
                key={ref}
                className={`search-card search-card--product ${product.isCombo ? 'search-card--combo' : ''}`}
                onClick={() => onProductSelect(ref)}
              >
                <div className="search-card-header">
                  <span className={`availability-dot ${product.isAvailable ? 'available' : 'unavailable'}`} />
                  <span className="search-card-title">{product.displayName || getRefId(ref)}</span>
                  <MatchBadge score={score} />
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
            {results.modifiers.map(({ ref, modifier, score }) => (
              <div key={ref} className="search-card search-card--modifier">
                <div className="search-card-header">
                  <span className={`availability-dot ${modifier.isAvailable ? 'available' : 'unavailable'}`} />
                  <span className="search-card-title">{modifier.displayName}</span>
                  <MatchBadge score={score} />
                </div>
                <code className="search-card-ref">{ref}</code>
                <div className="search-card-details">
                  {modifier.price > 0 && <span className="search-card-price">+${modifier.price.toFixed(2)}</span>}
                  {modifier.nutrition?.totalCalories != null && (
                    <span className="search-card-cal">{modifier.nutrition.totalCalories} cal</span>
                  )}
                  {modifier.PLU != null && <code className="search-card-plu">PLU: {modifier.PLU}</code>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {results.modifierGroups.length > 0 && (
        <section className="search-section">
          <h3 className="search-section-title">
            🗂️ Modifier Groups <span className="section-count">{results.modifierGroups.length}</span>
          </h3>
          <div className="search-grid">
            {results.modifierGroups.map(({ ref, modifierGroup, score }) => {
              const childCount = modifierGroup.childRefs ? Object.keys(modifierGroup.childRefs).length : 0;
              const { min, max } = modifierGroup.selectionQuantity || {} as Record<string, number | undefined>;
              return (
                <div key={ref} className="search-card search-card--modifier-group" onClick={() => onModifierGroupSelect?.(ref)} style={{ cursor: onModifierGroupSelect ? 'pointer' : undefined }}>
                  <div className="search-card-title">{modifierGroup.displayName || getRefId(ref)} <MatchBadge score={score} /></div>
                  <code className="search-card-ref">{ref}</code>
                  <div className="search-card-details">
                    <span className="search-card-meta">{childCount} modifier{childCount !== 1 ? 's' : ''}</span>
                    {(min != null || max != null) && (
                      <span className="search-card-meta">
                        Select {min ?? 0}–{max ?? '∞'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {results.productGroups.length > 0 && (
        <section className="search-section">
          <h3 className="search-section-title">
            📦 Product Groups <span className="section-count">{results.productGroups.length}</span>
          </h3>
          <div className="search-grid">
            {results.productGroups.map(({ ref, productGroup, score }) => {
              const childCount = productGroup.childRefs ? Object.keys(productGroup.childRefs).length : 0;
              return (
                <div key={ref} className="search-card search-card--product-group" onClick={() => onProductGroupSelect?.(ref)} style={{ cursor: onProductGroupSelect ? 'pointer' : undefined }}>
                  <div className="search-card-title">{productGroup.displayName || getRefId(ref)} <MatchBadge score={score} /></div>
                  <code className="search-card-ref">{ref}</code>
                  <div className="search-card-details">
                    <span className="search-card-meta">{childCount} product{childCount !== 1 ? 's' : ''}</span>
                    {productGroup.isRecipe && <span className="mini-badge">Recipe</span>}
                    {productGroup.description && (
                      <p className="search-card-desc">{productGroup.description.slice(0, 80)}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {totalResults === 0 && (
        <div className="search-empty">
          <svg className="search-empty-icon" viewBox="0 0 64 64" fill="none" width="64" height="64">
            <circle cx="28" cy="28" r="20" stroke="currentColor" strokeWidth="2.5" />
            <line x1="42" y1="42" x2="56" y2="56" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <line x1="20" y1="28" x2="36" y2="28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
          </svg>
          <p className="search-empty-title">No results for &ldquo;{query}&rdquo;</p>
          <p className="search-empty-hint">Try a different spelling, a product name, modifier, or category keyword.</p>
        </div>
      )}
    </div>
  );
}
