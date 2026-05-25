import { useState, useCallback, useEffect, useRef } from 'react';
import type { Annotation } from '../types/annotations';
import { useHistory } from './useHistory';
import {
  apiFetchAnnotations,
  apiCreateAnnotation,
  apiUpdateAnnotation,
  apiDeleteAnnotation,
  apiSaveBulk,
} from '../utils/api';

function generateId(): string {
  return crypto.randomUUID?.() ?? `ann-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function withTimestamps<T extends Annotation>(a: T): T {
  const now = Date.now();
  return {
    ...a,
    createdAt: (a as Annotation & { createdAt?: number }).createdAt ?? now,
    updatedAt: now,
  };
}

export function useAnnotations(_initial: Annotation[] = []) {
  const { annotations, setAnnotations, undo, redo, canUndo, canRedo } =
    useHistory([] as Annotation[]);

  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const syncTimeoutRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether current annotation state came from server (should not be synced back)
  const skipNextSyncRef       = useRef(true);

  // Load from backend on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetchAnnotations()
      .then((anns) => {
        if (!cancelled) {
          skipNextSyncRef.current = true; // don't sync data we just loaded from server
          setAnnotations(anns);
          setLoading(false);
        }
      })
      .catch((e)   => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced bulk-sync to backend (500ms after last change)
  const scheduleBulkSync = useCallback((anns: Annotation[]) => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      apiSaveBulk(anns).catch((e) => console.warn('Sync error:', e));
    }, 500);
  }, []);

  const add = useCallback(
    async (annotation: Omit<Annotation, 'id'> & { id?: string }) => {
      const id = annotation.id ?? generateId();
      const withId = withTimestamps({ ...annotation, id } as Annotation);
      // Snapshot current state for rollback, then optimistically append
      const snapshot = annotations;
      setAnnotations([...annotations, withId]);
      try {
        const saved = await apiCreateAnnotation(withId);
        setAnnotations((prev) => prev.map((a) => (a.id === id ? saved : a)));
      } catch (e) {
        setAnnotations(snapshot); // rollback to snapshot
        setError((e as Error).message);
      }
      return id;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [annotations, setAnnotations]
  );

  const update = useCallback(
    async (id: string, patch: Partial<Annotation>) => {
      const prev = annotations;
      const next = prev.map((a) =>
        a.id === id ? withTimestamps({ ...a, ...patch, id: a.id } as Annotation) : a
      );
      setAnnotations(next);
      try {
        await apiUpdateAnnotation(id, patch);
      } catch (e) {
        setAnnotations(prev); // rollback
        setError((e as Error).message);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [annotations, setAnnotations]
  );

  const remove = useCallback(
    async (id: string) => {
      const prev = annotations;
      setAnnotations(prev.filter((a) => a.id !== id));
      try {
        await apiDeleteAnnotation(id);
      } catch (e) {
        setAnnotations(prev); // rollback
        setError((e as Error).message);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [annotations, setAnnotations]
  );

  const clear = useCallback(() => {
    const prev = annotations;
    setAnnotations([]);
    // apiSaveBulk([]) will be triggered by the useEffect watching annotations
    apiSaveBulk([]).catch(() => setAnnotations(prev));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotations, setAnnotations]);

  const setAll = useCallback(
    (next: Annotation[]) => {
      setAnnotations(next);
      // sync is handled by the annotations-watching useEffect
    },
    [setAnnotations]
  );

  // Sync to backend whenever annotations change (covers undo/redo/add/remove/update)
  // Skip when the change originated from the server (initial load or explicit skip)
  const isInitialLoad = useRef(true);
  useEffect(() => {
    if (isInitialLoad.current) { isInitialLoad.current = false; return; }
    if (skipNextSyncRef.current) { skipNextSyncRef.current = false; return; }
    scheduleBulkSync(annotations);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotations]);

  const undoWithSync = useCallback(() => { undo(); }, [undo]);
  const redoWithSync = useCallback(() => { redo(); }, [redo]);

  return {
    annotations,
    add,
    update,
    remove,
    clear,
    setAnnotations: setAll,
    undo: undoWithSync,
    redo: redoWithSync,
    canUndo,
    canRedo,
    loading,
    error,
    clearError: () => setError(null),
  };
}

export type UseAnnotationsReturn = ReturnType<typeof useAnnotations>;
