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
  /** Image to display when both thumbnail and original fail */
  fallbackSrc?: string;
}

// ── Global loaded-image cache ──────────────────────────────
// Keeps track of URLs that have already been decoded once this session.
// On revisit the skeleton + fade-in are skipped entirely → instant render.
const _loadedCache = new Set<string>();

// ── Shared IntersectionObserver ────────────────────────────
// One observer for ALL OptimizedImage instances → fewer allocations.
type ObserverEntry = { callback: () => void };
let _sharedObserver: IntersectionObserver | null = null;
const _observerMap = new WeakMap<Element, ObserverEntry>();

function getSharedObserver(): IntersectionObserver {
  if (!_sharedObserver) {
    _sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const data = _observerMap.get(entry.target);
            if (data) {
              data.callback();
              _sharedObserver!.unobserve(entry.target);
              _observerMap.delete(entry.target);
            }
          }
        }
      },
      { rootMargin: '400px' },
    );
  }
  return _sharedObserver;
}

// ── Thumbnail URL helper ───────────────────────────────────
// Cloudflare Image Delivery supports flexible variants:
//   /w=<width>,quality=<1-100>,fit=<mode>
// Falls back to original URL for non-Cloudflare sources.
function toThumbnail(url: string, w: number): string {
  if (!url) return url;
  // Cloudflare Image Delivery: replace /download or /public with sized variant
  if (url.includes('imagedelivery.net/')) {
    return url.replace(/\/[^/]+$/, `/w=${w},fit=cover,quality=70`);
  }
  return url;
}

/**
 * Performance-optimised image component:
 * - Cloudflare thumbnail variant (smaller download)
 * - Shared IntersectionObserver (one for all images)
 * - Global loaded-image cache (instant re-render on revisit)
 * - `loading="lazy"` + `decoding="async"` for off-screen images
 * - Explicit width/height to prevent Cumulative Layout Shift (CLS)
 * - Food-themed shimmer skeleton with plate icon while loading
 * - Fade-in transition on load
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
  fallbackSrc,
}: OptimizedImageProps) {
  const thumbUrl = toThumbnail(src, width ?? 280);
  const alreadyCached = _loadedCache.has(thumbUrl);

  const [loaded, setLoaded] = useState(alreadyCached);
  const [error, setError] = useState(false);
  // When the thumbnail variant fails, retry with the original src before giving up
  const [useFallback, setUseFallback] = useState(false);
  const [inView, setInView] = useState(alreadyCached); // skip observer if cached
  const containerRef = useRef<HTMLDivElement>(null);

  const activeSrc = useFallback ? src : thumbUrl;

  // Shared IntersectionObserver — start loading when within 400px of viewport
  useEffect(() => {
    if (inView) return; // already visible or cached
    const el = containerRef.current;
    if (!el) return;

    if (!('IntersectionObserver' in window)) {
      setInView(true); // eslint-disable-line react-hooks/set-state-in-effect -- fallback for missing IO
      return;
    }

    const observer = getSharedObserver();
    _observerMap.set(el, { callback: () => setInView(true) });
    observer.observe(el);

    return () => {
      observer.unobserve(el);
      _observerMap.delete(el);
    };
  }, [inView]);

  const handleLoad = useCallback(() => {
    setLoaded(true);
    _loadedCache.add(activeSrc);
  }, [activeSrc]);

  const handleError = useCallback(() => {
    // If the thumbnail variant failed, retry with original URL
    if (!useFallback && thumbUrl !== src) {
      setUseFallback(true);
      return;
    }
    // Both failed — show error state
    setError(true);
    setLoaded(true);
  }, [useFallback, thumbUrl, src]);

  return (
    <div
      ref={containerRef}
      className={`optimized-image-wrapper ${className}`}
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
          src={activeSrc}
          alt={alt}
          width={width}
          height={height}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          className={`optimized-image ${loaded ? 'optimized-image--loaded' : ''} ${alreadyCached ? 'optimized-image--instant' : ''}`}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}

      {/* Combo ribbon overlay */}
      {isCombo && loaded && !error && (
        <span className="combo-ribbon">🍔+🍟 Combo</span>
      )}

      {/* Error fallback — both thumbnail and original failed */}
      {error && (
        fallbackSrc ? (
          <img
            src={fallbackSrc}
            alt={alt || 'Fallback'}
            width={width}
            height={height}
            className="optimized-image optimized-image--loaded optimized-image--fallback"
            style={{ objectFit: 'contain', opacity: 0.6 }}
          />
        ) : (
          <div className="optimized-image-error">
            <svg className="optimized-image-error-icon" viewBox="0 0 48 48" fill="none" width="36" height="36">
              <rect x="4" y="8" width="40" height="32" rx="4" stroke="currentColor" strokeWidth="2" fill="none" />
              <circle cx="16" cy="20" r="4" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M4 34 l12-10 6 5 10-12 12 17" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />
            </svg>
            <span className="optimized-image-error-text">Image unavailable</span>
          </div>
        )
      )}
    </div>
  );
}
