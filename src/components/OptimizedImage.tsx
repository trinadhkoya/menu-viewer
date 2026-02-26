import { useState, useCallback, useRef, useEffect } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  /** Width in px — used for sizing the placeholder and setting width/height attrs to prevent CLS */
  width?: number;
  /** Height in px */
  height?: number;
  /** Show combo overlay styling */
  isCombo?: boolean;
}

/**
 * Performance-optimised image component:
 * - `loading="lazy"` + `decoding="async"` for off-screen images
 * - Explicit width/height to prevent Cumulative Layout Shift (CLS)
 * - Food-themed shimmer skeleton with plate icon while loading
 * - Fade-in transition on load
 * - IntersectionObserver to defer src assignment for images far below the fold
 * - Graceful fallback on error
 * - Optional combo overlay ribbon
 */
export function OptimizedImage({
  src,
  alt,
  className = '',
  width,
  height,
  isCombo = false,
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver — start loading when within 300px of viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (!('IntersectionObserver' in window)) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleLoad = useCallback(() => setLoaded(true), []);
  const handleError = useCallback(() => {
    setError(true);
    setLoaded(true);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`optimized-image-wrapper ${className}`}
      style={{
        width: width ? `${width}px` : undefined,
        height: height ? `${height}px` : undefined,
      }}
    >
      {/* Food-themed skeleton placeholder */}
      {!loaded && (
        <div className="optimized-image-skeleton">
          <span className="skeleton-food-icon">🍽️</span>
        </div>
      )}

      {/* Actual image — only set src when in view */}
      {inView && !error && (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading="lazy"
          decoding="async"
          className={`optimized-image ${loaded ? 'optimized-image--loaded' : ''}`}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}

      {/* Combo ribbon overlay */}
      {isCombo && loaded && !error && (
        <span className="combo-ribbon">🍔+🍟 Combo</span>
      )}

      {/* Error fallback */}
      {error && (
        <div className="optimized-image-error">
          <span>📷</span>
          <span className="optimized-image-error-text">No image</span>
        </div>
      )}
    </div>
  );
}
