import type { SignalData } from '../../types/signal';

/**
 * Parse JSON file: { times: number[], values: number[] }
 */
export function parseSignalJSON(text: string): SignalData {
  const raw = JSON.parse(text) as unknown;
  if (typeof raw !== 'object' || raw === null) throw new Error('Invalid JSON');
  const o = raw as Record<string, unknown>;
  const times = Array.isArray(o.times) ? (o.times as number[]) : null;
  const values = Array.isArray(o.values) ? (o.values as number[]) : null;
  if (!times || !values) throw new Error('JSON must have "times" and "values" arrays');
  return { times, values };
}

/**
 * Parse CSV: first column = time (or index), second = value.
 * Header row optional (e.g. "time,value").
 */
export function parseSignalCSV(text: string): SignalData {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) throw new Error('CSV is empty');
  const times: number[] = [];
  const values: number[] = [];
  const maybeHeader = lines[0];
  const firstRow = maybeHeader.split(',').map((c) => c.trim());
  const isNumeric = (s: string) => /^-?\d*\.?\d+([eE][+-]?\d+)?$/.test(s);
  const startIndex = isNumeric(firstRow[0]) ? 0 : 1; // skip header if present
  for (let i = startIndex; i < lines.length; i++) {
    const parts = lines[i].split(',').map((c) => c.trim());
    const rowIndex = i - startIndex; // 0-based data row index
    if (parts.length === 1 || parts[1] === undefined || parts[1] === '') {
      // Single-column CSV: use row index as time, column as value
      const v = Number(parts[0]);
      times.push(rowIndex);
      values.push(Number.isFinite(v) ? v : 0);
    } else {
      const a = Number(parts[0]);
      const b = Number(parts[1]);
      times.push(Number.isFinite(a) ? a : rowIndex);
      values.push(Number.isFinite(b) ? b : 0);
    }
  }
  return { times, values };
}

export function parseSignalFile(file: File): Promise<SignalData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      try {
        const ext = file.name.split('.').pop()?.toLowerCase();
        const data = ext === 'json' ? parseSignalJSON(text) : parseSignalCSV(text);
        resolve(data);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
