/**
 * Menupedia wordmark logo — clean text-only.
 * Uses the active brand's heading font (falls back to Poppins).
 * Accepts an optional colour override so the welcome page can
 * tint the logo to the active brand.
 */

interface MenupediaLogoProps {
  /** Font-size of the wordmark in px */
  size?: number;
  /** Override colour — can be a hex, rgb, or CSS variable string */
  color?: string;
  className?: string;
}

const INSPIRE_RED = '#C8102E';

export function MenupediaLogo({ size = 28, color, className = '' }: MenupediaLogoProps) {
  return (
    <span
      className={`menupedia-logo ${className}`}
      aria-label="menupedia"
      style={{
        fontFamily: 'var(--brand-font-heading, "Poppins"), sans-serif',
        fontWeight: 800,
        fontSize: size,
        color: color ?? INSPIRE_RED,
        letterSpacing: '-0.01em',
        lineHeight: 1,
        userSelect: 'none',
        whiteSpace: 'nowrap',
        transition: 'color 0.35s ease',
      }}
    >
      menupedia
    </span>
  );
}
