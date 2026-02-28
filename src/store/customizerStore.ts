/**
 * Zustand store for ProductCustomizer state.
 *
 * Uses the "store-per-instance" pattern:
 *  - `createCustomizerStore(menu, product)` creates a scoped store
 *  - Provided to component tree via React context
 *  - Consumed via `useCustomizerStore(selector)` hook
 *
 * This eliminates all prop drilling for callbacks & selection state
 * across SingleCustomizer → ModifierGroupSection → ModifierItemCard.
 */

import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { createContext, useContext } from 'react';
import type { Menu, Product } from '../types/menu';
import { resolveRef } from '../utils/menuHelpers';
import {
  type SelectedModifiers,
  type ComboSelection,
  type ComboOptions,
  type FullPriceResult,
  getInitialSelectedIngredients,
  toggleIngredientSelection,
  increaseQuantity,
  decreaseQuantity,
  isRequiredSelectionComplete,
  getUnsatisfiedGroups,
  calculateFullPrice,
  getComboOptions,
  getInitialComboSelection,
} from '../utils/productCustomization';

/* ────────────────────────────────────────────── */
/*  State shape                                    */
/* ────────────────────────────────────────────── */

export interface CustomizerState {
  // ── Refs (non-reactive, set once) ──
  menu: Menu;
  product: Product;
  isCombo: boolean;

  // ── Single PDP ──
  initialIngredients: SelectedModifiers;
  selectedIngredients: SelectedModifiers;

  // ── Combo PDP ──
  comboOptions: ComboOptions;
  initialComboSelection: ComboSelection[];
  comboSelection: ComboSelection[];
  activeComboSlot: number;

  // ── Drill-down navigation ──
  drillDown: { groupRef: string; itemRef: string } | null;

  // ── Expanded sections (groupRef → boolean) ──
  expandedGroups: Record<string, boolean>;
}

/* ────────────────────────────────────────────── */
/*  Derived selectors (computed from state)        */
/* ────────────────────────────────────────────── */

export const selectPriceResult = (s: CustomizerState): FullPriceResult =>
  s.isCombo
    ? calculateFullPrice(s.menu, s.product, s.comboSelection, true)
    : calculateFullPrice(s.menu, s.product, s.selectedIngredients, false);

export const selectSelectionComplete = (s: CustomizerState): boolean =>
  s.isCombo ? true : isRequiredSelectionComplete(s.menu, s.selectedIngredients);

export const selectUnsatisfiedGroups = (s: CustomizerState): string[] =>
  s.isCombo ? [] : getUnsatisfiedGroups(s.menu, s.selectedIngredients);

export const selectIsModified = (s: CustomizerState): boolean =>
  JSON.stringify(s.selectedIngredients) !== JSON.stringify(s.initialIngredients) ||
  JSON.stringify(s.comboSelection) !== JSON.stringify(s.initialComboSelection);

export const selectDrillDownProduct = (s: CustomizerState): Product | undefined =>
  s.drillDown ? (resolveRef(s.menu, s.drillDown.itemRef) as Product | undefined) : undefined;

/* ────────────────────────────────────────────── */
/*  Actions                                        */
/* ────────────────────────────────────────────── */

export interface CustomizerActions {
  // Single PDP
  toggle: (groupRef: string, itemRef: string) => void;
  increase: (groupRef: string, itemRef: string) => void;
  decrease: (groupRef: string, itemRef: string) => void;
  changeIntensity: (groupRef: string, itemRef: string, subItemId: string) => void;
  reset: () => void;

  // Combo
  setActiveComboSlot: (index: number) => void;
  changeComboProduct: (slotIndex: number, productRef: string) => void;
  toggleComboModifier: (slotIndex: number, groupRef: string, itemRef: string) => void;

  // Drill-down navigation
  openDrillDown: (groupRef: string, itemRef: string) => void;
  closeDrillDown: () => void;
  saveDrillDown: (
    groupRef: string,
    itemRef: string,
    selectedSizeRef: string,
    sizeModifiers: SelectedModifiers,
  ) => void;

  // UI
  toggleGroupExpanded: (groupRef: string) => void;
  isGroupExpanded: (groupRef: string) => boolean;
}

export type CustomizerStore = CustomizerState & CustomizerActions;

/* ────────────────────────────────────────────── */
/*  Store factory                                  */
/* ────────────────────────────────────────────── */

export function createCustomizerStore(
  menu: Menu,
  product: Product,
  savedIngredients?: SelectedModifiers,
  savedComboSelection?: ComboSelection[],
) {
  const isCombo = product.isCombo === true;
  const initialIngredients = getInitialSelectedIngredients(menu, product);
  const comboOptions = isCombo ? getComboOptions(menu, product) : [];
  const initialComboSelection = isCombo ? getInitialComboSelection(menu, comboOptions) : [];

  return createStore<CustomizerStore>((set, get) => ({
    // ── Initial state ──
    menu,
    product,
    isCombo,
    initialIngredients,
    selectedIngredients: savedIngredients ?? initialIngredients,
    comboOptions,
    initialComboSelection,
    comboSelection: savedComboSelection ?? initialComboSelection,
    activeComboSlot: 0,
    drillDown: null,
    expandedGroups: {},

    // ── Single PDP actions ──
    toggle: (groupRef, itemRef) =>
      set((s) => ({
        selectedIngredients: toggleIngredientSelection(
          s.selectedIngredients,
          s.menu,
          groupRef,
          itemRef,
          s.initialIngredients,
        ),
      })),

    increase: (groupRef, itemRef) =>
      set((s) => ({
        selectedIngredients: increaseQuantity(s.selectedIngredients, s.menu, groupRef, itemRef),
      })),

    decrease: (groupRef, itemRef) =>
      set((s) => ({
        selectedIngredients: decreaseQuantity(s.selectedIngredients, groupRef, itemRef),
      })),

    changeIntensity: (groupRef, itemRef, subItemId) =>
      set((s) => {
        const groupState = s.selectedIngredients[groupRef];
        if (!groupState?.[itemRef]) return s;
        return {
          selectedIngredients: {
            ...s.selectedIngredients,
            [groupRef]: {
              ...groupState,
              [itemRef]: { ...groupState[itemRef], subItemId },
            },
          },
        };
      }),

    reset: () =>
      set((s) => ({
        selectedIngredients: s.initialIngredients,
        comboSelection: s.initialComboSelection,
        activeComboSlot: 0,
        drillDown: null,
      })),

    // ── Combo actions ──
    setActiveComboSlot: (index) => set({ activeComboSlot: index }),

    changeComboProduct: (slotIndex, productRef) =>
      set((s) => {
        const newProduct = resolveRef(s.menu, productRef) as Product | undefined;
        const newMods = newProduct ? getInitialSelectedIngredients(s.menu, newProduct) : {};
        return {
          comboSelection: s.comboSelection.map((slot, i) =>
            i === slotIndex
              ? { ...slot, product: newProduct, productRef, modifiers: newMods }
              : slot,
          ),
        };
      }),

    toggleComboModifier: (slotIndex, groupRef, itemRef) =>
      set((s) => {
        const slot = s.comboSelection[slotIndex];
        const slotInitial = slot.product
          ? getInitialSelectedIngredients(s.menu, slot.product)
          : {};
        const newMods = toggleIngredientSelection(
          slot.modifiers,
          s.menu,
          groupRef,
          itemRef,
          slotInitial,
        );
        return {
          comboSelection: s.comboSelection.map((sl, i) =>
            i === slotIndex ? { ...sl, modifiers: newMods } : sl,
          ),
        };
      }),

    // ── Drill-down actions ──
    openDrillDown: (groupRef, itemRef) => set({ drillDown: { groupRef, itemRef } }),

    closeDrillDown: () => set({ drillDown: null }),

    saveDrillDown: (groupRef, itemRef, selectedSizeRef, sizeModifiers) =>
      set((s) => {
        const groupState = s.selectedIngredients[groupRef] ?? {};
        const itemState = groupState[itemRef] ?? { quantity: 1 };
        return {
          selectedIngredients: {
            ...s.selectedIngredients,
            [groupRef]: {
              ...groupState,
              [itemRef]: {
                ...itemState,
                quantity: Math.max(itemState.quantity, 1),
                subItemId: selectedSizeRef,
                selection: sizeModifiers,
              },
            },
          },
          drillDown: null,
        };
      }),

    // ── UI actions ──
    toggleGroupExpanded: (groupRef) =>
      set((s) => ({
        expandedGroups: {
          ...s.expandedGroups,
          [groupRef]: !(s.expandedGroups[groupRef] ?? true), // default expanded
        },
      })),

    isGroupExpanded: (groupRef) => get().expandedGroups[groupRef] ?? true,
  }));
}

/* ────────────────────────────────────────────── */
/*  React context + hook                           */
/* ────────────────────────────────────────────── */

type CustomizerStoreApi = ReturnType<typeof createCustomizerStore>;

export const CustomizerContext = createContext<CustomizerStoreApi | null>(null);

/**
 * Access the customizer store from any child component.
 * Accepts an optional selector for fine-grained subscriptions.
 */
export function useCustomizerStore<T>(selector: (state: CustomizerStore) => T): T {
  const store = useContext(CustomizerContext);
  if (!store) throw new Error('useCustomizerStore must be used within CustomizerContext.Provider');
  return useStore(store, useShallow(selector));
}
