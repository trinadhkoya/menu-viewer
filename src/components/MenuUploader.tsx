import { useCallback, useRef, useState } from 'react';
import type { Menu } from '../types/menu';

interface MenuUploaderProps {
  onMenuLoad: (menu: Menu) => void;
}

export function MenuUploader({ onMenuLoad }: MenuUploaderProps) {
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseAndLoad = useCallback(
    (text: string) => {
      try {
        const parsed = JSON.parse(text);
        // Basic validation
        if (!parsed.products && !parsed.categories) {
          setError('Invalid menu.json — missing "products" or "categories" keys');
          return;
        }
        setError(null);
        onMenuLoad(parsed as Menu);
      } catch (e) {
        setError(`JSON parse error: ${(e as Error).message}`);
      }
    },
    [onMenuLoad],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => parseAndLoad(reader.result as string);
      reader.onerror = () => setError('Failed to read file');
      reader.readAsText(file);
    },
    [parseAndLoad],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => parseAndLoad(reader.result as string);
      reader.readAsText(file);
    },
    [parseAndLoad],
  );

  const handlePasteSubmit = useCallback(() => {
    if (jsonText.trim()) {
      parseAndLoad(jsonText.trim());
    }
  }, [jsonText, parseAndLoad]);

  return (
    <div className="uploader-container">
      <div className="uploader-card">
        <h1>🍔 MBDP Menu Viewer</h1>
        <p className="uploader-subtitle">
          Upload or paste your <code>menu.json</code> to explore categories, products, ingredients, and modifiers.
        </p>

        {!pasteMode ? (
          <>
            <div
              className={`drop-zone ${isDragging ? 'drop-zone--active' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="drop-zone-icon">📁</div>
              <p>
                <strong>Drop menu.json here</strong> or click to browse
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>

            <div className="uploader-divider">
              <span>or</span>
            </div>

            <button className="paste-btn" onClick={() => setPasteMode(true)}>
              📋 Paste JSON
            </button>
          </>
        ) : (
          <>
            <textarea
              className="json-textarea"
              placeholder='Paste your menu.json content here...'
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={12}
              autoFocus
            />
            <div className="paste-actions">
              <button className="paste-btn" onClick={handlePasteSubmit}>
                Load Menu
              </button>
              <button
                className="paste-btn paste-btn--secondary"
                onClick={() => {
                  setPasteMode(false);
                  setJsonText('');
                  setError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {error && <div className="uploader-error">{error}</div>}
      </div>
    </div>
  );
}
