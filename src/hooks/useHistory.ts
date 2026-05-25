import { useState, useCallback, useRef } from 'react';
import type { Annotation } from '../types/annotations';

const MAX_HISTORY = 50;

export function useHistory(initial: Annotation[] | (() => Annotation[]) = []) {
  const [past, setPast] = useState<Annotation[][]>([]);
  const [present, setPresent] = useState<Annotation[]>(
    typeof initial === 'function' ? initial() : initial
  );
  const [future, setFuture] = useState<Annotation[][]>([]);

  const presentRef = useRef(present);
  presentRef.current = present;

  const push = useCallback((next: Annotation[] | ((prev: Annotation[]) => Annotation[])) => {
    const current = presentRef.current;
    const nextValue = typeof next === 'function' ? next(current) : next;
    setPast((p) => [...p.slice(-MAX_HISTORY + 1), current]);
    setPresent(nextValue);
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [presentRef.current, ...f]);
    setPresent(prev);
  }, [past]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, presentRef.current]);
    setPresent(next);
  }, [future]);

  return { annotations: present, setAnnotations: push, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 };
}
