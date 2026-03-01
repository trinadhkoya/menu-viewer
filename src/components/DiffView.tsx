import { useState, useMemo, useCallback, useRef } from 'react';
import type { Menu } from '../types/menu';
import type { BrandId } from './MenuUploader';
import { BRANDS, DEFAULT_HEADERS } from './MenuUploader';
import { diffMenus, formatValue, isJsonBlock } from '../utils/menuDiff';
import type { MenuDiffResult, EntityDiff, DiffStatus, RefDetail } from '../utils/menuDiff';

interface DiffViewProps {
  menu: Menu;
  activeBrand: BrandId | null;
  onMenuLoad?: (menu: Menu, brand?: BrandId) => void;
}

type DiffTab = 'products' | 'categories';
type FilterStatus = DiffStatus | 'all';

// ─────────────────────────────────────────────
// Env Picker — let user load a second menu
// ─────────────────────────────────────────────

type PickerVariant = 'base' | 'compare';

function EnvPicker({
  activeBrand,
  onMenuLoaded,
  variant = 'compare',
}: {
  activeBrand: BrandId | null;
  onMenuLoaded: (menu: Menu, label: string) => void;
  variant?: PickerVariant;
}) {
  const [brand, setBrand] = useState<BrandId>(activeBrand ?? 'bww');
  const [env, setEnv] = useState('Production');
  const [locationId, setLocationId] = useState('MASTER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<'api' | 'file'>('api');
  const fileRef = useRef<HTMLInputElement>(null);

  const currentBrand = useMemo(() => BRANDS.find((b) => b.id === brand)!, [brand]);
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
      onMenuLoaded(data as Menu, `${currentBrand.label} ${env}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [currentEnv, locationId, currentBrand, env, onMenuLoaded]);

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setLoading(true);
      setError(null);
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          if (!data.products && !data.categories) throw new Error('Invalid menu JSON');
          onMenuLoaded(data as Menu, file.name.replace(/\.json$/i, ''));
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setLoading(false);
        }
      };
      reader.readAsText(file);
    },
    [onMenuLoaded],
  );

  const isBase = variant === 'base';
  const pickerTitle = isBase ? 'Change base menu' : 'Load comparison menu';
  const pickerIcon = isBase ? '◀' : '▶';
  const fetchLabel = isBase ? 'Load as Base' : 'Fetch & Compare';

  return (
    <div className={`diff-env-picker diff-env-picker--${variant}`}>
      <h3>{pickerIcon} {pickerTitle}</h3>
      <div className="diff-picker-tabs">
        <button
          className={`diff-picker-tab ${uploadMode === 'api' ? 'active' : ''}`}
          onClick={() => setUploadMode('api')}
        >
          🔗 From Environment
        </button>
        <button
          className={`diff-picker-tab ${uploadMode === 'file' ? 'active' : ''}`}
          onClick={() => setUploadMode('file')}
        >
          📁 Upload File
        </button>
      </div>

      {uploadMode === 'api' ? (
        <div className="diff-picker-form">
          {/* Brand is locked to the currently loaded menu's brand */}
          <div className="diff-picker-row">
            <label>Brand</label>
            {activeBrand ? (
              <span className="diff-brand-locked">{currentBrand.label}</span>
            ) : (
              <select value={brand} onChange={(e) => { setBrand(e.target.value as BrandId); setEnv(BRANDS.find(b => b.id === e.target.value)!.envs[0].env); }}>
                {BRANDS.map((b) => (
                  <option key={b.id} value={b.id}>{b.label}</option>
                ))}
              </select>
            )}
          </div>
          <div className="diff-picker-row">
            <label>Environment</label>
            <div className="diff-env-chips">
              {currentBrand.envs.map((e) => (
                <button
                  key={e.env}
                  className={`diff-env-chip ${env === e.env ? 'active' : ''}`}
                  onClick={() => setEnv(e.env)}
                >
                  {e.env}
                </button>
              ))}
            </div>
          </div>
          <div className="diff-picker-row">
            <label>Location</label>
            <input
              type="text"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              placeholder="MASTER"
              className="diff-input"
            />
          </div>
          <button className={`diff-fetch-btn diff-fetch-btn--${variant}`} onClick={handleFetch} disabled={loading}>
            {loading ? '⏳ Fetching…' : `🔄 ${fetchLabel}`}
          </button>
        </div>
      ) : (
        <div className="diff-picker-form">
          <div className="diff-file-zone" onClick={() => fileRef.current?.click()}>
            <input ref={fileRef} type="file" accept=".json" onChange={handleFile} hidden />
            <span>📁 Click to select a menu JSON file</span>
          </div>
        </div>
      )}

      {error && <div className="diff-error">⚠️ {error}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────
// Status Badge
// ─────────────────────────────────────────────

const STATUS_CONFIG: Record<DiffStatus, { label: string; icon: string; cls: string }> = {
  added: { label: 'Added', icon: '+', cls: 'diff-badge--added' },
  removed: { label: 'Removed', icon: '−', cls: 'diff-badge--removed' },
  changed: { label: 'Changed', icon: '~', cls: 'diff-badge--changed' },
  unchanged: { label: 'Same', icon: '=', cls: 'diff-badge--unchanged' },
};

function StatusBadge({ status }: { status: DiffStatus }) {
  const { label, icon, cls } = STATUS_CONFIG[status];
  return <span className={`diff-badge ${cls}`}><span className="diff-badge-icon">{icon}</span>{label}</span>;
}

// ─────────────────────────────────────────────
// Ref Detail Row (expandable)
// ─────────────────────────────────────────────

function RefDetailRow({
  field,
  leftSummary,
  rightSummary,
  detail,
  expanded,
  onToggle,
}: {
  field: string;
  leftSummary: string;
  rightSummary: string;
  detail: RefDetail;
  expanded: boolean;
  onToggle: () => void;
}) {
  const totalChanges = detail.added.length + detail.removed.length + detail.modified.length;

  return (
    <>
      <tr className="diff-ref-summary-row" onClick={onToggle} style={{ cursor: 'pointer' }}>
        <td className="diff-field-name">
          <span className="diff-ref-toggle">{expanded ? '▾' : '▸'}</span>
          {field}
        </td>
        <td className="diff-field-left">{leftSummary}</td>
        <td className="diff-field-right">{rightSummary}</td>
      </tr>
      {expanded && totalChanges > 0 && (
        <tr className="diff-ref-detail-row">
          <td colSpan={3}>
            <div className="diff-ref-detail-container">
              {detail.added.length > 0 && (
                <div className="diff-ref-group diff-ref-group--added">
                  <span className="diff-ref-group-label">+ Added ({detail.added.length})</span>
                  <div className="diff-ref-keys">
                    {detail.added.map((k) => (
                      <code key={k} className="diff-ref-key diff-ref-key--added">{k}</code>
                    ))}
                  </div>
                </div>
              )}
              {detail.removed.length > 0 && (
                <div className="diff-ref-group diff-ref-group--removed">
                  <span className="diff-ref-group-label">− Removed ({detail.removed.length})</span>
                  <div className="diff-ref-keys">
                    {detail.removed.map((k) => (
                      <code key={k} className="diff-ref-key diff-ref-key--removed">{k}</code>
                    ))}
                  </div>
                </div>
              )}
              {detail.modified.length > 0 && (
                <div className="diff-ref-group diff-ref-group--modified">
                  <span className="diff-ref-group-label">~ Modified ({detail.modified.length})</span>
                  <div className="diff-ref-keys">
                    {detail.modified.map((k) => (
                      <code key={k} className="diff-ref-key diff-ref-key--modified">{k}</code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// Diff Detail Panel
// ─────────────────────────────────────────────

function DiffDetail({
  item,
  leftLabel,
  rightLabel,
  onClose,
}: {
  item: EntityDiff;
  leftLabel: string;
  rightLabel: string;
  onClose: () => void;
}) {
  const changedCount = item.fields.length;  const [expandedRefs, setExpandedRefs] = useState<Set<string>>(new Set());

  const toggleRef = (field: string) => {
    setExpandedRefs((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };  return (
    <div className="diff-detail-panel">
      <div className="diff-detail-header">
        <div className="diff-detail-header-left">
          <StatusBadge status={item.status} />
          <h3>{item.displayName}</h3>
          <span className="diff-detail-id">{item.id}</span>
          {!item.matchedById && item.matchedRightId && (
            <div className="diff-detail-note">
              <span className="diff-detail-note-icon">⚠️</span>
              <span>Matched by name — right ID: <code>{item.matchedRightId}</code></span>
            </div>
          )}
        </div>
        <button className="diff-detail-close" onClick={onClose} title="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {item.status === 'added' && (
        <div className="diff-detail-message diff-detail-message--added">
          <span className="diff-detail-message-icon">✦</span>
          <span>New in <strong>{rightLabel}</strong></span>
        </div>
      )}
      {item.status === 'removed' && (
        <div className="diff-detail-message diff-detail-message--removed">
          <span className="diff-detail-message-icon">✕</span>
          <span>Missing from <strong>{rightLabel}</strong></span>
        </div>
      )}
      {item.status === 'unchanged' && (
        <div className="diff-detail-message diff-detail-message--unchanged">
          <span className="diff-detail-message-icon">✓</span>
          <span>Identical across environments</span>
        </div>
      )}

      {changedCount > 0 && (
        <>
          <div className="diff-detail-table-header">
            <span className="diff-detail-table-title">{changedCount} field{changedCount !== 1 ? 's' : ''} differ</span>
          </div>
          <div className="diff-detail-table-wrap">
            <table className="diff-field-table">
              <thead>
                <tr>
                  <th className="diff-th-field">Field</th>
                  <th className="diff-th-left">{leftLabel}</th>
                  <th className="diff-th-right">{rightLabel}</th>
                </tr>
              </thead>
              <tbody>
                {item.fields.map((f) => {
                  const lv = formatValue(f.left);
                  const rv = formatValue(f.right);
                  const isBlock = isJsonBlock(lv) || isJsonBlock(rv);
                  const rd = f.refDetail;
                  const isExpanded = expandedRefs.has(f.field);

                  return rd ? (
                    <RefDetailRow
                      key={f.field}
                      field={f.field}
                      leftSummary={lv}
                      rightSummary={rv}
                      detail={rd}
                      expanded={isExpanded}
                      onToggle={() => toggleRef(f.field)}
                    />
                  ) : (
                    <tr key={f.field} className={isBlock ? 'diff-row--json' : ''}>
                      <td className="diff-field-name">{f.field}</td>
                      <td className="diff-field-left">
                        {isBlock ? <pre className="diff-json-block">{lv}</pre> : lv}
                      </td>
                      <td className="diff-field-right">
                        {isBlock ? <pre className="diff-json-block">{rv}</pre> : rv}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main DiffView
// ─────────────────────────────────────────────

export function DiffView({ menu, activeBrand, onMenuLoad }: DiffViewProps) {
  const [compareMenu, setCompareMenu] = useState<Menu | null>(null);
  const [compareLabel, setCompareLabel] = useState('');
  const [tab, setTab] = useState<DiffTab>('products');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<EntityDiff | null>(null);
  const [showBaseChanger, setShowBaseChanger] = useState(false);

  const leftLabel = menu.displayName || 'Current Menu';

  const handleBaseMenuLoaded = useCallback((m: Menu, label: string) => {
    // Find the brand id from the label if possible
    const matchedBrand = BRANDS.find(b => label.startsWith(b.label));
    if (onMenuLoad) {
      onMenuLoad(m, matchedBrand?.id);
    }
    setShowBaseChanger(false);
    // Reset diff state since the base menu changed
    setCompareMenu(null);
    setCompareLabel('');
    setSelectedItem(null);
  }, [onMenuLoad]);

  const handleCompareLoaded = useCallback((m: Menu, label: string) => {
    setCompareMenu(m);
    setCompareLabel(label);
    setSelectedItem(null);
    setFilter('all');
    setSearchTerm('');
  }, []);

  const diff = useMemo<MenuDiffResult | null>(() => {
    if (!compareMenu) return null;
    return diffMenus(menu, compareMenu, leftLabel, compareLabel);
  }, [menu, compareMenu, leftLabel, compareLabel]);

  // Filter + search
  const filteredItems = useMemo(() => {
    if (!diff) return [];
    const items = tab === 'products' ? diff.products : diff.categories;
    let result = items;
    if (filter !== 'all') {
      result = result.filter((i) => i.status === filter);
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (i) => i.displayName.toLowerCase().includes(q) || i.id.toLowerCase().includes(q),
      );
    }
    // Sort: changed first, then added, removed, unchanged
    const order: Record<DiffStatus, number> = { changed: 0, added: 1, removed: 2, unchanged: 3 };
    result = [...result].sort((a, b) => order[a.status] - order[b.status]);
    return result;
  }, [diff, tab, filter, searchTerm]);

  // ── No compare menu yet — show picker ──
  if (!diff) {
    const prodCount = Object.keys(menu.products ?? {}).length;
    const catCount = Object.keys(menu.categories ?? {}).length;

    return (
      <div className="diff-view diff-view--setup">
        {/* Hero */}
        <div className="diff-hero">
          <div className="diff-hero-glow" />
          <div className="diff-hero-content">
            <div className="diff-hero-badge">Core Feature</div>
            <h2 className="diff-hero-title">
              <span className="diff-hero-icon-inline">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" stroke="url(#hero-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <defs><linearGradient id="hero-grad" x1="3" y1="3" x2="21" y2="21"><stop stopColor="#6366f1"/><stop offset="1" stopColor="#a855f7"/></linearGradient></defs>
                </svg>
              </span>
              Menu Diff Engine
            </h2>
            <p className="diff-hero-sub">
              Compare menus side-by-side across environments, brands, and locations.<br/>
              Instantly surface what changed, what's new, and what's missing.
            </p>
          </div>
        </div>

        {/* Two-column: Left (base) vs Right (compare) */}
        <div className="diff-setup">
          {/* ── LEFT: Base Menu ── */}
          <div className="diff-setup-panel diff-setup-panel--left">
            <div className="diff-setup-panel-header">
              <span className="diff-setup-step">A</span>
              <span className="diff-setup-label">Base Menu</span>
            </div>
            {!showBaseChanger ? (
              <div className="diff-setup-loaded">
                <div className="diff-setup-loaded-glyph">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="diff-setup-loaded-info">
                  <span className="diff-setup-loaded-name">{leftLabel}</span>
                  <span className="diff-setup-loaded-meta">
                    <span className="diff-setup-meta-chip">{prodCount} products</span>
                    <span className="diff-setup-meta-dot">·</span>
                    <span className="diff-setup-meta-chip">{catCount} categories</span>
                  </span>
                </div>
                {onMenuLoad && (
                  <button className="diff-setup-change-btn" onClick={() => setShowBaseChanger(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Change
                  </button>
                )}
              </div>
            ) : (
              <div className="diff-base-changer">
                <button className="diff-setup-cancel-btn" onClick={() => setShowBaseChanger(false)}>
                  ✕ Keep Current
                </button>
                <EnvPicker activeBrand={activeBrand} onMenuLoaded={handleBaseMenuLoaded} variant="base" />
              </div>
            )}
          </div>

          {/* ── VS Divider ── */}
          <div className="diff-setup-vs">
            <div className="diff-setup-vs-line" />
            <span className="diff-setup-vs-badge">VS</span>
            <div className="diff-setup-vs-line" />
          </div>

          {/* ── RIGHT: Comparison Menu ── */}
          <div className="diff-setup-panel diff-setup-panel--right">
            <div className="diff-setup-panel-header">
              <span className="diff-setup-step">B</span>
              <span className="diff-setup-label">Comparison Menu</span>
            </div>
            <EnvPicker activeBrand={activeBrand} onMenuLoaded={handleCompareLoaded} variant="compare" />
          </div>
        </div>
      </div>
    );
  }

  // ── Diff results ──
  const s = diff.summary;
  const activeSum = tab === 'products' ? s.products : s.categories;
  const totalChanges = s.products.changed + s.categories.changed + s.products.added + s.categories.added + s.products.removed + s.categories.removed;

  return (
    <div className="diff-view diff-view--results">
      {/* Results Header */}
      <div className="diff-results-header">
        <div className="diff-results-header-top">
          <div className="diff-results-title-group">
            <h2 className="diff-results-title">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Diff Results
            </h2>
            {totalChanges > 0 ? (
              <span className="diff-results-impact">{totalChanges} difference{totalChanges !== 1 ? 's' : ''} found</span>
            ) : (
              <span className="diff-results-impact diff-results-impact--clean">Menus are identical</span>
            )}
          </div>
          <button className="diff-change-btn" onClick={() => { setCompareMenu(null); setSelectedItem(null); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            New Comparison
          </button>
        </div>

        {/* Environment labels */}
        <div className="diff-env-labels">
          <div className="diff-env-label diff-env-label--left">
            <span className="diff-env-label-marker">A</span>
            <span>{diff.leftLabel}</span>
          </div>
          <div className="diff-env-label-vs-small">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M8 7l4-4 4 4M8 17l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div className="diff-env-label diff-env-label--right">
            <span className="diff-env-label-marker">B</span>
            <span>{diff.rightLabel}</span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="diff-summary-row">
        {[
          { key: 'changed', icon: '~', count: s.products.changed + s.categories.changed, label: 'Changed' },
          { key: 'added', icon: '+', count: s.products.added + s.categories.added, label: 'Added' },
          { key: 'removed', icon: '−', count: s.products.removed + s.categories.removed, label: 'Removed' },
          { key: 'unchanged', icon: '=', count: s.products.unchanged + s.categories.unchanged, label: 'Unchanged' },
        ].map(({ key, icon, count, label }) => (
          <div key={key} className={`diff-summary-card diff-summary-card--${key}`}>
            <span className="diff-summary-card-icon">{icon}</span>
            <div className="diff-summary-card-data">
              <span className="diff-summary-number">{count}</span>
              <span className="diff-summary-label">{label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="diff-tabs">
        <button
          className={`diff-tab ${tab === 'products' ? 'active' : ''}`}
          onClick={() => { setTab('products'); setSelectedItem(null); }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Products <span className="diff-tab-count">{s.products.total}</span>
        </button>
        <button
          className={`diff-tab ${tab === 'categories' ? 'active' : ''}`}
          onClick={() => { setTab('categories'); setSelectedItem(null); }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Categories <span className="diff-tab-count">{s.categories.total}</span>
        </button>
      </div>

      {/* Filter + Search */}
      <div className="diff-toolbar">
        <div className="diff-filter-chips">
          {(['all', 'changed', 'added', 'removed', 'unchanged'] as FilterStatus[]).map((f) => {
            const count = f === 'all' ? activeSum.total : activeSum[f as DiffStatus];
            return (
              <button
                key={f}
                className={`diff-filter-chip ${filter === f ? 'active' : ''} diff-filter-chip--${f}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                <span className="diff-filter-count">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="diff-search-wrap">
          <svg className="diff-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          <input
            type="text"
            className="diff-search"
            placeholder="Search by name or ID…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      <div className="diff-content">
        <div className="diff-list">
          {filteredItems.length === 0 && (
            <div className="diff-empty">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.3"/><path d="M8 15s1.5-2 4-2 4 2 4 2M9 9h.01M15 9h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              <span>No items match the current filter</span>
            </div>
          )}
          {filteredItems.map((item) => (
            <div
              key={`${item.id}-${item.status}`}
              className={`diff-list-item diff-list-item--${item.status} ${selectedItem?.id === item.id ? 'diff-list-item--selected' : ''}`}
              onClick={() => setSelectedItem(item)}
            >
              <div className="diff-list-item-main">
                <span className="diff-list-item-name">{item.displayName}</span>
                <StatusBadge status={item.status} />
              </div>
              <div className="diff-list-item-meta">
                <span className="diff-list-item-id">{item.id}</span>
                {item.status === 'changed' && (
                  <span className="diff-list-item-changes">{item.fields.length} field{item.fields.length !== 1 ? 's' : ''} changed</span>
                )}
                {!item.matchedById && item.matchedRightId && (
                  <span className="diff-list-item-fallback">matched by name</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Detail Panel */}
        {selectedItem && (
          <DiffDetail
            item={selectedItem}
            leftLabel={diff.leftLabel}
            rightLabel={diff.rightLabel}
            onClose={() => setSelectedItem(null)}
          />
        )}
      </div>
    </div>
  );
}
