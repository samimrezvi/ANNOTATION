import type {
  Annotation,
  PeakAnnotation,
  IntervalAnnotation,
  BboxAnnotation,
  PolygonAnnotation,
} from '../types/annotations';

// ── helpers ───────────────────────────────────────────────────────────────────

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** ISO timestamp from epoch ms, or '' if undefined */
function isoDate(ms?: number): string {
  return ms ? new Date(ms).toISOString() : '';
}

// ── JSON export ───────────────────────────────────────────────────────────────

/**
 * Exports annotations as a well-structured JSON file.
 * Each annotation object includes ALL fields (no missing attributes).
 */
export function exportJSON(annotations: Annotation[], filename = 'annotations.json') {
  const payload = {
    exportedAt: new Date().toISOString(),
    totalCount: annotations.length,
    annotations: annotations.map((a) => {
      const base = {
        id:        a.id,
        type:      a.type,
        label:     a.label     ?? '',
        color:     a.color     ?? '',
        status:    a.status    ?? 'pending',
        createdAt: isoDate(a.createdAt),
        updatedAt: isoDate(a.updatedAt),
      };

      if (a.type === 'peak') {
        const p = a as PeakAnnotation;
        return { ...base, time: p.time, value: p.value };
      }
      if (a.type === 'interval') {
        const i = a as IntervalAnnotation;
        return { ...base, startTime: i.startTime, endTime: i.endTime };
      }
      if (a.type === 'bbox') {
        const b = a as BboxAnnotation;
        return { ...base, x: b.x, y: b.y, width: b.width, height: b.height };
      }
      if (a.type === 'polygon') {
        const poly = a as PolygonAnnotation;
        return { ...base, points: poly.points };
      }
      return base;
    }),
  };

  downloadBlob(JSON.stringify(payload, null, 2), filename, 'application/json');
}

// ── CSV export ────────────────────────────────────────────────────────────────

function escape(value: string | number | undefined | null): string {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function baseFields(a: Annotation): string[] {
  return [
    escape(a.id),
    escape(a.type),
    escape(a.label),
    escape(a.color),
    escape(a.status ?? 'pending'),
    escape(isoDate(a.createdAt)),
    escape(isoDate(a.updatedAt)),
  ];
}

// Signal-only row: id,type,label,color,status,createdAt,updatedAt,time,value
function toSignalRow(a: Annotation): string {
  const base = baseFields(a);
  if (a.type === 'peak') {
    const p = a as PeakAnnotation;
    return [...base, escape(p.time), escape(p.value)].join(',');
  }
  return [...base, '', ''].join(',');
}

// Image-only row: id,type,label,color,status,createdAt,updatedAt,x,y,width,height
function toImageRow(a: Annotation): string {
  const base = baseFields(a);
  if (a.type === 'bbox') {
    const b = a as BboxAnnotation;
    return [...base, escape(b.x), escape(b.y), escape(b.width), escape(b.height)].join(',');
  }
  return [...base, '', '', '', ''].join(',');
}

// Mixed row: all columns present
function toMixedRow(a: Annotation): string {
  const base = baseFields(a);
  if (a.type === 'peak') {
    const p = a as PeakAnnotation;
    return [...base, escape(p.time), escape(p.value), '', '', '', ''].join(',');
  }
  if (a.type === 'bbox') {
    const b = a as BboxAnnotation;
    return [...base, '', '', escape(b.x), escape(b.y), escape(b.width), escape(b.height)].join(',');
  }
  return [...base, '', '', '', '', '', ''].join(',');
}

export function exportCSV(annotations: Annotation[], filename = 'annotations.csv') {
  const hasSignal = annotations.some((a) => a.type === 'peak' || a.type === 'interval');
  const hasImage  = annotations.some((a) => a.type === 'bbox' || a.type === 'polygon');

  let header: string;
  let rows: string[];

  if (hasSignal && !hasImage) {
    header = 'id,type,label,color,status,createdAt,updatedAt,time,value';
    rows   = annotations.map(toSignalRow);
  } else if (hasImage && !hasSignal) {
    header = 'id,type,label,color,status,createdAt,updatedAt,x,y,width,height';
    rows   = annotations.map(toImageRow);
  } else {
    header = 'id,type,label,color,status,createdAt,updatedAt,time,value,x,y,width,height';
    rows   = annotations.map(toMixedRow);
  }

  downloadBlob([header, ...rows].join('\n'), filename, 'text/csv');
}
