/**
 * ProductCustomizer — Interactive product customization panel.
 *
 * Mimics the mobile app PDP experience:
 * - Modifier groups with checkbox/radio/stepper controls
 * - Intensity options (Easy/Regular/Extra/None)
 * - Quantity +/- steppers respecting min/max constraints
 * - Real-time upcharge price calculation
 * - Combo product slot selection (sides, drinks)
 * - Size variant tabs with upcharge badges
 * - Validation indicators for required groups
 * - Running total (base price + modifier upcharges)
 */

import { useState, useMemo, useCallback } from 'react';
import type { Menu, Product, Modifier, ModifierGroup, ProductGroup, ChildRefOverride, Quantity } from '../types/menu';
import { resolveRef, getRefId } from '../utils/menuHelpers';
import { OptimizedImage } from './OptimizedImage';
import {
  type SelectedModifiers,
  type SelectedGroupItem,
  type ComboSelection,
  type ComboOptions,
  type FullPriceResult,
  ActionType,
  getInitialSelectedIngredients,
  toggleIngredientSelection,
  increaseQuantity,
  decreaseQuantity,
  getModifierActionType,
  getGroupSelectionQuantity,
  getGroupSelectedCount,
  getMaxSelectionQuantity,
  isRequiredSelectionComplete,
  getUnsatisfiedGroups,
  calculateFullPrice,
  getModificationSummary,
  isExclusiveRef,
  productHasIntensities,
  getComboOptions,
  getInitialComboSelection,
  getModifierPriceAndCalories,
  getVirtualSizeAlternatives,
  getInitialVirtualSizeState,
} from '../utils/productCustomization';

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

interface ProductCustomizerProps {
  menu: Menu;
  product: Product;
  productRef: string;
  onClose: () => void;
  onProductSelect?: (ref: string) => void;
}

export function ProductCustomizer({ menu, product, onClose, onProductSelect }: ProductCustomizerProps) {
  const isCombo = product.isCombo === true;

  // ── Single PDP State ──
  const initialIngredients = useMemo(
    () => getInitialSelectedIngredients(menu, product),
    [menu, product],
  );
  const [selectedIngredients, setSelectedIngredients] = useState<SelectedModifiers>(initialIngredients);

  // ── Combo PDP State ──
  const comboOptions = useMemo(
    () => (isCombo ? getComboOptions(menu, product) : []),
    [menu, product, isCombo],
  );
  const initialComboSelection = useMemo(
    () => (isCombo ? getInitialComboSelection(menu, comboOptions) : []),
    [menu, comboOptions, isCombo],
  );
  const [comboSelection, setComboSelection] = useState<ComboSelection[]>(initialComboSelection);
  const [activeComboSlot, setActiveComboSlot] = useState(0);

  // ── Price Calculation ──
  const priceResult: FullPriceResult = useMemo(() => {
    if (isCombo) {
      return calculateFullPrice(menu, product, comboSelection, true);
    }
    return calculateFullPrice(menu, product, selectedIngredients, false);
  }, [menu, product, selectedIngredients, comboSelection, isCombo]);

  // ── Validation ──
  const selectionComplete = useMemo(
    () => (isCombo ? true : isRequiredSelectionComplete(menu, selectedIngredients)),
    [menu, selectedIngredients, isCombo],
  );
  const unsatisfiedGroups = useMemo(
    () => (isCombo ? [] : getUnsatisfiedGroups(menu, selectedIngredients)),
    [menu, selectedIngredients, isCombo],
  );

  // ── Modification Summary ──
  const modSummary = useMemo(
    () => (isCombo ? [] : getModificationSummary(menu, selectedIngredients, initialIngredients)),
    [menu, selectedIngredients, initialIngredients, isCombo],
  );

  // ── Handlers ──
  const handleToggle = useCallback((groupRef: string, itemRef: string) => {
    setSelectedIngredients((prev) =>
      toggleIngredientSelection(prev, menu, groupRef, itemRef, initialIngredients),
    );
  }, [menu, initialIngredients]);

  const handleIncrease = useCallback((groupRef: string, itemRef: string) => {
    setSelectedIngredients((prev) => increaseQuantity(prev, menu, groupRef, itemRef));
  }, [menu]);

  const handleDecrease = useCallback((groupRef: string, itemRef: string) => {
    setSelectedIngredients((prev) => decreaseQuantity(prev, groupRef, itemRef));
  }, []);

  const handleIntensityChange = useCallback((groupRef: string, itemRef: string, subItemId: string) => {
    setSelectedIngredients((prev) => {
      const groupState = prev[groupRef];
      if (!groupState?.[itemRef]) return prev;
      return {
        ...prev,
        [groupRef]: {
          ...groupState,
          [itemRef]: {
            ...groupState[itemRef],
            subItemId,
          },
        },
      };
    });
  }, []);

  const handleReset = useCallback(() => {
    setSelectedIngredients(initialIngredients);
    setComboSelection(initialComboSelection);
  }, [initialIngredients, initialComboSelection]);

  // ── Combo slot handlers ──
  const handleComboProductChange = useCallback((slotIndex: number, productRef: string) => {
    setComboSelection((prev) => {
      const newProduct = resolveRef(menu, productRef) as Product | undefined;
      const newMods = newProduct ? getInitialSelectedIngredients(menu, newProduct) : {};
      return prev.map((s, i) =>
        i === slotIndex ? { ...s, product: newProduct, productRef, modifiers: newMods } : s,
      );
    });
  }, [menu]);

  const handleComboModifierToggle = useCallback((slotIndex: number, groupRef: string, itemRef: string) => {
    setComboSelection((prev) => {
      const slot = prev[slotIndex];
      const initialMods = slot.product ? getInitialSelectedIngredients(menu, slot.product) : {};
      const newMods = toggleIngredientSelection(slot.modifiers, menu, groupRef, itemRef, initialMods);
      return prev.map((s, i) => (i === slotIndex ? { ...s, modifiers: newMods } : s));
    });
  }, [menu]);

  // ── Nested drill-down state (for virtual products with size variants) ──
  const [drillDown, setDrillDown] = useState<{ groupRef: string; itemRef: string } | null>(null);

  const handleDrillDownOpen = useCallback((groupRef: string, itemRef: string) => {
    setDrillDown({ groupRef, itemRef });
  }, []);

  const handleDrillDownClose = useCallback(() => {
    setDrillDown(null);
  }, []);

  /** Called when the nested customizer saves size + modifier selections back. */
  const handleDrillDownSave = useCallback((
    groupRef: string,
    itemRef: string,
    selectedSizeRef: string,
    sizeModifiers: SelectedModifiers,
  ) => {
    setSelectedIngredients((prev) => {
      const groupState = prev[groupRef] ?? {};
      const itemState = groupState[itemRef] ?? { quantity: 1 };
      return {
        ...prev,
        [groupRef]: {
          ...groupState,
          [itemRef]: {
            ...itemState,
            quantity: Math.max(itemState.quantity, 1), // ensure selected
            subItemId: selectedSizeRef,
            selection: sizeModifiers,
          },
        },
      };
    });
    setDrillDown(null);
  }, []);

  // ── Detect if modified ──
  const isModified = useMemo(() => {
    return JSON.stringify(selectedIngredients) !== JSON.stringify(initialIngredients) ||
           JSON.stringify(comboSelection) !== JSON.stringify(initialComboSelection);
  }, [selectedIngredients, initialIngredients, comboSelection, initialComboSelection]);

  // ── Resolve drill-down target ──
  const drillDownProduct = drillDown
    ? resolveRef(menu, drillDown.itemRef) as Product | undefined
    : undefined;

  // ── Progress tracking ──
  const totalRequiredGroups = unsatisfiedGroups.length + Object.keys(selectedIngredients).filter(
    (g) => !unsatisfiedGroups.includes(g) && (() => {
      const sq = getGroupSelectionQuantity(menu, g);
      return sq.min != null && sq.min > 0;
    })()
  ).length;
  const satisfiedRequired = totalRequiredGroups - unsatisfiedGroups.length;
  const progressPct = totalRequiredGroups > 0 ? (satisfiedRequired / totalRequiredGroups) * 100 : 100;

  const [summaryExpanded, setSummaryExpanded] = useState(false);

  return (
    <div className="customizer">
      {/* Header */}
      <div className="customizer-header">
        <button className="customizer-back" onClick={onClose} title="Back to detail view">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        {product.imageUrl && (
          <img src={product.imageUrl} alt="" className="customizer-header-avatar" />
        )}
        <div className="customizer-header-info">
          <h2 className="customizer-title">{product.displayName}</h2>
          <span className="customizer-product-name">
            ${priceResult.totalPrice.toFixed(2)}
            {priceResult.totalCalories != null && <> &middot; {priceResult.totalCalories} cal</>}
          </span>
        </div>
        {isModified && (
          <button className="customizer-reset" onClick={handleReset} title="Reset to defaults">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M20.49 9A9 9 0 105.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        )}
      </div>

      {/* Progress bar for required groups */}
      {totalRequiredGroups > 0 && (
        <div className="customizer-progress">
          <div className="customizer-progress-bar" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      {/* Modification Summary — collapsible chip */}
      {modSummary.length > 0 && (
        <div className="customizer-summary">
          <button
            className="customizer-summary-toggle"
            onClick={() => setSummaryExpanded(!summaryExpanded)}
          >
            <span className="customizer-summary-count">{modSummary.length}</span>
            {modSummary.length === 1 ? 'modification' : 'modifications'}
            <svg className={`customizer-summary-chevron ${summaryExpanded ? 'open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          {summaryExpanded && (
            <div className="customizer-summary-pills">
              {modSummary.map((mod, i) => (
                <span
                  key={i}
                  className={`customizer-mod-pill customizer-mod-pill--${mod.action.toLowerCase()}`}
                >
                  {mod.action === 'ADD' && '+ '}
                  {mod.action === 'REMOVE' && '− '}
                  {mod.action === 'CHANGE' && '↻ '}
                  {mod.displayName}
                  {mod.quantity > 1 && ` ×${mod.quantity}`}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Body — Single PDP, Combo PDP, or Nested Drill-down */}
      <div className="customizer-body">
        {drillDown && drillDownProduct ? (
          <NestedSizeCustomizer
            menu={menu}
            parentGroupRef={drillDown.groupRef}
            parentItemRef={drillDown.itemRef}
            virtualProduct={drillDownProduct}
            existingState={selectedIngredients[drillDown.groupRef]?.[drillDown.itemRef]}
            onSave={handleDrillDownSave}
            onBack={handleDrillDownClose}
          />
        ) : isCombo ? (
          <ComboCustomizer
            menu={menu}
            comboOptions={comboOptions}
            comboSelection={comboSelection}
            activeSlot={activeComboSlot}
            onSlotChange={setActiveComboSlot}
            onProductChange={handleComboProductChange}
            onModifierToggle={handleComboModifierToggle}
            onProductSelect={onProductSelect}
          />
        ) : (
          <SingleCustomizer
            menu={menu}
            selectedIngredients={selectedIngredients}
            initialIngredients={initialIngredients}
            unsatisfiedGroups={unsatisfiedGroups}
            onToggle={handleToggle}
            onIncrease={handleIncrease}
            onDecrease={handleDecrease}
            onIntensityChange={handleIntensityChange}
            onProductSelect={onProductSelect}
            onDrillDown={handleDrillDownOpen}
          />
        )}
      </div>

      {/* Sticky Footer with CTA */}
      <div className="customizer-footer">
        <div className="customizer-footer-left">
          <span className="customizer-footer-amount">${priceResult.totalPrice.toFixed(2)}</span>
          {priceResult.modifierUpcharge !== 0 && (
            <span className={`customizer-footer-upcharge ${priceResult.modifierUpcharge > 0 ? 'up' : 'down'}`}>
              {priceResult.modifierUpcharge > 0 ? '+' : ''}{priceResult.modifierUpcharge.toFixed(2)}
            </span>
          )}
        </div>
        <button
          className={`customizer-footer-cta ${!selectionComplete ? 'disabled' : ''}`}
          disabled={!selectionComplete}
          onClick={onClose}
        >
          {!selectionComplete ? (
            <>{unsatisfiedGroups.length} required left</>
          ) : (
            <>Done<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></>
          )}
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Single PDP — Ingredient Groups
   ────────────────────────────────────────────── */

interface SingleCustomizerProps {
  menu: Menu;
  selectedIngredients: SelectedModifiers;
  initialIngredients: SelectedModifiers;
  unsatisfiedGroups: string[];
  onToggle: (groupRef: string, itemRef: string) => void;
  onIncrease: (groupRef: string, itemRef: string) => void;
  onDecrease: (groupRef: string, itemRef: string) => void;
  onIntensityChange: (groupRef: string, itemRef: string, subItemId: string) => void;
  onProductSelect?: (ref: string) => void;
  onDrillDown?: (groupRef: string, itemRef: string) => void;
}

function SingleCustomizer({
  menu,
  selectedIngredients,
  initialIngredients,
  unsatisfiedGroups,
  onToggle,
  onIncrease,
  onDecrease,
  onIntensityChange,
  onProductSelect,
  onDrillDown,
}: SingleCustomizerProps) {
  return (
    <div className="customizer-groups">
      {Object.entries(selectedIngredients).map(([groupRef, group]) => (
        <ModifierGroupSection
          key={groupRef}
          menu={menu}
          groupRef={groupRef}
          group={group}
          initialGroup={initialIngredients[groupRef]}
          isUnsatisfied={unsatisfiedGroups.includes(groupRef)}
          onToggle={onToggle}
          onIncrease={onIncrease}
          onDecrease={onDecrease}
          onIntensityChange={onIntensityChange}
          onProductSelect={onProductSelect}
          onDrillDown={onDrillDown}
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

interface ModifierGroupSectionProps {
  menu: Menu;
  groupRef: string;
  group: Record<string, import('../utils/productCustomization').SelectedGroupItem>;
  initialGroup: Record<string, import('../utils/productCustomization').SelectedGroupItem> | undefined;
  isUnsatisfied: boolean;
  onToggle: (groupRef: string, itemRef: string) => void;
  onIncrease: (groupRef: string, itemRef: string) => void;
  onDecrease: (groupRef: string, itemRef: string) => void;
  onIntensityChange: (groupRef: string, itemRef: string, subItemId: string) => void;
  onProductSelect?: (ref: string) => void;
  onDrillDown?: (groupRef: string, itemRef: string) => void;
}

function ModifierGroupSection({
  menu,
  groupRef,
  group,
  initialGroup,
  isUnsatisfied,
  onToggle,
  onIncrease,
  onDecrease,
  onIntensityChange,
  onProductSelect,
  onDrillDown,
}: ModifierGroupSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const groupEntity = resolveRef(menu, groupRef) as ProductGroup | ModifierGroup | undefined;
  const groupName = groupEntity?.displayName ?? getRefId(groupRef);
  const sq = getGroupSelectionQuantity(menu, groupRef);
  const selectedCount = getGroupSelectedCount(group);
  const isRecipe = (groupEntity as ProductGroup)?.isRecipe;
  const isAtMax = sq.max != null && selectedCount >= sq.max;

  return (
    <div className={`customizer-group ${isUnsatisfied ? 'customizer-group--required' : ''} ${isAtMax ? 'customizer-group--maxed' : ''}`}>
      <button className="customizer-group-header" onClick={() => setExpanded(!expanded)}>
        <div className="customizer-group-header-left">
          <svg className={`customizer-group-chevron ${expanded ? 'open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <strong className="customizer-group-name">{groupName}</strong>
          {isRecipe && <span className="customizer-group-badge recipe">Recipe</span>}
          {isUnsatisfied && <span className="customizer-group-badge required">Required</span>}
        </div>
        <div className="customizer-group-header-right">
          {(sq.min != null || sq.max != null) && (
            <span className="customizer-group-qty-hint">
              {formatSelectionQty(sq)}
            </span>
          )}
          <span className={`customizer-group-count ${selectedCount > 0 ? 'active' : ''} ${isAtMax ? 'at-max' : ''}`}>
            {selectedCount}{sq.max != null ? `/${sq.max}` : ''}
          </span>
        </div>
      </button>

      <div className={`customizer-group-items-wrap ${expanded ? 'expanded' : 'collapsed'}`}>
        <div className="customizer-group-items">
          {Object.entries(group).map(([itemRef, item]) => (
            <ModifierItemCard
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
              onProductSelect={onProductSelect}
              onDrillDown={onDrillDown}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Modifier Item Card
   ────────────────────────────────────────────── */

interface ModifierItemCardProps {
  menu: Menu;
  groupRef: string;
  itemRef: string;
  item: import('../utils/productCustomization').SelectedGroupItem;
  initialItem: import('../utils/productCustomization').SelectedGroupItem | undefined;
  group: Record<string, import('../utils/productCustomization').SelectedGroupItem>;
  onToggle: (groupRef: string, itemRef: string) => void;
  onIncrease: (groupRef: string, itemRef: string) => void;
  onDecrease: (groupRef: string, itemRef: string) => void;
  onIntensityChange: (groupRef: string, itemRef: string, subItemId: string) => void;
  onProductSelect?: (ref: string) => void;
  onDrillDown?: (groupRef: string, itemRef: string) => void;
}

function ModifierItemCard({
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
  onProductSelect,
  onDrillDown,
}: ModifierItemCardProps) {
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

  // Virtual product with size alternatives → show drill-down button
  const virtualAlts = useMemo(
    () => getVirtualSizeAlternatives(menu, menuItem),
    [menu, menuItem],
  );
  const hasDrillDown = virtualAlts != null && onDrillDown != null;

  // Currently selected size name (for subtitle)
  const selectedSizeName = useMemo(() => {
    if (!item.subItemId || !virtualAlts) return null;
    const variant = virtualAlts.variants.find((v) => v.ref === item.subItemId);
    return variant?.product?.displayName ?? null;
  }, [item.subItemId, virtualAlts]);

  // Group-level capacity check: disable unselected items when group max is reached
  const groupSQ = getGroupSelectionQuantity(menu, groupRef);
  const groupTotal = getGroupSelectedCount(group);
  const groupAtMax = groupSQ.max != null && groupTotal >= groupSQ.max;
  const isDisabledByCapacity = !isSelected && groupAtMax && actionType === ActionType.CHECK_BOX;

  // Upcharge display — uses proper IDP tech doc delta pricing
  const pricingInfo = getModifierPriceAndCalories(menu, groupRef, itemRef, item.subItemId, item.quantity);
  let upchargeDisplay: string | null = null;
  if (pricingInfo.price > 0 && !isExclusive) {
    upchargeDisplay = `+$${pricingInfo.price.toFixed(2)}`;
  }
  const itemCalories = pricingInfo.calories;

  // Intensity display
  let intensityName: string | null = null;
  if (item.subItemId) {
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
    'customizer-item',
    isSelected && 'customizer-item--selected',
    isChanged && 'customizer-item--changed',
    isExclusive && 'customizer-item--exclusive',
    isDisabledByCapacity && 'customizer-item--disabled',
    hasDrillDown && isSelected && 'customizer-item--drillable',
  ].filter(Boolean).join(' ');

  return (
    <div className={itemClasses}>
      {/* Selection control */}
      <button
        className="customizer-item-toggle"
        onClick={() => {
          if (!isToggleDisabled) onToggle(groupRef, itemRef);
        }}
        disabled={isToggleDisabled}
        title={isDisabledByCapacity ? `Max ${groupSQ.max} selected — deselect one first` : undefined}
      >
        {controlIcon}
      </button>

      {/* Image */}
      {imageUrl && (
        <div className="customizer-item-image">
          <OptimizedImage src={imageUrl} alt={name} width={48} height={48} />
        </div>
      )}

      {/* Info */}
      <div className="customizer-item-info">
        <div className="customizer-item-name-row">
          <span className="customizer-item-name">{name}</span>
          {isDefault && <span className="customizer-item-default-badge">Default</span>}
          {isExclusive && <span className="customizer-item-exclusive-badge">None</span>}
          {isChanged && !isExclusive && <span className="customizer-item-modified-dot" title="Modified" />}
        </div>
        {intensityName && isSelected && !hasDrillDown && (
          <span className="customizer-item-intensity">{intensityName}</span>
        )}
        {selectedSizeName && isSelected && hasDrillDown && (
          <span className="customizer-item-intensity">{selectedSizeName}</span>
        )}
        {hasIntensities && isSelected && !hasDrillDown && (
          <IntensitySelector
            menu={menu}
            itemRef={itemRef}
            currentSubItemId={item.subItemId}
            onSelect={(subItemId) => onIntensityChange(groupRef, itemRef, subItemId)}
          />
        )}
        <div className="customizer-item-meta">
          {upchargeDisplay && <span className="customizer-item-upcharge">{upchargeDisplay}</span>}
          {itemCalories != null && itemCalories > 0 && (
            <span className="customizer-item-cal">{itemCalories} cal</span>
          )}
        </div>
      </div>

      {/* Drill-down Customize button for virtual products with sizes */}
      {hasDrillDown && isSelected && (
        <button
          className="customizer-item-drilldown"
          onClick={() => onDrillDown!(groupRef, itemRef)}
          title={`Customize ${name}`}
        >
          <span>Customize</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      )}

      {/* Quantity Stepper */}
      {isSelected && actionType === ActionType.CHECK_BOX && maxQty > 1 && !hasDrillDown && (
        <div className="customizer-item-stepper">
          <button
            className="customizer-stepper-btn"
            onClick={() => onDecrease(groupRef, itemRef)}
            disabled={item.quantity <= 0}
          >−</button>
          <span className="customizer-stepper-qty">{item.quantity}</span>
          <button
            className="customizer-stepper-btn"
            onClick={() => onIncrease(groupRef, itemRef)}
            disabled={item.quantity >= maxQty}
          >+</button>
        </div>
      )}

      {/* Navigate to product detail */}
      {onProductSelect && !isExclusive && !hasDrillDown && (
        <button
          className="customizer-item-navigate"
          onClick={() => onProductSelect(itemRef)}
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

interface NestedSizeCustomizerProps {
  menu: Menu;
  parentGroupRef: string;
  parentItemRef: string;
  virtualProduct: Product;
  existingState?: SelectedGroupItem;
  onSave: (groupRef: string, itemRef: string, selectedSizeRef: string, sizeModifiers: SelectedModifiers) => void;
  onBack: () => void;
}

function NestedSizeCustomizer({
  menu,
  parentGroupRef,
  parentItemRef,
  virtualProduct,
  existingState,
  onSave,
  onBack,
}: NestedSizeCustomizerProps) {
  const alternatives = useMemo(
    () => getVirtualSizeAlternatives(menu, virtualProduct),
    [menu, virtualProduct],
  );

  // Determine the initial size ref: from existing state, or default variant, or first
  const initialSizeRef = useMemo(() => {
    if (existingState?.subItemId) return existingState.subItemId;
    if (!alternatives) return '';
    const def = alternatives.variants.find((v) => v.isDefault);
    return def?.ref ?? alternatives.variants[0]?.ref ?? '';
  }, [existingState, alternatives]);

  const [selectedSizeRef, setSelectedSizeRef] = useState(initialSizeRef);

  // Build initial modifiers for each size variant, or use existing
  const [sizeModifiers, setSizeModifiers] = useState<SelectedModifiers>(() => {
    if (existingState?.selection && existingState.subItemId === initialSizeRef) {
      return existingState.selection;
    }
    const variant = alternatives?.variants.find((v) => v.ref === initialSizeRef);
    return variant ? getInitialSelectedIngredients(menu, variant.product) : {};
  });

  // Cache initial modifiers per size ref for comparison
  const initialMods = useMemo(() => {
    const variant = alternatives?.variants.find((v) => v.ref === selectedSizeRef);
    return variant ? getInitialSelectedIngredients(menu, variant.product) : {};
  }, [menu, alternatives, selectedSizeRef]);

  const currentVariant = alternatives?.variants.find((v) => v.ref === selectedSizeRef);

  // When size tab changes, swap modifiers
  const handleSizeChange = useCallback((ref: string) => {
    setSelectedSizeRef(ref);
    // Load existing or default modifiers for the new size
    if (existingState?.subItemId === ref && existingState.selection) {
      setSizeModifiers(existingState.selection);
    } else {
      const variant = alternatives?.variants.find((v) => v.ref === ref);
      if (variant) {
        setSizeModifiers(getInitialSelectedIngredients(menu, variant.product));
      }
    }
  }, [menu, alternatives, existingState]);

  // Ingredient handlers for the selected size
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
        <button className="customizer-nested-back" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Back
        </button>
        <p className="customizer-empty">No size options available</p>
      </div>
    );
  }

  return (
    <div className="customizer-nested">
      {/* Nested Header */}
      <div className="customizer-nested-header">
        <button className="customizer-nested-back" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Back
        </button>
        <div className="customizer-nested-title">
          <strong>{virtualProduct.displayName}</strong>
          <span className="customizer-nested-subtitle">{alternatives.groupName}</span>
        </div>
      </div>

      {/* Size Pills */}
      <div className="customizer-nested-sizes">
        {alternatives.variants.map((v) => {
          const isActive = v.ref === selectedSizeRef;
          const upcharge = v.product.price != null && alternatives.variants[0]?.product.price != null
            ? Math.max(v.product.price - (alternatives.variants.find((d) => d.isDefault)?.product.price ?? 0), 0)
            : 0;
          return (
            <button
              key={v.ref}
              className={`customizer-nested-size-pill ${isActive ? 'active' : ''}`}
              onClick={() => handleSizeChange(v.ref)}
            >
              <span className="customizer-nested-size-name">{v.product.displayName ?? getRefId(v.ref)}</span>
              {v.isDefault && <span className="customizer-nested-size-default">Default</span>}
              {upcharge > 0 && <span className="customizer-nested-size-upcharge">+${upcharge.toFixed(2)}</span>}
            </button>
          );
        })}
      </div>

      {/* Current size's ingredient groups */}
      {currentVariant && (
        <div className="customizer-nested-body">
          {currentVariant.product.imageUrl && (
            <div className="customizer-nested-hero">
              <OptimizedImage
                src={currentVariant.product.imageUrl}
                alt={currentVariant.product.displayName ?? ''}
                width={80}
                height={80}
              />
              <span className="customizer-nested-hero-name">{currentVariant.product.displayName}</span>
              {currentVariant.product.calories != null && (
                <span className="customizer-nested-hero-cal">{currentVariant.product.calories} cal</span>
              )}
            </div>
          )}

          <SingleCustomizer
            menu={menu}
            selectedIngredients={sizeModifiers}
            initialIngredients={initialMods}
            unsatisfiedGroups={getUnsatisfiedGroups(menu, sizeModifiers)}
            onToggle={handleToggle}
            onIncrease={handleIncrease}
            onDecrease={handleDecrease}
            onIntensityChange={handleIntensityChange}
          />
        </div>
      )}

      {/* Save / Done button */}
      <div className="customizer-nested-footer">
        <button
          className="customizer-nested-done"
          onClick={() => onSave(parentGroupRef, parentItemRef, selectedSizeRef, sizeModifiers)}
        >
          Done — Apply {currentVariant?.product.displayName ?? 'Selection'}
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Intensity Selector (pill row)
   ────────────────────────────────────────────── */

interface IntensitySelectorProps {
  menu: Menu;
  itemRef: string;
  currentSubItemId?: string;
  onSelect: (subItemId: string) => void;
}

function IntensitySelector({ menu, itemRef, currentSubItemId, onSelect }: IntensitySelectorProps) {
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
   Combo Customizer
   ────────────────────────────────────────────── */

interface ComboCustomizerProps {
  menu: Menu;
  comboOptions: ComboOptions;
  comboSelection: ComboSelection[];
  activeSlot: number;
  onSlotChange: (index: number) => void;
  onProductChange: (slotIndex: number, productRef: string) => void;
  onModifierToggle: (slotIndex: number, groupRef: string, itemRef: string) => void;
  onProductSelect?: (ref: string) => void;
}

function ComboCustomizer({
  menu,
  comboOptions,
  comboSelection,
  activeSlot,
  onSlotChange,
  onProductChange,
  onModifierToggle,
}: ComboCustomizerProps) {
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
              onClick={() => onSlotChange(i)}
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
                  onClick={() => onProductChange(activeSlot, p._ref)}
                >
                  {p.imageUrl && (
                    <OptimizedImage src={p.imageUrl} alt={p.displayName ?? ''} width={64} height={64} />
                  )}
                  <span className="customizer-combo-product-name">{p.displayName ?? getRefId(p._ref)}</span>
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
                            onModifierToggle(activeSlot, groupRef, itemRef);
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
