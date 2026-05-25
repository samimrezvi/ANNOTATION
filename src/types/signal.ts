/**
 * Signal data for time-series (e.g. ECG).
 */

export interface SignalDataPoint {
  time: number;
  value: number;
}

export interface SignalData {
  times: number[];
  values: number[];
}

export function toDataPoints(data: SignalData): SignalDataPoint[] {
  const { times, values } = data;
  const len = Math.min(times.length, values.length);
  const out: SignalDataPoint[] = [];
  for (let i = 0; i < len; i++) {
    out.push({ time: times[i], value: values[i] });
  }
  return out;
}
