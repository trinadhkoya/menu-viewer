import React from 'react';

const S = 18; // default icon size

interface IconProps {
  size?: number;
  className?: string;
}

/** Arby's – stylised oven-mitt / hat silhouette */
export const ArbysIcon: React.FC<IconProps> = ({ size = S, className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    width={size}
    height={size}
    className={className}
    aria-label="Arby's"
  >
    <rect width="100" height="100" rx="18" fill="#D5001F" />
    <path
      d="M50 14c-2 0-5 2-8 7-4 6-8 16-8 26 0 6 1 10 3 13
         2 4 6 6 10 7v12c0 2 1 3 3 3s3-1 3-3V67c4-1 8-3 10-7
         2-3 3-7 3-13 0-10-4-20-8-26-3-5-6-7-8-7z"
      fill="#fff"
    />
  </svg>
);

/** BWW – buffalo silhouette */
export const BwwIcon: React.FC<IconProps> = ({ size = S, className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    width={size}
    height={size}
    className={className}
    aria-label="Buffalo Wild Wings"
  >
    <rect width="100" height="100" rx="18" fill="#FFC526" />
    {/* simplified buffalo body */}
    <path
      d="M22 72c0 0 2-10 8-16 3-3 5-3 7-6 1-2 1-5-1-8
         -2-3-1-7 2-10 3-3 5-3 7-1 1 1 2 3 1 5
         -1 3 0 5 2 6 3 2 6 1 8-1 2-2 5-2 7 0
         2 2 4 3 7 1 2-1 3-3 2-6-1-2 0-4 1-5
         2-2 4-2 7 1 3 3 4 7 2 10-2 3 0 6 1 8
         2 3 4 3 7 6 6 6 8 16 8 16z"
      fill="#3D2B1F"
    />
    {/* wings */}
    <path
      d="M55 32c2-5 6-10 12-14 3-2 5-1 4 2-2 4-2 8 0 11
         3 4 7 5 10 3-2 4-6 6-10 5-3-1-6-1-8 1
         -3 2-5 0-8-4 1-2 0-3 0-4z"
      fill="#fff"
    />
  </svg>
);

/** Sonic – bowtie / carhop shape */
export const SonicIcon: React.FC<IconProps> = ({ size = S, className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    width={size}
    height={size}
    className={className}
    aria-label="Sonic"
  >
    <rect width="100" height="100" rx="18" fill="#7DD3E8" />
    {/* bowtie outline */}
    <path
      d="M14 50c0-8 12-22 36-22s36 14 36 22-12 22-36 22S14 58 14 50z"
      fill="#fff"
      stroke="#0093D0"
      strokeWidth="5"
    />
    {/* pinch at centre */}
    <path
      d="M42 36c-5 4-8 9-8 14s3 10 8 14M58 36c5 4 8 9 8 14s-3 10-8 14"
      fill="none"
      stroke="#0093D0"
      strokeWidth="4"
    />
  </svg>
);

/** Dunkin' – stylised "D" with coffee drop */
export const DunkinIcon: React.FC<IconProps> = ({ size = S, className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    width={size}
    height={size}
    className={className}
    aria-label="Dunkin'"
  >
    <rect width="100" height="100" rx="18" fill="#FF6600" />
    {/* bold "D" */}
    <text
      x="50"
      y="68"
      textAnchor="middle"
      fontFamily="Arial Black, Arial, sans-serif"
      fontWeight="900"
      fontSize="60"
      fill="#fff"
    >
      D
    </text>
    {/* pink apostrophe / coffee drop */}
    <circle cx="76" cy="22" r="6" fill="#DA1884" />
  </svg>
);

/** Inspire – flame with spoon inside a circle */
export const InspireIcon: React.FC<IconProps> = ({ size = S, className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    width={size}
    height={size}
    className={className}
    aria-label="Inspire"
  >
    <circle cx="50" cy="50" r="48" fill="#9B59D0" />
    <circle cx="50" cy="50" r="40" fill="none" stroke="#fff" strokeWidth="4" />
    {/* flame */}
    <path
      d="M50 18c-4 10-16 20-16 34 0 12 8 20 16 20s16-8 16-20
         C66 38 54 28 50 18z"
      fill="#fff"
    />
    {/* inner flame / spoon bowl */}
    <ellipse cx="50" cy="56" rx="6" ry="8" fill="#9B59D0" />
    {/* spoon handle */}
    <rect x="48" y="62" width="4" height="14" rx="2" fill="#9B59D0" />
  </svg>
);

/** Map brand-id → icon component */
export const BRAND_ICONS: Record<string, React.FC<IconProps>> = {
  arbys: ArbysIcon,
  bww: BwwIcon,
  sonic: SonicIcon,
  dunkin: DunkinIcon,
  inspire: InspireIcon,
};
