import React from 'react';

const S = 28; // default icon size

interface IconProps {
  size?: number;
  className?: string;
}

/**
 * Arby's – Classic oven-mitt hat on Arby's red.
 * The silhouette uses the distinctive wide-brim cowboy-hat shape.
 */
export const ArbysIcon: React.FC<IconProps> = ({ size = S, className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 120 120"
    width={size}
    height={size}
    className={className}
    aria-label="Arby's"
  >
    <rect width="120" height="120" rx="22" fill="#CE1126" />
    {/* Hat crown (tall rounded top) */}
    <path
      d="M47 70
         C47 46 49 28 60 28
         C71 28 73 46 73 70"
      fill="#fff"
    />
    {/* Hat brim (wide curved base) */}
    <ellipse cx="60" cy="72" rx="26" ry="8" fill="#fff" />
    {/* Inner shadow line on brim */}
    <ellipse cx="60" cy="72" rx="13" ry="4" fill="#CE1126" opacity="0.15" />
  </svg>
);

/**
 * BWW – Buffalo Wild Wings.
 * Dark buffalo wings silhouette on signature gold/yellow.
 */
export const BwwIcon: React.FC<IconProps> = ({ size = S, className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 120 120"
    width={size}
    height={size}
    className={className}
    aria-label="Buffalo Wild Wings"
  >
    <rect width="120" height="120" rx="22" fill="#FFC600" />
    {/* Simplified buffalo/wings silhouette */}
    <g fill="#1A1A1A">
      {/* Left wing */}
      <path d="M22 62c2-12 8-22 18-28 4-2 7-1 6 3-2 6-3 13 0 18 2 4 6 7 11 8z" />
      {/* Right wing */}
      <path d="M98 62c-2-12-8-22-18-28-4-2-7-1-6 3 2 6 3 13 0 18-2 4-6 7-11 8z" />
      {/* Buffalo body (center mass) */}
      <ellipse cx="60" cy="62" rx="20" ry="14" />
      {/* Head */}
      <circle cx="60" cy="44" r="8" />
      {/* Horns */}
      <path
        d="M52 42c-3-4-8-6-13-5M68 42c3-4 8-6 13-5"
        fill="none" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round"
      />
    </g>
    {/* BWW text */}
    <text
      x="60" y="100"
      textAnchor="middle"
      fontFamily="'Arial Black','Helvetica Neue',Arial,sans-serif"
      fontWeight="900"
      fontSize="18"
      fill="#1A1A1A"
      letterSpacing="1.5"
    >BWW</text>
  </svg>
);

/**
 * Sonic Drive-In.
 * Horizontal speed lines with the red cherry-limeade circle on Sonic blue.
 */
export const SonicIcon: React.FC<IconProps> = ({ size = S, className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 120 120"
    width={size}
    height={size}
    className={className}
    aria-label="Sonic"
  >
    <rect width="120" height="120" rx="22" fill="#0073CF" />
    {/* Three horizontal speed lines */}
    <rect x="18" y="35" width="60" height="7" rx="3.5" fill="#fff" />
    <rect x="24" y="51" width="48" height="7" rx="3.5" fill="#fff" />
    <rect x="18" y="67" width="60" height="7" rx="3.5" fill="#fff" />
    {/* Red carhop cherry circle */}
    <circle cx="86" cy="51" r="16" fill="#EE3A42" />
    {/* Highlight on cherry */}
    <circle cx="82" cy="47" r="4" fill="#fff" opacity="0.35" />
    {/* SONIC text */}
    <text
      x="60" y="100"
      textAnchor="middle"
      fontFamily="'Arial Black','Helvetica Neue',Arial,sans-serif"
      fontWeight="900"
      fontSize="16"
      fill="#fff"
      letterSpacing="3"
    >SONIC</text>
  </svg>
);

/**
 * Dunkin' (formerly Dunkin' Donuts).
 * Coffee cup with DD on warm orange.
 */
export const DunkinIcon: React.FC<IconProps> = ({ size = S, className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 120 120"
    width={size}
    height={size}
    className={className}
    aria-label="Dunkin'"
  >
    <rect width="120" height="120" rx="22" fill="#FF671F" />
    {/* Steam wisps */}
    <path
      d="M46 26c0-5 4-9 4-14M56 24c0-5 4-9 4-14M66 26c0-5 4-9 4-14"
      fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.6"
    />
    {/* Cup lid */}
    <rect x="34" y="30" width="52" height="9" rx="4.5" fill="#DA1884" />
    {/* Cup body */}
    <path
      d="M38 39h44l-5 48c-.5 4.5-4 8-8.5 8H51.5c-4.5 0-8-3.5-8.5-8L38 39z"
      fill="#fff"
    />
    {/* DD text on cup */}
    <text
      x="60" y="72"
      textAnchor="middle"
      fontFamily="'Arial Black','Helvetica Neue',Arial,sans-serif"
      fontWeight="900"
      fontSize="22"
      fill="#FF671F"
    >DD</text>
  </svg>
);

/** Map brand-id → icon component */
// eslint-disable-next-line react-refresh/only-export-components
export const BRAND_ICONS: Record<string, React.FC<IconProps>> = {
  arbys: ArbysIcon,
  bww: BwwIcon,
  sonic: SonicIcon,
  dunkin: DunkinIcon,
};
