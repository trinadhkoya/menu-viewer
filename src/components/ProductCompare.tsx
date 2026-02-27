import { useState, useMemo, useCallback, useRef } from 'react';
import type { Menu, Product } from '../types/menu';
import type { BrandId } from './MenuUploader';
import { BRANDS, DEFAULT_HEADERS } from './MenuUploader';
import { OptimizedImage } from './OptimizedImage';
import { getRefId } from '../utils/menuHelpers';
import {
  fmt,
  isBlock,
  extractFields,
  buildCompareFields,
  diffModifierGroups,
  FIELD_LABELS,
} from '../utils/productCompareHelpers';
import type { CompareField, ModGroupDiff } from '../utils/productCompareHelpers';

interface ProductCompareProps {
  menu: Menu;
  productRef: string;
  activeBrand: BrandId | null;
  onClose: () => void;
}

// ─── Main Component ────────────────────────────
export function ProductCompare({ menu, productRef, activeBrand, onClose }: ProductCompareProps) {
  const productId = getRefId(productRef);
  const product = menu.products?.[productId];

  const [compareMenu, setCompareMenu] = useState<Menu | null>(null);
  const [compareLabel, setCompareLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOnlyDiffs, setShowOnlyDiffs] = useState(true);
  const [activeSection, setActiveSection] = useState<'fields' | 'modifiers'>('fields');

  // Env picker state
  const brand = activeBrand ?? 'bww';
  const currentBrand = useMemo(() => BRANDS.find((b) => b.id === brand)!, [brand]);
  const [env, setEnv] = useState('Production');
  const [locationId, setLocationId] = useState('MASTER');
  const [uploadMode, setUploadMode] = useState<'api' | 'file'>('api');
  const fileRef = useRef<HTMLInputElement>(null);

  const currentEnv = useMemo(
    () => currentBrand.envs.find((e) => e.env === env) ?? currentBrand.envs[0],
    [currentBrand, env],
  );

  const handleFetch = useCallback(async () => {
    const base = currentEnv.api;
    const loc = locationId.trim();
    const url = loc ? `${base.replace(/\/$/, '')}/${loc}` : base;

    setLoading(true);
    setError(null);
    try {
      const fetchHeaders: Record<string, string> = {};
      for (const h of DEFAULT_HEADERS) {
        const k = h.key.trim();
        if (k) fetchHeaders[k] = h.value;
      }
      const res = await fetch(url, { mode: 'cors', headers: fetchHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.products && !data.categories) throw new Error('Invalid menu JSON');
      setCompareMenu(data as Menu);
      setCompareLabel(`${currentBrand.label} ${env}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [currentEnv, locationId, currentBrand, env]);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!data.products && !data.categories) throw new Error('Invalid menu JSON');
        setCompareMenu(data as Menu);
        setCompareLabel(file.name.replace(/\.json$/i, ''));
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  }, []);

  // Find the same product in comparison menu
  const compareProduct = useMemo<Product | undefined>(() => {
    if (!compareMenu) return undefined;
    // Try exact ID match first
    if (compareMenu.products?.[productId]) return compareMenu.products[productId];
    // Fallback: match by displayName
    if (product?.displayName) {
      for (const [, p] of Object.entries(compareMenu.products ?? {})) {
        if (p.displayName === product.displayName) return p;
      }
    }
    return undefined;
  }, [compareMenu, productId, product]);

  // Compare fields
  const fields = useMemo(
    () => buildCompareFields(product, compareProduct),
    [product, compareProduct],
  );

  const modGroupDiffs = useMemo(
    () => compareMenu ? diffModifierGroups(menu, compareMenu, product, compareProduct) : [],
    [menu, compareMenu, product, compareProduct],
  );

  const diffCount = fields.filter((f) => f.isDiff).length;
  const modDiffCount = modGroupDiffs.filter(g => g.status !== 'same').length;
  const visibleFields = showOnlyDiffs ? fields.filter((f) => f.isDiff) : fields;

  const leftLabel = menu.displayName || 'Current Menu';
  const rightLabel = compareLabel || 'Comparison';

  if (!product) {
    return (
      <div className="pc-view">
        <div className="pc-empty">Product not found.</div>
      </div>
    );
  }

  return (
    <div className="pc-view">
      {/* Header */}
      <div className="pc-header">
        <div className="pc-header-left">
          <button className="pc-back" onClick={onClose} title="Back to product detail">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M19 12H5m0 0l7 7m-7-7l7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div className="pc-header-info">
            <h2 className="pc-title">Product Compare</h2>
            <span className="pc-product-name">{product.displayName || productId}</span>
          </div>
        </div>
      </div>

      {/* Product Identity Card */}
      <div className="pc-identity">
        {(product.imageUrl || product.image) && (
          <OptimizedImage
            src={(product.imageUrl || product.image)!}
            alt={product.displayName ?? ''}
            className="pc-identity-img"
            width={80}
            height={80}
          />
        )}
        <div className="pc-identity-info">
          <span className="pc-identity-name">{product.displayName || productId}</span>
          <span className="pc-identity-id">{productId}</span>
          <div className="pc-identity-tags">
            {product.isCombo && <span className="pc-tag pc-tag--combo">Combo</span>}
            {product.isVirtual && <span className="pc-tag pc-tag--virtual">Virtual</span>}
            {product.isExclusive && <span className="pc-tag pc-tag--exclusive">Exclusive</span>}
            {product.price != null && <span className="pc-tag pc-tag--price">${product.price.toFixed(2)}</span>}
            {product.calories != null && <span className="pc-tag pc-tag--cal">{product.calories} cal</span>}
          </div>
        </div>
      </div>

      {/* Env Picker (if no comparison loaded yet) */}
      {!compareMenu ? (
        <div className="pc-picker">
          <h3 className="pc-picker-title">Select environment to compare against</h3>
          <div className="pc-picker-tabs">
            <button className={`pc-picker-tab ${uploadMode === 'api' ? 'active' : ''}`} onClick={() => setUploadMode('api')}>
              From Environment
            </button>
            <button className={`pc-picker-tab ${uploadMode === 'file' ? 'active' : ''}`} onClick={() => setUploadMode('file')}>
              Upload File
            </button>
          </div>

          {uploadMode === 'api' ? (
            <div className="pc-picker-form">
              <div className="pc-picker-brand">
                <span className="pc-picker-label">Brand</span>
                <span className="pc-picker-brand-name">{currentBrand.label}</span>
              </div>
              <div className="pc-picker-row">
                <span className="pc-picker-label">Environment</span>
                <div className="pc-env-chips">
                  {currentBrand.envs.map((e) => (
                    <button
                      key={e.env}
                      className={`pc-env-chip ${env === e.env ? 'active' : ''}`}
                      onClick={() => setEnv(e.env)}
                    >
                      {e.env}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pc-picker-row">
                <span className="pc-picker-label">Location</span>
                <input
                  type="text"
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  placeholder="MASTER"
                  className="pc-input"
                />
              </div>
              <button className="pc-fetch-btn" onClick={handleFetch} disabled={loading}>
                {loading ? 'Fetching…' : 'Fetch & Compare'}
              </button>
            </div>
          ) : (
            <div className="pc-picker-form">
              <div className="pc-file-zone" onClick={() => fileRef.current?.click()}>
                <input ref={fileRef} type="file" accept=".json" onChange={handleFile} hidden />
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span>Click to select a menu JSON file</span>
              </div>
            </div>
          )}

          {error && <div className="pc-error">{error}</div>}
        </div>
      ) : (
        <>
          {/* Comparison loaded — show env labels + change button */}
          <div className="pc-env-bar">
            <div className="pc-env-tag pc-env-tag--left">
              <span className="pc-env-marker">A</span>
              <span>{leftLabel}</span>
            </div>
            <span className="pc-env-vs">vs</span>
            <div className="pc-env-tag pc-env-tag--right">
              <span className="pc-env-marker">B</span>
              <span>{rightLabel}</span>
            </div>
            <button className="pc-change-btn" onClick={() => { setCompareMenu(null); setCompareLabel(''); setError(null); }}>
              Change
            </button>
          </div>

          {/* Product not found warning */}
          {!compareProduct && (
            <div className="pc-not-found">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              <span>Product <strong>{product.displayName || productId}</strong> not found in {rightLabel}</span>
            </div>
          )}

          {compareProduct && (
            <>
              {/* Impact summary */}
              <div className="pc-impact-row">
                <div className={`pc-impact-card ${diffCount > 0 ? 'pc-impact-card--warn' : 'pc-impact-card--ok'}`}>
                  <span className="pc-impact-num">{diffCount}</span>
                  <span className="pc-impact-label">Field Diff{diffCount !== 1 ? 's' : ''}</span>
                </div>
                <div className={`pc-impact-card ${modDiffCount > 0 ? 'pc-impact-card--warn' : 'pc-impact-card--ok'}`}>
                  <span className="pc-impact-num">{modDiffCount}</span>
                  <span className="pc-impact-label">Modifier Group Diff{modDiffCount !== 1 ? 's' : ''}</span>
                </div>
                <div className="pc-impact-card">
                  <span className="pc-impact-num">{fields.length}</span>
                  <span className="pc-impact-label">Fields Compared</span>
                </div>
              </div>

              {/* Section tabs */}
              <div className="pc-section-tabs">
                <button
                  className={`pc-section-tab ${activeSection === 'fields' ? 'active' : ''}`}
                  onClick={() => setActiveSection('fields')}
                >
                  Fields
                  {diffCount > 0 && <span className="pc-section-badge pc-section-badge--warn">{diffCount}</span>}
                </button>
                <button
                  className={`pc-section-tab ${activeSection === 'modifiers' ? 'active' : ''}`}
                  onClick={() => setActiveSection('modifiers')}
                >
                  Modifier Groups
                  {modDiffCount > 0 && <span className="pc-section-badge pc-section-badge--warn">{modDiffCount}</span>}
                </button>
              </div>

              {activeSection === 'fields' && (
                <>
                  {/* Toggle */}
                  <div className="pc-toolbar">
                    <label className="pc-toggle">
                      <input type="checkbox" checked={showOnlyDiffs} onChange={() => setShowOnlyDiffs((v) => !v)} />
                      <span className="pc-toggle-slider" />
                      <span className="pc-toggle-text">Show only differences</span>
                    </label>
                    <span className="pc-field-count">
                      {showOnlyDiffs ? `${diffCount} of ${fields.length} fields` : `${fields.length} fields`}
                    </span>
                  </div>

                  {/* Side-by-side compare table */}
                  <div className="pc-table-wrap">
                    <table className="pc-table">
                      <thead>
                        <tr>
                          <th className="pc-th-field">Field</th>
                          <th className="pc-th-left">{leftLabel}</th>
                          <th className="pc-th-right">{rightLabel}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleFields.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="pc-table-empty">
                              {showOnlyDiffs ? 'No differences — this product is identical across environments!' : 'No fields to display'}
                            </td>
                          </tr>
                        ) : (
                          visibleFields.map((f) => {
                            const lb = isBlock(f.left);
                            const rb = isBlock(f.right);
                            const jsonRow = lb || rb;
                            return (
                              <tr key={f.key} className={`${f.isDiff ? 'pc-row--diff' : ''} ${jsonRow ? 'pc-row--json' : ''}`}>
                                <td className="pc-cell-field">{f.label}</td>
                                <td className={`pc-cell-left ${f.isDiff ? 'pc-cell--highlight' : ''}`}>
                                  {f.left == null
                                    ? <span className="pc-null">—</span>
                                    : lb ? <pre className="pc-json-block">{f.left}</pre> : f.left}
                                </td>
                                <td className={`pc-cell-right ${f.isDiff ? 'pc-cell--highlight' : ''}`}>
                                  {f.right == null
                                    ? <span className="pc-null">—</span>
                                    : rb ? <pre className="pc-json-block">{f.right}</pre> : f.right}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {activeSection === 'modifiers' && (
                <div className="pc-mod-section">
                  {modGroupDiffs.length === 0 ? (
                    <div className="pc-mod-empty">No modifier groups on this product.</div>
                  ) : (
                    modGroupDiffs.map((g) => (
                      <div key={g.groupId} className={`pc-mod-group pc-mod-group--${g.status}`}>
                        <div className="pc-mod-group-header">
                          <span className="pc-mod-group-name">{g.groupName}</span>
                          <span className={`pc-mod-status pc-mod-status--${g.status}`}>
                            {g.status === 'same' ? 'Identical' : g.status === 'changed' ? 'Changed' : g.status === 'only-left' ? 'Only in A' : 'Only in B'}
                          </span>
                          <span className="pc-mod-counts">{g.leftCount} / {g.rightCount} modifiers</span>
                        </div>
                        {g.modifierDiffs.length > 0 && g.status !== 'only-left' && g.status !== 'only-right' && (
                          <div className="pc-mod-children">
                            {g.modifierDiffs.filter(m => m.status !== 'same').map((m) => (
                              <div key={m.id} className={`pc-mod-child pc-mod-child--${m.status}`}>
                                <div className="pc-mod-child-header">
                                  <span className="pc-mod-child-name">{m.name}</span>
                                  <span className={`pc-mod-child-status pc-mod-status--${m.status}`}>
                                    {m.status === 'changed' ? 'Changed' : m.status === 'only-left' ? 'Only A' : 'Only B'}
                                  </span>
                                </div>
                                {m.fields.length > 0 && (
                                  <div className="pc-mod-fields">
                                    {m.fields.map((f) => (
                                      <div key={f.key} className="pc-mod-field">
                                        <span className="pc-mod-field-key">{f.key}</span>
                                        <span className="pc-mod-field-left">{f.left ?? '—'}</span>
                                        <span className="pc-mod-field-arrow">→</span>
                                        <span className="pc-mod-field-right">{f.right ?? '—'}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                            {g.modifierDiffs.every(m => m.status === 'same') && (
                              <div className="pc-mod-all-same">All modifiers identical</div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
