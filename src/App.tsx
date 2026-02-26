import { useState, useCallback, useEffect } from 'react';
import type { Menu } from './types/menu';

const STORAGE_KEY = 'mbdp-menu-viewer-menu';

function loadMenuFromStorage(): Menu | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Menu) : null;
  } catch {
    return null;
  }
}
import { MenuUploader } from './components/MenuUploader';
import { Sidebar } from './components/Sidebar';
import { ProductDetail } from './components/ProductDetail';
import { SearchBar } from './components/SearchBar';
import { SearchResults } from './components/SearchResults';
import { MenuStats } from './components/MenuStats';
import { Breadcrumb } from './components/Breadcrumb';
import './App.css';

interface BreadcrumbItem {
  label: string;
  ref?: string;
  type: 'root' | 'category' | 'product';
}

function App() {
  const [menu, setMenu] = useState<Menu | null>(loadMenuFromStorage);
  const [selectedProductRef, setSelectedProductRef] = useState<string | null>(null);
  const [selectedCategoryRef, setSelectedCategoryRef] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>(() => {
    const stored = loadMenuFromStorage();
    return [{ label: stored?.displayName || 'Menu', type: 'root' }];
  });

  const handleMenuLoad = useCallback((loadedMenu: Menu) => {
    setMenu(loadedMenu);
    setSelectedProductRef(null);
    setSelectedCategoryRef(null);
    setSearchQuery('');
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
    setBreadcrumbs([{ label: 'Menu', type: 'root' }]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  if (!menu) {
    return (
      <div className="app">
        <MenuUploader onMenuLoad={handleMenuLoad} />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title" onClick={handleReset} style={{ cursor: 'pointer' }}>
            🍔 Menu Viewer
          </h1>
          <Breadcrumb items={breadcrumbs} onClick={handleBreadcrumbClick} />
        </div>
        <div className="header-right">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <button className="reset-btn" onClick={handleReset} title="Load different menu">
            ↻ New Menu
          </button>
        </div>
      </header>

      <div className="app-body">
        <aside className="app-sidebar">
          <Sidebar
            menu={menu}
            selectedCategoryRef={selectedCategoryRef}
            selectedProductRef={selectedProductRef}
            onCategorySelect={handleCategorySelect}
            onProductSelect={handleProductSelect}
          />
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
            <ProductDetail menu={menu} productRef={selectedProductRef} onProductSelect={handleProductSelect} />
          ) : (
            <MenuStats menu={menu} selectedCategoryRef={selectedCategoryRef} onProductSelect={handleProductSelect} />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
