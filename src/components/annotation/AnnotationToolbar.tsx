import type { AnnotationMode } from '../../pages/AnnotationPage';
import { CATEGORY_COLORS } from '../../utils/colors';
import './AnnotationToolbar.css';

export type ToolId = 'select' | 'peak' | 'interval' | 'bbox' | 'polygon';

const SIGNAL_TOOLS: { id: ToolId; label: string; ariaLabel: string; key: string; icon: string }[] = [
  { id: 'select',   label: 'Select',   ariaLabel: 'Select / pan',      key: 'S', icon: '↖' },
  { id: 'peak',     label: 'Peak',     ariaLabel: 'Mark peak',         key: 'P', icon: '◆' },
  { id: 'interval', label: 'Interval', ariaLabel: 'Select interval',   key: 'I', icon: '⟷' },
];

const IMAGE_TOOLS: { id: ToolId; label: string; ariaLabel: string; key: string; icon: string }[] = [
  { id: 'select',  label: 'Select',  ariaLabel: 'Select / pan',  key: 'S', icon: '↖' },
  { id: 'bbox',    label: 'Box',     ariaLabel: 'Bounding box',  key: 'B', icon: '▭' },
  { id: 'polygon', label: 'Polygon', ariaLabel: 'Draw polygon',  key: 'G', icon: '⬡' },
];

interface AnnotationToolbarProps {
  mode: AnnotationMode;
  activeTool: string;
  onToolChange: (tool: string) => void;
  currentLabel: string;
  onLabelChange: (label: string) => void;
  activeColor: string;
  onColorChange: (color: string) => void;
  readOnly?: boolean;
}

export function AnnotationToolbar({
  mode,
  activeTool,
  onToolChange,
  currentLabel,
  onLabelChange,
  activeColor,
  onColorChange,
  readOnly = false,
}: AnnotationToolbarProps) {
  const tools = mode === 'signal' ? SIGNAL_TOOLS : IMAGE_TOOLS;

  if (readOnly) {
    return (
      <div className="annotation-toolbar" style={{ opacity: 0.5, pointerEvents: 'none' }} aria-disabled="true">
        <div className="toolbar-section">
          <span className="toolbar-label" style={{ color: '#ffd43b' }}>
            Reviewer mode — tools locked
          </span>
          <p style={{ fontSize: '0.75rem', color: 'var(--text)', marginTop: 4 }}>
            Select an annotation then use Approve / Reject in the header.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="annotation-toolbar" role="toolbar" aria-label="Annotation tools">
      <div className="toolbar-section">
        <span className="toolbar-label">Tool</span>
        <div className="tool-group" role="group" aria-label="Drawing tool">
          {tools.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tool-btn ${activeTool === t.id ? 'active' : ''}`}
              aria-pressed={activeTool === t.id}
              aria-label={t.ariaLabel}
              title={`${t.label} (${t.key})`}
              onClick={() => onToolChange(t.id)}
            >
              <span className="tool-icon" aria-hidden>{t.icon}</span>
              {t.label}
              <span className="tool-shortcut">{t.key}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <label className="toolbar-label" htmlFor="annotation-label">Label</label>
        <input
          id="annotation-label"
          type="text"
          className="toolbar-input"
          placeholder="e.g. QRS, tumor, car…"
          value={currentLabel}
          onChange={(e) => onLabelChange(e.target.value)}
          aria-label="Annotation label"
        />
      </div>

      <div className="toolbar-section">
        <span className="toolbar-label">Color</span>
        <div className="color-swatches" role="group" aria-label="Annotation color">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`color-swatch ${activeColor === c ? 'active' : ''}`}
              style={{ background: c }}
              aria-label={`Color ${c}`}
              aria-pressed={activeColor === c}
              onClick={() => onColorChange(c)}
              title={c}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
