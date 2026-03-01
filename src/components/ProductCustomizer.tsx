/**
 * ProductCustomizer — Interactive product customization panel.
 *
 * State management: Zustand store (scoped per-instance via context).
 * See `src/store/customizerStore.ts` for state shape + actions.
 *
 * Features:
 * - Modifier groups with checkbox/radio/stepper controls
 * - Intensity options (Easy/Regular/Extra/None)
 * - Quantity +/- steppers respecting min/max constraints
 * - Real-time upcharge price calculation
 * - Combo product slot selection (sides, drinks)
 * - Size variant tabs with upcharge badges
 * - Validation indicators for required groups
 * - Running total (base price + modifier upcharges)
 */

import { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import type { Menu, Product, Modifier, ModifierGroup, ProductGroup, ChildRefOverride, Quantity } from '../types/menu';
import { resolveRef, getRefId, isCustomizable } from '../utils/menuHelpers';
import { OptimizedImage } from './OptimizedImage';
import { CopyRef } from './CopyRef';
import {
  type SelectedModifiers,
  type SelectedGroupItem,
  type ComboSelection,
  type SavedCustomization,
  ActionType,
  getInitialSelectedIngredients,
  toggleIngredientSelection,
  increaseQuantity,
  decreaseQuantity,
  getModifierActionType,
  getGroupSelectionQuantity,
  getGroupSelectedCount,
  getMaxSelectionQuantity,
  getUnsatisfiedGroups,
  isExclusiveRef,
  productHasIntensities,
  getModifierPriceAndCalories,
  getVirtualSizeAlternatives,
  getSizeVariantUpcharge,
  getModificationSummary,
} from '../utils/productCustomization';
import {
  createCustomizerStore,
  CustomizerContext,
  useCustomizerStore,
  selectPriceResult,
  selectUnsatisfiedGroups,
  selectIsModified,
  selectDrillDownProduct,
} from '../store/customizerStore';

/**
 * Convert selectionQuantity { min, max } into human-readable text.
 */
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

/* ══════════════════════════════════════════════
   Root — creates scoped store + provides context
   ══════════════════════════════════════════════ */

interface ProductCustomizerProps {
  menu: Menu;
  product: Product;
  productRef: string;
  onClose: () => void;
  onSave?: (data: SavedCustomization) => void;
  savedSelections?: SelectedModifiers;
  savedComboSelection?: ComboSelection[];
  onProductSelect?: (ref: string) => void;
}

export function ProductCustomizer({
  menu,
  product,
  productRef,
  onClose,
  onSave,
  savedSelections,
  savedComboSelection,
  onProductSelect,
}: ProductCustomizerProps) {
  // Create store once per mount — restore saved selections if available
  const [store] = useState(() =>
    createCustomizerStore(menu, product, savedSelections, savedComboSelection),
  );

  return (
    <CustomizerContext.Provider value={store}>
      <CustomizerInner productRef={productRef} onClose={onClose} onSave={onSave} onProductSelect={onProductSelect} />
    </CustomizerContext.Provider>
  );
}

/* ══════════════════════════════════════════════
   Inner shell — reads store, renders layout
   ══════════════════════════════════════════════ */

function CustomizerInner({
  productRef,
  onClose,
  onSave,
  onProductSelect,
}: {
  productRef: string;
  onClose: () => void;
  onSave?: (data: SavedCustomization) => void;
  onProductSelect?: (ref: string) => void;
}) {
  const menu = useCustomizerStore((s) => s.menu);
  const product = useCustomizerStore((s) => s.product);
  const isCombo = useCustomizerStore((s) => s.isCombo);
  const priceResult = useCustomizerStore(selectPriceResult);
  const unsatisfied = useCustomizerStore(selectUnsatisfiedGroups);
  const isModified = useCustomizerStore(selectIsModified);
  const drillDown = useCustomizerStore((s) => s.drillDown);
  const drillDownProduct = useCustomizerStore(selectDrillDownProduct);

  const selectedIngredients = useCustomizerStore((s) => s.selectedIngredients);
  const initialIngredients = useCustomizerStore((s) => s.initialIngredients);
  const comboSelection = useCustomizerStore((s) => s.comboSelection);

  const reset = useCustomizerStore((s) => s.reset);

  const isDrillDown = !!drillDown && !!drillDownProduct;

  // Determine whether the drill-down product has actual size alternatives.
  // A virtual product without relatedProducts should fall through to the ingredient customizer.
  const drillDownHasSizeAlts = useMemo(
    () => isDrillDown && !!drillDownProduct?.isVirtual && getVirtualSizeAlternatives(menu, drillDownProduct) !== null,
    [isDrillDown, drillDownProduct, menu],
  );

  /** Save selections and close. */
  const handleDone = useCallback(() => {
    if (onSave) {
      const modifications = getModificationSummary(menu, selectedIngredients, initialIngredients);
      onSave({
        selectedIngredients,
        comboSelection,
        priceResult,
        isCombo,
        modifications,
      });
    }
    onClose();
  }, [onSave, onClose, menu, selectedIngredients, initialIngredients, comboSelection, priceResult, isCombo]);

  /* ── Scroll-driven hero collapse ── */
  const bodyRef = useRef<HTMLDivElement>(null);
  const [heroCollapsed, setHeroCollapsed] = useState(false);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const onScroll = () => setHeroCollapsed(el.scrollTop > 40);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="customizer">
      {/* ── Hero Header (collapses on scroll) ── */}
      <div className={`customizer-hero-header ${heroCollapsed ? 'customizer-hero-header--collapsed' : ''}`}>
        <div className="customizer-hero-nav">
          <button className="customizer-back" onClick={onClose} title="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>

          {/* Collapsed inline info — only visible when scrolled */}
          <div className="customizer-hero-collapsed-info">
            {product.imageUrl && (
              <div className="customizer-hero-collapsed-img">
                <OptimizedImage src={product.imageUrl} alt="" width={32} height={32} />
              </div>
            )}
            <div className="customizer-hero-collapsed-text">
              <span className="customizer-hero-collapsed-name">{product.displayName}</span>
              <div className="customizer-hero-collapsed-meta">
                <span className="customizer-hero-collapsed-price">${priceResult.totalPrice.toFixed(2)}</span>
                {priceResult.totalCalories != null && (
                  <span className="customizer-hero-collapsed-cal">{priceResult.totalCalories} cal</span>
                )}
                <CopyRef value={productRef} display={getRefId(productRef)} className="customizer-hero-collapsed-ref" />
              </div>
            </div>
          </div>

          <div className="customizer-hero-nav-right">
            {isModified && (
              <button className="customizer-reset" onClick={reset} title="Reset to defaults">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M20.49 9A9 9 0 105.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            )}
            <button
              className={`customizer-save${!isModified ? ' customizer-save--disabled' : ''}`}
              disabled={!isModified}
              onClick={handleDone}
            >
              Save
            </button>
          </div>
        </div>

        {/* Expanded hero content — hides when scrolled */}
        <div className="customizer-hero-expanded">
          <div className="customizer-hero-card">
            {product.imageUrl && (
              <div className="customizer-hero-image">
                <OptimizedImage src={product.imageUrl} alt="" width={80} height={80} />
              </div>
            )}
            <div className="customizer-hero-text">
              <h2 className="customizer-hero-name">{product.displayName}</h2>
              <div className="customizer-hero-meta">
                <span className="customizer-hero-price">${priceResult.totalPrice.toFixed(2)}</span>
                {priceResult.totalCalories != null && (
                  <span className="customizer-hero-meta-sep">·</span>
                )}
                {priceResult.totalCalories != null && (
                  <span className="customizer-hero-cal">{priceResult.totalCalories} cal</span>
                )}
                {priceResult.modifierUpcharge !== 0 && (
                  <span className={`customizer-hero-delta ${priceResult.modifierUpcharge > 0 ? 'up' : 'down'}`}>
                    {priceResult.modifierUpcharge > 0 ? '+' : ''}${Math.abs(priceResult.modifierUpcharge).toFixed(2)}
                  </span>
                )}
              </div>
              <CopyRef value={productRef} display={getRefId(productRef)} className="customizer-hero-ref" />
            </div>
          </div>
          {unsatisfied.length > 0 && (
            <div className="customizer-hero-required-hint">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              {unsatisfied.length} required {unsatisfied.length === 1 ? 'selection' : 'selections'} remaining
            </div>
          )}
        </div>
      </div>

      {/* Body — Single PDP or Combo PDP */}
      <div className="customizer-body" ref={bodyRef}>
        {isCombo ? (
          <ComboCustomizer />
        ) : (
          <SingleCustomizer onProductSelect={onProductSelect} />
        )}
      </div>

      {/* ── Nested drill-down overlay ── */}
      {isDrillDown && (
        drillDownHasSizeAlts
          ? <NestedSizeCustomizer />
          : <NestedIngredientCustomizer />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────
   Single PDP — Ingredient Groups
   ────────────────────────────────────────────── */

function SingleCustomizer({ onProductSelect }: { onProductSelect?: (ref: string) => void }) {
  const selectedIngredients = useCustomizerStore((s) => s.selectedIngredients);

  return (
    <div className="customizer-groups">
      {Object.keys(selectedIngredients).map((groupRef) => (
        <ModifierGroupSection
          key={groupRef}
          groupRef={groupRef}
          onProductSelect={onProductSelect}
        />
      ))}

      {Object.keys(selectedIngredients).length === 0 && (
        <div className="customizer-empty">
          <svg viewBox="0 0 64 64" fill="none" width="48" height="48">
            <rect x="16" y="8" width="32" height="48" rx="4" stroke="currentColor" strokeWidth="2" />
            <line x1="24" y1="22" x2="40" y2="22" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
            <line x1="24" y1="30" x2="36" y2="30" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
            <line x1="24" y1="38" x2="38" y2="38" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
          </svg>
          <p>No customizable options for this product</p>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────
   Modifier Group Section
   ────────────────────────────────────────────── */

function ModifierGroupSection({
  groupRef,
  onProductSelect,
}: {
  groupRef: string;
  onProductSelect?: (ref: string) => void;
}) {
  const menu = useCustomizerStore((s) => s.menu);
  const group = useCustomizerStore((s) => s.selectedIngredients[groupRef]);
  const unsatisfiedGroups = useCustomizerStore(selectUnsatisfiedGroups);
  const isUnsatisfied = unsatisfiedGroups.includes(groupRef);
  const toggleGroupExpanded = useCustomizerStore((s) => s.toggleGroupExpanded);
  const expanded = useCustomizerStore((s) => s.expandedGroups[groupRef] ?? true);

  const groupEntity = resolveRef(menu, groupRef) as ProductGroup | ModifierGroup | undefined;
  const groupName = groupEntity?.displayName ?? getRefId(groupRef);
  const sq = getGroupSelectionQuantity(menu, groupRef);
  const selectedCount = getGroupSelectedCount(group);
  const isRecipe = (groupEntity as ProductGroup)?.isRecipe;
  const isAtMax = sq.max != null && selectedCount >= sq.max;

  return (
    <div className={[
      'customizer-section',
      isUnsatisfied && 'customizer-section--required',
      isAtMax && 'customizer-section--maxed',
    ].filter(Boolean).join(' ')}>
      <button className="customizer-section-header" onClick={() => toggleGroupExpanded(groupRef)}>
        <div className="customizer-section-title-row">
          <h3 className="customizer-section-name">{groupName}</h3>
          <CopyRef value={groupRef} display={getRefId(groupRef)} className="customizer-section-ref" />
          {isUnsatisfied && <span className="customizer-section-tag required">Required</span>}
          {isRecipe && <span className="customizer-section-tag recipe">Recipe</span>}
        </div>
        <div className="customizer-section-right">
          {(sq.min != null || sq.max != null) && (
            <span className="customizer-section-hint">{formatSelectionQty(sq)}</span>
          )}
          <span className={[
            'customizer-section-count',
            selectedCount > 0 && 'active',
            isAtMax && 'at-max',
          ].filter(Boolean).join(' ')}>
            {selectedCount}{sq.max != null ? `/${sq.max}` : ''}
          </span>
          <svg className={`customizer-section-chevron ${expanded ? 'open' : ''}`} width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      </button>

      <div className={`customizer-section-body ${expanded ? 'expanded' : 'collapsed'}`}>
        <div className="customizer-section-items">
          {Object.keys(group).map((itemRef) => (
            <ModifierOptionRow
              key={itemRef}
              groupRef={groupRef}
              itemRef={itemRef}
              onProductSelect={onProductSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Modifier Option Row (full-row clickable)
   ────────────────────────────────────────────── */

function ModifierOptionRow({
  groupRef,
  itemRef,
  onProductSelect,
}: {
  groupRef: string;
  itemRef: string;
  onProductSelect?: (ref: string) => void;
}) {
  const menu = useCustomizerStore((s) => s.menu);
  const item = useCustomizerStore((s) => s.selectedIngredients[groupRef]?.[itemRef]);
  const initialItem = useCustomizerStore((s) => s.initialIngredients[groupRef]?.[itemRef]);
  const group = useCustomizerStore((s) => s.selectedIngredients[groupRef]);
  const toggle = useCustomizerStore((s) => s.toggle);
  const increase = useCustomizerStore((s) => s.increase);
  const decrease = useCustomizerStore((s) => s.decrease);
  const openDrillDown = useCustomizerStore((s) => s.openDrillDown);

  const menuItem = resolveRef(menu, itemRef) as Product | Modifier | undefined;
  const groupEntity = resolveRef(menu, groupRef) as ProductGroup | ModifierGroup | undefined;
  const override = groupEntity && 'childRefs' in groupEntity ? (groupEntity.childRefs?.[itemRef] as ChildRefOverride) : undefined;
  const actionType = getModifierActionType(menu, groupRef, itemRef);

  const name = menuItem?.displayName ?? getRefId(itemRef);
  const imageUrl = (menuItem as Product)?.imageUrl;
  const isDefault = override?.isDefault ?? (menuItem as Product)?.isDefault ?? false;
  const isExclusive = isExclusiveRef(menu, itemRef);
  const isSelected = item?.quantity >= 1;
  const isChanged = item?.quantity !== (initialItem?.quantity ?? 0) || item?.subItemId !== initialItem?.subItemId;
  const hasIntensities = productHasIntensities(menuItem as Product, menu);
  const maxQty = getMaxSelectionQuantity(menu, groupRef, itemRef, group);

  // Virtual product with size alternatives → show drill-down button
  const virtualAlts = useMemo(
    () => getVirtualSizeAlternatives(menu, menuItem),
    [menu, menuItem],
  );
  const hasVirtualDrillDown = virtualAlts != null;

  // Non-virtual product with its own ingredientRefs or modifierGroupRefs → ingredient drill-down
  const hasIngredientDrillDown = !hasVirtualDrillDown
    && !isExclusive
    && !!menuItem
    && isCustomizable(menuItem as Product);
  const hasDrillDown = hasVirtualDrillDown || hasIngredientDrillDown;

  // Currently selected size name
  const selectedSizeName = useMemo(() => {
    if (!item?.subItemId || !virtualAlts) return null;
    const variant = virtualAlts.variants.find((v) => v.ref === item.subItemId);
    return variant?.product?.displayName ?? null;
  }, [item?.subItemId, virtualAlts]);

  // Adjustment summary — shows what was modified in the nested customizer
  const adjustmentSummary = useMemo(() => {
    if (!item?.selection || !isSelected) return null;

    // Ingredient drill-down: compare against the item's own initial ingredients
    if (hasIngredientDrillDown && menuItem) {
      const initial = getInitialSelectedIngredients(menu, menuItem as Product);
      return getModificationSummary(menu, item.selection, initial);
    }

    // Virtual drill-down: compare against the selected size variant's initial ingredients
    if (hasVirtualDrillDown && item.subItemId) {
      const sizeProduct = resolveRef(menu, item.subItemId) as Product | undefined;
      if (sizeProduct) {
        const initial = getInitialSelectedIngredients(menu, sizeProduct);
        return getModificationSummary(menu, item.selection, initial);
      }
    }

    return null;
  }, [hasIngredientDrillDown, hasVirtualDrillDown, item?.selection, item?.subItemId, isSelected, menu, menuItem]);

  // Group-level capacity check
  const groupSQ = getGroupSelectionQuantity(menu, groupRef);
  const groupTotal = getGroupSelectedCount(group);
  const groupAtMax = groupSQ.max != null && groupTotal >= groupSQ.max;
  const isDisabledByCapacity = !isSelected && groupAtMax && actionType === ActionType.CHECK_BOX;

  // Upcharge display
  const pricingInfo = getModifierPriceAndCalories(menu, groupRef, itemRef, item?.subItemId, item?.quantity ?? 0);
  let upchargeDisplay: string | null = null;
  if (pricingInfo.price > 0 && !isExclusive) {
    upchargeDisplay = `+$${pricingInfo.price.toFixed(2)}`;
  }
  const itemCalories = pricingInfo.calories;

  // Intensity display
  let intensityName: string | null = null;
  if (item?.subItemId) {
    const intensityMod = resolveRef(menu, item.subItemId) as Modifier | undefined;
    intensityName = intensityMod?.displayName ?? null;
  }

  // Control type icon
  const controlIcon = actionType === ActionType.RADIO ? (
    <span className={`customizer-radio ${isSelected ? 'selected' : ''}`} />
  ) : actionType === ActionType.STATIC ? (
    <span className="customizer-static">✕</span>
  ) : (
    <span className={`customizer-checkbox ${isSelected ? 'selected' : ''}`}>
      {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
    </span>
  );

  const isToggleDisabled = actionType === ActionType.STATIC || isDisabledByCapacity;

  // Build class list
  const itemClasses = [
    'customizer-option',
    isSelected && 'customizer-option--selected',
    isChanged && 'customizer-option--changed',
    isExclusive && 'customizer-option--exclusive',
    isDisabledByCapacity && 'customizer-option--disabled',
    hasDrillDown && isSelected && 'customizer-option--drillable',
  ].filter(Boolean).join(' ');

  // Full-row click handler
  const handleRowClick = () => {
    if (!isToggleDisabled) toggle(groupRef, itemRef);
  };

  if (!item) return null;

  return (
    <div
      className={itemClasses}
      onClick={handleRowClick}
      role="option"
      aria-selected={isSelected}
      tabIndex={isToggleDisabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(); }
      }}
      title={isDisabledByCapacity ? `Max ${groupSQ.max} selected — deselect one first` : undefined}
    >
      {/* Visual indicator */}
      <span className={`customizer-option-control ${isToggleDisabled ? 'disabled' : ''}`}>
        {controlIcon}
      </span>

      {/* Image */}
      {imageUrl && (
        <div className="customizer-option-image">
          <OptimizedImage src={imageUrl} alt={name} width={44} height={44} />
        </div>
      )}

      {/* Content */}
      <div className="customizer-option-content">
        <div className="customizer-option-name-row">
          <span className="customizer-option-name">{name}</span>
          {isDefault && <span className="customizer-option-badge default">Default</span>}
          {isExclusive && <span className="customizer-option-badge none">None</span>}
        </div>
        <CopyRef value={itemRef} display={getRefId(itemRef)} className="customizer-option-ref" />
        {intensityName && isSelected && !hasDrillDown && (
          <span className="customizer-option-sub">{intensityName}</span>
        )}
        {selectedSizeName && isSelected && hasDrillDown && (
          <span className="customizer-option-sub">{selectedSizeName}</span>
        )}
        {adjustmentSummary && adjustmentSummary.length > 0 && isSelected && (
          <div className="customizer-option-adjustments">
            {adjustmentSummary.map((mod, i) => (
              <span key={i} className={`customizer-adjustment-chip ${mod.action.toLowerCase()}`}>
                {mod.action === 'ADD' ? '+' : mod.action === 'REMOVE' ? '−' : '⇄'}
                {' '}{mod.displayName}{mod.quantity > 1 ? ` ×${mod.quantity}` : ''}
              </span>
            ))}
          </div>
        )}
        {hasIntensities && isSelected && !hasDrillDown && (
          <div onClick={(e) => e.stopPropagation()}>
            <IntensitySelector
              itemRef={itemRef}
              groupRef={groupRef}
            />
          </div>
        )}
        {(upchargeDisplay || (itemCalories != null && itemCalories > 0)) && (
          <div className="customizer-option-meta">
            {upchargeDisplay && <span className="customizer-option-upcharge">{upchargeDisplay}</span>}
            {upchargeDisplay && itemCalories != null && itemCalories > 0 && (
              <span className="customizer-option-dot">·</span>
            )}
            {itemCalories != null && itemCalories > 0 && (
              <span className="customizer-option-cal">{itemCalories} calories</span>
            )}
          </div>
        )}
        {/* Inline stepper — shown inside content area when item also has drill-down */}
        {isSelected && hasDrillDown && actionType === ActionType.CHECK_BOX && maxQty > 1 && (
          <div className="customizer-option-stepper customizer-option-stepper--inline" onClick={(e) => e.stopPropagation()}>
            <button
              className="customizer-stepper-btn"
              onClick={() => decrease(groupRef, itemRef)}
              disabled={item.quantity <= 1}
            >−</button>
            <span className="customizer-stepper-qty">{item.quantity}</span>
            <button
              className="customizer-stepper-btn"
              onClick={() => increase(groupRef, itemRef)}
              disabled={item.quantity >= maxQty}
            >+</button>
          </div>
        )}
      </div>

      {/* Drill-down button */}
      {hasDrillDown && isSelected && (
        <button
          className="customizer-option-drill"
          onClick={(e) => { e.stopPropagation(); openDrillDown(groupRef, itemRef); }}
          title={`Customize ${name}`}
        >
          <span>Customize</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      )}

      {/* Quantity Stepper — right-aligned for non-drillable items */}
      {isSelected && actionType === ActionType.CHECK_BOX && maxQty > 1 && !hasDrillDown && (
        <div className="customizer-option-stepper" onClick={(e) => e.stopPropagation()}>
          <button
            className="customizer-stepper-btn"
            onClick={() => decrease(groupRef, itemRef)}
            disabled={item.quantity <= 1}
          >−</button>
          <span className="customizer-stepper-qty">{item.quantity}</span>
          <button
            className="customizer-stepper-btn"
            onClick={() => increase(groupRef, itemRef)}
            disabled={item.quantity >= maxQty}
          >+</button>
        </div>
      )}

      {/* Navigate */}
      {onProductSelect && !isExclusive && !hasDrillDown && (
        <button
          className="customizer-option-nav"
          onClick={(e) => { e.stopPropagation(); onProductSelect(itemRef); }}
          title={`View ${name} details`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────
   Nested Size Customizer (drill-down for virtual products)
   ────────────────────────────────────────────── */

function NestedSizeCustomizer() {
  const menu = useCustomizerStore((s) => s.menu);
  const drillDown = useCustomizerStore((s) => s.drillDown);
  const existingState = useCustomizerStore(
    (s) => s.drillDown ? s.selectedIngredients[s.drillDown.groupRef]?.[s.drillDown.itemRef] : undefined,
  );
  const closeDrillDown = useCustomizerStore((s) => s.closeDrillDown);
  const saveDrillDown = useCustomizerStore((s) => s.saveDrillDown);
  const drillDownProduct = useCustomizerStore(selectDrillDownProduct);

  if (!drillDown || !drillDownProduct) return null;

  return (
    <NestedSizeCustomizerInner
      menu={menu}
      parentGroupRef={drillDown.groupRef}
      parentItemRef={drillDown.itemRef}
      virtualProduct={drillDownProduct}
      existingState={existingState}
      onSave={saveDrillDown}
      onBack={closeDrillDown}
    />
  );
}

/* ──────────────────────────────────────────────
   Nested Ingredient Customizer (drill-down for
   non-virtual products with ingredientRefs)
   ────────────────────────────────────────────── */

function NestedIngredientCustomizer() {
  const menu = useCustomizerStore((s) => s.menu);
  const drillDown = useCustomizerStore((s) => s.drillDown);
  const existingState = useCustomizerStore(
    (s) => s.drillDown ? s.selectedIngredients[s.drillDown.groupRef]?.[s.drillDown.itemRef] : undefined,
  );
  const closeDrillDown = useCustomizerStore((s) => s.closeDrillDown);
  const saveDrillDown = useCustomizerStore((s) => s.saveDrillDown);
  const drillDownProduct = useCustomizerStore(selectDrillDownProduct);

  if (!drillDown || !drillDownProduct) return null;

  const parentGroupRef = drillDown.groupRef;
  const parentItemRef = drillDown.itemRef;

  return (
    <NestedIngredientCustomizerInner
      menu={menu}
      parentGroupRef={parentGroupRef}
      parentItemRef={parentItemRef}
      product={drillDownProduct}
      existingState={existingState}
      onSave={(mods) => saveDrillDown(parentGroupRef, parentItemRef, parentItemRef, mods)}
      onBack={closeDrillDown}
    />
  );
}

function NestedIngredientCustomizerInner({
  menu,
  parentGroupRef,
  parentItemRef,
  product,
  existingState,
  onSave,
  onBack,
}: {
  menu: Menu;
  parentGroupRef: string;
  parentItemRef: string;
  product: Product;
  existingState?: SelectedGroupItem;
  onSave: (mods: SelectedModifiers) => void;
  onBack: () => void;
}) {
  const initialMods = useMemo(
    () => getInitialSelectedIngredients(menu, product),
    [menu, product],
  );

  const [ingredientMods, setIngredientMods] = useState<SelectedModifiers>(() =>
    existingState?.selection ?? initialMods,
  );

  const isNestedModified = useMemo(
    () => JSON.stringify(ingredientMods) !== JSON.stringify(initialMods),
    [ingredientMods, initialMods],
  );

  const handleToggle = useCallback((groupRef: string, itemRef: string) => {
    setIngredientMods((prev) =>
      toggleIngredientSelection(prev, menu, groupRef, itemRef, initialMods),
    );
  }, [menu, initialMods]);

  const handleIncrease = useCallback((groupRef: string, itemRef: string) => {
    setIngredientMods((prev) => increaseQuantity(prev, menu, groupRef, itemRef));
  }, [menu]);

  const handleDecrease = useCallback((groupRef: string, itemRef: string) => {
    setIngredientMods((prev) => decreaseQuantity(prev, groupRef, itemRef));
  }, []);

  const handleIntensityChange = useCallback((groupRef: string, itemRef: string, subItemId: string) => {
    setIngredientMods((prev) => {
      const groupState = prev[groupRef];
      if (!groupState?.[itemRef]) return prev;
      return {
        ...prev,
        [groupRef]: {
          ...groupState,
          [itemRef]: { ...groupState[itemRef], subItemId },
        },
      };
    });
  }, []);

  const imageUrl = product.imageUrl;
  const name = product.displayName ?? getRefId(parentItemRef);
  const calories = product.calories ?? product.nutrition?.totalCalories;

  if (Object.keys(ingredientMods).length === 0) {
    return (
      <div className="customizer-nested">
        <button className="customizer-back" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Back
        </button>
        <p className="customizer-empty">No customization options available</p>
      </div>
    );
  }

  return (
    <div className="customizer-nested">
      {/* Header */}
      <div className="customizer-nested-header">
        <button className="customizer-back" onClick={onBack} title="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        {imageUrl && (
          <div className="customizer-nested-img">
            <OptimizedImage src={imageUrl} alt="" width={32} height={32} />
          </div>
        )}
        <div className="customizer-nested-title">
          <strong>{name}</strong>
          <div className="customizer-nested-meta">
            {product.price != null && (
              <span className="customizer-nested-meta-price">${product.price.toFixed(2)}</span>
            )}
            {calories != null && (
              <span className="customizer-nested-meta-cal">{calories} cal</span>
            )}
            <CopyRef value={parentItemRef} display={getRefId(parentItemRef)} className="customizer-nested-meta-ref" />
          </div>
        </div>
        <button
          className={`customizer-save${!isNestedModified ? ' customizer-save--disabled' : ''}`}
          disabled={!isNestedModified}
          onClick={() => onSave(ingredientMods)}
        >
          Save
        </button>
      </div>

      {/* Body */}
      <div className="customizer-nested-body">
        {imageUrl && (
          <div className="customizer-nested-hero">
            <OptimizedImage src={imageUrl} alt={name} width={120} height={120} />
          </div>
        )}

        <NestedSingleCustomizer
          menu={menu}
          selectedIngredients={ingredientMods}
          initialIngredients={initialMods}
          onToggle={handleToggle}
          onIncrease={handleIncrease}
          onDecrease={handleDecrease}
          onIntensityChange={handleIntensityChange}
        />
      </div>
    </div>
  );
}

interface NestedSizeCustomizerInnerProps {
  menu: Menu;
  parentGroupRef: string;
  parentItemRef: string;
  virtualProduct: Product;
  existingState?: SelectedGroupItem;
  onSave: (groupRef: string, itemRef: string, selectedSizeRef: string, sizeModifiers: SelectedModifiers) => void;
  onBack: () => void;
}

function NestedSizeCustomizerInner({
  menu,
  parentGroupRef,
  parentItemRef,
  virtualProduct,
  existingState,
  onSave,
  onBack,
}: NestedSizeCustomizerInnerProps) {
  const alternatives = useMemo(
    () => getVirtualSizeAlternatives(menu, virtualProduct),
    [menu, virtualProduct],
  );

  const initialSizeRef = useMemo(() => {
    if (existingState?.subItemId) return existingState.subItemId;
    if (!alternatives) return '';
    const def = alternatives.variants.find((v) => v.isDefault);
    return def?.ref ?? alternatives.variants[0]?.ref ?? '';
  }, [existingState, alternatives]);

  const [selectedSizeRef, setSelectedSizeRef] = useState(initialSizeRef);

  const [sizeModifiers, setSizeModifiers] = useState<SelectedModifiers>(() => {
    if (existingState?.selection && existingState.subItemId === initialSizeRef) {
      return existingState.selection;
    }
    const variant = alternatives?.variants.find((v) => v.ref === initialSizeRef);
    return variant ? getInitialSelectedIngredients(menu, variant.product) : {};
  });

  const initialMods = useMemo(() => {
    const variant = alternatives?.variants.find((v) => v.ref === selectedSizeRef);
    return variant ? getInitialSelectedIngredients(menu, variant.product) : {};
  }, [menu, alternatives, selectedSizeRef]);

  const currentVariant = alternatives?.variants.find((v) => v.ref === selectedSizeRef);

  // Track whether nested state has changed from its initial snapshot
  const isNestedModified = useMemo(() => {
    if (selectedSizeRef !== initialSizeRef) return true;
    return JSON.stringify(sizeModifiers) !== JSON.stringify(initialMods);
  }, [selectedSizeRef, initialSizeRef, sizeModifiers, initialMods]);

  const handleSizeChange = useCallback((ref: string) => {
    setSelectedSizeRef(ref);
    if (existingState?.subItemId === ref && existingState.selection) {
      setSizeModifiers(existingState.selection);
    } else {
      const variant = alternatives?.variants.find((v) => v.ref === ref);
      if (variant) {
        setSizeModifiers(getInitialSelectedIngredients(menu, variant.product));
      }
    }
  }, [menu, alternatives, existingState]);

  const handleToggle = useCallback((groupRef: string, itemRef: string) => {
    setSizeModifiers((prev) =>
      toggleIngredientSelection(prev, menu, groupRef, itemRef, initialMods),
    );
  }, [menu, initialMods]);

  const handleIncrease = useCallback((groupRef: string, itemRef: string) => {
    setSizeModifiers((prev) => increaseQuantity(prev, menu, groupRef, itemRef));
  }, [menu]);

  const handleDecrease = useCallback((groupRef: string, itemRef: string) => {
    setSizeModifiers((prev) => decreaseQuantity(prev, groupRef, itemRef));
  }, []);

  const handleIntensityChange = useCallback((groupRef: string, itemRef: string, subItemId: string) => {
    setSizeModifiers((prev) => {
      const groupState = prev[groupRef];
      if (!groupState?.[itemRef]) return prev;
      return {
        ...prev,
        [groupRef]: {
          ...groupState,
          [itemRef]: { ...groupState[itemRef], subItemId },
        },
      };
    });
  }, []);

  if (!alternatives || alternatives.variants.length === 0) {
    return (
      <div className="customizer-nested">
        <button className="customizer-back" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Back
        </button>
        <p className="customizer-empty">No size options available</p>
      </div>
    );
  }

  return (
    <div className="customizer-nested">
      {/* Nested Header — close + save */}
      <div className="customizer-nested-header">
        <button className="customizer-back" onClick={onBack} title="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        {currentVariant?.product.imageUrl && (
          <div className="customizer-nested-img">
            <OptimizedImage src={currentVariant.product.imageUrl} alt="" width={32} height={32} />
          </div>
        )}
        <div className="customizer-nested-title">
          <strong>{currentVariant?.product.displayName ?? virtualProduct.displayName}</strong>
          <div className="customizer-nested-meta">
            {currentVariant?.product.price != null && (
              <span className="customizer-nested-meta-price">${currentVariant.product.price.toFixed(2)}</span>
            )}
            {(currentVariant?.product.calories ?? currentVariant?.product.nutrition?.totalCalories) != null && (
              <span className="customizer-nested-meta-cal">
                {currentVariant!.product.calories ?? currentVariant!.product.nutrition?.totalCalories} cal
              </span>
            )}
            <CopyRef value={selectedSizeRef} display={getRefId(selectedSizeRef)} className="customizer-nested-meta-ref" />
          </div>
        </div>
        <button
          className={`customizer-save${!isNestedModified ? ' customizer-save--disabled' : ''}`}
          disabled={!isNestedModified}
          onClick={() => onSave(parentGroupRef, parentItemRef, selectedSizeRef, sizeModifiers)}
        >
          Save
        </button>
      </div>

      {/* Scrollable body */}
      <div className="customizer-nested-body">
        {/* Hero — product image */}
        {currentVariant?.product.imageUrl && (
          <div className="customizer-nested-hero">
            <OptimizedImage
              src={currentVariant.product.imageUrl}
              alt={currentVariant.product.displayName ?? ''}
              width={120}
              height={120}
            />
          </div>
        )}

        {/* Size — Segmented Tab Control */}
        <div className="customizer-segment-section">
          <span className="customizer-segment-label">{alternatives.groupName || 'Size'}</span>
          <div
            className="customizer-segment"
            style={{ '--segment-count': alternatives.variants.length } as React.CSSProperties}
          >
            {/* Sliding indicator */}
            <div
              className="customizer-segment-indicator"
              style={{
                width: `${100 / alternatives.variants.length}%`,
                transform: `translateX(${alternatives.variants.findIndex((v) => v.ref === selectedSizeRef) * 100}%)`,
              }}
            />
            {alternatives.variants.map((v) => {
              const isActive = v.ref === selectedSizeRef;
              const upcharge = getSizeVariantUpcharge(menu, virtualProduct, v.ref);
              return (
                <button
                  key={v.ref}
                  className={`customizer-segment-tab ${isActive ? 'active' : ''}`}
                  onClick={() => handleSizeChange(v.ref)}
                >
                  <span className="customizer-segment-tab-name">
                    {v.product.displayName ?? getRefId(v.ref)}
                  </span>
                  {upcharge > 0 && (
                    <span className="customizer-segment-tab-upcharge">+${upcharge.toFixed(2)}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Modifier groups for the selected size */}
        {currentVariant && (
          <NestedSingleCustomizer
            menu={menu}
            selectedIngredients={sizeModifiers}
            initialIngredients={initialMods}
            onToggle={handleToggle}
            onIncrease={handleIncrease}
            onDecrease={handleDecrease}
            onIntensityChange={handleIntensityChange}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Lightweight group renderer for the nested customizer.
 * Does NOT use the Zustand store (has its own local state).
 */
function NestedSingleCustomizer({
  menu,
  selectedIngredients,
  initialIngredients,
  onToggle,
  onIncrease,
  onDecrease,
  onIntensityChange,
}: {
  menu: Menu;
  selectedIngredients: SelectedModifiers;
  initialIngredients: SelectedModifiers;
  onToggle: (groupRef: string, itemRef: string) => void;
  onIncrease: (groupRef: string, itemRef: string) => void;
  onDecrease: (groupRef: string, itemRef: string) => void;
  onIntensityChange: (groupRef: string, itemRef: string, subItemId: string) => void;
}) {
  const unsatisfied = getUnsatisfiedGroups(menu, selectedIngredients);

  return (
    <div className="customizer-groups">
      {Object.entries(selectedIngredients).map(([groupRef, group]) => (
        <NestedGroupSection
          key={groupRef}
          menu={menu}
          groupRef={groupRef}
          group={group}
          initialGroup={initialIngredients[groupRef]}
          isUnsatisfied={unsatisfied.includes(groupRef)}
          onToggle={onToggle}
          onIncrease={onIncrease}
          onDecrease={onDecrease}
          onIntensityChange={onIntensityChange}
        />
      ))}
    </div>
  );
}

/** Group section used inside `NestedSizeCustomizer` — uses props, not store. */
function NestedGroupSection({
  menu,
  groupRef,
  group,
  initialGroup,
  isUnsatisfied,
  onToggle,
  onIncrease,
  onDecrease,
  onIntensityChange,
}: {
  menu: Menu;
  groupRef: string;
  group: Record<string, SelectedGroupItem>;
  initialGroup: Record<string, SelectedGroupItem> | undefined;
  isUnsatisfied: boolean;
  onToggle: (groupRef: string, itemRef: string) => void;
  onIncrease: (groupRef: string, itemRef: string) => void;
  onDecrease: (groupRef: string, itemRef: string) => void;
  onIntensityChange: (groupRef: string, itemRef: string, subItemId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const groupEntity = resolveRef(menu, groupRef) as ProductGroup | ModifierGroup | undefined;
  const groupName = groupEntity?.displayName ?? getRefId(groupRef);
  const sq = getGroupSelectionQuantity(menu, groupRef);
  const selectedCount = getGroupSelectedCount(group);
  const isRecipe = (groupEntity as ProductGroup)?.isRecipe;
  const isAtMax = sq.max != null && selectedCount >= sq.max;

  return (
    <div className={[
      'customizer-section',
      isUnsatisfied && 'customizer-section--required',
      isAtMax && 'customizer-section--maxed',
    ].filter(Boolean).join(' ')}>
      <button className="customizer-section-header" onClick={() => setExpanded(!expanded)}>
        <div className="customizer-section-title-row">
          <h3 className="customizer-section-name">{groupName}</h3>
          <CopyRef value={groupRef} display={getRefId(groupRef)} className="customizer-section-ref" />
          {isUnsatisfied && <span className="customizer-section-tag required">Required</span>}
          {isRecipe && <span className="customizer-section-tag recipe">Recipe</span>}
        </div>
        <div className="customizer-section-right">
          {(sq.min != null || sq.max != null) && (
            <span className="customizer-section-hint">{formatSelectionQty(sq)}</span>
          )}
          <span className={[
            'customizer-section-count',
            selectedCount > 0 && 'active',
            isAtMax && 'at-max',
          ].filter(Boolean).join(' ')}>
            {selectedCount}{sq.max != null ? `/${sq.max}` : ''}
          </span>
          <svg className={`customizer-section-chevron ${expanded ? 'open' : ''}`} width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      </button>

      <div className={`customizer-section-body ${expanded ? 'expanded' : 'collapsed'}`}>
        <div className="customizer-section-items">
          {Object.entries(group).map(([itemRef, item]) => (
            <NestedOptionRow
              key={itemRef}
              menu={menu}
              groupRef={groupRef}
              itemRef={itemRef}
              item={item}
              initialItem={initialGroup?.[itemRef]}
              group={group}
              onToggle={onToggle}
              onIncrease={onIncrease}
              onDecrease={onDecrease}
              onIntensityChange={onIntensityChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Modifier row used inside nested customizer — uses props, not store. */
function NestedOptionRow({
  menu,
  groupRef,
  itemRef,
  item,
  initialItem,
  group,
  onToggle,
  onIncrease,
  onDecrease,
  onIntensityChange,
}: {
  menu: Menu;
  groupRef: string;
  itemRef: string;
  item: SelectedGroupItem;
  initialItem: SelectedGroupItem | undefined;
  group: Record<string, SelectedGroupItem>;
  onToggle: (groupRef: string, itemRef: string) => void;
  onIncrease: (groupRef: string, itemRef: string) => void;
  onDecrease: (groupRef: string, itemRef: string) => void;
  onIntensityChange: (groupRef: string, itemRef: string, subItemId: string) => void;
}) {
  const menuItem = resolveRef(menu, itemRef) as Product | Modifier | undefined;
  const groupEntity = resolveRef(menu, groupRef) as ProductGroup | ModifierGroup | undefined;
  const override = groupEntity && 'childRefs' in groupEntity ? (groupEntity.childRefs?.[itemRef] as ChildRefOverride) : undefined;
  const actionType = getModifierActionType(menu, groupRef, itemRef);

  const name = menuItem?.displayName ?? getRefId(itemRef);
  const imageUrl = (menuItem as Product)?.imageUrl;
  const isDefault = override?.isDefault ?? (menuItem as Product)?.isDefault ?? false;
  const isExclusive = isExclusiveRef(menu, itemRef);
  const isSelected = item.quantity >= 1;
  const isChanged = item.quantity !== (initialItem?.quantity ?? 0) || item.subItemId !== initialItem?.subItemId;
  const hasIntensities = productHasIntensities(menuItem as Product, menu);
  const maxQty = getMaxSelectionQuantity(menu, groupRef, itemRef, group);

  const groupSQ = getGroupSelectionQuantity(menu, groupRef);
  const groupTotal = getGroupSelectedCount(group);
  const groupAtMax = groupSQ.max != null && groupTotal >= groupSQ.max;
  const isDisabledByCapacity = !isSelected && groupAtMax && actionType === ActionType.CHECK_BOX;

  const pricingInfo = getModifierPriceAndCalories(menu, groupRef, itemRef, item.subItemId, item.quantity);
  let upchargeDisplay: string | null = null;
  if (pricingInfo.price > 0 && !isExclusive) upchargeDisplay = `+$${pricingInfo.price.toFixed(2)}`;
  const itemCalories = pricingInfo.calories;

  let intensityName: string | null = null;
  if (item.subItemId) {
    const intensityMod = resolveRef(menu, item.subItemId) as Modifier | undefined;
    intensityName = intensityMod?.displayName ?? null;
  }

  const controlIcon = actionType === ActionType.RADIO ? (
    <span className={`customizer-radio ${isSelected ? 'selected' : ''}`} />
  ) : actionType === ActionType.STATIC ? (
    <span className="customizer-static">✕</span>
  ) : (
    <span className={`customizer-checkbox ${isSelected ? 'selected' : ''}`}>
      {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
    </span>
  );

  const isToggleDisabled = actionType === ActionType.STATIC || isDisabledByCapacity;

  const itemClasses = [
    'customizer-option',
    isSelected && 'customizer-option--selected',
    isChanged && 'customizer-option--changed',
    isExclusive && 'customizer-option--exclusive',
    isDisabledByCapacity && 'customizer-option--disabled',
  ].filter(Boolean).join(' ');

  const handleRowClick = () => {
    if (!isToggleDisabled) onToggle(groupRef, itemRef);
  };

  return (
    <div
      className={itemClasses}
      onClick={handleRowClick}
      role="option"
      aria-selected={isSelected}
      tabIndex={isToggleDisabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(); }
      }}
    >
      <span className={`customizer-option-control ${isToggleDisabled ? 'disabled' : ''}`}>
        {controlIcon}
      </span>
      {imageUrl && (
        <div className="customizer-option-image">
          <OptimizedImage src={imageUrl} alt={name} width={44} height={44} />
        </div>
      )}
      <div className="customizer-option-content">
        <div className="customizer-option-name-row">
          <span className="customizer-option-name">{name}</span>
          {isDefault && <span className="customizer-option-badge default">Default</span>}
          {isExclusive && <span className="customizer-option-badge none">None</span>}
        </div>
        <CopyRef value={itemRef} display={getRefId(itemRef)} className="customizer-option-ref" />
        {intensityName && isSelected && (
          <span className="customizer-option-sub">{intensityName}</span>
        )}
        {hasIntensities && isSelected && (
          <div onClick={(e) => e.stopPropagation()}>
            <NestedIntensitySelector
              menu={menu}
              itemRef={itemRef}
              currentSubItemId={item.subItemId}
              onSelect={(subItemId) => onIntensityChange(groupRef, itemRef, subItemId)}
            />
          </div>
        )}
        {(upchargeDisplay || (itemCalories != null && itemCalories > 0)) && (
          <div className="customizer-option-meta">
            {upchargeDisplay && <span className="customizer-option-upcharge">{upchargeDisplay}</span>}
            {upchargeDisplay && itemCalories != null && itemCalories > 0 && (
              <span className="customizer-option-dot">·</span>
            )}
            {itemCalories != null && itemCalories > 0 && (
              <span className="customizer-option-cal">{itemCalories} calories</span>
            )}
          </div>
        )}
      </div>
      {isSelected && actionType === ActionType.CHECK_BOX && maxQty > 1 && (
        <div className="customizer-option-stepper" onClick={(e) => e.stopPropagation()}>
          <button className="customizer-stepper-btn" onClick={() => onDecrease(groupRef, itemRef)} disabled={item.quantity <= 1}>−</button>
          <span className="customizer-stepper-qty">{item.quantity}</span>
          <button className="customizer-stepper-btn" onClick={() => onIncrease(groupRef, itemRef)} disabled={item.quantity >= maxQty}>+</button>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────
   Intensity Selector (pill row) — Store-connected
   ────────────────────────────────────────────── */

function IntensitySelector({ itemRef, groupRef }: { itemRef: string; groupRef: string }) {
  const menu = useCustomizerStore((s) => s.menu);
  const currentSubItemId = useCustomizerStore((s) => s.selectedIngredients[groupRef]?.[itemRef]?.subItemId);
  const changeIntensity = useCustomizerStore((s) => s.changeIntensity);

  const product = resolveRef(menu, itemRef) as Product | undefined;
  if (!product?.modifierGroupRefs) return null;

  const firstGroupRef = Object.keys(product.modifierGroupRefs)[0];
  const modGroup = firstGroupRef ? resolveRef(menu, firstGroupRef) as ModifierGroup : undefined;
  if (!modGroup?.childRefs) return null;

  return (
    <div className="customizer-intensity-row">
      {Object.entries(modGroup.childRefs).map(([modRef]) => {
        const mod = resolveRef(menu, modRef) as Modifier | undefined;
        const isActive = modRef === currentSubItemId;
        const isExclusive = isExclusiveRef(menu, modRef);
        return (
          <button
            key={modRef}
            type="button"
            className={`customizer-intensity-pill ${isActive ? 'active' : ''} ${isExclusive ? 'exclusive' : ''}`}
            title={mod?.displayName}
            onClick={(e) => {
              e.stopPropagation();
              changeIntensity(groupRef, itemRef, modRef);
            }}
          >
            {mod?.displayName ?? getRefId(modRef)}
          </button>
        );
      })}
    </div>
  );
}

/** Intensity selector for nested customizer — uses props, not store. */
function NestedIntensitySelector({
  menu,
  itemRef,
  currentSubItemId,
  onSelect,
}: {
  menu: Menu;
  itemRef: string;
  currentSubItemId?: string;
  onSelect: (subItemId: string) => void;
}) {
  const product = resolveRef(menu, itemRef) as Product | undefined;
  if (!product?.modifierGroupRefs) return null;

  const firstGroupRef = Object.keys(product.modifierGroupRefs)[0];
  const modGroup = firstGroupRef ? resolveRef(menu, firstGroupRef) as ModifierGroup : undefined;
  if (!modGroup?.childRefs) return null;

  return (
    <div className="customizer-intensity-row">
      {Object.entries(modGroup.childRefs).map(([modRef]) => {
        const mod = resolveRef(menu, modRef) as Modifier | undefined;
        const isActive = modRef === currentSubItemId;
        const isExclusive = isExclusiveRef(menu, modRef);
        return (
          <button
            key={modRef}
            type="button"
            className={`customizer-intensity-pill ${isActive ? 'active' : ''} ${isExclusive ? 'exclusive' : ''}`}
            title={mod?.displayName}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(modRef);
            }}
          >
            {mod?.displayName ?? getRefId(modRef)}
          </button>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────
   Combo Customizer — Store-connected
   ────────────────────────────────────────────── */

function ComboCustomizer() {
  const menu = useCustomizerStore((s) => s.menu);
  const comboOptions = useCustomizerStore((s) => s.comboOptions);
  const comboSelection = useCustomizerStore((s) => s.comboSelection);
  const activeSlot = useCustomizerStore((s) => s.activeComboSlot);
  const setActiveComboSlot = useCustomizerStore((s) => s.setActiveComboSlot);
  const changeComboProduct = useCustomizerStore((s) => s.changeComboProduct);
  const toggleComboModifier = useCustomizerStore((s) => s.toggleComboModifier);

  const activeOption = comboOptions[activeSlot];
  const activeSelection = comboSelection[activeSlot];

  if (!activeOption) return null;

  return (
    <div className="customizer-combo">
      {/* Combo slot tabs */}
      <div className="customizer-combo-tabs">
        {comboOptions.map((option, i) => {
          const selection = comboSelection[i];
          const productName = selection?.product?.displayName ?? 'Choose';
          return (
            <button
              key={i}
              className={`customizer-combo-tab ${i === activeSlot ? 'active' : ''}`}
              onClick={() => setActiveComboSlot(i)}
            >
              <span className="customizer-combo-tab-label">{option.groupTitle}</span>
              <span className="customizer-combo-tab-selection">{productName}</span>
            </button>
          );
        })}
      </div>

      {/* Product choices (for sides/drinks) */}
      {!activeOption.isEntree && activeOption.products.length > 1 && (
        <div className="customizer-combo-products">
          <h4 className="customizer-combo-products-title">Choose {activeOption.groupTitle}</h4>
          <div className="customizer-combo-product-grid">
            {activeOption.products.map((p) => {
              const isActive = activeSelection?.productRef === p._ref;
              const defaultPrice = activeOption.products.find((d) => d.isDefault)?.price ?? 0;
              const upcharge = p.price && p.price > defaultPrice ? p.price - defaultPrice : 0;
              return (
                <button
                  key={p._ref}
                  className={`customizer-combo-product-card ${isActive ? 'active' : ''}`}
                  onClick={() => changeComboProduct(activeSlot, p._ref)}
                >
                  {p.imageUrl && (
                    <OptimizedImage src={p.imageUrl} alt={p.displayName ?? ''} width={64} height={64} />
                  )}
                  <span className="customizer-combo-product-name">{p.displayName ?? getRefId(p._ref)}</span>
                  <CopyRef value={p._ref} display={getRefId(p._ref)} className="customizer-combo-product-ref" />
                  {p.isDefault && <span className="customizer-combo-default-badge">Default</span>}
                  {upcharge > 0 && (
                    <span className="customizer-combo-upcharge">+${upcharge.toFixed(2)}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Entree info */}
      {activeOption.isEntree && activeOption.products[0] && (
        <div className="customizer-combo-entree">
          {activeOption.products[0].imageUrl && (
            <OptimizedImage src={activeOption.products[0].imageUrl} alt="" width={64} height={64} />
          )}
          <div>
            <strong>{activeOption.products[0].displayName}</strong>
            <CopyRef value={activeOption.products[0]._ref} display={getRefId(activeOption.products[0]._ref)} className="customizer-combo-entree-ref" />
            <span className="customizer-combo-entree-note">Included in combo</span>
          </div>
        </div>
      )}

      {/* Selected product's modifier groups */}
      {activeSelection?.product && Object.keys(activeSelection.modifiers).length > 0 && (
        <div className="customizer-combo-mods">
          <h4 className="customizer-combo-mods-title">Customize {activeSelection.product.displayName}</h4>
          {Object.entries(activeSelection.modifiers).map(([groupRef, group]) => {
            const groupEntity = resolveRef(menu, groupRef) as ProductGroup | ModifierGroup | undefined;
            const groupName = groupEntity?.displayName ?? getRefId(groupRef);
            const sq = getGroupSelectionQuantity(menu, groupRef);
            const selectedCount = getGroupSelectedCount(group);

            return (
              <div key={groupRef} className="customizer-combo-mod-group">
                <div className="customizer-combo-mod-group-header">
                  <strong>{groupName}</strong>
                  {(sq.min != null || sq.max != null) && (
                    <span className="customizer-group-qty-hint">{formatSelectionQty(sq)}</span>
                  )}
                  <span className={`customizer-group-count ${selectedCount > 0 ? 'active' : ''}`}>{selectedCount}</span>
                </div>
                <div className="customizer-combo-mod-items">
                  {Object.entries(group).map(([itemRef, item]) => {
                    const menuItem = resolveRef(menu, itemRef) as Product | Modifier | undefined;
                    const name = menuItem?.displayName ?? getRefId(itemRef);
                    const isSelected = item.quantity >= 1;
                    const actionType = getModifierActionType(menu, groupRef, itemRef);

                    return (
                      <button
                        key={itemRef}
                        className={`customizer-combo-mod-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          if (actionType !== ActionType.STATIC) {
                            toggleComboModifier(activeSlot, groupRef, itemRef);
                          }
                        }}
                        disabled={actionType === ActionType.STATIC}
                      >
                        <span className={`customizer-checkbox ${isSelected ? 'selected' : ''}`}>
                          {isSelected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </span>
                        <span>{name}</span>
                        {item.quantity > 1 && <span className="customizer-combo-mod-qty">×{item.quantity}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
