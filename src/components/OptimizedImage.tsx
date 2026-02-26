import { useState, useCallback, useRef, useEffect } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  /** Width in px — used for sizing the placeholder and setting width/height attrs to prevent CLS */
  width?: number;
  /** Height in px */
  height?: number;
}

/**
 * Performance-optimised image component:
 * - `loading="lazy"` + `decoding="async"` for off-screen images
 * - Explicit width/height to prevent Cumulative Layout Shift (CLS)
 * - Skeleton placeholder while loading
 * - Fade-in transition on load
 * - IntersectionObserver to defer src assignment for images far below the fold
 * - Graceful fallback on error (hides broken image icon)
 */
export function OptimizedImage({
  src,
  alt,
  className = '',
  width,
  height,
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver — start loading when within 300px of viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // If IntersectionObserver is unsupported, just show immediately
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
    setLoaded(true); // stop showing skeleton
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
      {/* Skeleton placeholder */}
      {!loaded && <div className="optimized-image-skeleton" />}

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

      {/* Error fallback */}
      {error && (
        <div className="optimized-image-error">
          <span>📷</span>
        </div>
      )}
    </div>
  );
}
