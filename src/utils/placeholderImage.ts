import type { BrandId } from '../components/MenuUploader';

const BRAND_PLACEHOLDERS: Record<BrandId, string> = {
  arbys: '/placeholders/arbys.png',
  bww: '/placeholders/bww.png',
  dunkin: '/placeholders/dunkin.png',
  sonic: '/placeholders/sonic.png',
};

const DEFAULT_PLACEHOLDER = '/placeholders/default.png';

/**
 * Returns the brand-specific product fallback image path.
 * Falls back to the generic placeholder when brand is unknown.
 */
export function getProductPlaceholder(brand: BrandId | null | undefined): string {
  return brand ? BRAND_PLACEHOLDERS[brand] ?? DEFAULT_PLACEHOLDER : DEFAULT_PLACEHOLDER;
}
