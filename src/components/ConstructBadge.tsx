import type { ConstructClassification, ConstructTag } from '../utils/constructClassifier';
import { TAG_INFO } from '../utils/constructClassifier';

// ─────────────────────────────────────────────
// ConstructBadge – shows the primary + tag pills
// ─────────────────────────────────────────────

interface ConstructBadgeProps {
  classification: ConstructClassification;
  /** Show all detected tags (default: primary badge only) */
  showAll?: boolean;
  /** Compact: icon only */
  compact?: boolean;
  onClick?: (tag: ConstructTag) => void;
}

export function ConstructBadge({ classification, showAll = false, compact = false, onClick }: ConstructBadgeProps) {
  if (!classification) return null;

  // Primary badge is always shown
  const primaryInfo = TAG_INFO[classification.primary === 'customizable' ? 'has-ingredients' : classification.primary];

  return (
    <span className="construct-badge-group">
      {/* Primary badge */}
      <span
        className={`construct-badge construct-badge--primary ${compact ? 'construct-badge--compact' : ''}`}
        style={{ '--construct-color': classification.color } as React.CSSProperties}
        title={classification.summary}
      >
        <span className="construct-badge-icon">{classification.icon}</span>
        {!compact && <span className="construct-badge-label">{primaryInfo?.label ?? classification.primary}</span>}
      </span>

      {/* Extra tags */}
      {showAll && classification.tags
        .filter(t => TAG_INFO[t]?.isFilterable && t !== classification.primary && t !== 'has-ingredients')
        .slice(0, 8)
        .map(tag => {
          const info = TAG_INFO[tag];
          return (
            <span
              key={tag}
              className={`construct-badge ${compact ? 'construct-badge--compact' : ''}`}
              style={{ '--construct-color': info.color } as React.CSSProperties}
              title={`${info.label}: ${info.description}`}
              onClick={(e) => { e.stopPropagation(); onClick?.(tag); }}
            >
              <span className="construct-badge-icon">{info.icon}</span>
              {!compact && <span className="construct-badge-label">{info.label}</span>}
            </span>
          );
        })}
    </span>
  );
}

// ─────────────────────────────────────────────
// ConstructTagBadge – single tag pill for filters
// ─────────────────────────────────────────────

export function ConstructTagBadge({
  tag,
  count,
  isActive,
  onClick,
}: {
  tag: ConstructTag;
  count?: number;
  isActive?: boolean;
  onClick?: () => void;
}) {
  const info = TAG_INFO[tag];
  if (!info) return null;

  return (
    <button
      className={`construct-type-badge ${isActive ? 'construct-type-badge--active' : ''}`}
      style={{ '--construct-color': info.color } as React.CSSProperties}
      onClick={onClick}
      title={info.description}
    >
      <span className="construct-type-icon">{info.icon}</span>
      <span className="construct-type-label">{info.label}</span>
      {count != null && <span className="construct-type-count">{count}</span>}
    </button>
  );
}
