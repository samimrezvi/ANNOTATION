/**
 * Annotation types for biomedical signals and medical images.
 */

export type ReviewStatus = 'approved' | 'rejected';

// ── Signal annotations ────────────────────────────────────────────────────────

export interface PeakAnnotation {
  id: string;
  type: 'peak';
  time: number;
  value: number;
  label?: string;
  color?: string;
  status?: ReviewStatus;
  createdAt?: number;
  updatedAt?: number;
}

export interface IntervalAnnotation {
  id: string;
  type: 'interval';
  startTime: number;
  endTime: number;
  label?: string;
  color?: string;
  status?: ReviewStatus;
  createdAt?: number;
  updatedAt?: number;
}

export type SignalAnnotation = PeakAnnotation | IntervalAnnotation;

// ── Image annotations ─────────────────────────────────────────────────────────

export interface BboxAnnotation {
  id: string;
  type: 'bbox';
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  color?: string;
  status?: ReviewStatus;
  createdAt?: number;
  updatedAt?: number;
}

export interface PolygonAnnotation {
  id: string;
  type: 'polygon';
  points: Array<{ x: number; y: number }>;
  label?: string;
  color?: string;
  status?: ReviewStatus;
  createdAt?: number;
  updatedAt?: number;
}

export type ImageAnnotation = BboxAnnotation | PolygonAnnotation;

// ── Union and guards ──────────────────────────────────────────────────────────

export type Annotation = SignalAnnotation | ImageAnnotation;

export function isPeak(a: Annotation): a is PeakAnnotation       { return a.type === 'peak'; }
export function isInterval(a: Annotation): a is IntervalAnnotation { return a.type === 'interval'; }
export function isBbox(a: Annotation): a is BboxAnnotation        { return a.type === 'bbox'; }
export function isPolygon(a: Annotation): a is PolygonAnnotation  { return a.type === 'polygon'; }

export function isSignalAnnotation(a: Annotation): a is SignalAnnotation {
  return a.type === 'peak' || a.type === 'interval';
}
export function isImageAnnotation(a: Annotation): a is ImageAnnotation {
  return a.type === 'bbox' || a.type === 'polygon';
}
