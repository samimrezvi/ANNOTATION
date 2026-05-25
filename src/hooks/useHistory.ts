import { useState, useCallback } from 'react';
import type { Annotation } from '../types/annotations';

const MAX_HISTORY = 50;

export function useHistory(initial: Annotation[] | (() => Annotation[]) = []) {
  const [past, setPast] = useState<Annotation[][]>([]);
  const [present, setPresent] = useState<Annotation[]>(
    typeof initial === 'function' ? initial : initial
  );
  const [future, setFuture] = useState<Annotation[][]>([]);

  const push = useCallback((next: Annotation[] | ((prev: Annotation[]) => Annotation[])) => {
    const nextValue = typeof next === 'function' ? next(present) : next;
    setPast((p) => [...p.slice(-MAX_HISTORY + 1), present]);
    setPresent(nextValue);
    setFuture([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [present]);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [present, ...f]);
    setPresent(prev);
  }, [past, present]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, present]);
    setPresent(next);
  }, [future, present]);

  return { annotations: present, setAnnotations: push, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 };
}
