import { useState, useEffect, useCallback } from 'react';
import { useAnnotations } from '../hooks/useAnnotations';
import { AnnotationToolbar } from '../components/annotation/AnnotationToolbar';
import { AnnotationList } from '../components/annotation/AnnotationList';
import { SignalViewer } from '../components/signal-viewer/SignalViewer';
import { ImageViewer } from '../components/image-viewer/ImageViewer';
import { isSignalAnnotation, isImageAnnotation } from '../types/annotations';
import { exportJSON, exportCSV } from '../utils/exportAnnotations';
import { CATEGORY_COLORS } from '../utils/colors';
import type { User } from '../types/auth';
import { ROLE_COLORS, ROLE_LABELS } from '../types/auth';
import { apiLogout } from '../utils/api';
import './AnnotationPage.css';

export type AnnotationMode = 'signal' | 'image';

interface Toast { id: number; msg: string; type: 'default' | 'success'; }
let toastId = 0;

interface Props { user: User; onLogout: () => void; }

export function AnnotationPage({ user, onLogout }: Props) {
  const [mode, setMode]               = useState<AnnotationMode>('signal');
  const [activeTool, setActiveTool]   = useState<string>('select');
  const [currentLabel, setCurrentLabel] = useState('');
  const [activeColor, setActiveColor] = useState(CATEGORY_COLORS[0]);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [toasts, setToasts]           = useState<Toast[]>([]);
  const annotationState = useAnnotations([]);

  const canAnnotate = user.role === 'annotator' || user.role === 'admin';
  const canReview   = user.role === 'reviewer'  || user.role === 'admin';

  const signalAnnotations = annotationState.annotations.filter(isSignalAnnotation);
  const imageAnnotations  = annotationState.annotations.filter(isImageAnnotation);

  const showToast = useCallback((msg: string, type: 'default' | 'success' = 'default') => {
    const id = ++toastId;
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2200);
  }, []);

  const handleLogout = async () => { await apiLogout(); onLogout(); };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === '1') setMode('signal');
      if (e.key === '2') setMode('image');
      if (e.key === 's' || e.key === 'S') setActiveTool('select');
      if ((e.key === 'p' || e.key === 'P') && mode === 'signal') setActiveTool('peak');
      if ((e.key === 'i' || e.key === 'I') && mode === 'signal') setActiveTool('interval');
      if ((e.key === 'b' || e.key === 'B') && mode === 'image')  setActiveTool('bbox');
      if ((e.key === 'g' || e.key === 'G') && mode === 'image')  setActiveTool('polygon');

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault(); annotationState.undo(); showToast('Undone');
      }
      if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && e.key === 'z') || e.key === 'y')) {
        e.preventDefault(); annotationState.redo(); showToast('Redone');
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && canAnnotate) {
        annotationState.remove(selectedId); setSelectedId(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, selectedId, canAnnotate, annotationState, showToast]);

  const handleExportJSON = () => {
    const anns = mode === 'signal' ? signalAnnotations : imageAnnotations;
    exportJSON(anns, `annotations-${mode}-${Date.now()}.json`);
    showToast(`Exported ${anns.length} annotation(s) as JSON`, 'success');
  };

  const handleExportCSV = () => {
    const anns = mode === 'signal' ? signalAnnotations : imageAnnotations;
    exportCSV(anns, `annotations-${mode}-${Date.now()}.csv`);
    showToast(`Exported ${anns.length} annotation(s) as CSV`, 'success');
  };

  const handleExportAll = () => {
    const all = annotationState.annotations;
    const ts  = Date.now();
    exportJSON(all, `all-annotations-${ts}.json`);
    exportCSV(all,  `all-annotations-${ts}.csv`);
    showToast(`Exported all ${all.length} annotation(s) as JSON + CSV`, 'success');
  };

  const handleApprove = () => {
    if (!selectedId) return;
    annotationState.update(selectedId, { status: 'approved' });
    showToast('Approved ✓', 'success');
  };

  const handleReject = () => {
    if (!selectedId) return;
    annotationState.update(selectedId, { status: 'rejected' });
    showToast('Rejected');
  };

  const pendingCount = annotationState.annotations.filter((a) => !a.status).length;

  return (
    <div className="annotation-page" role="main">

      {/* ── Header ── */}
      <header className="annotation-header">
        <div className="header-left">
          <div className="header-logo" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 8L6 4L10 10L13 7" stroke="#000" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="13" cy="7" r="1.5" fill="#000"/>
            </svg>
          </div>
          <h1>BioAnnot</h1>
        </div>

        <div className="header-right">
          {/* Mode switch */}
          <div className="mode-switch" role="tablist" aria-label="Annotation mode">
            <button type="button" role="tab"
              className={mode === 'signal' ? 'active' : ''}
              onClick={() => setMode('signal')} title="Signal mode (1)">Signal</button>
            <button type="button" role="tab"
              className={mode === 'image' ? 'active' : ''}
              onClick={() => setMode('image')} title="Image mode (2)">Image</button>
          </div>

          {/* Action buttons */}
          <div className="header-actions">
            <button type="button" className="header-btn"
              onClick={annotationState.undo} disabled={!annotationState.canUndo}
              title="Undo (Ctrl+Z)">↩ Undo</button>
            <button type="button" className="header-btn"
              onClick={annotationState.redo} disabled={!annotationState.canRedo}
              title="Redo (Ctrl+Y)">↪ Redo</button>
            <button type="button" className="header-btn"
              onClick={handleExportJSON} title="Export current mode as JSON">↓ JSON</button>
            <button type="button" className="header-btn"
              onClick={handleExportCSV} title="Export current mode as CSV">↓ CSV</button>
            <button type="button" className="header-btn"
              onClick={handleExportAll} title="Export all annotations">↓ All</button>

            {canReview && selectedId && (
              <>
                <button type="button" className="header-btn success"
                  onClick={handleApprove}>✓ Approve</button>
                <button type="button" className="header-btn danger"
                  onClick={handleReject}>✕ Reject</button>
              </>
            )}
          </div>

          {canReview && pendingCount > 0 && (
            <span className="pending-badge">{pendingCount} pending</span>
          )}

          {/* User chip */}
          <div className="user-chip">
            <span className="user-role-dot"
              style={{ background: ROLE_COLORS[user.role] }} />
            <span className="user-name">{user.name}</span>
            <span className="user-role-label"
              style={{ color: ROLE_COLORS[user.role] }}>
              {ROLE_LABELS[user.role]}
            </span>
            <button type="button" className="logout-btn"
              onClick={handleLogout} title="Sign out">⏻</button>
          </div>
        </div>
      </header>

      {/* ── Workspace ── */}
      <div className="annotation-workspace">
        <aside className="annotation-sidebar">
          <AnnotationToolbar
            mode={mode}
            activeTool={activeTool}
            onToolChange={setActiveTool}
            currentLabel={currentLabel}
            onLabelChange={setCurrentLabel}
            activeColor={activeColor}
            onColorChange={setActiveColor}
            readOnly={!canAnnotate}
          />
          <AnnotationList
            annotations={annotationState.annotations}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDelete={canAnnotate
              ? (id) => { annotationState.remove(id); if (selectedId === id) setSelectedId(null); }
              : undefined}
            onUpdateLabel={canAnnotate
              ? (id, label) => annotationState.update(id, { label })
              : undefined}
          />
        </aside>

        <div id="annotation-content" className="annotation-content" role="tabpanel">
          {mode === 'signal' && (
            <SignalViewer
              annotations={signalAnnotations}
              activeTool={canAnnotate ? activeTool : 'select'}
              currentLabel={currentLabel}
              activeColor={activeColor}
              onAddAnnotation={annotationState.add}
              onRemoveAnnotation={annotationState.remove}
              onClearAnnotations={() => annotationState.setAnnotations(imageAnnotations)}
            />
          )}
          {mode === 'image' && (
            <ImageViewer
              annotations={imageAnnotations}
              activeTool={canAnnotate ? activeTool : 'select'}
              currentLabel={currentLabel}
              activeColor={activeColor}
              onAddAnnotation={annotationState.add}
              onRemoveAnnotation={annotationState.remove}
              onClearAnnotations={() => annotationState.setAnnotations(signalAnnotations)}
            />
          )}
        </div>
      </div>

      {/* Loading / Error banner */}
      {annotationState.loading && (
        <div style={{position:"fixed",top:56,left:0,right:0,zIndex:999,background:"rgba(168,85,247,0.12)",borderBottom:"1px solid rgba(168,85,247,0.3)",padding:"6px 16px",fontSize:"0.78rem",color:"#c084fc",textAlign:"center"}}>
          ⟳ Syncing with server…
        </div>
      )}
      {annotationState.error && (
        <div onClick={annotationState.clearError} style={{position:"fixed",top:56,left:0,right:0,zIndex:999,background:"rgba(244,63,94,0.1)",borderBottom:"1px solid rgba(244,63,94,0.3)",padding:"6px 16px",fontSize:"0.78rem",color:"#f43f5e",textAlign:"center",cursor:"pointer"}}>
          ⚠ {annotationState.error} — click to dismiss
        </div>
      )}

      {/* ── Shortcuts bar ── */}
      <div className="shortcuts-bar" aria-hidden>
        <span className="shortcut-item"><kbd className="kbd">S</kbd> Select</span>
        {mode === 'signal' ? (
          <>
            <span className="shortcut-item"><kbd className="kbd">P</kbd> Peak</span>
            <span className="shortcut-item"><kbd className="kbd">I</kbd> Interval</span>
            <span className="shortcut-item"><kbd className="kbd">Scroll</kbd> Zoom</span>
            <span className="shortcut-item"><kbd className="kbd">←→</kbd> Pan</span>
          </>
        ) : (
          <>
            <span className="shortcut-item"><kbd className="kbd">B</kbd> Box</span>
            <span className="shortcut-item"><kbd className="kbd">G</kbd> Polygon</span>
            <span className="shortcut-item"><kbd className="kbd">DblClick</kbd> Close poly</span>
            <span className="shortcut-item"><kbd className="kbd">Esc</kbd> Cancel</span>
          </>
        )}
        <span className="shortcut-item"><kbd className="kbd">Ctrl Z</kbd> Undo</span>
        <span className="shortcut-item"><kbd className="kbd">Del</kbd> Delete</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.65rem', opacity: 0.4 }}>
          Auto-saved to browser
        </span>
      </div>

      {/* ── Toasts ── */}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}
