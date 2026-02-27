import type { ConstructDef, ClassifiedProduct } from '../utils/constructClassifier';
import { getConstruct } from '../utils/constructClassifier';

// ─────────────────────────────────────────────
// ConstructBadge – shows construct id + name
// ─────────────────────────────────────────────

interface ConstructBadgeProps {
  constructId: string;
  compact?: boolean;
  onClick?: () => void;
}

export function ConstructBadge({ constructId, compact = false, onClick }: ConstructBadgeProps) {
  const c = getConstruct(constructId);
  if (!c) return null;

  return (
    <span
      className={`construct-badge ${compact ? 'construct-badge--compact' : ''}`}
      style={{ '--construct-color': c.color } as React.CSSProperties}
      title={`${c.name}\n${c.engineeringTerm}`}
      onClick={onClick}
    >
      <span className="construct-badge-icon">{c.icon}</span>
      <span className="construct-badge-label">
        {compact ? c.id : `${c.id}: ${c.shortName}`}
      </span>
    </span>
  );
}

// ─────────────────────────────────────────────
// ConstructTypePill – primary type filter button
// ─────────────────────────────────────────────

export function ConstructTypePill({
  construct,
  count,
  isActive,
  onClick,
}: {
  construct: ConstructDef;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`construct-type-badge ${isActive ? 'construct-type-badge--active' : ''}`}
      style={{ '--construct-color': construct.color } as React.CSSProperties}
      onClick={onClick}
      title={`${construct.name}\n${construct.engineeringTerm}`}
    >
      <span className="construct-type-icon">{construct.icon}</span>
      <span className="construct-type-label">{construct.id}: {construct.shortName}</span>
      <span className="construct-type-count">{count}</span>
    </button>
  );
}

// ─────────────────────────────────────────────
// BehavioralTag – small tag for sub-constructs
// ─────────────────────────────────────────────

export function BehavioralTag({
  constructId,
  compact = false,
  isActive = false,
  onClick,
}: {
  constructId: string;
  compact?: boolean;
  isActive?: boolean;
  onClick?: () => void;
}) {
  const c = getConstruct(constructId);
  if (!c) return null;

  return (
    <span
      className={`construct-mini-tag ${isActive ? 'construct-mini-tag--active' : ''}`}
      style={
        {
          '--construct-color': c.color,
          borderColor: c.color,
          color: c.color,
        } as React.CSSProperties
      }
      title={`${c.name}\n${c.engineeringTerm}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {c.icon} {compact ? c.id : c.shortName}
    </span>
  );
}

// ─────────────────────────────────────────────
// FlagPills – structural flag indicators
// ─────────────────────────────────────────────

export function FlagPills({ item }: { item: ClassifiedProduct }) {
  const { flags } = item;
  const pills: { label: string; color: string; title: string }[] = [];

  if (flags.isCombo) {
    pills.push({ label: '🍔 Combo', color: '#8b5cf6', title: 'isCombo = true' });
  }
  if (flags.hasModifierGroupRefs) {
    pills.push({ label: '🔧 Modifiers', color: '#f59e0b', title: 'Has modifierGroupRefs' });
  }
  if (flags.hasBundleLink) {
    pills.push({ label: '🔗 Bundle', color: '#6366f1', title: 'relatedProducts.bundle — links to combo/meal counterpart' });
  }

  if (pills.length === 0) return null;

  return (
    <span className="flag-pills">
      {pills.map((p) => (
        <span
          key={p.label}
          className="flag-pill"
          style={{ '--pill-color': p.color } as React.CSSProperties}
          title={p.title}
        >
          {p.label}
        </span>
      ))}
    </span>
  );
}
