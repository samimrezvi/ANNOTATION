import { useRef, useState, useCallback, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Rect, Circle, Text } from 'react-konva';
import type Konva from 'konva';
import type { ImageAnnotation, BboxAnnotation, PolygonAnnotation } from '../../types/annotations';
import './ImageViewer.css';

interface ImageViewerProps {
  annotations: ImageAnnotation[];
  activeTool: string;
  currentLabel: string;
  activeColor: string;
  onAddAnnotation: (a: Omit<ImageAnnotation, 'id'> & { id?: string }) => Promise<string>;
  onRemoveAnnotation: (id: string) => void;
  onClearAnnotations: () => void;
}

export function ImageViewer({
  annotations,
  activeTool,
  currentLabel,
  activeColor,
  onAddAnnotation,
  onClearAnnotations,
}: ImageViewerProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [drawing, setDrawing] = useState<
    | { type: 'bbox'; x: number; y: number; w: number; h: number }
    | { type: 'polygon'; points: number[] }
    | null
  >(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 500 });

  const safeW = Math.max(1, stageSize.width);
  const safeH = Math.max(1, stageSize.height);

  useEffect(() => {
    return () => { if (imageUrl) URL.revokeObjectURL(imageUrl); };
  }, [imageUrl]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setStageSize({ width: el.clientWidth || 800, height: el.clientHeight || 500 });
    });
    ro.observe(el);
    setStageSize({ width: el.clientWidth || 800, height: el.clientHeight || 500 });
    return () => ro.disconnect();
  }, [imageUrl, imageSize]);

  // Fit and center the image whenever a new one is loaded
  useEffect(() => {
    if (!imageSize) return;
    const el = containerRef.current;
    if (!el) return;
    const containerW = el.clientWidth || 800;
    const containerH = (el.clientHeight - 28) || 472; // subtract padding-bottom reserved for shortcuts bar
    const scale = Math.min(containerW / imageSize.width, containerH / imageSize.height, 1);
    setStageScale(scale);
    setStagePos({
      x: (containerW - imageSize.width * scale) / 2,
      y: (containerH - imageSize.height * scale) / 2,
    });
  }, [imageSize]);

  const getStageCoords = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    return {
      x: (pos.x - stage.x()) / stageScale,
      y: (pos.y - stage.y()) / stageScale,
    };
  }, [stageScale]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      // Don't manually revoke imageUrl here — the useEffect cleanup handles it
      // when imageUrl state changes, preventing a double-revoke.
      setImageUrl(url);
      setImageSize(null);
      setImageElement(null);
      setStageScale(1);
      setStagePos({ x: 0, y: 0 });
      const img = new window.Image();
      img.onload = () => {
        setImageElement(img);
        setImageSize({ width: img.width, height: img.height });
        onClearAnnotations();
      };
      img.src = url;
      e.target.value = '';
    },
    [onClearAnnotations]
  );

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const stage = stageRef.current;
    const container = containerRef.current;
    if (!stage || !container) return;
    const oldScale = stage.scaleX();
    const rect = container.getBoundingClientRect();
    const pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const scaleBy = 1.12;
    const newScale = e.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    const s = Math.max(0.1, Math.min(8, newScale));
    setStageScale(s);
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    setStagePos({
      x: pointer.x - mousePointTo.x * s,
      y: pointer.y - mousePointTo.y * s,
    });
  }, []);

  const handleStageMouseDown = useCallback(
    (_ev: Konva.KonvaEventObject<MouseEvent>) => {
      if (!imageSize) return;
      const coords = getStageCoords();
      if (!coords) return;
      const { x, y } = coords;

      if (activeTool === 'bbox') {
        setDrawing({ type: 'bbox', x, y, w: 0, h: 0 });
      }
      if (activeTool === 'polygon') {
        setDrawing((prev) => {
          const pts = prev?.type === 'polygon' ? [...prev.points, x, y] : [x, y];
          return { type: 'polygon', points: pts };
        });
      }
    },
    [imageSize, getStageCoords, activeTool]
  );

  const handleStageMouseMove = useCallback(
    (_ev: Konva.KonvaEventObject<MouseEvent>) => {
      const coords = getStageCoords();
      if (!coords) return;
      setMousePos(coords);
      if (!drawing || drawing.type !== 'bbox') return;
      setDrawing({ type: 'bbox', x: drawing.x, y: drawing.y, w: coords.x - drawing.x, h: coords.y - drawing.y });
    },
    [drawing, getStageCoords]
  );

  const handleStageMouseUp = useCallback(
    (_ev: Konva.KonvaEventObject<MouseEvent>) => {
      if (drawing?.type === 'bbox') {
        const { x, y, w, h } = drawing;
        const nx = w < 0 ? x + w : x;
        const ny = h < 0 ? y + h : y;
        const nw = Math.abs(w);
        const nh = Math.abs(h);
        if (nw > 4 && nh > 4) {
          onAddAnnotation({
            type: 'bbox',
            x: nx, y: ny, width: nw, height: nh,
            label: currentLabel || undefined,
            color: activeColor,
          } as BboxAnnotation);
        }
        setDrawing(null);
      }
    },
    [drawing, currentLabel, activeColor, onAddAnnotation]
  );

  // Double-click closes polygon
  const handleStageDblClick = useCallback(() => {
    if (drawing?.type === 'polygon' && drawing.points.length >= 6) {
      const pts: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < drawing.points.length; i += 2) {
        pts.push({ x: drawing.points[i], y: drawing.points[i + 1] });
      }
      onAddAnnotation({
        type: 'polygon',
        points: pts,
        label: currentLabel || undefined,
        color: activeColor,
      } as PolygonAnnotation);
      setDrawing(null);
    }
  }, [drawing, currentLabel, activeColor, onAddAnnotation]);

  const closePolygon = useCallback(() => {
    if (drawing?.type === 'polygon' && drawing.points.length >= 6) {
      const pts: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < drawing.points.length; i += 2) {
        pts.push({ x: drawing.points[i], y: drawing.points[i + 1] });
      }
      onAddAnnotation({
        type: 'polygon',
        points: pts,
        label: currentLabel || undefined,
        color: activeColor,
      } as PolygonAnnotation);
    }
    setDrawing(null);
  }, [drawing, currentLabel, activeColor, onAddAnnotation]);

  // Escape cancels current drawing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawing(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const bboxAnnotations = annotations.filter((a): a is BboxAnnotation => a.type === 'bbox');
  const polygonAnnotations = annotations.filter((a): a is PolygonAnnotation => a.type === 'polygon');

  const handleDownload = useCallback(() => {
    if (!imageElement || !imageSize) return;
    const canvas = document.createElement('canvas');
    canvas.width  = imageSize.width;
    canvas.height = imageSize.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(imageElement, 0, 0, imageSize.width, imageSize.height);

    for (const a of polygonAnnotations) {
      const c = a.color ?? '#00d4ff';
      ctx.beginPath();
      a.points.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
      ctx.closePath();
      ctx.fillStyle   = c + '28';
      ctx.strokeStyle = c;
      ctx.lineWidth   = 2;
      ctx.fill();
      ctx.stroke();
    }

    for (const a of bboxAnnotations) {
      const c = a.color ?? '#00d4ff';
      ctx.fillStyle   = c + '1a';
      ctx.strokeStyle = c;
      ctx.lineWidth   = 2;
      ctx.fillRect(a.x, a.y, a.width, a.height);
      ctx.strokeRect(a.x, a.y, a.width, a.height);
      if (a.label) {
        ctx.fillStyle = '#fff';
        ctx.font      = '11px sans-serif';
        ctx.fillText(a.label, a.x + 4, a.y + 14);
      }
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href     = url;
      link.download = 'annotated.png';
      link.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }, [imageElement, imageSize, bboxAnnotations, polygonAnnotations]);

  const polyPointCount = drawing?.type === 'polygon' ? drawing.points.length / 2 : 0;

  // Build a preview line for polygon: existing points + mouse cursor
  const polygonPreviewPoints = drawing?.type === 'polygon' && mousePos
    ? [...drawing.points, mousePos.x, mousePos.y]
    : drawing?.type === 'polygon' ? drawing.points : [];

  const zoomPct = Math.round(stageScale * 100);

  return (
    <div className="image-viewer">
      <div className="image-viewer-toolbar">
        <label className="file-label">
          <span className="file-upload-btn">↑ Load image</span>
          <input type="file" accept="image/*" onChange={handleFileSelect} aria-label="Load image file" />
        </label>

        {activeTool === 'polygon' && drawing?.type === 'polygon' && (
          <>
            <span className="polygon-point-count">{polyPointCount} pts</span>
            {polyPointCount >= 3 && (
              <button type="button" className="close-polygon-btn" onClick={closePolygon}>
                ⬡ Close polygon
              </button>
            )}
          </>
        )}

        {imageUrl && imageSize && (
          <button
            type="button"
            className="download-annotated-btn"
            onClick={handleDownload}
            title="Download annotated image as PNG"
          >
            ↓ Download
          </button>
        )}

        {imageUrl && (
          <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontFamily: 'var(--mono)', color: 'var(--text)', opacity: 0.6 }}>
            {zoomPct}%
          </span>
        )}
      </div>

      {!imageUrl || !imageSize ? (
        <div className="image-viewer-placeholder">
          <div className="placeholder-icon">⬚</div>
          Load an image (PNG, JPEG, WebP…) to annotate.
          <span style={{ fontSize: '0.78rem', opacity: 0.5 }}>Scroll to zoom · Drag in select mode to pan</span>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="image-stage-wrap"
          style={{ cursor: activeTool === 'select' ? 'grab' : 'crosshair', position: 'relative' }}
          onWheel={handleWheel}
        >
          <Stage
            ref={stageRef}
            width={safeW}
            height={safeH}
            scaleX={stageScale}
            scaleY={stageScale}
            x={stagePos.x}
            y={stagePos.y}
            draggable={activeTool === 'select'}
            onMouseDown={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
            onDblClick={handleStageDblClick}
            onDragEnd={(e) => { const s = e.target; setStagePos({ x: s.x(), y: s.y() }); }}
          >
            <Layer>
              {imageElement && (
                <KonvaImage image={imageElement} width={imageSize.width} height={imageSize.height} listening={false} />
              )}

              {/* Completed bboxes */}
              {bboxAnnotations.map((a) => {
                const c = a.color ?? '#00d4ff';
                return (
                  <Rect
                    key={a.id}
                    x={a.x} y={a.y} width={a.width} height={a.height}
                    stroke={c}
                    strokeWidth={2 / stageScale}
                    fill={c + '1a'}
                    listening={false}
                  />
                );
              })}
              {bboxAnnotations.map((a) => a.label ? (
                <Text
                  key={`lbl-${a.id}`}
                  x={a.x + 4 / stageScale}
                  y={a.y + 4 / stageScale}
                  text={a.label}
                  fontSize={11 / stageScale}
                  fill="#fff"
                  listening={false}
                />
              ) : null)}

              {/* Completed polygons */}
              {polygonAnnotations.map((a) => {
                const c = a.color ?? '#00d4ff';
                return (
                  <Line
                    key={a.id}
                    points={a.points.flatMap((p) => [p.x, p.y])}
                    closed
                    stroke={c}
                    strokeWidth={2 / stageScale}
                    fill={c + '28'}
                    listening={false}
                  />
                );
              })}

              {/* Drawing: bbox preview */}
              {drawing?.type === 'bbox' && (
                <Rect
                  x={drawing.w < 0 ? drawing.x + drawing.w : drawing.x}
                  y={drawing.h < 0 ? drawing.y + drawing.h : drawing.y}
                  width={Math.abs(drawing.w)}
                  height={Math.abs(drawing.h)}
                  stroke={activeColor}
                  strokeWidth={2 / stageScale}
                  dash={[6 / stageScale, 3 / stageScale]}
                  fill={activeColor + '14'}
                />
              )}

              {/* Drawing: polygon preview with cursor line */}
              {drawing?.type === 'polygon' && polygonPreviewPoints.length >= 4 && (
                <Line
                  points={polygonPreviewPoints}
                  stroke={activeColor}
                  strokeWidth={2 / stageScale}
                  dash={[6 / stageScale, 3 / stageScale]}
                  fill={activeColor + '14'}
                />
              )}

              {/* Polygon vertex dots */}
              {drawing?.type === 'polygon' && drawing.points.length >= 2 && (
                <>
                  {Array.from({ length: drawing.points.length / 2 }, (_, i) => (
                    <Circle
                      key={i}
                      x={drawing.points[i * 2]}
                      y={drawing.points[i * 2 + 1]}
                      radius={4 / stageScale}
                      fill={i === 0 ? activeColor : '#fff'}
                      stroke={activeColor}
                      strokeWidth={1.5 / stageScale}
                    />
                  ))}
                </>
              )}
            </Layer>
          </Stage>
        </div>
      )}
    </div>
  );
}
