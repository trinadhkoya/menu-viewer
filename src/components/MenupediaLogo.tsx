/**
 * Menupedia wordmark logo — clean text-only.
 * Uses Poppins 800 in Inspire crimson red.
 */

interface MenupediaLogoProps {
  /** Font-size of the wordmark in px */
  size?: number;
  className?: string;
}

const INSPIRE_RED = '#C8102E';

export function MenupediaLogo({ size = 28, className = '' }: MenupediaLogoProps) {
  return (
    <span
      className={`menupedia-logo ${className}`}
      aria-label="menupedia"
      style={{
        fontFamily: '"Poppins", sans-serif',
        fontWeight: 800,
        fontSize: size,
        color: INSPIRE_RED,
        letterSpacing: '-0.01em',
        lineHeight: 1,
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      menupedia
    </span>
  );
}
