import { useMemo, useRef, useEffect, useState } from 'react';
import { Pattern, DMCColor } from '../types';
import { getShapeForColor } from '../utils/shapeMapping';
import { Button } from '@/components/ui/button';

// Print page content area: 7.5" × 10" (US Letter with 0.5" margins) at 96dpi
const PAGE_W = 720;
const PAGE_H = 960;

// Symbol chunk size — 50 cols × 70 rows per page
const CHUNK_COLS = 50;
const CHUNK_ROWS = 70;
const PAGE_PADDING = 40;  // matches .pp-page padding in CSS
const RULER_W = 20;       // row ruler column width
const RULER_H = 14;       // column ruler row height
const CHUNK_HEADER_H = 28; // section label row height
// Cell size = smallest of width-constrained and height-constrained values so the grid always fits
const AVAIL_W = PAGE_W - PAGE_PADDING * 2 - RULER_W;
const AVAIL_H = PAGE_H - PAGE_PADDING * 2 - CHUNK_HEADER_H - RULER_H;
const CHUNK_CELL = Math.min(AVAIL_W / CHUNK_COLS, AVAIL_H / CHUNK_ROWS); // ~11.9px

// Color preview page: available height after subtracting header, footer, and padding
const COLOR_PAGE_HEADER_H = 65;  // pp-page-header (title + subtitle + border + margin)
const COLOR_PAGE_FOOTER_H = 35;  // pp-page-footer (border + padding + text + margin)
const COLOR_AVAIL_H = PAGE_H - PAGE_PADDING * 2 - COLOR_PAGE_HEADER_H - COLOR_PAGE_FOOTER_H;

// Shopping list: how many thread entries fit per page (conservative to leave room for footer)
const SHOPPING_ENTRY_H = 22;     // px per thread row
const SHOPPING_FOOTER_H = 35;    // page footer
const SHOPPING_PAGE1_OVERHEAD = 65 + 135 + 35 + 22 + SHOPPING_FOOTER_H; // header+materials+section+colheader+footer
const SHOPPING_CONT_OVERHEAD = 65 + 35 + 22 + SHOPPING_FOOTER_H;        // header+section+colheader+footer
const SHOPPING_PAGE1_MAX = Math.floor((PAGE_H - PAGE_PADDING * 2 - SHOPPING_PAGE1_OVERHEAD) / SHOPPING_ENTRY_H);
const SHOPPING_CONT_MAX = Math.floor((PAGE_H - PAGE_PADDING * 2 - SHOPPING_CONT_OVERHEAD) / SHOPPING_ENTRY_H);

interface PrintPreviewProps {
  pattern: Pattern;
  shapeMap: Map<string, string>;
  clothCount: number;
  onClose: () => void;
}

interface ColorEntry {
  color: DMCColor;
  symbol: string;
  stitchCount: number;
}

// ─── Color preview page rendered to a canvas for perf ───────────────────────
function ColorPreviewCanvas({ pattern, availW, availH }: { pattern: Pattern; availW: number; availH: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { width, height, cells } = pattern;
  const cellSize = Math.min(availW / width, availH / height);
  const canvasW = Math.round(width * cellSize);
  const canvasH = Math.round(height * cellSize);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvasW;
    canvas.height = canvasH;
    cells.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (!cell.isEmpty && cell.dmcColor) {
          const [r, g, b] = cell.dmcColor.rgb;
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(Math.round(x * cellSize), Math.round(y * cellSize), Math.ceil(cellSize), Math.ceil(cellSize));
        }
      });
    });
  }, [pattern, canvasW, canvasH, cellSize, cells]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', border: '1px solid #aaa', imageRendering: 'pixelated' }}
    />
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
const BASE_SCALE = 0.52;
const SCALE_STEP = 0.1;
const MIN_SCALE = 0.2;
const MAX_SCALE = 2.0;

// Initial scale: the default, or smaller so a page fits the viewport width on phones
const computeFitScale = () => {
  const avail = window.innerWidth - 32; // pp-scroll horizontal padding + a little slack
  return Math.max(MIN_SCALE, Math.min(BASE_SCALE, avail / PAGE_W));
};

export function PrintPreview({ pattern, shapeMap, clothCount, onClose }: PrintPreviewProps) {
  const { width, height } = pattern;
  const [previewScale, setPreviewScale] = useState(computeFitScale);
  const zoomIn = () => setPreviewScale(s => Math.min(MAX_SCALE, Math.round((s + SCALE_STEP) * 10) / 10));
  const zoomOut = () => setPreviewScale(s => Math.max(MIN_SCALE, Math.round((s - SCALE_STEP) * 10) / 10));
  const zoomReset = () => setPreviewScale(computeFitScale());

  const entries = useMemo<ColorEntry[]>(() => {
    const countMap = new Map<string, { color: DMCColor; count: number }>();
    for (const row of pattern.cells) {
      for (const cell of row) {
        if (!cell.isEmpty && cell.dmcColor) {
          const key = cell.dmcColor.number;
          const existing = countMap.get(key);
          if (existing) existing.count++;
          else countMap.set(key, { color: cell.dmcColor, count: 1 });
        }
      }
    }
    return Array.from(countMap.values())
      .sort((a, b) => {
        const an = parseInt(a.color.number), bn = parseInt(b.color.number);
        if (!isNaN(an) && !isNaN(bn)) return an - bn;
        return a.color.number.localeCompare(b.color.number);
      })
      .map(({ color, count }) => ({
        color,
        symbol: shapeMap.get(color.number) ?? '●',
        stitchCount: count,
      }));
  }, [pattern, shapeMap]);

  const chunks = useMemo(() => {
    const result: { rowStart: number; colStart: number; rowEnd: number; colEnd: number }[] = [];
    for (let rowStart = 0; rowStart < height; rowStart += CHUNK_ROWS) {
      for (let colStart = 0; colStart < width; colStart += CHUNK_COLS) {
        result.push({
          rowStart,
          colStart,
          rowEnd: Math.min(rowStart + CHUNK_ROWS, height),
          colEnd: Math.min(colStart + CHUNK_COLS, width),
        });
      }
    }
    return result;
  }, [width, height]);

  const shoppingPageCount = entries.length <= SHOPPING_PAGE1_MAX
    ? 1
    : 1 + Math.ceil((entries.length - SHOPPING_PAGE1_MAX) / SHOPPING_CONT_MAX);
  const totalPages = 1 + chunks.length + 1 + shoppingPageCount; // color + chunks + key + shopping
  const totalStitches = entries.reduce((s, e) => s + e.stitchCount, 0);

  const inchesW = (width / clothCount).toFixed(1);
  const inchesH = (height / clothCount).toFixed(1);
  // Minimum cloth = pattern size + 2" border on each side, rounded up to nearest 0.5"
  const minClothW = Math.ceil((width / clothCount + 4) / 0.5) * 0.5;
  const minClothH = Math.ceil((height / clothCount + 4) / 0.5) * 0.5;
  const needleSize = clothCount <= 11 ? 22 : clothCount <= 14 ? 24 : clothCount <= 18 ? 26 : 28;

  // ── Page content renderers ─────────────────────────────────────────────────

  const colorPage = (
    <div className="pp-page">
      <div className="pp-page-header">
        <div className="pp-title">Cross Stitch Pattern</div>
        <div className="pp-subtitle">
          {width} × {height} stitches &nbsp;·&nbsp; {inchesW}" × {inchesH}" &nbsp;·&nbsp; {clothCount}-count Aida
        </div>
      </div>
      <div className="pp-color-preview-area">
        <ColorPreviewCanvas pattern={pattern} availW={PAGE_W - PAGE_PADDING * 2} availH={COLOR_AVAIL_H} />
      </div>
      <div className="pp-page-footer">Color Preview &nbsp;·&nbsp; Page 1 of {totalPages}</div>
    </div>
  );

  const chunkPages = chunks.map((chunk, i) => {
    const chunkCols = chunk.colEnd - chunk.colStart;
    const chunkRows = chunk.rowEnd - chunk.rowStart;
    const cs = CHUNK_CELL;

    const gridCells = [];
    for (let y = chunk.rowStart; y < chunk.rowEnd; y++) {
      for (let x = chunk.colStart; x < chunk.colEnd; x++) {
        const cell = pattern.cells[y][x];
        const boldLeft = x % 10 === 0 ? '2px solid #777' : '1px solid #ccc';
        const boldTop = y % 10 === 0 ? '2px solid #777' : '1px solid #ccc';
        const baseB = '1px solid #ccc';

        if (cell.isEmpty || !cell.dmcColor) {
          gridCells.push(
            <div key={`${x}-${y}`} style={{ width: cs, height: cs, backgroundColor: '#fff', borderLeft: boldLeft, borderTop: boldTop, borderRight: baseB, borderBottom: baseB }} />
          );
        } else {
          const shape = getShapeForColor(cell.dmcColor, shapeMap);
          const isAlpha = /^[A-Z0-9]$/.test(shape);
          const [r, g, b] = cell.dmcColor.rgb;
          gridCells.push(
            <div
              key={`${x}-${y}`}
              style={{
                width: cs, height: cs,
                backgroundColor: `rgba(${r},${g},${b},0.22)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: Math.max(6, cs * 0.65),
                fontWeight: isAlpha ? 'bold' : 'normal',
                fontFamily: "'Courier New', monospace",
                color: '#111', lineHeight: 1, overflow: 'hidden',
                borderLeft: boldLeft, borderTop: boldTop, borderRight: baseB, borderBottom: baseB,
              }}
            >
              {shape}
            </div>
          );
        }
      }
    }

    return (
      <div key={i} className="pp-page">
        <div className="pp-chunk-header">
          <span className="pp-chunk-title">
            Cols {chunk.colStart + 1}–{chunk.colEnd} &nbsp;/&nbsp; Rows {chunk.rowStart + 1}–{chunk.rowEnd}
          </span>
          <span className="pp-page-footer-inline">Page {i + 2} of {totalPages}</span>
        </div>

        {/* Rulers + grid */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Column ruler row */}
          <div style={{ display: 'flex', marginLeft: 20 }}>
            {Array.from({ length: chunkCols }, (_, ci) => {
              const absX = chunk.colStart + ci;
              return (
                <div key={ci} style={{ width: cs, flexShrink: 0, textAlign: 'center', fontSize: 7, color: '#999', lineHeight: '14px', overflow: 'hidden' }}>
                  {absX % 10 === 0 ? absX : ''}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex' }}>
            {/* Row ruler */}
            <div style={{ width: 20, flexShrink: 0 }}>
              {Array.from({ length: chunkRows }, (_, ri) => {
                const absY = chunk.rowStart + ri;
                return (
                  <div key={ri} style={{ height: cs, lineHeight: `${cs}px`, textAlign: 'right', paddingRight: 2, fontSize: 7, color: '#999', overflow: 'hidden' }}>
                    {absY % 10 === 0 ? absY : ''}
                  </div>
                );
              })}
            </div>

            {/* Symbol grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${chunkCols}, ${cs}px)`,
              gridTemplateRows: `repeat(${chunkRows}, ${cs}px)`,
              border: '2px solid #444',
            }}>
              {gridCells}
            </div>
          </div>
        </div>
      </div>
    );
  });

  // Symbol key — split into two columns
  const half = Math.ceil(entries.length / 2);
  const keyPage = (
    <div className="pp-page">
      <div className="pp-page-header">
        <div className="pp-title">Symbol Key</div>
        <div className="pp-subtitle">{entries.length} colors &nbsp;·&nbsp; {totalStitches.toLocaleString()} total stitches</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 28px', marginTop: 12 }}>
        {[entries.slice(0, half), entries.slice(half)].map((col, ci) => (
          <div key={ci}>
            <div style={{ display: 'grid', gridTemplateColumns: '22px 18px 1fr auto', gap: '0 5px', padding: '3px 0', borderBottom: '1.5px solid #888', marginBottom: 1, fontSize: 9, fontWeight: 'bold', color: '#555' }}>
              <span>Sym</span><span></span><span>DMC # / Name</span><span>Sts</span>
            </div>
            {col.map(({ color, symbol, stitchCount }) => {
              const isAlpha = /^[A-Z0-9]$/.test(symbol);
              const [r, g, b] = color.rgb;
              return (
                <div key={color.number} style={{ display: 'grid', gridTemplateColumns: '22px 18px 1fr auto', gap: '0 5px', padding: '2px 0', borderBottom: '1px solid #eee', alignItems: 'center' }}>
                  <div style={{ width: 20, height: 20, backgroundColor: `rgba(${r},${g},${b},0.22)`, border: '1px solid #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: isAlpha ? 'bold' : 'normal', fontFamily: 'monospace' }}>
                    {symbol}
                  </div>
                  <div style={{ width: 16, height: 16, backgroundColor: `rgb(${r},${g},${b})`, border: '1px solid #bbb', borderRadius: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 'bold', lineHeight: 1.2 }}>DMC {color.number}</div>
                    <div style={{ fontSize: 9, color: '#666', lineHeight: 1.2 }}>{color.name}</div>
                  </div>
                  <div style={{ fontSize: 10, color: '#555', textAlign: 'right' }}>{stitchCount.toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="pp-page-footer" style={{ marginTop: 'auto' }}>Symbol Key &nbsp;·&nbsp; Page {2 + chunks.length} of {totalPages}</div>
    </div>
  );

  const threadColHeader = (
    <div style={{ display: 'grid', gridTemplateColumns: '18px 60px 1fr auto 22px', gap: '0 8px', padding: '3px 4px', backgroundColor: '#eee', borderRadius: 2, fontSize: 9, fontWeight: 'bold', marginBottom: 2 }}>
      <span></span><span>DMC #</span><span>Color Name</span><span>Stitches</span><span style={{ textAlign: 'center' }}>✓</span>
    </div>
  );

  const renderThreadRows = (slice: typeof entries) =>
    slice.map(({ color, stitchCount }) => {
      const [r, g, b] = color.rgb;
      return (
        <div key={color.number} style={{ display: 'grid', gridTemplateColumns: '18px 60px 1fr auto 22px', gap: '0 8px', padding: '3px 4px', borderBottom: '1px solid #eee', alignItems: 'center' }}>
          <div style={{ width: 14, height: 14, backgroundColor: `rgb(${r},${g},${b})`, border: '1px solid #bbb', borderRadius: 2 }} />
          <span style={{ fontSize: 10, fontWeight: 'bold' }}>{color.number}</span>
          <span style={{ fontSize: 10 }}>{color.name}</span>
          <span style={{ fontSize: 10, color: '#555' }}>{stitchCount.toLocaleString()} sts</span>
          <div style={{ width: 16, height: 16, border: '1.5px solid #aaa', borderRadius: 2, margin: '0 auto' }} />
        </div>
      );
    });

  // Split thread entries across as many pages as needed
  const shoppingPages: JSX.Element[] = [];
  const firstSlice = entries.slice(0, SHOPPING_PAGE1_MAX);
  const remaining = entries.slice(SHOPPING_PAGE1_MAX);
  const shoppingStartPage = 2 + chunks.length + 1; // page number of first shopping page

  shoppingPages.push(
    <div key="shop-0" className="pp-page">
      <div className="pp-page-header">
        <div className="pp-title">Shopping List</div>
        <div className="pp-subtitle">{width} × {height} stitches &nbsp;·&nbsp; {clothCount}-count Aida</div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 6 }}>Materials Needed</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ padding: 10, border: '1px solid #ddd', borderRadius: 4, backgroundColor: '#fafafa' }}>
            <div style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 3 }}>Aida Cloth</div>
            <div style={{ fontSize: 12 }}>{clothCount}-count</div>
            <div style={{ fontSize: 12 }}>Minimum size: <strong>{minClothW}" × {minClothH}"</strong></div>
            <div style={{ fontSize: 10, color: '#888', marginTop: 3 }}>Pattern {inchesW}" × {inchesH}" + 2" border on each side</div>
          </div>
          <div style={{ padding: 10, border: '1px solid #ddd', borderRadius: 4, backgroundColor: '#fafafa' }}>
            <div style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 3 }}>Tapestry Needle</div>
            <div style={{ fontSize: 12 }}>Size {needleSize} (for {clothCount}-count Aida)</div>
            <div style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 3, marginTop: 8 }}>Embroidery Hoop</div>
            <div style={{ fontSize: 12 }}>Sized to fit your cloth</div>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 6 }}>
        DMC Embroidery Floss &nbsp;·&nbsp; {entries.length} color{entries.length !== 1 ? 's' : ''}
        {shoppingPageCount > 1 ? ` (continued on next page${shoppingPageCount > 2 ? 's' : ''})` : ''}
      </div>
      {threadColHeader}
      {renderThreadRows(firstSlice)}

      <div className="pp-page-footer" style={{ marginTop: 'auto' }}>
        Shopping List &nbsp;·&nbsp; Page {shoppingStartPage} of {totalPages}
      </div>
    </div>
  );

  for (let i = 0; i < remaining.length; i += SHOPPING_CONT_MAX) {
    const pageIndex = shoppingPages.length;
    const slice = remaining.slice(i, i + SHOPPING_CONT_MAX);
    shoppingPages.push(
      <div key={`shop-${pageIndex}`} className="pp-page">
        <div className="pp-page-header">
          <div className="pp-title">Shopping List <span style={{ fontSize: 13, fontWeight: 'normal', color: '#666' }}>(continued)</span></div>
          <div className="pp-subtitle">{entries.length} colors total &nbsp;·&nbsp; {clothCount}-count Aida</div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 6 }}>
          DMC Embroidery Floss &nbsp;·&nbsp; entries {SHOPPING_PAGE1_MAX + i + 1}–{Math.min(SHOPPING_PAGE1_MAX + i + SHOPPING_CONT_MAX, entries.length)} of {entries.length}
        </div>
        {threadColHeader}
        {renderThreadRows(slice)}
        <div className="pp-page-footer" style={{ marginTop: 'auto' }}>
          Shopping List &nbsp;·&nbsp; Page {shoppingStartPage + pageIndex} of {totalPages}
        </div>
      </div>
    );
  }

  const allPageContents = [colorPage, ...chunkPages, keyPage, ...shoppingPages];

  return (
    <>
      {/* ── Print-only content: hidden on screen, visible on print ────────── */}
      <div className="pp-print-only">
        {allPageContents}
      </div>

      {/* ── Preview modal: visible on screen, hidden on print ─────────────── */}
      <div className="pp-overlay no-print">
        <div className="pp-panel">
          {/* Header */}
          <div className="pp-panel-header">
            <div>
              <div style={{ fontSize: 17, fontWeight: '600' }}>Print Preview</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                {totalPages} pages &nbsp;·&nbsp; {width} × {height} stitches &nbsp;·&nbsp; {chunks.length} pattern section{chunks.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <Button variant="outline" size="sm" style={{ width: 28, height: 28, padding: 0 }} onClick={zoomOut} title="Zoom out" disabled={previewScale <= MIN_SCALE}>−</Button>
              <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'center' }}>{Math.round(previewScale * 100)}%</span>
              <Button variant="outline" size="sm" style={{ width: 28, height: 28, padding: 0 }} onClick={zoomIn} title="Zoom in" disabled={previewScale >= MAX_SCALE}>+</Button>
              <Button variant="outline" size="sm" onClick={zoomReset} style={{ fontSize: 12 }}>Reset</Button>
              <Button onClick={() => window.print()}>🖨 Print / Save as PDF</Button>
              <Button variant="outline" onClick={onClose}>Close</Button>
            </div>
          </div>

          {/* Scrollable page previews */}
          <div className="pp-scroll">
            {allPageContents.map((pageContent, i) => (
              <div key={i} className="pp-preview-card">
                <div className="pp-preview-label">Page {i + 1} of {totalPages}</div>
                <div
                  className="pp-preview-outer"
                  style={{ width: Math.round(720 * previewScale), height: Math.round(960 * previewScale) }}
                >
                  <div
                    className="pp-preview-inner"
                    style={{ transform: `scale(${previewScale})` }}
                  >
                    {pageContent}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
