import { useState, useCallback } from 'react';

interface CopyRefProps {
  /** The text to copy to clipboard */
  value: string;
  /** Optional display text — defaults to value */
  display?: string;
  /** Extra CSS class */
  className?: string;
}

/**
 * Inline <code> with a clipboard-copy button.
 * Shows a brief "Copied!" tick after clicking.
 */
export function CopyRef({ value, display, className = '' }: CopyRefProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(value).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      });
    },
    [value],
  );

  return (
    <span className={`copy-ref ${className}`}>
      <code className="copy-ref-text">{display ?? value}</code>
      <button
        className={`copy-ref-btn ${copied ? 'copy-ref-btn--copied' : ''}`}
        onClick={handleCopy}
        title={copied ? 'Copied!' : `Copy`}
        aria-label={`Copy ${value}`}
      >
        {copied ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          </svg>
        )}
      </button>
    </span>
  );
}
