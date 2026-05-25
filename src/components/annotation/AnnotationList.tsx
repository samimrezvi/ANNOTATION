import type { Annotation } from '../../types/annotations';
import { isPeak, isInterval, isBbox, isPolygon } from '../../types/annotations';
import './AnnotationList.css';

function formatSummary(a: Annotation): string {
  if (isPeak(a))     return `t=${a.time.toFixed(3)}  v=${a.value.toFixed(3)}`;
  if (isInterval(a)) return `[${a.startTime.toFixed(2)} → ${a.endTime.toFixed(2)}]`;
  if (isBbox(a))     return `(${a.x.toFixed(0)}, ${a.y.toFixed(0)})  ${a.width.toFixed(0)}×${a.height.toFixed(0)}`;
  if (isPolygon(a))  return `${a.points.length} pts`;
  return a.type;
}

interface AnnotationListProps {
  annotations: Annotation[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  onUpdateLabel?: (id: string, label: string) => void;
}

export function AnnotationList({
  annotations,
  selectedId,
  onSelect,
  onDelete,
  onUpdateLabel,
}: AnnotationListProps) {
  const readOnly = !onDelete && !onUpdateLabel;

  return (
    <>
      <div className="annotation-list-header">
        <span className="annotation-list-title">Annotations</span>
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          {readOnly && <span className="readonly-badge">read-only</span>}
          {annotations.length > 0 && (
            <span className="annotation-count">{annotations.length}</span>
          )}
        </div>
      </div>

      {annotations.length === 0 ? (
        <div className="annotation-list empty" aria-live="polite">
          <div className="empty-icon">◈</div>
          <div>No annotations yet</div>
          <div style={{ fontSize: '0.72rem', opacity: 0.5, marginTop: 4 }}>
            {readOnly
              ? 'Switch to an Annotator account to add.'
              : 'Pick a tool and click the viewer'}
          </div>
        </div>
      ) : (
        <div className="annotation-list" role="list">
          {annotations.map((a) => {
            const color = a.color ?? '#00d4ff';
            return (
              <div
                key={a.id}
                className={[
                  'annotation-list-item',
                  selectedId === a.id ? 'selected' : '',
                  a.status ? `status-${a.status}` : '',
                ].filter(Boolean).join(' ')}
                role="listitem"
                onClick={() => onSelect?.(a.id)}
              >
                <div className="annotation-item-top">
                  <span
                    className="annotation-color-dot"
                    style={{ background: color }}
                    aria-hidden
                  />
                  <span className="annotation-type" style={{ color }}>
                    {a.type}
                  </span>
                  {a.label && (
                    <span className="annotation-label-badge">{a.label}</span>
                  )}
                  {a.status === 'approved' && (
                    <span className="status-badge approved">✓ Approved</span>
                  )}
                  {a.status === 'rejected' && (
                    <span className="status-badge rejected">✕ Rejected</span>
                  )}
                </div>

                <div className="annotation-summary">{formatSummary(a)}</div>

                {!readOnly && (
                  <div className="annotation-actions">
                    <input
                      key={a.label ?? ''}
                      type="text"
                      className="annotation-list-label-input"
                      placeholder="Add label…"
                      defaultValue={a.label ?? ''}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (a.label ?? '')) onUpdateLabel?.(a.id, v);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Label for ${a.type}`}
                    />
                    <button
                      type="button"
                      className="annotation-delete-btn"
                      onClick={(e) => { e.stopPropagation(); onDelete?.(a.id); }}
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
