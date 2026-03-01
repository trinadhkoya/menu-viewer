import { useMemo, useState } from 'react';
import type { Menu, Modifier, ModifierGroup, ChildRefOverride, Quantity } from '../types/menu';
import { CopyRef } from './CopyRef';
import {
  getRefId,
  hasOverrides,
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

function hasDefaultModifier(modifiers: Array<{ modifier: Modifier }>): boolean {
  return modifiers.some(({ modifier }) => modifier.isDefault);
}

interface ModifierGroupDetailProps {
  menu: Menu;
  modifierGroupRef: string;
  onBack?: () => void;
}

export function ModifierGroupDetail({ menu, modifierGroupRef, onBack }: ModifierGroupDetailProps) {
  const groupId = getRefId(modifierGroupRef);
  const group = menu.modifierGroups?.[groupId] as ModifierGroup | undefined;
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['info', 'modifiers', 'usedBy', 'raw']),
  );

  // Resolve child modifiers
  const childModifiers = useMemo(() => {
    if (!group?.childRefs) return [];
    return Object.entries(group.childRefs)
      .map(([ref, override]) => {
        const modId = getRefId(ref);
        const modifier = menu.modifiers?.[modId];
        if (!modifier) return null;
        return {
          ref,
          modifier,
          overrides: override && hasOverrides(override as ChildRefOverride) ? (override as ChildRefOverride) : undefined,
        };
      })
      .filter(Boolean) as Array<{
        ref: string;
        modifier: Modifier;
        overrides: ChildRefOverride | undefined;
      }>;
  }, [group, menu]);

  // Find products that use this modifier group
  const referencingProducts = useMemo(() => {
    if (!menu.products) return [];
    return Object.entries(menu.products)
      .filter(([, p]) => {
        if (!p.modifierGroupRefs) return false;
        return Object.keys(p.modifierGroupRefs).some(ref => getRefId(ref) === groupId);
      })
      .map(([id, product]) => ({ ref: `products.${id}`, product }))
      .slice(0, 30);
  }, [menu, groupId]);

  // Find modifiers that have nested modifier group refs pointing to this group
  const nestedFrom = useMemo(() => {
    if (!menu.modifiers) return [];
    return Object.entries(menu.modifiers)
      .filter(([, m]) => {
        if (!m.modifierGroupRefs) return false;
        return Object.keys(m.modifierGroupRefs).some(ref => getRefId(ref) === groupId);
      })
      .map(([id, modifier]) => ({ ref: `modifiers.${id}`, modifier }))
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
        <p>Modifier Group not found: <code>{modifierGroupRef}</code></p>
      </div>
    );
  }

  const sq = group.selectionQuantity;
  const isRequired = sq != null && (sq.min ?? 0) >= 1 && !hasDefaultModifier(childModifiers);

  return (
    <div className="product-detail group-detail mg-detail">
      {/* Back button */}
      {onBack && (
        <button className="group-detail-back" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Back
        </button>
      )}

      {/* Header */}
      <div className="detail-header group-detail-header">
        <div className="group-detail-icon mg-detail-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <div className="detail-title-area">
          <h2 className="detail-title">{group.displayName}</h2>
          <CopyRef value={modifierGroupRef} className="detail-ref" />
          <div className="detail-badges">
            {isRequired && <span className="badge badge--required">Required</span>}
            {sq && (
              <span className="quantity-badge">
                {formatSelectionQty(sq)}
              </span>
            )}
            <span className="badge badge--group badge--mg">
              🗂️ Modifier Group
            </span>
          </div>
        </div>
      </div>

      {/* Info Section */}
      <section className="detail-section">
        <div className="section-header" onClick={() => toggleSection('info')}>
          <h3>{expandedSections.has('info') ? '▼' : '▶'} Group Info</h3>
        </div>
        {expandedSections.has('info') && (
          <div className="section-body">
            <table className="info-table">
              <tbody>
                {group.id && (
                  <tr className="info-row-ref">
                    <td className="info-label">ID</td>
                    <td><CopyRef value={group.id} /></td>
                  </tr>
                )}
                <tr>
                  <td className="info-label">Required</td>
                  <td>{isRequired ? <span className="required-badge">Yes — no default</span> : 'No'}</td>
                </tr>
                {sq && (
                  <tr>
                    <td className="info-label">Selection</td>
                    <td>
                      <span className="qty-chips">
                        <span className="qty-chip">
                          <span className="qty-chip-label">min</span>
                          <span className="qty-chip-value">{sq.min ?? 0}</span>
                        </span>
                        <span className="qty-chip">
                          <span className="qty-chip-label">max</span>
                          <span className="qty-chip-value">{sq.max ?? '∞'}</span>
                        </span>
                        {sq.default != null && (
                          <span className="qty-chip qty-chip--default">
                            <span className="qty-chip-label">default</span>
                            <span className="qty-chip-value">{sq.default}</span>
                          </span>
                        )}
                        {sq.free != null && (
                          <span className="qty-chip">
                            <span className="qty-chip-label">free</span>
                            <span className="qty-chip-value">{sq.free}</span>
                          </span>
                        )}
                      </span>
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="info-label">Modifiers</td>
                  <td>{childModifiers.length} modifier{childModifiers.length !== 1 ? 's' : ''}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Child Modifiers */}
      {childModifiers.length > 0 && (
        <section className="detail-section">
          <div className="section-header" onClick={() => toggleSection('modifiers')}>
            <h3>
              {expandedSections.has('modifiers') ? '▼' : '▶'} Modifiers
              <span className="section-count">{childModifiers.length}</span>
            </h3>
          </div>
          {expandedSections.has('modifiers') && (
            <div className="section-body">
              <div className="mg-modifier-list">
                {[...childModifiers]
                  .sort((a, b) => (a.modifier.displayOrder ?? 0) - (b.modifier.displayOrder ?? 0))
                  .map(({ ref, modifier, overrides }) => (
                    <div key={ref} className={`mg-modifier-card ${modifier.isDefault ? 'mg-modifier-card--default' : ''}`}>
                      <div className="mg-modifier-main">
                        <span className={`availability-dot ${modifier.isAvailable ? 'available' : 'unavailable'}`} />
                        <div className="mg-modifier-info">
                          <span className="mg-modifier-name">{modifier.displayName}</span>
                          <CopyRef value={ref} display={getRefId(ref)} className="mg-modifier-ref" />
                        </div>
                        <div className="mg-modifier-meta">
                          {modifier.isDefault && <span className="mini-badge default">Default</span>}
                          {modifier.isExclusive && <span className="mini-badge">Exclusive</span>}
                          {overrides && (
                            <span className="mini-badge override" title={`Overrides: ${Object.keys(overrides).join(', ')}`}>
                              ⚡ {Object.keys(overrides).length}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mg-modifier-stats">
                        {modifier.price > 0 && <span className="mg-modifier-price">+${modifier.price.toFixed(2)}</span>}
                        {modifier.price === 0 && <span className="mg-modifier-price mg-modifier-price--free">Free</span>}
                        {modifier.nutrition?.totalCalories != null && (
                          <span className="mg-modifier-cal">{modifier.nutrition.totalCalories} cal</span>
                        )}
                        {modifier.PLU != null && (
                          <CopyRef value={String(modifier.PLU)} display={`PLU: ${modifier.PLU}`} className="mg-modifier-plu" />
                        )}
                      </div>
                      {modifier.tags && modifier.tags.length > 0 && (
                        <div className="mg-modifier-tags">
                          {modifier.tags.map((tag) => (
                            <span key={tag} className="tag">{tag}</span>
                          ))}
                        </div>
                      )}
                      {modifier.quantity && (
                        <div className="mg-modifier-qty">
                          <span className="qty-chips">
                            <span className="qty-chip">
                              <span className="qty-chip-label">min</span>
                              <span className="qty-chip-value">{modifier.quantity.min ?? 0}</span>
                            </span>
                            <span className="qty-chip">
                              <span className="qty-chip-label">max</span>
                              <span className="qty-chip-value">{modifier.quantity.max ?? '∞'}</span>
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Used By Products */}
      {referencingProducts.length > 0 && (
        <section className="detail-section">
          <div className="section-header" onClick={() => toggleSection('usedBy')}>
            <h3>
              {expandedSections.has('usedBy') ? '▼' : '▶'} Used By Products
              <span className="section-count">{referencingProducts.length}</span>
            </h3>
          </div>
          {expandedSections.has('usedBy') && (
            <div className="section-body">
              <div className="mg-usedby-list">
                {referencingProducts.map(({ ref, product }) => (
                  <div key={ref} className="mg-usedby-item">
                    <span className={`availability-dot ${product.isAvailable ? 'available' : 'unavailable'}`} />
                    <span className="mg-usedby-name">{product.displayName || getRefId(ref)}</span>
                    <CopyRef value={ref} display={getRefId(ref)} className="mg-usedby-ref" />
                    {product.price != null && <span className="mg-usedby-price">${product.price.toFixed(2)}</span>}
                    {product.isCombo && <span className="mini-badge combo">Combo</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Nested From (modifiers referencing this group) */}
      {nestedFrom.length > 0 && (
        <section className="detail-section">
          <div className="section-header" onClick={() => toggleSection('nestedFrom')}>
            <h3>
              {expandedSections.has('nestedFrom') ? '▼' : '▶'} Nested From Modifiers
              <span className="section-count">{nestedFrom.length}</span>
            </h3>
          </div>
          {expandedSections.has('nestedFrom') && (
            <div className="section-body">
              <div className="mg-usedby-list">
                {nestedFrom.map(({ ref, modifier }) => (
                  <div key={ref} className="mg-usedby-item">
                    <span className={`availability-dot ${modifier.isAvailable ? 'available' : 'unavailable'}`} />
                    <span className="mg-usedby-name">{modifier.displayName}</span>
                    <CopyRef value={ref} display={getRefId(ref)} className="mg-usedby-ref" />
                    {modifier.price > 0 && <span className="mg-usedby-price">+${modifier.price.toFixed(2)}</span>}
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
