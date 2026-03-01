import { useCallback, useMemo, useRef, useState } from 'react';
import type { Menu } from '../types/menu';
import { MenupediaLogo } from './MenupediaLogo';
import { detectBrand } from '../utils/detectBrand';

const PASTE_WARN_BYTES = 10 * 1024 * 1024;
const PASTE_MAX_BYTES = 50 * 1024 * 1024;

// ── Monochromatic line-art food icons (SVG paths, 24×24 viewBox) ──
// 72 unique icons covering all brands: burgers, wings, drinks, donuts, fries, etc.
const LINE_ICONS: string[] = [
  // ── DRINKS (12) ──
  // 1 Coffee mug
  'M5 8h10v7a2 2 0 01-2 2H7a2 2 0 01-2-2V8zm10 2h2a1.5 1.5 0 010 3h-2M8 5v2m3-3v3',
  // 2 Iced coffee
  'M8 4h8l-1 16h-6L8 4zm0 4h8m-7 3h6',
  // 3 Take-out cup
  'M7 8h10l-1 12H8L7 8zm-1-2h12m-8-2h4v2h-4V4z',
  // 4 Milkshake
  'M9 9h6l-.5 11h-5L9 9zm-1-1h8m-4-5v5m-2 2c1 1 3 1 4 0',
  // 5 Slushie
  'M7 10h10l-1 10H8L7 10zm0 0c0-3 2.5-5 5-5s5 2 5 5m-7 4h4',
  // 6 Soda can
  'M8 5h8v14H8V5zm0 0c0-1 2-2 4-2s4 1 4 2m-8 2h8',
  // 7 Water bottle
  'M9 7h6v13H9V7zm1-4h4v4h-4V3zm-1 8h8',
  // 8 Beer mug
  'M5 8h10v10a1 1 0 01-1 1H6a1 1 0 01-1-1V8zm10 2h2.5a1.5 1.5 0 010 3H15M7 6c1-1 2-1 3 0s2 1 3 0',
  // 9 Wine glass
  'M9 4h6l-.5 5c0 1.5-1 2.5-2.5 2.5S10 10.5 10 9L9 4zm3 8v7m-2.5 0h5',
  // 10 Teapot
  'M6 10h8v5a2 2 0 01-2 2H8a2 2 0 01-2-2v-5zm8 1h3l-1 3h-2m-5-4v-2m3 2V8',
  // 11 Juice box
  'M7 5h10v14H7V5zm3-3l2 3 2-3m-6 8h4m-4 3h3',
  // 12 Smoothie
  'M8 7h8l-1 14h-6L8 7zm-1 0h10m-8 4c1 .5 2.5.5 3.5 0s2-.5 3 0',

  // ── BURGERS & SANDWICHES (10) ──
  // 13 Burger
  'M4 10h16m-16 4h16M5 10c0-3 3-5 7-5s7 2 7 5M5 14c0 2 3 3 7 3s7-1 7-3',
  // 14 Cheeseburger
  'M4 9h16m-16 3h16m-16 3h16M5 9c0-2.5 3-4 7-4s7 1.5 7 4M5 15c0 2 3 2.5 7 2.5s7-.5 7-2.5',
  // 15 Double stack
  'M4 7h16m-16 4h16m-16 4h16m-16 4h16M5 7c0-2 3-3 7-3s7 1 7 3M5 19c0 1 3 2 7 2s7-1 7-2',
  // 16 Sandwich
  'M3 16h18L12 5 3 16zm4-4h10',
  // 17 Sub / hero
  'M2 12h20c0 3-5 5-10 5S2 15 2 12zm0 0c0-3 5-5 10-5s10 2 10 5',
  // 18 Club sandwich
  'M5 7h14v3H5V7zm0 5h14v3H5v-3zm0 5h14M6 7c0-2 3-3 6-3s6 1 6 3',
  // 19 Wrap / burrito
  'M5 9l14 2-2 8H7L5 9zm4 1l1 6m4-5l1 5',
  // 20 Hot dog
  'M3 12c0-4 4-6 9-6s9 2 9 6-4 6-9 6-9-2-9-6zm4-1h10',
  // 21 BLT
  'M5 8h14l-1 3H6L5 8zm0 5h14l-1 3H6L5 13zm2-5c0-2 3-3 5-3s5 1 5 3',
  // 22 Gyro / pita
  'M6 6c3 0 5 2 6 6s1 6 6 6H6c0-4 0-8 0-12zm3 4h5m-4 3h4',

  // ── CHICKEN & MEAT (8) ──
  // 23 Chicken wing
  'M8 6c3-1 6 1 7 3s2 5 0 7l-2-1c1-1.5.5-3.5-1-5s-3-2-5-1.5L8 6z',
  // 24 Drumstick
  'M14 4c2 0 4 2 4 5s-2 5-5 5l-2 5h-3l1-5c-2-1-4-3-4-5s1-5 4-5h5z',
  // 25 Steak
  'M6 8c1-2.5 4-4 7-4s5 2 6 4c1 3 0 6-2 8s-4 3-7 3-5-1-6-3 1-5 2-8z',
  // 26 Ribs
  'M5 6h14m-14 3.5h14M5 13h14m-14 3.5h14M5 6v11m14-11v11',
  // 27 Fish
  'M3 12c3-4 6-5.5 9-4l5-3v10l-5-3c-3 1.5-6 0-9-4zm12-.5a1 1 0 110 1',
  // 28 Shrimp
  'M16 6c-1 2.5-3.5 4.5-6 4.5-2 0-3 1-3 2.5v4h2v-3c0-.5.5-1 1.5-1 3.5 0 6.5-2.5 7.5-5l1-3-3 1z',
  // 29 Bacon
  'M5 7c2 .5 3 2.5 5 3.5s3 .5 5-.5 3-2 5-2.5m-15 4c2 .5 3 2.5 5 3.5s3 .5 5-.5 3-2 5-2.5m-15 4c2 .5 3 2.5 5 3.5s3 .5 5-.5 3-2 5-2.5',
  // 30 Grilled patty
  'M5 9c0-2 3-3.5 7-3.5S19 7 19 9M5 15c0 2 3 3.5 7 3.5s7-1.5 7-3.5M5 9v6m14-6v6m-12 0h10M7 9h10',

  // ── SIDES (10) ──
  // 31 French fries
  'M7 20l1-9h8l1 9H7zm2-9V7m2 4V6m2 5V7m2 4V8',
  // 32 Curly fries
  'M7 19l1-8h8l1 8H7zm3-8c0-1.5.5-3.5 1-5m2 5c-.5-2 0-4 .5-5m3 5c0-1.5-.5-3-1-4',
  // 33 Onion rings
  'M6 12a6 6 0 1112 0 6 6 0 01-12 0zm2 0a4 4 0 108 0 4 4 0 00-8 0',
  // 34 Tater tots
  'M5 9a2.5 2.5 0 015 0 2.5 2.5 0 015 0m-10 5a2.5 2.5 0 015 0 2.5 2.5 0 015 0m-7.5-2.5a2.5 2.5 0 015 0',
  // 35 Nachos
  'M4 18h16L12 5 4 18zm3.5-5h9m-7 3h5',
  // 36 Salad bowl
  'M3 11h18c0 5-4 9-9 9s-9-4-9-9zm5-3c1-1.5 2.5-2.5 4-2.5s3 1 4 2.5',
  // 37 Corn on cob
  'M8 5v14m2-14v14m2-14v14m2-14v14M7 7c0-1 2.5-2 5-2s5 1 5 2M7 17c0 1 2.5 2 5 2s5-1 5-2',
  // 38 Mashed potatoes
  'M4 13h16c0 4-4 7-8 7s-8-3-8-7zm2-1c1-2 3-3 4-3s2 0 3 1c1-2 2.5-3 3.5-3s2.5 1 3.5 3',
  // 39 Coleslaw
  'M4 12h16c0 4.5-4 8-8 8s-8-3.5-8-8zm4-1c.5-1 1.5-2 2.5-2m3.5 0c1 0 2 1 2.5 2',
  // 40 Loaded tots
  'M6 18h12l1-6H5l1 6zm1-6c0-2.5 2-5 5-5s5 2.5 5 5M9 15h6',

  // ── PIZZA & MEXICAN (8) ──
  // 41 Pizza slice
  'M12 3L3 20h18L12 3zm0 6v6m-3.5 2h7',
  // 42 Whole pizza
  'M12 4a8 8 0 100 16 8 8 0 000-16zm0 0v8l5.5 5.5m-8-6.5a1 1 0 110 0m4-3a1 1 0 110 0',
  // 43 Taco
  'M3 15c0-5 4-10 9-10s9 5 9 10m-15-3h12m-13 3h14',
  // 44 Burrito bowl
  'M4 10h16v2c0 4-4 8-8 8s-8-4-8-8v-2zm5-2h6m-8 6h10m-8 3h6',
  // 45 Quesadilla
  'M4 12c0-4 4-4 8-4s8 0 8 4c0 4-4 4-8 4s-8 0-8-4zm4-2h8m-8 4h8',
  // 46 Enchilada
  'M4 8h16v8H4V8zm3 0v8m3-8v8m3-8v8m3-8v8',
  // 47 Chips bag
  'M7 4h10l1 16H6L7 4zm-1 4h12m-11 5h10',
  // 48 Guacamole
  'M4 12h16c0 5-4 8-8 8s-8-3-8-8zm6-2a2 2 0 114 0 2 2 0 01-4 0',

  // ── BREAKFAST / DONUTS (12) ──
  // 49 Donut
  'M12 3a9 9 0 100 18 9 9 0 000-18zm0 5a4 4 0 100 8 4 4 0 000-8z',
  // 50 Bagel
  'M12 4c4.5 0 8 3.5 8 8s-3.5 8-8 8-8-3.5-8-8 3.5-8 8-8zm0 4c2.5 0 4 1.5 4 4s-1.5 4-4 4-4-1.5-4-4 1.5-4 4-4z',
  // 51 Croissant
  'M4 15c1-5 4-9 8-9s7 4 8 9m-14 0c2 2 4 3 6 3s4-1 6-3m-14 0h16',
  // 52 Pancakes
  'M5 16h14m-13 0v-2h12v2M6 14c0-1 3-2 6-2s6 1 6 2m-13-3c0-1 3-2 6-2s6 1 6 2M6 11v-2c0-1 3-1.5 6-1.5s6 .5 6 1.5v2',
  // 53 Waffle
  'M4 6h16v12H4V6zm4 0v12m4-12v12m4-12v12M4 10h16m-16 4h16',
  // 54 Fried egg
  'M4 12c0-5 4-7 8-7s8 2 8 7-4 8-8 8-8-3-8-8zm4 0a4 4 0 108 0 4 4 0 00-8 0',
  // 55 Toast
  'M6 5h12a1 1 0 011 1v13H5V6a1 1 0 011-1zm3 5h6m-6 3h4',
  // 56 Muffin
  'M6 13h12v6H6v-6zm1 0c0-3 2-6 5-6s5 3 5 6m-9-2c1-1 3-2 4-2s3 1 4 2',
  // 57 Cereal bowl
  'M3 10h18c0 5.5-4 10-9 10S3 15.5 3 10zm5 0V8m4 2V7m4 3V8',
  // 58 Hash brown
  'M6 8h12a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4a2 2 0 012-2zm3 2v4m3-4v4m3-4v4',
  // 59 Breakfast sandwich
  'M5 9h14c0-2.5-3-4.5-7-4.5S5 6.5 5 9zm0 0v2h14V9M5 13h14c0 2-3 3.5-7 3.5S5 15 5 13zm0-2h14',
  // 60 Biscuit
  'M6 10h12c0-3-3-5-6-5s-6 2-6 5zm0 0v3c0 2 3 3.5 6 3.5s6-1.5 6-3.5v-3',

  // ── DESSERTS (8) ──
  // 61 Ice cream cone
  'M12 21l-5-9h10l-5 9zm-4-9a4 4 0 118 0',
  // 62 Cupcake
  'M6 12h12l-.5 8h-11L6 12zm2 0c0-3 2-5 4-5s4 2 4 5m-7-3c1-1.5 3-2.5 4-2.5s3 1 4 2.5',
  // 63 Cake slice
  'M4 19V10l8-5 8 5v9H4zm8-14v9m-8 0h16',
  // 64 Pie
  'M4 18h16c0-6-4-11-8-11S4 12 4 18zm8-11v11m-4-7l8 4',
  // 65 Cookie
  'M12 4a8 8 0 100 16 8 8 0 000-16zm-2 5a1 1 0 110 .5 1 1 0 010-.5zm5 1a1 1 0 110 .5 1 1 0 010-.5zm-4 4a1 1 0 110 .5 1 1 0 010-.5z',
  // 66 Cinnamon roll
  'M12 4a8 8 0 100 16 8 8 0 000-16zm0 3a5 5 0 100 10 5 5 0 000-10zm0 3a2 2 0 100 4 2 2 0 000-4z',
  // 67 Popsicle
  'M9 3h6v11a3 3 0 01-6 0V3zm3 14v5m-2-9h4',
  // 68 Brownie
  'M5 8h14v9H5V8zm3.5 0v9m3.5-9v9m3.5-9v9M5 12.5h14',

  // ── CONDIMENTS & ACCESSORIES (4) ──
  // 69 Ketchup bottle
  'M9 9h6v11H9V9zm1-5h4v5h-4V4zm-1 7h8',
  // 70 Fork
  'M9 3v6c0 1 1.5 2 3 2s3-1 3-2V3M9 3v4m3-4v4m3-4v4m-3 4v9',
  // 71 Knife
  'M12 3v18m0-18c3 0 5 3 5 6.5S15 14 12 16',
  // 72 Plate
  'M3 14h18M5 14c0-4 3-7 7-7s7 3 7 7M9 14c0-2 1.5-3.5 3-3.5s3 1.5 3 3.5',
];

// ── Dense grid: 22 columns × 20 rows = 440 icon placements ──
const GRID_COLS = 22;
const GRID_ROWS = 20;
const TOTAL_ICONS = GRID_COLS * GRID_ROWS;

const ICON_POSITIONS = Array.from({ length: TOTAL_ICONS }, (_, i) => {
  const col = i % GRID_COLS;
  const row = Math.floor(i / GRID_COLS);
  const iconIndex = i % LINE_ICONS.length;
  // Deterministic pseudo-random jitter per cell
  const jx = ((i * 17 + 7) % 13) - 6;
  const jy = ((i * 23 + 3) % 11) - 5;
  const cellW = 100 / GRID_COLS;
  const cellH = 100 / GRID_ROWS;
  return {
    path: LINE_ICONS[iconIndex],
    left: `${col * cellW + cellW * 0.5 + jx * 0.2}%`,
    top: `${row * cellH + cellH * 0.5 + jy * 0.25}%`,
    size: 18 + ((i * 13 + 5) % 12),       // 18–29px (smaller to fit denser)
    rotation: ((i * 31 + 11) % 70) - 35,  // –35° to +35°
    delay: (i * 0.05) % 4,                // stagger animation 0–4s
    duration: 14 + ((i * 7) % 12),         // 14–25s float cycle
  };
});

function FloatingIcons() {
  return (
    <div className="uploader-bg-icons" aria-hidden="true">
      {ICON_POSITIONS.map((item, i) => (
        <svg
          key={i}
          className="uploader-bg-icon"
          style={{
            left: item.left,
            top: item.top,
            width: item.size,
            height: item.size,
            '--icon-rotation': `${item.rotation}deg`,
            '--float-delay': `${item.delay}s`,
            '--float-duration': `${item.duration}s`,
          } as React.CSSProperties}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={item.path} />
        </svg>
      ))}
    </div>
  );
}

type Tab = 'upload' | 'paste' | 'url' | 'brand';

interface HeaderEntry { key: string; value: string }

// eslint-disable-next-line react-refresh/only-export-components
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
export type BrandId = 'arbys' | 'bww' | 'sonic' | 'dunkin';

export interface BrandInfo {
  id: BrandId;
  label: string;
  envs: { env: string; api: string }[];
}

// eslint-disable-next-line react-refresh/only-export-components
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
        // Auto-detect brand when not explicitly provided (upload / paste / URL)
        let resolvedBrand = brand;
        if (!resolvedBrand) {
          const detected = detectBrand(parsed as Menu);
          if (detected) {
            resolvedBrand = detected.brand;
          }
        }
        onMenuLoad(parsed as Menu, resolvedBrand);
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

  const pasteBytes = useMemo(() => new Blob([jsonText]).size, [jsonText]);
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
    <div className={`uploader-container brand-${selectedBrand}`}>
      <FloatingIcons />
      <div className="uploader-card">
        {/* Brand hero — icon + logo morph on selection */}
        <div className="uploader-hero">
          <div className="uploader-hero-icon" key={selectedBrand}>
            <img
              src={`/placeholders/${selectedBrand}.png`}
              alt={selectedBrand}
              width={56}
              height={56}
              style={{ borderRadius: 'var(--radius-md)' }}
            />
          </div>
          <MenupediaLogo size={38} color="var(--color-accent)" />
          <p className="uploader-hero-brand">{currentBrand.label}</p>
        </div>
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
              {/* Brand cards */}
              <div className="brand-card-grid">
                {BRANDS.map((b) => {
                  return (
                    <button
                      key={b.id}
                      className={`brand-card ${selectedBrand === b.id ? 'brand-card--active' : ''}`}
                      onClick={() => handleBrandChange(b.id)}
                    >
                      <img
                        src={`/placeholders/${b.id}.png`}
                        alt={b.label}
                        className="brand-card-icon"
                        width={32}
                        height={32}
                      />
                    </button>
                  );
                })}
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
