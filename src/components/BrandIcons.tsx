import React from 'react';

const S = 28; // default icon size

interface IconProps {
  size?: number;
  className?: string;
}

/** Arby's – iconic wide-brimmed hat on red */
export const ArbysIcon: React.FC<IconProps> = ({ size = S, className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 120 120"
    width={size}
    height={size}
    className={className}
    aria-label="Arby's"
  >
    <rect width="120" height="120" rx="22" fill="#DC0032" />
    {/* Arby's hat silhouette */}
    <path
      d="M60 22c-3 0-7 4-11 12-5 10-9 24-9 36 0 4 .5 8 2 11
         1.5 3 4 5.5 7 7l1 .5V96c0 1.5 1 2.5 2.5 2.5h15
         c1.5 0 2.5-1 2.5-2.5V88.5l1-.5c3-1.5 5.5-4 7-7
         1.5-3 2-7 2-11 0-12-4-26-9-36C66 26 63 22 60 22z"
      fill="#fff"
    />
  </svg>
);

/** BWW – bold "BWW" text on gold */
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
    {/* Buffalo silhouette — compact, centered */}
    <path
      d="M36 78c-2-4-3-9-1-14 1-4 4-7 7-9 2-1 3-3 3-5
         0-3-2-5-1-8 1-4 4-6 8-5 3 0 5 2 7 5v-4c0-3 2-6 5-7
         3-1 6 0 8 2 2-2 5-3 8-2 3 1 5 4 5 7v4
         c2-3 4-5 7-5 4-1 7 1 8 5 1 3-1 5-1 8
         0 2 1 4 3 5 3 2 6 5 7 9 2 5 1 10-1 14z"
      fill="#1A1A1A"
    />
    {/* Wing accent */}
    <path
      d="M48 44c-1-3 0-7 3-10 2-2 4-3 6-2 1 0 2 1 2 3
         -1 3-2 6-1 9M72 44c1-3 0-7-3-10-2-2-4-3-6-2
         -1 0-2 1-2 3 1 3 2 6 1 9"
      fill="none" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round"
    />
    {/* BWW text */}
    <text
      x="60" y="105"
      textAnchor="middle"
      fontFamily="Arial Black, Impact, sans-serif"
      fontWeight="900"
      fontSize="18"
      fill="#1A1A1A"
      letterSpacing="2"
    >BWW</text>
  </svg>
);

/** Sonic – double chevron speed mark on blue */
export const SonicIcon: React.FC<IconProps> = ({ size = S, className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 120 120"
    width={size}
    height={size}
    className={className}
    aria-label="Sonic"
  >
    <rect width="120" height="120" rx="22" fill="#0093D0" />
    {/* Horizontal speed lines — the Sonic carhop motif */}
    <rect x="20" y="38" width="80" height="6" rx="3" fill="#fff" />
    <rect x="28" y="52" width="64" height="6" rx="3" fill="#fff" />
    <rect x="20" y="66" width="80" height="6" rx="3" fill="#fff" />
    {/* Cherry limeade circle at right */}
    <circle cx="88" cy="55" r="14" fill="#E40046" />
    <circle cx="88" cy="55" r="8" fill="#fff" opacity="0.35" />
    {/* SONIC text */}
    <text
      x="60" y="100"
      textAnchor="middle"
      fontFamily="Arial Black, Impact, sans-serif"
      fontWeight="900"
      fontSize="18"
      fill="#fff"
      letterSpacing="3"
    >SONIC</text>
  </svg>
);

/** Dunkin' – coffee cup with DD on warm orange-pink */
export const DunkinIcon: React.FC<IconProps> = ({ size = S, className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 120 120"
    width={size}
    height={size}
    className={className}
    aria-label="Dunkin'"
  >
    <rect width="120" height="120" rx="22" fill="#FF6600" />
    {/* Coffee cup body */}
    <path
      d="M38 36h44l-5 52c-.5 4-3.5 7-7.5 7H50.5c-4 0-7-3-7.5-7L38 36z"
      fill="#fff"
    />
    {/* Cup lid */}
    <rect x="34" y="30" width="52" height="8" rx="4" fill="#DA1884" />
    {/* DD text on cup */}
    <text
      x="60" y="72"
      textAnchor="middle"
      fontFamily="Arial Black, Impact, sans-serif"
      fontWeight="900"
      fontSize="22"
      fill="#FF6600"
    >DD</text>
    {/* Steam wisps */}
    <path d="M48 24c0-4 3-7 3-10M56 22c0-4 3-7 3-10M64 24c0-4 3-7 3-10"
      fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.7"
    />
  </svg>
);

/** Map brand-id → icon component */
export const BRAND_ICONS: Record<string, React.FC<IconProps>> = {
  arbys: ArbysIcon,
  bww: BwwIcon,
  sonic: SonicIcon,
  dunkin: DunkinIcon,
};
