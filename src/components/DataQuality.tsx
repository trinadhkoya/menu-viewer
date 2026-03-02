import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Menu } from '../types/menu';
import { getRecipeNoDefaultMismatches, getVirtualMissingCtaLabel, getProductsMissingDescription, getDescriptionInheritableObservations, getProductsMissingImage, getProductsMissingTags, getTagsInheritableObservations, getProductsMissingKeywords, getKeywordsInheritableObservations, getProductsWithMalformedTags, getProductGroupsMissingDefault } from '../utils/menuHelpers';
import { CopyRef } from './CopyRef';

/* ── Animated counter hook ── */
function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    prev.current = target;
    if (from === target) { setValue(target); return; }
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setValue(Math.round(from + (target - from) * ease));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/* ── Health score ring ── */
function HealthRing({ score }: { score: number }) {
  const r = 38;
  const stroke = 6;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - score / 100);
  const animatedScore = useCountUp(Math.round(score));

  const color =
    score >= 90 ? '#22c55e' :
    score >= 70 ? '#84cc16' :
    score >= 50 ? '#f59e0b' :
    '#ef4444';

  return (
    <div className="dq-health-ring" title={`Menu quality: ${Math.round(score)}%`}>
      <svg viewBox="0 0 96 96" className="dq-health-svg">
        <circle cx="48" cy="48" r={r} fill="none" stroke="var(--color-border-subtle)" strokeWidth={stroke} />
        <circle
          cx="48" cy="48" r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="dq-health-arc"
          style={{ '--health-offset': offset, '--health-circumference': circumference } as React.CSSProperties}
        />
      </svg>
      <div className="dq-health-center">
        <span className="dq-health-value" style={{ color }}>{animatedScore}</span>
        <span className="dq-health-unit">%</span>
      </div>
    </div>
  );
}

/* ── Check card SVG icons (replace emojis with professional SVGs) ── */
const CHECK_ICONS: Record<string, React.ReactNode> = {
  'recipe-no-default': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2v7.527a2 2 0 01-.211.896L4.72 20.55a1 1 0 00.9 1.45h12.76a1 1 0 00.9-1.45l-5.069-10.127A2 2 0 0114 9.527V2" />
      <path d="M8.5 2h7" /><path d="M7 16.5h10" />
    </svg>
  ),
  'virtual-missing-cta': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 15l-2 5L9 9l11 4-5 2zm7 7l-5-5" />
    </svg>
  ),
  'missing-description': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  'desc-inheritable': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M6 21V9a9 9 0 009 9" />
    </svg>
  ),
  'missing-image': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  'missing-tags': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),
  'tags-inheritable': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M6 21V9a9 9 0 009 9" />
    </svg>
  ),
  'missing-keywords': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  'kw-inheritable': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M6 21V9a9 9 0 009 9" />
    </svg>
  ),
  'malformed-tags': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  'pg-missing-default': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
      <line x1="17.5" y1="15.5" x2="17.5" y2="21.5" /><line x1="14.5" y1="18.5" x2="20.5" y2="18.5" />
    </svg>
  ),
};

interface DataQualityProps {
  menu: Menu;
  onProductSelect: (productRef: string) => void;
}

/** Severity levels for quality checks */
type Severity = 'error' | 'warning' | 'info';

/** Priority levels for quality checks */
type Priority = 'high' | 'medium' | 'low';

interface QualityCheck {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  priority: Priority;
  count: number;
  icon: string;
}

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
const SEVERITY_LABEL: Record<Severity, string> = { error: 'Errors', warning: 'Warnings', info: 'Observations' };
const PRIORITY_LABEL: Record<Priority, string> = { high: 'High', medium: 'Medium', low: 'Low' };
const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

type SortBy = 'severity' | 'priority' | 'count';
const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'severity', label: 'Severity' },
  { value: 'priority', label: 'Priority' },
  { value: 'count', label: 'Count' },
];

export function DataQuality({ menu, onProductSelect }: DataQualityProps) {
  const recipeNoDefaultMismatches = useMemo(() => getRecipeNoDefaultMismatches(menu), [menu]);
  const pgMissingDefault = useMemo(() => getProductGroupsMissingDefault(menu), [menu]);
  const virtualMissingCta = useMemo(() => getVirtualMissingCtaLabel(menu), [menu]);
  const missingDescriptions = useMemo(() => getProductsMissingDescription(menu), [menu]);
  const descInheritObs = useMemo(() => getDescriptionInheritableObservations(menu), [menu]);
  const missingImages = useMemo(() => getProductsMissingImage(menu), [menu]);
  const missingTags = useMemo(() => getProductsMissingTags(menu), [menu]);
  const tagsInheritObs = useMemo(() => getTagsInheritableObservations(menu), [menu]);
  const missingKeywords = useMemo(() => getProductsMissingKeywords(menu), [menu]);
  const kwInheritObs = useMemo(() => getKeywordsInheritableObservations(menu), [menu]);
  const malformedTags = useMemo(() => getProductsWithMalformedTags(menu), [menu]);

  /** Health score: % of checks that are clean.
   *  Each check type contributes equally; a check with 0 issues → 100%, >0 → 0%. */
  const healthScore = useMemo(() => {
    const checkResults = [
      recipeNoDefaultMismatches.length,
      pgMissingDefault.length,
      virtualMissingCta.length,
      missingDescriptions.length,
      missingImages.length,
      missingTags.length,
      missingKeywords.length,
      malformedTags.length,
    ];
    const clean = checkResults.filter((v) => v === 0).length;
    return Math.round((clean / checkResults.length) * 100);
  }, [recipeNoDefaultMismatches, pgMissingDefault, virtualMissingCta, missingDescriptions, missingImages, missingTags, missingKeywords, malformedTags]);

  /* ── CSV export ── */
  const handleExport = useCallback(() => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows: string[][] = [['Check', 'Severity', 'Priority', 'Product', 'ProductRef', 'IsVirtual', 'SizeGroup', 'SizedProduct', 'SizedRef']];

    const pushFieldRows = (
      check: string, severity: string, priority: string, fieldLabel: string,
      items: { productRef: string; productName: string; isVirtual: boolean; groups: { groupName: string; groupRef: string; children: { name: string; ref: string }[] }[]; directProducts: { name: string; ref: string }[] }[],
    ) => {
      for (const m of items) {
        if (!m.isVirtual) {
          rows.push([check, severity, priority, m.productName, m.productRef, 'No', '', `${fieldLabel}=missing`, '']);
        } else {
          for (const d of m.directProducts) {
            rows.push([check, severity, priority, m.productName, m.productRef, 'Yes', 'Direct', d.name, d.ref]);
          }
          for (const g of m.groups) {
            for (const c of g.children) {
              rows.push([check, severity, priority, m.productName, m.productRef, 'Yes', g.groupName, c.name, c.ref]);
            }
          }
        }
      }
    };

    // Recipe no-default
    for (const m of recipeNoDefaultMismatches) {
      for (const g of m.groups) {
        for (const c of g.children) {
          rows.push(['Recipe groups missing isDefault', 'warning', 'medium', m.productName, m.productRef, 'No', g.groupName, `${c.name} (isDefault=${c.isDefault})`, c.ref]);
        }
      }
    }

    // Virtual products with groups missing isDefault (DOVS-5556)
    for (const vp of pgMissingDefault) {
      for (const g of vp.groups) {
        for (const c of g.children) {
          rows.push(['Virtual groups missing isDefault', 'error', 'high', vp.productName, vp.productRef, 'Yes', `${g.groupName} (${g.sourceType})`, `${c.name} (isDefault=${c.isDefault})`, c.ref]);
        }
      }
    }

    // Virtual missing ctaLabel
    for (const m of virtualMissingCta) {
      for (const d of m.directProducts) {
        rows.push(['Virtual missing ctaLabel', 'warning', 'high', m.productName, m.productRef, 'Yes', 'Direct', d.name, d.ref]);
      }
      for (const g of m.groups) {
        for (const c of g.children) {
          rows.push(['Virtual missing ctaLabel', 'warning', 'high', m.productName, m.productRef, 'Yes', g.groupName, c.name, c.ref]);
        }
      }
    }

    pushFieldRows('Missing description', 'warning', 'high', 'description', missingDescriptions);
    pushFieldRows('Description inheritable', 'info', 'low', 'description', descInheritObs);
    pushFieldRows('Missing image', 'warning', 'high', 'image', missingImages);
    pushFieldRows('Missing tags', 'warning', 'medium', 'tags', missingTags);
    pushFieldRows('Tags inheritable', 'info', 'low', 'tags', tagsInheritObs);
    pushFieldRows('Missing search keywords', 'warning', 'medium', 'keywords', missingKeywords);
    pushFieldRows('Keywords inheritable', 'info', 'low', 'keywords', kwInheritObs);

    // Malformed tags
    for (const m of malformedTags) {
      for (const t of m.badTags) {
        rows.push(['Non-standard tag format', 'warning', 'medium', m.productName, m.productRef, m.isVirtual ? 'Yes' : 'No', '', t, '']);
      }
    }

    const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data-quality-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [recipeNoDefaultMismatches, pgMissingDefault, virtualMissingCta, missingDescriptions, descInheritObs, missingImages, missingTags, tagsInheritObs, missingKeywords, kwInheritObs, malformedTags]);

  /** All quality checks — add new ones here */
  const checks: QualityCheck[] = useMemo(() => {
    const list: QualityCheck[] = [];

    if (pgMissingDefault.length > 0) {
      const totalGroups = pgMissingDefault.reduce((s, vp) => s + vp.groups.length, 0);
      list.push({
        id: 'pg-missing-default',
        title: 'Virtual products with groups missing isDefault',
        description:
          `${pgMissingDefault.length} virtual product${pgMissingDefault.length !== 1 ? 's' : ''} with ${totalGroups} group${totalGroups !== 1 ? 's' : ''} (productGroups or modifierGroups) where no child has isDefault=true. Traces relatedProducts.alternatives → productGroups and modifierGroupRefs → modifierGroups. DOVS-5556.`,
        severity: 'error',
        priority: 'high',
        count: pgMissingDefault.length,
        icon: '⚠️',
      });
    }

    if (recipeNoDefaultMismatches.length > 0) {
      list.push({
        id: 'recipe-no-default',
        title: 'Recipe groups missing isDefault',
        description:
          'Products with ingredientRef recipe groups where no child has isDefault set to true.',
        severity: 'warning',
        priority: 'medium',
        count: recipeNoDefaultMismatches.length,
        icon: '🧪',
      });
    }

    if (virtualMissingCta.length > 0) {
      list.push({
        id: 'virtual-missing-cta',
        title: 'Virtual products with missing ctaLabel',
        description:
          'Virtual products whose sized/related products have ctaLabel missing or empty.',
        severity: 'warning',
        priority: 'high',
        count: virtualMissingCta.length,
        icon: '🏷️',
      });
    }

    if (missingDescriptions.length > 0) {
      list.push({
        id: 'missing-description',
        title: 'Products missing description',
        description:
          'Products with no description. For virtual products, only flagged when the parent also has no description (nothing to inherit).',
        severity: 'warning',
        priority: 'high',
        count: missingDescriptions.length,
        icon: '📝',
      });
    }

    if (descInheritObs.length > 0) {
      list.push({
        id: 'desc-inheritable',
        title: 'Description inheritable from virtual',
        description:
          'Sized products missing their own description, but the virtual parent has one — can be inherited.',
        severity: 'info',
        priority: 'low',
        count: descInheritObs.length,
        icon: '👁️',
      });
    }

    if (missingImages.length > 0) {
      list.push({
        id: 'missing-image',
        title: 'Products missing image',
        description:
          'Category-visible products with no image URL. For virtual products, checks sized variant images.',
        severity: 'warning',
        priority: 'high',
        count: missingImages.length,
        icon: '🖼️',
      });
    }

    if (missingTags.length > 0) {
      list.push({
        id: 'missing-tags',
        title: 'Products missing tags',
        description:
          'Products with no classification tags (allergens, protein type, spice level, etc.).',
        severity: 'warning',
        priority: 'medium',
        count: missingTags.length,
        icon: '🏷️',
      });
    }

    if (tagsInheritObs.length > 0) {
      list.push({
        id: 'tags-inheritable',
        title: 'Tags inheritable from virtual',
        description:
          'Sized products missing their own tags, but the virtual parent has them — can be inherited.',
        severity: 'info',
        priority: 'low',
        count: tagsInheritObs.length,
        icon: '👁️',
      });
    }

    if (missingKeywords.length > 0) {
      list.push({
        id: 'missing-keywords',
        title: 'Products missing search keywords',
        description:
          'Products with no search keywords (customAttributes.keywords). Affects search discoverability.',
        severity: 'warning',
        priority: 'medium',
        count: missingKeywords.length,
        icon: '🔑',
      });
    }

    if (kwInheritObs.length > 0) {
      list.push({
        id: 'kw-inheritable',
        title: 'Keywords inheritable from virtual',
        description:
          'Sized products missing search keywords, but the virtual parent has them — can be inherited.',
        severity: 'info',
        priority: 'low',
        count: kwInheritObs.length,
        icon: '👁️',
      });
    }

    if (malformedTags.length > 0) {
      list.push({
        id: 'malformed-tags',
        title: 'Non-standard tag format',
        description:
          'Products with tags that don\u2019t follow the standard namespace.value pattern (e.g. is.Drink, allergen.Egg).',
        severity: 'warning',
        priority: 'medium',
        count: malformedTags.length,
        icon: '\u{1F3F7}\uFE0F',
      });
    }

    // ── Future checks go here ──

    list.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    return list;
  }, [recipeNoDefaultMismatches, pgMissingDefault, virtualMissingCta, missingDescriptions, descInheritObs, missingImages, missingTags, tagsInheritObs, missingKeywords, kwInheritObs, malformedTags]);

  const [activeCheck, setActiveCheck] = useState<string | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('severity');

  /** Sorted checks based on active sort */
  const sortedChecks = useMemo(() => {
    const sorted = [...checks];
    switch (sortBy) {
      case 'priority':
        sorted.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
        break;
      case 'count':
        sorted.sort((a, b) => b.count - a.count);
        break;
      default: // severity
        sorted.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
        break;
    }
    return sorted;
  }, [checks, sortBy]);

  const totalIssues = checks.reduce((sum, c) => sum + c.count, 0);

  // Group counts by severity for the dashboard
  const severityCounts = useMemo(() => {
    const map: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
    for (const c of checks) map[c.severity] += c.count;
    return map;
  }, [checks]);

  // Group checks by severity for section headers
  const sections = useMemo(() => {
    if (sortBy !== 'severity') {
      // No grouping when sorting by priority or count — flat list
      return [{ severity: 'flat' as Severity, label: '', checks: sortedChecks }];
    }
    const groups: { severity: Severity; label: string; checks: QualityCheck[] }[] = [];
    let lastSev: Severity | null = null;
    for (const c of sortedChecks) {
      if (c.severity !== lastSev) {
        groups.push({ severity: c.severity, label: SEVERITY_LABEL[c.severity], checks: [] });
        lastSev = c.severity;
      }
      groups[groups.length - 1].checks.push(c);
    }
    return groups;
  }, [sortedChecks, sortBy]);

  const animTotalIssues = useCountUp(totalIssues);
  const animErrorCount = useCountUp(severityCounts.error);
  const animWarningCount = useCountUp(severityCounts.warning);
  const animInfoCount = useCountUp(severityCounts.info);

  return (
    <div className="dq-page">
      {/* ── Hero banner ── */}
      <div className="dq-hero">
        <div className="dq-hero-top">
          <HealthRing score={healthScore} />
          <div className="dq-hero-info">
            <h2 className="dq-hero-title">Data Quality</h2>
            <p className="dq-hero-subtitle">
              {totalIssues === 0
                ? 'All checks passed \u2014 no issues found.'
                : `${animTotalIssues} issue${totalIssues !== 1 ? 's' : ''} across ${checks.length} check${checks.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          {checks.length > 0 && (
            <button className="dq-export-btn" onClick={handleExport} title="Export all issues as CSV">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export
            </button>
          )}
        </div>

        {/* Severity breakdown cards — always show all 3 for stable layout */}
        {checks.length > 0 && (
          <div className="dq-severity-grid">
            <div className={`dq-severity-card dq-severity-card--error${severityCounts.error === 0 ? ' dq-severity-card--zero' : ''}`}>
              <span className="dq-severity-count">{animErrorCount}</span>
              <span className="dq-severity-label">Errors</span>
            </div>
            <div className={`dq-severity-card dq-severity-card--warning${severityCounts.warning === 0 ? ' dq-severity-card--zero' : ''}`}>
              <span className="dq-severity-count">{animWarningCount}</span>
              <span className="dq-severity-label">Warnings</span>
            </div>
            <div className={`dq-severity-card dq-severity-card--info${severityCounts.info === 0 ? ' dq-severity-card--zero' : ''}`}>
              <span className="dq-severity-count">{animInfoCount}</span>
              <span className="dq-severity-label">Observations</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Check cards ── */}
      {checks.length === 0 ? (
        <div className="dq-empty">
          <div className="dq-empty-icon-wrap">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
          </div>
          <p className="dq-empty-title">All Clear</p>
          <p className="dq-empty-sub">Every quality check passed — no issues detected.</p>
        </div>
      ) : (
        <div className="dq-checks">
          {/* Sort toolbar */}
          <div className="dq-sort-bar">
            <span className="dq-sort-label">Sort by</span>
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`dq-sort-btn ${sortBy === opt.value ? 'dq-sort-btn--active' : ''}`}
                onClick={() => setSortBy(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {sections.map((sec) => {
            // Compute stagger offset: count checks in previous sections
            let staggerBase = 0;
            for (const s of sections) {
              if (s === sec) break;
              staggerBase += s.checks.length;
            }
            return (
            <div key={sec.severity + sec.label} className="dq-section">
              {/* Section divider label when sorting by severity */}
              {sec.label && (
                <div className={`dq-section-label dq-section-label--${sec.severity}`}>
                  <span className="dq-section-dot" />
                  {sec.label}
                  <span className="dq-section-count">{sec.checks.reduce((s, c) => s + c.count, 0)}</span>
                </div>
              )}
              {sec.checks.map((check, ci) => {
                const isActive = activeCheck === check.id;
                return (
                  <div
                    key={check.id}
                    className={`dq-check dq-check--${check.severity} ${isActive ? 'dq-check--active' : ''}`}
                    style={{ '--stagger': staggerBase + ci } as React.CSSProperties}
                  >
                    <button className="dq-check-toggle" onClick={() => { setActiveCheck(isActive ? null : check.id); setExpandedProduct(null); }}>
                      <span className={`dq-check-icon-wrap dq-check-icon-wrap--${check.severity}`}>
                        {CHECK_ICONS[check.id] ?? <span className="dq-check-icon">{check.icon}</span>}
                      </span>
                      <div className="dq-check-info">
                        <span className="dq-check-title">{check.title}</span>
                        <span className="dq-check-desc">{check.description}</span>
                      </div>
                      <span className={`dq-priority dq-priority--${check.priority}`}>{PRIORITY_LABEL[check.priority]}</span>
                      <span className={`dq-check-badge dq-check-badge--${check.severity}`}>{check.count}</span>
                      <span className={`dq-chevron ${isActive ? 'open' : ''}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                      </span>
                    </button>

                    {/* ── Expanded detail area for each check type ── */}
                    {isActive && check.id === 'pg-missing-default' && (
                      <GroupMissingDefaultDetail
                        groups={pgMissingDefault}
                        expandedProduct={expandedProduct}
                        setExpandedProduct={setExpandedProduct}
                        onProductSelect={onProductSelect}
                      />
                    )}

                    {isActive && check.id === 'recipe-no-default' && (
                      <RecipeNoDefaultDetail
                        mismatches={recipeNoDefaultMismatches}
                        expandedProduct={expandedProduct}
                        setExpandedProduct={setExpandedProduct}
                        onProductSelect={onProductSelect}
                      />
                    )}

                    {isActive && check.id === 'virtual-missing-cta' && (
                      <VirtualCtaDetail
                        mismatches={virtualMissingCta}
                        expandedProduct={expandedProduct}
                        setExpandedProduct={setExpandedProduct}
                        onProductSelect={onProductSelect}
                      />
                    )}

                    {isActive && check.id === 'missing-description' && (
                      <MissingFieldDetail
                        items={missingDescriptions}
                        fieldLabel="description"
                        expandedProduct={expandedProduct}
                        setExpandedProduct={setExpandedProduct}
                        onProductSelect={onProductSelect}
                      />
                    )}

                    {isActive && check.id === 'desc-inheritable' && (
                      <MissingFieldDetail
                        items={descInheritObs}
                        fieldLabel="description"
                        expandedProduct={expandedProduct}
                        setExpandedProduct={setExpandedProduct}
                        onProductSelect={onProductSelect}
                      />
                    )}

                    {isActive && check.id === 'missing-image' && (
                      <MissingFieldDetail
                        items={missingImages}
                        fieldLabel="image"
                        expandedProduct={expandedProduct}
                        setExpandedProduct={setExpandedProduct}
                        onProductSelect={onProductSelect}
                      />
                    )}

                    {isActive && check.id === 'missing-tags' && (
                      <MissingFieldDetail
                        items={missingTags}
                        fieldLabel="tags"
                        expandedProduct={expandedProduct}
                        setExpandedProduct={setExpandedProduct}
                        onProductSelect={onProductSelect}
                      />
                    )}

                    {isActive && check.id === 'tags-inheritable' && (
                      <MissingFieldDetail
                        items={tagsInheritObs}
                        fieldLabel="tags"
                        expandedProduct={expandedProduct}
                        setExpandedProduct={setExpandedProduct}
                        onProductSelect={onProductSelect}
                      />
                    )}

                    {isActive && check.id === 'missing-keywords' && (
                      <MissingFieldDetail
                        items={missingKeywords}
                        fieldLabel="keywords"
                        expandedProduct={expandedProduct}
                        setExpandedProduct={setExpandedProduct}
                        onProductSelect={onProductSelect}
                      />
                    )}

                    {isActive && check.id === 'kw-inheritable' && (
                      <MissingFieldDetail
                        items={kwInheritObs}
                        fieldLabel="keywords"
                        expandedProduct={expandedProduct}
                        setExpandedProduct={setExpandedProduct}
                        onProductSelect={onProductSelect}
                      />
                    )}

                    {isActive && check.id === 'malformed-tags' && (
                      <MalformedTagsDetail
                        items={malformedTags}
                        onProductSelect={onProductSelect}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          );
          })}
        </div>
      )}

      {/* ── Feedback ── */}
      <div className="dq-feedback">
        <div className="dq-feedback-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </div>
        <div className="dq-feedback-body">
          <p className="dq-feedback-title">Have a repetitive manual check?</p>
          <p className="dq-feedback-desc">
            Let me know and I'll automate it right here. Less grunt work, more impact.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Detail sub-components ───

import type { RecipeNoDefaultMismatch, VirtualMissingCtaLabel, ProductMissingDescription, ProductMissingImage, ProductMissingTags, ProductMissingSearchKeywords, MalformedTagProduct, VirtualProductGroupsMissingDefault } from '../utils/menuHelpers';

function GroupMissingDefaultDetail({
  groups,
  expandedProduct,
  setExpandedProduct,
  onProductSelect,
}: {
  groups: VirtualProductGroupsMissingDefault[];
  expandedProduct: string | null;
  setExpandedProduct: (v: string | null) => void;
  onProductSelect: (ref: string) => void;
}) {
  return (
    <div className="dq-detail">
      <div className="dq-detail-list">
        {groups.map((vp) => {
          const isExpanded = expandedProduct === vp.productRef;
          const totalGroups = vp.groups.length;
          return (
            <div key={vp.productRef} className="dq-product-card">
              <button
                className="dq-product-toggle"
                onClick={() => setExpandedProduct(isExpanded ? null : vp.productRef)}
              >
                <div className="dq-product-header">
                  <strong
                    className="dq-product-name"
                    onClick={(e) => { e.stopPropagation(); onProductSelect(vp.productRef); }}
                    title="Open product detail"
                  >
                    {vp.productName}
                  </strong>
                  <span className="dq-product-count">
                    {totalGroups} group{totalGroups !== 1 ? 's' : ''}
                  </span>
                </div>
                <span className="dq-group-badge">virtual</span>
                <CopyRef value={vp.productRef} />
                <span className={`dq-chevron ${isExpanded ? 'open' : ''}`}>▸</span>
              </button>
              {isExpanded && (
                <div className="dq-product-detail">
                  {vp.groups.map((g) => (
                    <div key={g.groupRef} className="dq-group">
                      <div className="dq-group-header">
                        <span className="dq-group-name">{g.groupName}</span>
                        <span className="dq-group-badge">
                          {g.sourceType === 'modifierGroup' ? 'modifierGroup' : g.isRecipe ? 'recipe' : 'productGroup'}
                        </span>
                        <CopyRef value={g.groupRef} />
                      </div>
                      <div className="dq-children">
                        {g.children.map((c) => (
                          <span key={c.ref} className="dq-child">
                            <span className={`dq-child-dot ${c.isDefault ? 'dq-child-dot--ok' : 'dq-child-dot--miss'}`} />
                            <span className="dq-child-name">{c.name}</span>
                            <code className={`dq-child-flag ${c.isDefault ? 'dq-child-flag--ok' : 'dq-child-flag--miss'}`}>
                              isDefault={String(c.isDefault)}
                            </code>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecipeNoDefaultDetail({
  mismatches,
  expandedProduct,
  setExpandedProduct,
  onProductSelect,
}: {
  mismatches: RecipeNoDefaultMismatch[];
  expandedProduct: string | null;
  setExpandedProduct: (v: string | null) => void;
  onProductSelect: (ref: string) => void;
}) {
  return (
    <div className="dq-detail">
      <div className="dq-detail-list">
        {mismatches.map((m) => {
          const isExpanded = expandedProduct === m.productRef;
          return (
            <div key={m.productRef} className="dq-product-card">
              <button
                className="dq-product-toggle"
                onClick={() => setExpandedProduct(isExpanded ? null : m.productRef)}
              >
                <div className="dq-product-header">
                  <strong
                    className="dq-product-name"
                    onClick={(e) => { e.stopPropagation(); onProductSelect(m.productRef); }}
                    title="Open product detail"
                  >
                    {m.productName}
                  </strong>
                  <span className="dq-product-count">
                    {m.groups.length} group{m.groups.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <CopyRef value={m.productRef} />
                <span className={`dq-chevron ${isExpanded ? 'open' : ''}`}>▸</span>
              </button>
              {isExpanded && (
                <div className="dq-product-detail">
                  {m.groups.map((g) => (
                    <div key={g.groupRef} className="dq-group">
                      <div className="dq-group-header">
                        <span className="dq-group-name">{g.groupName}</span>
                        <span className="dq-group-badge">isRecipe = true</span>
                        <CopyRef value={g.groupRef} />
                      </div>
                      <div className="dq-children">
                        {g.children.map((c) => (
                          <span key={c.ref} className="dq-child">
                            <span className={`dq-child-dot ${c.isDefault ? 'dq-child-dot--ok' : 'dq-child-dot--miss'}`} />
                            <span className="dq-child-name">{c.name}</span>
                            <code className={`dq-child-flag ${c.isDefault ? 'dq-child-flag--ok' : 'dq-child-flag--miss'}`}>
                              isDefault={String(c.isDefault)}
                            </code>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VirtualCtaDetail({
  mismatches,
  expandedProduct,
  setExpandedProduct,
  onProductSelect,
}: {
  mismatches: VirtualMissingCtaLabel[];
  expandedProduct: string | null;
  setExpandedProduct: (v: string | null) => void;
  onProductSelect: (ref: string) => void;
}) {
  return (
    <div className="dq-detail">
      <div className="dq-detail-list">
        {mismatches.map((m) => {
          const isExpanded = expandedProduct === m.productRef;
          const totalMissing = m.groups.reduce((s, g) => s + g.children.length, 0) + m.directProducts.length;
          return (
            <div key={m.productRef} className="dq-product-card">
              <button
                className="dq-product-toggle"
                onClick={() => setExpandedProduct(isExpanded ? null : m.productRef)}
              >
                <div className="dq-product-header">
                  <strong
                    className="dq-product-name"
                    onClick={(e) => { e.stopPropagation(); onProductSelect(m.productRef); }}
                    title="Open product detail"
                  >
                    {m.productName}
                  </strong>
                  <span className="dq-product-count">
                    {totalMissing} missing
                  </span>
                </div>
                <CopyRef value={m.productRef} />
                <span className={`dq-chevron ${isExpanded ? 'open' : ''}`}>▸</span>
              </button>
              {isExpanded && (
                <div className="dq-product-detail">
                  {m.directProducts.length > 0 && (
                    <div className="dq-group">
                      <div className="dq-group-header">
                        <span className="dq-group-name">Direct refs</span>
                      </div>
                      <div className="dq-children">
                        {m.directProducts.map((c) => (
                          <span key={c.ref} className="dq-child">
                            <span className="dq-child-dot dq-child-dot--miss" />
                            <span className="dq-child-name">{c.name}</span>
                            <code className="dq-child-flag dq-child-flag--miss">ctaLabel=missing</code>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {m.groups.map((g) => (
                    <div key={g.groupRef} className="dq-group">
                      <div className="dq-group-header">
                        <span className="dq-group-name">{g.groupName}</span>
                        <span className="dq-group-badge">size group</span>
                        <CopyRef value={g.groupRef} />
                      </div>
                      <div className="dq-children">
                        {g.children.map((c) => (
                          <span key={c.ref} className="dq-child">
                            <span className="dq-child-dot dq-child-dot--miss" />
                            <span className="dq-child-name">{c.name}</span>
                            <code className="dq-child-flag dq-child-flag--miss">ctaLabel=missing</code>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Shared sub-component for missing-description and missing-image checks */
function MissingFieldDetail({
  items,
  fieldLabel,
  expandedProduct,
  setExpandedProduct,
  onProductSelect,
}: {
  items: (ProductMissingDescription | ProductMissingImage | ProductMissingTags | ProductMissingSearchKeywords)[];
  fieldLabel: string;
  expandedProduct: string | null;
  setExpandedProduct: (v: string | null) => void;
  onProductSelect: (ref: string) => void;
}) {
  return (
    <div className="dq-detail">
      <div className="dq-detail-list">
        {items.map((m) => {
          const isExpanded = expandedProduct === m.productRef;
          const totalChildren = m.groups.reduce((s, g) => s + g.children.length, 0) + m.directProducts.length;
          return (
            <div key={m.productRef} className="dq-product-card">
              <button
                className="dq-product-toggle"
                onClick={() => setExpandedProduct(isExpanded ? null : m.productRef)}
              >
                <div className="dq-product-header">
                  <strong
                    className="dq-product-name"
                    onClick={(e) => { e.stopPropagation(); onProductSelect(m.productRef); }}
                    title="Open product detail"
                  >
                    {m.productName}
                  </strong>
                  <span className="dq-product-count">
                    {m.isVirtual
                      ? `${totalChildren} sized missing`
                      : `${fieldLabel}=missing`}
                  </span>
                </div>
                <CopyRef value={m.productRef} />
                {m.isVirtual && <span className={`dq-chevron ${isExpanded ? 'open' : ''}`}>▸</span>}
              </button>
              {isExpanded && m.isVirtual && (
                <div className="dq-product-detail">
                  {m.directProducts.length > 0 && (
                    <div className="dq-group">
                      <div className="dq-group-header">
                        <span className="dq-group-name">Direct refs</span>
                      </div>
                      <div className="dq-children">
                        {m.directProducts.map((c) => (
                          <span key={c.ref} className="dq-child">
                            <span className="dq-child-dot dq-child-dot--miss" />
                            <span className="dq-child-name">{c.name}</span>
                            <code className="dq-child-flag dq-child-flag--miss">{fieldLabel}=missing</code>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {m.groups.map((g) => (
                    <div key={g.groupRef} className="dq-group">
                      <div className="dq-group-header">
                        <span className="dq-group-name">{g.groupName}</span>
                        <span className="dq-group-badge">size group</span>
                        <CopyRef value={g.groupRef} />
                      </div>
                      <div className="dq-children">
                        {g.children.map((c) => (
                          <span key={c.ref} className="dq-child">
                            <span className="dq-child-dot dq-child-dot--miss" />
                            <span className="dq-child-name">{c.name}</span>
                            <code className="dq-child-flag dq-child-flag--miss">{fieldLabel}=missing</code>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Diagnose why a tag is non-standard and suggest a fix */
function diagnoseTag(tag: string): { reason: string; suggestion: string } {
  const trimmed = tag.trim();
  if (!trimmed) return { reason: 'Empty tag', suggestion: 'Remove or replace with namespace.value' };
  const dotCount = (trimmed.match(/\./g) || []).length;
  if (dotCount === 0) return { reason: 'Missing dot separator', suggestion: `namespace.${trimmed}` };
  if (dotCount > 1) return { reason: 'Multiple dots', suggestion: trimmed.split('.').slice(0, 2).join('.') };
  if (trimmed.startsWith('.')) return { reason: 'Starts with dot', suggestion: `namespace${trimmed}` };
  if (trimmed.endsWith('.')) return { reason: 'Ends with dot', suggestion: `${trimmed}value` };
  return { reason: 'Unknown format issue', suggestion: 'namespace.value' };
}

function MalformedTagsDetail({
  items,
  onProductSelect,
}: {
  items: MalformedTagProduct[];
  onProductSelect: (ref: string) => void;
}) {
  return (
    <div className="dq-detail">
      <div className="dq-detail-list">
        {items.map((m) => (
          <div key={m.productRef} className="dq-product-card">
            <div className="dq-product-toggle" style={{ cursor: 'default' }}>
              <div className="dq-product-header">
                <strong
                  className="dq-product-name"
                  onClick={() => onProductSelect(m.productRef)}
                  title="Open product detail"
                  style={{ cursor: 'pointer' }}
                >
                  {m.productName}
                </strong>
                <span className="dq-product-count">
                  {m.badTags.length} non-standard
                </span>
              </div>
              <CopyRef value={m.productRef} />
            </div>
            <div className="dq-malformed-tags">
              {m.badTags.map((tag) => {
                const { reason, suggestion } = diagnoseTag(tag);
                return (
                  <div key={tag} className="dq-malformed-tag-row">
                    <div className="dq-malformed-tag-current">
                      <span className="dq-child-dot dq-child-dot--miss" />
                      <code className="dq-malformed-tag-value">{tag}</code>
                      <span className="dq-malformed-tag-reason">{reason}</span>
                    </div>
                    <div className="dq-malformed-tag-fix">
                      <span className="dq-malformed-tag-arrow">→</span>
                      <code className="dq-malformed-tag-suggestion">{suggestion}</code>
                      <span className="dq-malformed-tag-hint">expected: namespace.value</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Returns the total number of quality issues for badge display.
 *  Observations (info severity) are excluded from the count. */
export function useDataQualityCount(menu: Menu | null): number {
  return useMemo(() => {
    if (!menu) return 0;
    return (
      getProductGroupsMissingDefault(menu).length +
      getRecipeNoDefaultMismatches(menu).length +
      getVirtualMissingCtaLabel(menu).length +
      getProductsMissingDescription(menu).length +
      getProductsMissingImage(menu).length +
      getProductsMissingTags(menu).length +
      getProductsMissingKeywords(menu).length +
      getProductsWithMalformedTags(menu).length
      // inheritable observations intentionally excluded (info only)
    );
  }, [menu]);
}
