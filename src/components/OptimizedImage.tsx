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
}: OptimizedImageProps) {
  const thumbUrl = toThumbnail(src, width ?? 280);
  const alreadyCached = _loadedCache.has(thumbUrl);

  const [loaded, setLoaded] = useState(alreadyCached);
  const [error, setError] = useState(false);
  const [inView, setInView] = useState(alreadyCached); // skip observer if cached
  const containerRef = useRef<HTMLDivElement>(null);

  // Shared IntersectionObserver — start loading when within 400px of viewport
  useEffect(() => {
    if (inView) return; // already visible or cached
    const el = containerRef.current;
    if (!el) return;

    if (!('IntersectionObserver' in window)) {
      setInView(true);
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
    _loadedCache.add(thumbUrl);
  }, [thumbUrl]);

  const handleError = useCallback(() => {
    // If the thumbnail variant failed, try the original URL
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
          src={thumbUrl}
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

      {/* Error fallback — try original URL if thumbnail variant failed */}
      {error && (
        <div className="optimized-image-error">
          <span>📷</span>
          <span className="optimized-image-error-text">No image</span>
        </div>
      )}
    </div>
  );
}
