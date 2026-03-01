import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import type { Menu } from './types/menu';

const STORAGE_KEY = 'menupedia-menu';
const BRAND_KEY = 'menupedia-brand';

function loadMenuFromStorage(): Menu | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Menu) : null;
  } catch {
    return null;
  }
}

function loadBrandFromStorage(): BrandId | null {
  try {
    const raw = localStorage.getItem(BRAND_KEY);
    return raw as BrandId | null;
  } catch {
    return null;
  }
}
import { MenuUploader } from './components/MenuUploader';
import type { BrandId } from './components/MenuUploader';
import { Sidebar } from './components/Sidebar';
import { ProductDetail } from './components/ProductDetail';
import { SearchBar } from './components/SearchBar';
import { SearchResults } from './components/SearchResults';
import { MenuStats } from './components/MenuStats';
import { ConstructView } from './components/ConstructView';
import { DiffView } from './components/DiffView';
import { Breadcrumb } from './components/Breadcrumb';
import { ThemeToggle } from './components/ThemeToggle';
import { useTheme } from './hooks/useTheme';
import { MenupediaLogo } from './components/MenupediaLogo';
import { BRAND_ICONS } from './components/BrandIcons';
import './App.css';

interface BreadcrumbItem {
  label: string;
  ref?: string;
  type: 'root' | 'category' | 'product';
}

function App() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [menu, setMenu] = useState<Menu | null>(loadMenuFromStorage);
  const [selectedProductRef, setSelectedProductRef] = useState<string | null>(null);
  const [selectedCategoryRef, setSelectedCategoryRef] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeBrand, setActiveBrand] = useState<BrandId | null>(loadBrandFromStorage);
  const [showRefs, setShowRefs] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const sidebarWasOpenRef = useRef(true);

  // Derive active tab from current route path
  const activeTab = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/constructs')) return 'constructs' as const;
    if (path.startsWith('/diff')) return 'diff' as const;
    return 'menu' as const;
  }, [location.pathname]);

  // Auto-collapse sidebar on constructs/diff pages, restore on menu page
  useEffect(() => {
    if (activeTab === 'constructs' || activeTab === 'diff') {
      if (sidebarOpen) {
        sidebarWasOpenRef.current = true;
        setSidebarOpen(false);
      }
    } else {
      if (sidebarWasOpenRef.current) {
        setSidebarOpen(true);
      }
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const menuSizeBytes = useMemo(() => {
    if (!menu) return 0;
    try {
      return new Blob([JSON.stringify(menu)]).size;
    } catch {
      return 0;
    }
  }, [menu]);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>(() => {
    const stored = loadMenuFromStorage();
    return [{ label: stored?.displayName || 'Menu', type: 'root' }];
  });

  // --- Draggable FAB state ---
  const [fabPos, setFabPos] = useState<{ x: number; y: number } | null>(null);
  const [fabDragging, setFabDragging] = useState(false);
  const fabDragRef = useRef<{
    startX: number; startY: number;
    startLeft: number; startTop: number;
    moved: boolean;
  } | null>(null);

  const handleFabPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    btn.setPointerCapture(e.pointerId);
    const rect = btn.getBoundingClientRect();
    fabDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      moved: false,
    };
    const onMove = (ev: PointerEvent) => {
      const drag = fabDragRef.current;
      if (!drag) return;
      const dx = ev.clientX - drag.startX;
      const dy = ev.clientY - drag.startY;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 5) {
        drag.moved = true;
        setFabDragging(true);
      }
      if (drag.moved) {
        const size = 56;
        const nx = Math.max(0, Math.min(window.innerWidth - size, drag.startLeft + dx));
        const ny = Math.max(0, Math.min(window.innerHeight - size, drag.startTop + dy));
        setFabPos({ x: nx, y: ny });
      }
    };
    const onUp = (ev: PointerEvent) => {
      btn.releasePointerCapture(ev.pointerId);
      btn.removeEventListener('pointermove', onMove);
      btn.removeEventListener('pointerup', onUp);
      const drag = fabDragRef.current;
      if (!drag?.moved) {
        // It was a click — navigate
        navigate('/diff');
        setSelectedProductRef(null);
      } else {
        // Snap to nearest horizontal edge
        const size = 56;
        const margin = 28;
        const midX = window.innerWidth / 2;
        setFabPos(prev => {
          if (!prev) return prev;
          const snappedX = prev.x + size / 2 < midX ? margin : window.innerWidth - size - margin;
          return { ...prev, x: snappedX };
        });
      }
      setFabDragging(false);
      fabDragRef.current = null;
    };
    btn.addEventListener('pointermove', onMove);
    btn.addEventListener('pointerup', onUp);
  }, [navigate]);

  const handleMenuLoad = useCallback((loadedMenu: Menu, brand?: BrandId) => {
    // Clear any existing menu state first
    localStorage.removeItem(STORAGE_KEY);
    setSelectedProductRef(null);
    setSelectedCategoryRef(null);
    setSearchQuery('');
    setActiveBrand(brand ?? null);
    // Persist the brand for reload
    try {
      if (brand) {
        localStorage.setItem(BRAND_KEY, brand);
      } else {
        localStorage.removeItem(BRAND_KEY);
      }
    } catch { /* ignore */ }
    // Load the new menu
    setMenu(loadedMenu);
    setBreadcrumbs([{ label: loadedMenu.displayName || 'Menu', type: 'root' }]);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loadedMenu));
    } catch {
      // Storage full or unavailable — continue without persistence
    }
    navigate('/menu');
  }, [navigate]);

  const handleProductSelect = useCallback(
    (productRef: string, categoryName?: string) => {
      setSelectedProductRef(productRef);
      setSearchQuery('');
      const productId = productRef.includes('.') ? productRef.substring(productRef.indexOf('.') + 1) : productRef;
      const product = menu?.products?.[productId];
      const crumbs: BreadcrumbItem[] = [{ label: menu?.displayName || 'Menu', type: 'root' }];
      if (selectedCategoryRef) {
        const selCatId = selectedCategoryRef.includes('.') ? selectedCategoryRef.substring(selectedCategoryRef.indexOf('.') + 1) : selectedCategoryRef;
        const cat = menu?.categories?.[selCatId];
        crumbs.push({
          label: cat?.displayName || selectedCategoryRef,
          ref: selectedCategoryRef,
          type: 'category',
        });
      }
      if (categoryName && !selectedCategoryRef) {
        crumbs.push({ label: categoryName, type: 'category' });
      }
      crumbs.push({
        label: product?.displayName || productRef,
        ref: productRef,
        type: 'product',
      });
      setBreadcrumbs(crumbs);
      // Ensure we're on the menu route when selecting a product
      if (activeTab !== 'menu') navigate('/menu');
    },
    [menu, selectedCategoryRef, activeTab, navigate],
  );

  const handleCategorySelect = useCallback(
    (categoryRef: string) => {
      setSelectedCategoryRef(categoryRef);
      setSelectedProductRef(null);
      setSearchQuery('');
      const catId = categoryRef.includes('.') ? categoryRef.substring(categoryRef.indexOf('.') + 1) : categoryRef;
      const cat = menu?.categories?.[catId];
      setBreadcrumbs([
        { label: menu?.displayName || 'Menu', type: 'root' },
        { label: cat?.displayName || categoryRef, ref: categoryRef, type: 'category' },
      ]);
      if (activeTab !== 'menu') navigate('/menu');
    },
    [menu, activeTab, navigate],
  );

  const handleBreadcrumbClick = useCallback(
    (item: BreadcrumbItem) => {
      if (item.type === 'root') {
        setSelectedProductRef(null);
        setSelectedCategoryRef(null);
        setBreadcrumbs([{ label: menu?.displayName || 'Menu', type: 'root' }]);
      } else if (item.type === 'category' && item.ref) {
        setSelectedProductRef(null);
        setSelectedCategoryRef(item.ref);
        setBreadcrumbs([
          { label: menu?.displayName || 'Menu', type: 'root' },
          { label: item.label, ref: item.ref, type: 'category' },
        ]);
      }
    },
    [menu],
  );

  const handleReset = useCallback(() => {
    setMenu(null);
    setSelectedProductRef(null);
    setSelectedCategoryRef(null);
    setSearchQuery('');
    setActiveBrand(null);
    setBreadcrumbs([{ label: 'Menu', type: 'root' }]);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(BRAND_KEY);
    navigate('/');
  }, [navigate]);

  const brandClass = activeBrand ? `brand-${activeBrand}` : '';

  if (!menu) {
    return (
      <div className="app">
        <div style={{ position: 'absolute', top: 16, right: 16 }}>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
        <MenuUploader onMenuLoad={handleMenuLoad} />
      </div>
    );
  }

  // Content for the main area — search + product overlay on top of routed view
  const mainContent = searchQuery ? (
    <SearchResults
      menu={menu}
      query={searchQuery}
      onProductSelect={handleProductSelect}
      onCategorySelect={handleCategorySelect}
    />
  ) : selectedProductRef ? (
    <ProductDetail menu={menu} productRef={selectedProductRef} activeBrand={activeBrand} onProductSelect={handleProductSelect} />
  ) : null;

  return (
    <div className={`app ${brandClass}`}>
      <header className="app-header">
        {/* Row 1: Search bar — full width, prominent */}
        <div className="header-row header-row--search">
          <h1 className="app-title" onClick={handleReset} style={{ cursor: 'pointer' }}>
            {activeBrand && BRAND_ICONS[activeBrand] && (
              <span className="header-brand-icon">
                {(() => { const Icon = BRAND_ICONS[activeBrand]; return <Icon size={26} />; })()}
              </span>
            )}
            <MenupediaLogo size={22} color={activeBrand ? 'var(--color-accent)' : undefined} />
          </h1>
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>

        {/* Row 2: Navigation left, settings right */}
        <div className="header-row header-row--nav">
          <div className="header-nav-left">
            <Breadcrumb items={breadcrumbs} onClick={handleBreadcrumbClick} />
            <div className="view-mode-toggle">
              <button
                className={`view-mode-btn ${activeTab === 'menu' ? 'active' : ''}`}
                onClick={() => { navigate('/menu'); setSelectedProductRef(null); }}
                title="Browse by category"
              >
                📂 Menu
              </button>
              <button
                className={`view-mode-btn ${activeTab === 'constructs' ? 'active' : ''}`}
                onClick={() => { navigate('/constructs'); setSelectedProductRef(null); }}
                title="Browse by product construct"
              >
                🧬 Constructs
              </button>
            </div>
          </div>
          <div className="header-settings">
            <label className="header-toggle" title="Hide product IDs, category IDs, and ref codes">
              <input
                type="checkbox"
                checked={!showRefs}
                onChange={() => setShowRefs((v) => !v)}
              />
              <span className="header-toggle-slider" />
              <span className="header-toggle-label">Hide IDs</span>
            </label>
            <span className="header-settings-divider" />
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </div>
      </header>

      {/* Floating Diff button — draggable */}
      {menu && activeTab !== 'diff' && (
        <button
          className={`fab-diff${fabDragging ? ' fab-dragging' : ''}`}
          style={fabPos ? { top: fabPos.y, left: fabPos.x, bottom: 'auto', right: 'auto' } : undefined}
          onPointerDown={handleFabPointerDown}
          title="Compare menus across environments"
        >
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 3.5A1.5 1.5 0 013.5 2h3A1.5 1.5 0 018 3.5V5h1.5A1.5 1.5 0 0111 6.5v6A1.5 1.5 0 019.5 14h-3A1.5 1.5 0 015 12.5V11H3.5A1.5 1.5 0 012 9.5v-6zM3.5 3a.5.5 0 00-.5.5v6a.5.5 0 00.5.5H5V6.5A1.5 1.5 0 016.5 5H7V3.5a.5.5 0 00-.5-.5h-3zM6 6.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v6a.5.5 0 01-.5.5h-3a.5.5 0 01-.5-.5v-6z"/>
          </svg>
        </button>
      )}

      <div className={`app-body${showRefs ? '' : ' hide-refs'}`}>
        <aside className={`app-sidebar ${sidebarOpen ? '' : 'app-sidebar--collapsed'}`}>
          <div className="sidebar-content">
            <Sidebar
              menu={menu}
              selectedCategoryRef={selectedCategoryRef}
              selectedProductRef={selectedProductRef}
              onCategorySelect={handleCategorySelect}
              onProductSelect={handleProductSelect}
            />
            <div className="sidebar-footer">
              <div className="sidebar-toggle-row">
                <span className="sidebar-footer-label">Menu size</span>
                <span className="sidebar-footer-value">
                  {menuSizeBytes < 1024
                    ? `${menuSizeBytes} B`
                    : menuSizeBytes < 1048576
                      ? `${(menuSizeBytes / 1024).toFixed(1)} KB`
                      : `${(menuSizeBytes / 1048576).toFixed(2)} MB`}
                </span>
              </div>
            </div>
          </div>
          <button
            className={`sidebar-collapse-btn ${sidebarOpen ? '' : 'sidebar-collapse-btn--collapsed'}`}
            onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              {sidebarOpen ? (
                <path d="M10.354 3.354a.5.5 0 00-.708-.708l-5 5a.5.5 0 000 .708l5 5a.5.5 0 00.708-.708L5.707 8l4.647-4.646z"/>
              ) : (
                <path d="M5.646 3.354a.5.5 0 01.708-.708l5 5a.5.5 0 010 .708l-5 5a.5.5 0 01-.708-.708L10.293 8 5.646 3.354z"/>
              )}
            </svg>
          </button>
        </aside>

        <main className="app-main">
          {mainContent ?? (
            <Routes>
              <Route path="/menu" element={
                <MenuStats menu={menu} selectedCategoryRef={selectedCategoryRef} onProductSelect={handleProductSelect} onCategorySelect={handleCategorySelect} activeBrand={activeBrand} />
              } />
              <Route path="/constructs" element={
                <ConstructView menu={menu} onProductSelect={handleProductSelect} activeBrand={activeBrand} />
              } />
              <Route path="/diff" element={
                <DiffView menu={menu} activeBrand={activeBrand} onMenuLoad={handleMenuLoad} />
              } />
              <Route path="*" element={<Navigate to="/menu" replace />} />
            </Routes>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
