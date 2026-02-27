import { useCallback, useMemo, useRef, useState } from 'react';
import type { Menu } from '../types/menu';
import { MenupediaLogo } from './MenupediaLogo';
import { BRAND_ICONS } from './BrandIcons';

const PASTE_WARN_BYTES = 10 * 1024 * 1024;
const PASTE_MAX_BYTES = 50 * 1024 * 1024;

type Tab = 'upload' | 'paste' | 'url' | 'brand';

interface HeaderEntry { key: string; value: string }

export const DEFAULT_HEADERS: HeaderEntry[] = [
  { key: 'accept', value: 'application/json, text/plain, */*' },
  { key: 'x-session-id', value: '0b0d4a53-d150-4733-8d8b-a614d79426bd' },
  { key: 'x-device-id', value: '67B1B3DB-89BB-4C7F-8682-1151F983BCE5' },
  { key: 'x-channel', value: 'WEBOA' },
  { key: 'x-user-agent', value: 'iPhone17,1' },
  { key: 'x-version', value: '1.0.1' },
];

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'upload', label: 'Upload', icon: '📁' },
  { id: 'paste',  label: 'Paste',  icon: '📋' },
  { id: 'url',    label: 'URL',    icon: '🔗' },
  { id: 'brand',  label: 'Brand',  icon: '🏢' },
];

// ── Brand / Environment endpoint registry ──────
export type BrandId = 'arbys' | 'bww' | 'sonic' | 'dunkin' | 'inspire';

export interface BrandInfo {
  id: BrandId;
  label: string;
  envs: { env: string; api: string }[];
}

export const BRANDS: BrandInfo[] = [
  {
    id: 'arbys', label: "Arby's",
    envs: [
      { env: 'Production', api: 'https://api-idp.arbys.com/menu' },
      { env: 'QA',         api: 'https://menu2-arb.qa.irb.digital' },
      { env: 'UAT',        api: 'https://menu2-arb.uat.irb.digital' },
      { env: 'Demo',       api: 'https://menu2-arb.demo.irb.digital' },
    ],
  },
  {
    id: 'bww', label: 'BWW',
    envs: [
      { env: 'Production', api: 'https://api-idp.buffalowildwings.com/menu' },
      { env: 'QA',         api: 'https://menu2-bww.qa.irb.digital' },
      { env: 'UAT',        api: 'https://menu2-bww.uat02.irb.digital' },
      { env: 'Demo',       api: 'https://menu2-bww.demo.irb.digital' },
    ],
  },
  {
    id: 'sonic', label: 'Sonic',
    envs: [
      { env: 'Production', api: 'https://api-idp.sonicdrivein.com/menu' },
      { env: 'QA',         api: 'https://menu2-snc.qa.irb.digital' },
      { env: 'UAT',        api: 'https://menu2-snc.uat.irb.digital' },
      { env: 'Demo',       api: 'https://menu2-snc.demo.irb.digital' },
    ],
  },
  {
    id: 'dunkin', label: 'Dunkin',
    envs: [
      { env: 'Production', api: 'https://arb-menu.irb.digital' },
      { env: 'QA',         api: 'https://menu2-dun.qa.irb.digital' },
      { env: 'UAT',        api: 'https://menu2-arb.uat.irb.digital' },
    ],
  },
  {
    id: 'inspire', label: 'Inspire',
    envs: [
      { env: 'Production', api: 'https://ignite-menu.irb.digital' },
      { env: 'QA',         api: 'https://menu2-snc.qa.irb.digital' },
      { env: 'UAT',        api: 'https://bww-menu.uat.irb.digital' },
      { env: 'Demo',       api: 'https://ignite-menu.demo.irb.digital' },
    ],
  },
];

interface MenuUploaderProps { onMenuLoad: (menu: Menu, brand?: BrandId) => void }

export function MenuUploader({ onMenuLoad }: MenuUploaderProps) {
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [tab, setTab] = useState<Tab>('brand');
  const [jsonText, setJsonText] = useState('');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [headers, setHeaders] = useState<HeaderEntry[]>(DEFAULT_HEADERS);
  const [headersOpen, setHeadersOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Brand tab state
  const [selectedBrand, setSelectedBrand] = useState<BrandId>('arbys');
  const [selectedEnv, setSelectedEnv] = useState('QA');
  const [locationId, setLocationId] = useState('0');

  const switchTab = useCallback((t: Tab) => { setTab(t); setError(null); }, []);

  const currentBrand = useMemo(() => BRANDS.find((b) => b.id === selectedBrand)!, [selectedBrand]);
  const currentEnvData = useMemo(
    () => currentBrand.envs.find((e) => e.env === selectedEnv) ?? currentBrand.envs[0],
    [currentBrand, selectedEnv],
  );
  const builtUrl = useMemo(() => {
    const base = currentEnvData.api;
    if (!base) return '';
    const loc = locationId.trim();
    return loc ? `${base.replace(/\/$/, '')}/${loc}` : base;
  }, [currentEnvData, locationId]);

  // When brand changes, reset env to first available
  const handleBrandChange = useCallback((id: BrandId) => {
    setSelectedBrand(id);
    const brand = BRANDS.find((b) => b.id === id)!;
    const qaEnv = brand.envs.find((e) => e.env === 'QA');
    setSelectedEnv(qaEnv ? 'QA' : brand.envs[0].env);
    setError(null);
  }, []);

  // ── Shared parser ────────────────────────────
  const parseAndLoad = useCallback(
    (text: string, source?: string, brand?: BrandId) => {
      try {
        const parsed = JSON.parse(text);
        if (!parsed.products && !parsed.categories) {
          setError('Invalid menu — missing "products" or "categories"');
          return;
        }
        setError(null);
        onMenuLoad(parsed as Menu, brand);
      } catch (e) {
        setError(`Parse error${source ? ` (${source})` : ''}: ${(e as Error).message}`);
      }
    },
    [onMenuLoad],
  );

  // ── Shared fetch ─────────────────────────────
  const doFetch = useCallback(async (url: string, brand?: BrandId) => {
    if (!url) return;
    try { new URL(url); } catch {
      setError('Enter a full URL starting with http:// or https://');
      return;
    }
    setError(null);
    setLoading(true);

    const fetchHeaders: Record<string, string> = {};
    for (const h of headers) { const k = h.key.trim(); if (k) fetchHeaders[k] = h.value; }

    try {
      const res = await fetch(url, { mode: 'cors', headers: fetchHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText || 'Request failed'}`);
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('json') && !ct.includes('text'))
        throw new Error(`Unexpected content-type "${ct}"`);
      parseAndLoad(await res.text(), url, brand);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS'))
        setError('Could not fetch — likely a CORS issue. Download the file and upload it instead.');
      else setError(`Fetch error: ${msg}`);
    } finally { setLoading(false); }
  }, [headers, parseAndLoad]);

  // ── File ─────────────────────────────────────
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        parseAndLoad(reader.result as string, file.name);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.onerror = () => setError('Failed to read file');
      reader.readAsText(file);
    },
    [parseAndLoad],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => parseAndLoad(reader.result as string, file.name);
      reader.readAsText(file);
    },
    [parseAndLoad],
  );

  // ── Paste ────────────────────────────────────
  const handlePasteChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (new Blob([val]).size > PASTE_MAX_BYTES) {
      setError(`Paste exceeds ${fmtMB(PASTE_MAX_BYTES)} — use file upload instead.`);
      return;
    }
    setError(null);
    setJsonText(val);
  }, []);

  const handlePasteSubmit = useCallback(() => {
    if (jsonText.trim()) parseAndLoad(jsonText.trim(), 'pasted JSON');
  }, [jsonText, parseAndLoad]);

  // ── URL tab handlers ─────────────────────────
  const handleUrlSubmit = useCallback(() => doFetch(remoteUrl.trim()), [remoteUrl, doFetch]);
  const handleUrlKeyDown = useCallback(
    (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleUrlSubmit(); },
    [handleUrlSubmit],
  );

  // ── Brand tab handler ────────────────────────
  const handleBrandFetch = useCallback(() => doFetch(builtUrl, selectedBrand), [builtUrl, selectedBrand, doFetch]);

  // ── Header helpers ───────────────────────────
  const updateHeader = useCallback((i: number, f: 'key' | 'value', v: string) => {
    setHeaders((p) => p.map((h, idx) => (idx === i ? { ...h, [f]: v } : h)));
  }, []);
  const removeHeader = useCallback((i: number) => {
    setHeaders((p) => p.filter((_, idx) => idx !== i));
  }, []);
  const addHeader = useCallback(() => {
    setHeaders((p) => [...p, { key: '', value: '' }]);
  }, []);

  const pasteBytes = new Blob([jsonText]).size;
  const pasteWarn = pasteBytes > PASTE_WARN_BYTES;

  // ── Shared headers panel ─────────────────────
  const headersPanel = (
    <details
      className="hdrs-panel"
      open={headersOpen}
      onToggle={(e) => setHeadersOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="hdrs-toggle">
        Headers
        <span className="hdrs-badge">{headers.filter((h) => h.key.trim()).length}</span>
      </summary>
      <div className="hdrs-list">
        {headers.map((h, i) => (
          <div className="hdrs-row" key={i}>
            <input className="hdrs-key" placeholder="key" value={h.key}
              onChange={(e) => updateHeader(i, 'key', e.target.value)} disabled={loading} />
            <input className="hdrs-val" placeholder="value" value={h.value}
              onChange={(e) => updateHeader(i, 'value', e.target.value)} disabled={loading} />
            <button className="hdrs-rm" onClick={() => removeHeader(i)} disabled={loading}>×</button>
          </div>
        ))}
        <button className="hdrs-add" onClick={addHeader} disabled={loading}>+ Add</button>
      </div>
    </details>
  );

  return (
    <div className="uploader-container">
      <div className="uploader-card">
        <MenupediaLogo size={42} />
        <p className="uploader-subtitle">
          Load your <code>menu.json</code> to explore categories, products &amp; modifiers.
        </p>

        {/* ── Tab bar ── */}
        <div className="up-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`up-tab ${tab === t.id ? 'up-tab--active' : ''}`}
              onClick={() => switchTab(t.id)}
            >
              <span className="up-tab-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <div className="up-body">
          {tab === 'upload' && (
            <div
              className={`drop-zone ${isDragging ? 'drop-zone--active' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <p className="drop-zone-text">
                <strong>Drop file here</strong> or click to browse
              </p>
              <span className="drop-zone-hint">.json files only</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>
          )}

          {tab === 'paste' && (
            <>
              <textarea
                className="json-textarea"
                placeholder="Paste your menu.json here…"
                value={jsonText}
                onChange={handlePasteChange}
                rows={10}
                autoFocus
              />
              <div className="paste-meta">
                <span className={pasteWarn ? 'paste-size-warn' : 'paste-size'}>
                  {fmtSize(pasteBytes)}
                </span>
                {pasteWarn && <span className="paste-size-warn">⚠ Large — consider file upload</span>}
              </div>
              <button
                className="up-action-btn"
                onClick={handlePasteSubmit}
                disabled={!jsonText.trim()}
              >
                Load Menu
              </button>
            </>
          )}

          {tab === 'url' && (
            <>
              <div className="url-row">
                <input
                  type="text"
                  className="url-input"
                  placeholder="Enter menu API URL…"
                  value={remoteUrl}
                  onChange={(e) => { setRemoteUrl(e.target.value); setError(null); }}
                  onKeyDown={handleUrlKeyDown}
                  autoFocus
                  disabled={loading}
                />
                <button
                  className="up-action-btn up-fetch-btn"
                  onClick={handleUrlSubmit}
                  disabled={loading || !remoteUrl.trim()}
                >
                  {loading ? <span className="up-spinner" /> : 'Fetch'}
                </button>
              </div>
              {headersPanel}
            </>
          )}

          {tab === 'brand' && (
            <>
              {/* Brand pills */}
              <div className="brand-pills">
                {BRANDS.map((b) => (
                  <button
                    key={b.id}
                    className={`brand-pill ${selectedBrand === b.id ? 'brand-pill--active' : ''}`}
                    onClick={() => handleBrandChange(b.id)}
                  >
                    {BRAND_ICONS[b.id] && (() => { const Icon = BRAND_ICONS[b.id]; return <Icon size={20} className="brand-pill-icon" />; })()}
                    {b.label}
                  </button>
                ))}
              </div>

              {/* Env pills */}
              <div className="brand-pills brand-pills--env">
                {currentBrand.envs.map((e) => (
                  <button
                    key={e.env}
                    className={`brand-pill brand-pill--sm ${selectedEnv === e.env ? 'brand-pill--active' : ''}`}
                    onClick={() => { setSelectedEnv(e.env); setError(null); }}
                  >
                    {e.env}
                  </button>
                ))}
              </div>

              {/* Location ID */}
              <div className="brand-row">
                <label className="brand-label">Location / Path</label>
                <input
                  type="text"
                  className="url-input"
                  placeholder="e.g. MASTER, 12345"
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* Built URL preview */}
              {builtUrl && (
                <div className="brand-preview">
                  <code>{builtUrl}</code>
                </div>
              )}

              {headersPanel}

              <button
                className="up-action-btn"
                onClick={handleBrandFetch}
                disabled={loading || !builtUrl}
              >
                {loading ? <span className="up-spinner" /> : 'Fetch Menu'}
              </button>
            </>
          )}
        </div>

        {error && <div className="uploader-error">{error}</div>}
      </div>
    </div>
  );
}

function fmtMB(b: number) { return `${(b / 1048576).toFixed(0)} MB`; }
function fmtSize(b: number) {
  if (b === 0) return '0 B';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(2)} MB`;
}
