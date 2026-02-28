import { useState, useCallback, useMemo } from 'react';
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
  const [menu, setMenu] = useState<Menu | null>(loadMenuFromStorage);
  const [selectedProductRef, setSelectedProductRef] = useState<string | null>(null);
  const [selectedCategoryRef, setSelectedCategoryRef] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'menu' | 'constructs' | 'diff'>('menu');
  const [activeBrand, setActiveBrand] = useState<BrandId | null>(loadBrandFromStorage);
  const [showRefs, setShowRefs] = useState(true);

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
  }, []);

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
    },
    [menu, selectedCategoryRef],
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
    },
    [menu],
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
  }, []);

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

  return (
    <div className={`app ${brandClass}`}>
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title" onClick={handleReset} style={{ cursor: 'pointer' }}>
            {activeBrand && BRAND_ICONS[activeBrand] && (
              <span className="header-brand-icon">
                {(() => { const Icon = BRAND_ICONS[activeBrand]; return <Icon size={26} />; })()}
              </span>
            )}
            <MenupediaLogo size={22} color={activeBrand ? 'var(--color-accent)' : undefined} />
          </h1>
          <Breadcrumb items={breadcrumbs} onClick={handleBreadcrumbClick} />
        </div>
        <div className="header-right">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <div className="view-mode-toggle">
            <button
              className={`view-mode-btn ${viewMode === 'menu' ? 'active' : ''}`}
              onClick={() => { setViewMode('menu'); setSelectedProductRef(null); }}
              title="Browse by category"
            >
              📂 Menu
            </button>
            <button
              className={`view-mode-btn ${viewMode === 'constructs' ? 'active' : ''}`}
              onClick={() => { setViewMode('constructs'); setSelectedProductRef(null); }}
              title="Browse by product construct"
            >
              🧬 Constructs
            </button>
          </div>
          <label className="header-toggle" title="Hide product IDs, category IDs, and ref codes">
            <input
              type="checkbox"
              checked={!showRefs}
              onChange={() => setShowRefs((v) => !v)}
            />
            <span className="header-toggle-slider" />
            <span className="header-toggle-label">Hide IDs</span>
          </label>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      </header>

      {/* Floating Diff button */}
      {menu && viewMode !== 'diff' && (
        <button
          className="fab-diff"
          onClick={() => { setViewMode('diff'); setSelectedProductRef(null); }}
          title="Compare menus across environments"
        >
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 3.5A1.5 1.5 0 013.5 2h3A1.5 1.5 0 018 3.5V5h1.5A1.5 1.5 0 0111 6.5v6A1.5 1.5 0 019.5 14h-3A1.5 1.5 0 015 12.5V11H3.5A1.5 1.5 0 012 9.5v-6zM3.5 3a.5.5 0 00-.5.5v6a.5.5 0 00.5.5H5V6.5A1.5 1.5 0 016.5 5H7V3.5a.5.5 0 00-.5-.5h-3zM6 6.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v6a.5.5 0 01-.5.5h-3a.5.5 0 01-.5-.5v-6z"/>
          </svg>
        </button>
      )}

      <div className={`app-body${showRefs ? '' : ' hide-refs'}`}>
        <aside className="app-sidebar">
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
        </aside>

        <main className="app-main">
          {searchQuery ? (
            <SearchResults
              menu={menu}
              query={searchQuery}
              onProductSelect={handleProductSelect}
              onCategorySelect={handleCategorySelect}
            />
          ) : selectedProductRef ? (
            <ProductDetail menu={menu} productRef={selectedProductRef} activeBrand={activeBrand} onProductSelect={handleProductSelect} />
          ) : viewMode === 'constructs' ? (
            <ConstructView menu={menu} onProductSelect={handleProductSelect} />
          ) : viewMode === 'diff' ? (
            <DiffView menu={menu} activeBrand={activeBrand} onMenuLoad={handleMenuLoad} />
          ) : (
            <MenuStats menu={menu} selectedCategoryRef={selectedCategoryRef} onProductSelect={handleProductSelect} onCategorySelect={handleCategorySelect} />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
