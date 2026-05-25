import { useRef, useState, useCallback, useEffect } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, ReferenceDot, ReferenceArea, CartesianGrid,
} from 'recharts';
import type { SignalAnnotation, PeakAnnotation, IntervalAnnotation } from '../../types/annotations';
import type { SignalData } from '../../types/signal';
import { toDataPoints } from '../../types/signal';
import { parseSignalFile } from './parseSignalFile';
import './SignalViewer.css';

interface SignalViewerProps {
  annotations: SignalAnnotation[];
  activeTool: string;
  currentLabel: string;
  activeColor: string;
  onAddAnnotation: (a: Omit<SignalAnnotation, 'id'> & { id?: string }) => Promise<string>;
  onRemoveAnnotation: (id: string) => void;
  onClearAnnotations: () => void;
}

export function SignalViewer({
  annotations,
  activeTool,
  currentLabel,
  activeColor,
  onAddAnnotation,
  onClearAnnotations,
}: SignalViewerProps) {
  const [signalData, setSignalData] = useState<SignalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ time: number; value: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ time: number; value: number } | null>(null);
  // Zoom/pan state: [minTime, maxTime] window
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const dataPoints = signalData ? toDataPoints(signalData) : [];
  const fullTimeRange = dataPoints.length
    ? { min: dataPoints[0].time, max: dataPoints[dataPoints.length - 1].time }
    : null;

  const effectiveDomain: [number, number] | ['dataMin', 'dataMax'] = zoomDomain
    ? zoomDomain
    : ['dataMin', 'dataMax'];

  // Filter visible data points for performance
  const visiblePoints = zoomDomain
    ? dataPoints.filter((d) => d.time >= zoomDomain[0] && d.time <= zoomDomain[1])
    : dataPoints;

  const timeRange = zoomDomain
    ? { min: zoomDomain[0], max: zoomDomain[1] }
    : fullTimeRange;

  const valueRange = visiblePoints.length
    ? {
        min: Math.min(...visiblePoints.map((d) => d.value)),
        max: Math.max(...visiblePoints.map((d) => d.value)),
      }
    : null;

  // Must match LineChart margin + YAxis width so pixel→time mapping is accurate
  const PLOT_LEFT  = 8 + 52; // margin.left + YAxis width
  const PLOT_RIGHT = 16;     // margin.right
  const PLOT_TOP   = 8;      // margin.top
  const PLOT_BOT   = 30;     // margin.bottom + XAxis tick height (approx)

  const timeFromX = useCallback(
    (clientX: number): number | null => {
      if (!timeRange || !containerRef.current) return null;
      const rect = containerRef.current.getBoundingClientRect();
      const plotWidth = rect.width - PLOT_LEFT - PLOT_RIGHT;
      const x = clientX - rect.left - PLOT_LEFT;
      const t = timeRange.min + (x / plotWidth) * (timeRange.max - timeRange.min);
      return Math.max(timeRange.min, Math.min(timeRange.max, t));
    },
    [timeRange, PLOT_LEFT, PLOT_RIGHT]
  );

  const valueFromY = useCallback(
    (clientY: number): number | null => {
      if (!valueRange || !containerRef.current) return null;
      const rect = containerRef.current.getBoundingClientRect();
      const plotHeight = rect.height - PLOT_TOP - PLOT_BOT;
      const y = clientY - rect.top - PLOT_TOP;
      const v = valueRange.max - (y / plotHeight) * (valueRange.max - valueRange.min);
      return Math.max(valueRange.min, Math.min(valueRange.max, v));
    },
    [valueRange, PLOT_TOP, PLOT_BOT]
  );

  const findValueAtTime = useCallback(
    (t: number): number => {
      if (!dataPoints.length) return 0;
      let i = 0;
      while (i < dataPoints.length - 1 && dataPoints[i + 1].time < t) i++;
      const a = dataPoints[i];
      const b = dataPoints[i + 1];
      if (!b) return a.value;
      const frac = (t - a.time) / (b.time - a.time);
      return a.value + frac * (b.value - a.value);
    },
    [dataPoints]
  );

  // Snap to the nearest actual data sample so peaks land on real signal points
  const snapToNearest = useCallback(
    (t: number): { time: number; value: number } => {
      if (!dataPoints.length) return { time: t, value: 0 };
      let nearest = dataPoints[0];
      let minDist = Math.abs(dataPoints[0].time - t);
      for (const pt of dataPoints) {
        const d = Math.abs(pt.time - t);
        if (d < minDist) { minDist = d; nearest = pt; }
      }
      return nearest;
    },
    [dataPoints]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setError(null);
      parseSignalFile(file)
        .then((data) => {
          setSignalData(data);
          setZoomDomain(null);
          setZoomLevel(1);
          onClearAnnotations();
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to parse file'));
      e.target.value = '';
    },
    [onClearAnnotations]
  );

  // Wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!fullTimeRange || !timeRange) return;
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.15 : 0.87;
      const t = timeFromX(e.clientX);
      if (t == null) return;

      const span = timeRange.max - timeRange.min;
      const newSpan = Math.max((fullTimeRange.max - fullTimeRange.min) * 0.02, span * factor);
      const frac = (t - timeRange.min) / span;
      let newMin = t - frac * newSpan;
      let newMax = t + (1 - frac) * newSpan;

      // clamp to full range
      if (newMin < fullTimeRange.min) { newMax += fullTimeRange.min - newMin; newMin = fullTimeRange.min; }
      if (newMax > fullTimeRange.max) { newMin -= newMax - fullTimeRange.max; newMax = fullTimeRange.max; }
      newMin = Math.max(newMin, fullTimeRange.min);
      newMax = Math.min(newMax, fullTimeRange.max);

      const fullSpan = fullTimeRange.max - fullTimeRange.min;
      const newZoom = fullSpan / (newMax - newMin);
      setZoomDomain([newMin, newMax]);
      setZoomLevel(newZoom);
    },
    [fullTimeRange, timeRange, timeFromX]
  );

  const zoomIn  = () => { if (fullTimeRange && timeRange) {
    const mid = (timeRange.min + timeRange.max) / 2;
    const half = (timeRange.max - timeRange.min) / 2 / 1.5;
    const newMin = Math.max(fullTimeRange.min, mid - half);
    const newMax = Math.min(fullTimeRange.max, mid + half);
    setZoomDomain([newMin, newMax]);
    setZoomLevel((fullTimeRange.max - fullTimeRange.min) / (newMax - newMin));
  }};
  const zoomOut = () => {
    if (!fullTimeRange || !timeRange) return;
    const mid = (timeRange.min + timeRange.max) / 2;
    const half = (timeRange.max - timeRange.min) / 2 * 1.5;
    const newMin = Math.max(fullTimeRange.min, mid - half);
    const newMax = Math.min(fullTimeRange.max, mid + half);
    if (newMin <= fullTimeRange.min && newMax >= fullTimeRange.max) {
      setZoomDomain(null); setZoomLevel(1);
    } else {
      setZoomDomain([newMin, newMax]);
      setZoomLevel((fullTimeRange.max - fullTimeRange.min) / (newMax - newMin));
    }
  };
  const zoomReset = () => { setZoomDomain(null); setZoomLevel(1); };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!timeRange || dataPoints.length === 0) return;
      const t = timeFromX(e.clientX);
      const v = valueFromY(e.clientY);
      if (t == null || v == null) return;
      if (activeTool === 'interval') {
        setDragStart({ time: t, value: findValueAtTime(t) });
        setDragCurrent({ time: t, value: findValueAtTime(t) });
      }
    },
    [timeRange, dataPoints.length, timeFromX, valueFromY, findValueAtTime, activeTool]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragStart == null) return;
      const t = timeFromX(e.clientX);
      if (t == null) return;
      setDragCurrent({ time: t, value: findValueAtTime(t) });
    },
    [dragStart, timeFromX, findValueAtTime]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool === 'peak' && !dragStart) {
        const t = timeFromX(e.clientX);
        if (t != null) {
          const { time, value } = snapToNearest(t);
          onAddAnnotation({
            type: 'peak',
            time,
            value,
            label: currentLabel || undefined,
            color: activeColor,
          } as PeakAnnotation);
        }
      }
      if (activeTool === 'interval' && dragStart && dragCurrent) {
        const start = Math.min(dragStart.time, dragCurrent.time);
        const end = Math.max(dragStart.time, dragCurrent.time);
        if (Math.abs(end - start) > 1e-9) {
          onAddAnnotation({
            type: 'interval',
            startTime: start,
            endTime: end,
            label: currentLabel || undefined,
            color: activeColor,
          } as IntervalAnnotation);
        }
      }
      setDragStart(null);
      setDragCurrent(null);
    },
    [activeTool, dragStart, dragCurrent, timeFromX, snapToNearest, currentLabel, activeColor, onAddAnnotation]
  );

  const peakAnnotations = annotations.filter((a): a is PeakAnnotation => a.type === 'peak');
  const intervalAnnotations = annotations.filter((a): a is IntervalAnnotation => a.type === 'interval');

  const dragArea = dragStart && dragCurrent
    ? { start: Math.min(dragStart.time, dragCurrent.time), end: Math.max(dragStart.time, dragCurrent.time) }
    : null;

  // Keyboard: Pan left/right with arrow keys when zoomed
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!zoomDomain || !fullTimeRange) return;
      const span = zoomDomain[1] - zoomDomain[0];
      const step = span * 0.15;
      if (e.key === 'ArrowLeft') {
        const nm = Math.max(fullTimeRange.min, zoomDomain[0] - step);
        setZoomDomain([nm, nm + span]);
      }
      if (e.key === 'ArrowRight') {
        const nm = Math.min(fullTimeRange.max - span, zoomDomain[0] + step);
        setZoomDomain([nm, nm + span]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomDomain, fullTimeRange]);

  return (
    <div className="signal-viewer">
      <div className="signal-viewer-toolbar">
        <label className="file-label">
          <span className="file-upload-btn">
            ↑ Load signal (CSV / JSON)
          </span>
          <input
            type="file"
            accept=".csv,.json,text/csv,application/json"
            onChange={handleFileSelect}
            aria-label="Load signal file"
          />
        </label>

        {error && <p className="signal-error" role="alert">⚠ {error}</p>}

        {signalData && (
          <div className="signal-zoom-controls">
            <button className="zoom-btn" onClick={zoomOut} title="Zoom out (scroll)" type="button">−</button>
            <button className="zoom-reset-btn" onClick={zoomReset} type="button">
              {zoomLevel > 1 ? `${zoomLevel.toFixed(1)}×` : '1×'}
            </button>
            <button className="zoom-btn" onClick={zoomIn} title="Zoom in (scroll)" type="button">+</button>
          </div>
        )}
      </div>

      {!signalData || dataPoints.length === 0 ? (
        <div className="signal-viewer-placeholder">
          <div className="placeholder-icon">〜</div>
          Load a CSV or JSON file to visualize the signal.
          <span className="placeholder-hint">
            CSV: time,value columns · JSON: {'{'}times:[], values:[]{'}'} 
          </span>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="signal-chart-wrap"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { setDragStart(null); setDragCurrent(null); }}
          onWheel={handleWheel}
          role="application"
          aria-label="Signal chart"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={visiblePoints} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="time"
                type="number"
                domain={effectiveDomain}
                stroke="var(--text)"
                tick={{ fontSize: 11, fontFamily: 'var(--mono)' }}
                tickFormatter={(v) => Number(v).toFixed(2)}
              />
              <YAxis
                type="number"
                domain={['auto', 'auto']}
                stroke="var(--text)"
                tick={{ fontSize: 11, fontFamily: 'var(--mono)' }}
                width={52}
              />
              <Tooltip
                contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 12 }}
                labelFormatter={(t) => `t = ${Number(t).toFixed(4)}`}
                formatter={(v: number) => [v.toFixed(4), 'value']}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--accent)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              {peakAnnotations.map((p) => (
                <ReferenceDot
                  key={p.id}
                  x={p.time}
                  y={p.value}
                  r={5}
                  fill={p.color ?? 'var(--accent)'}
                  stroke="var(--bg)"
                  strokeWidth={2}
                />
              ))}
              {intervalAnnotations.map((i) => (
                <ReferenceArea
                  key={i.id}
                  x1={i.startTime}
                  x2={i.endTime}
                  fill={i.color
                    ? i.color + '28'
                    : 'var(--accent-bg)'}
                  stroke={i.color ?? 'var(--accent)'}
                  strokeOpacity={0.6}
                />
              ))}
              {dragArea && (
                <ReferenceArea
                  x1={dragArea.start}
                  x2={dragArea.end}
                  fill="var(--accent-bg)"
                  stroke="var(--accent)"
                  strokeOpacity={0.9}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
