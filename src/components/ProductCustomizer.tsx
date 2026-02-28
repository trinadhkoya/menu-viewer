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
import type { Menu, Product, Modifier, ModifierGroup, ProductGroup, ChildRefOverride } from '../types/menu';
import { resolveRef, getRefId } from '../utils/menuHelpers';
import { OptimizedImage } from './OptimizedImage';
import {
  type SelectedModifiers,
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
} from '../utils/productCustomization';

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

  // ── Detect if modified ──
  const isModified = useMemo(() => {
    return JSON.stringify(selectedIngredients) !== JSON.stringify(initialIngredients) ||
           JSON.stringify(comboSelection) !== JSON.stringify(initialComboSelection);
  }, [selectedIngredients, initialIngredients, comboSelection, initialComboSelection]);

  return (
    <div className="customizer">
      {/* Header */}
      <div className="customizer-header">
        <button className="customizer-back" onClick={onClose} title="Back to detail view">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div className="customizer-header-info">
          <h2 className="customizer-title">Customize</h2>
          <span className="customizer-product-name">{product.displayName}</span>
        </div>
        {isModified && (
          <button className="customizer-reset" onClick={handleReset} title="Reset to defaults">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M20.49 9A9 9 0 105.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Reset
          </button>
        )}
      </div>

      {/* Product Hero */}
      <div className="customizer-hero">
        {product.imageUrl && (
          <OptimizedImage src={product.imageUrl} alt={product.displayName ?? ''} className="customizer-hero-image" width={120} height={120} />
        )}
        <div className="customizer-hero-info">
          <span className="customizer-hero-price">${priceResult.totalPrice.toFixed(2)}</span>
          {priceResult.totalCalories != null && (
            <span className="customizer-hero-cal">{priceResult.totalCalories} cal</span>
          )}
          {priceResult.modifierUpcharge !== 0 && (
            <span className={`customizer-upcharge ${priceResult.modifierUpcharge > 0 ? 'positive' : 'negative'}`}>
              {priceResult.modifierUpcharge > 0 ? '+' : ''}{priceResult.modifierUpcharge.toFixed(2)} customization
            </span>
          )}
        </div>
      </div>

      {/* Modification Summary Pills */}
      {modSummary.length > 0 && (
        <div className="customizer-summary">
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

      {/* Body — Single PDP or Combo PDP */}
      <div className="customizer-body">
        {isCombo ? (
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
          />
        )}
      </div>

      {/* Sticky Footer */}
      <div className="customizer-footer">
        <div className="customizer-footer-price">
          <span className="customizer-footer-label">Total</span>
          <span className="customizer-footer-amount">${priceResult.totalPrice.toFixed(2)}</span>
        </div>
        {!selectionComplete && (
          <span className="customizer-footer-warning">
            Required selections incomplete
          </span>
        )}
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
}: ModifierGroupSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const groupEntity = resolveRef(menu, groupRef) as ProductGroup | ModifierGroup | undefined;
  const groupName = groupEntity?.displayName ?? getRefId(groupRef);
  const sq = getGroupSelectionQuantity(menu, groupRef);
  const selectedCount = getGroupSelectedCount(group);
  const isRecipe = (groupEntity as ProductGroup)?.isRecipe;
  const isAtMax = sq.max != null && selectedCount >= sq.max;

  return (
    <div className={`customizer-group ${isUnsatisfied ? 'customizer-group--required' : ''}`}>
      <div className="customizer-group-header" onClick={() => setExpanded(!expanded)}>
        <div className="customizer-group-header-left">
          <span className="customizer-group-expand">{expanded ? '▼' : '▶'}</span>
          <strong className="customizer-group-name">{groupName}</strong>
          {isRecipe && <span className="customizer-group-badge recipe">Recipe</span>}
        </div>
        <div className="customizer-group-header-right">
          {sq.min != null && sq.max != null && (
            <span className="customizer-group-qty-hint">
              {sq.min === sq.max
                ? `Select ${sq.min}`
                : `${sq.min ?? 0}–${sq.max ?? '∞'}`}
            </span>
          )}
          <span className={`customizer-group-count ${selectedCount > 0 ? 'active' : ''} ${isAtMax ? 'at-max' : ''}`}>
            {selectedCount}{sq.max != null ? `/${sq.max}` : ''}
          </span>
          {isAtMax && (
            <span className="customizer-group-max-badge" title={`Maximum ${sq.max} selected`}>MAX</span>
          )}
          {isUnsatisfied && (
            <span className="customizer-group-required-dot" title="Required — not enough selected">!</span>
          )}
        </div>
      </div>

      {expanded && (
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
            />
          ))}
        </div>
      )}
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

  return (
    <div className={`customizer-item ${isSelected ? 'customizer-item--selected' : ''} ${isChanged ? 'customizer-item--changed' : ''} ${isExclusive ? 'customizer-item--exclusive' : ''} ${isDisabledByCapacity ? 'customizer-item--disabled' : ''}`}>
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
        </div>
        {intensityName && isSelected && (
          <span className="customizer-item-intensity">{intensityName}</span>
        )}
        {hasIntensities && isSelected && (
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

      {/* Quantity Stepper */}
      {isSelected && actionType === ActionType.CHECK_BOX && maxQty > 1 && (
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
      {onProductSelect && !isExclusive && (
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
                  {sq.min != null && sq.max != null && (
                    <span className="customizer-group-qty-hint">{sq.min}–{sq.max}</span>
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
