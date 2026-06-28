import { type FC } from 'react';
import { Pattern } from '../types';
import { getShapeForColor } from '../utils/shapeMapping';
import './PatternDisplay.css';

interface PatternDisplayProps {
  pattern: Pattern | null;
  cellSize?: number;
  viewMode?: 'color' | 'crossstitch' | 'shape';
  shapeMap?: Map<string, string>;
}

const GRID_INTERVAL = 10;
const RULER_SIZE = 24; // px width of the ruler column / height of the ruler row

export const PatternDisplay: FC<PatternDisplayProps> = ({
  pattern,
  cellSize = 20,
  viewMode = 'color',
  shapeMap,
}) => {
  if (!pattern) {
    return <div className="pattern-display-empty" />;
  }

  const isShapeView = viewMode === 'shape' && shapeMap;
  const isCrossStitchView = viewMode === 'crossstitch';
  const showRulers = cellSize >= 6;

  // Fabric background for cross-stitch view — mimics natural Aida cloth colour
  const FABRIC_COLOR = '#f5f0e8';

  // Border helpers — every 10th column gets a bold left border, every 10th row gets a bold top border
  const getBorderStyle = (x: number, y: number, isShape: boolean) => {
    const base = cellSize < 4
      ? 'none'
      : isShape
        ? '1px solid #d0d0d0'
        : isCrossStitchView
          ? '1px solid #d9d0c0'
          : '1px solid #ddd';
    const boldV = isCrossStitchView ? '2px solid #b0a090' : '2px solid #888';
    const boldH = isCrossStitchView ? '2px solid #b0a090' : '2px solid #888';
    return {
      borderTop: y % GRID_INTERVAL === 0 ? boldH : base,
      borderLeft: x % GRID_INTERVAL === 0 ? boldV : base,
      borderBottom: base,
      borderRight: base,
    };
  };

  // Column ruler labels (shown every 10 columns)
  const colLabels = showRulers
    ? Array.from({ length: pattern.width }, (_, x) =>
        x % GRID_INTERVAL === 0 ? (
          <div
            key={x}
            style={{
              width: cellSize,
              flexShrink: 0,
              textAlign: 'center',
              fontSize: Math.min(10, cellSize - 2),
              color: '#888',
              lineHeight: `${RULER_SIZE}px`,
              overflow: 'hidden',
            }}
          >
            {x === 0 ? '' : x}
          </div>
        ) : (
          <div key={x} style={{ width: cellSize, flexShrink: 0 }} />
        )
      )
    : null;

  // Row ruler labels (shown every 10 rows)
  const rowLabels = showRulers
    ? Array.from({ length: pattern.height }, (_, y) => (
        <div
          key={y}
          style={{
            height: cellSize,
            width: RULER_SIZE,
            flexShrink: 0,
            textAlign: 'right',
            paddingRight: 4,
            fontSize: Math.min(10, cellSize - 2),
            color: '#888',
            lineHeight: `${cellSize}px`,
            overflow: 'hidden',
          }}
        >
          {y % GRID_INTERVAL === 0 && y !== 0 ? y : ''}
        </div>
      ))
    : null;

  const gridContent = pattern.cells.map((row, y) =>
    row.map((cell, x) => {
      const borders = getBorderStyle(x, y, !!isShapeView);

      if (isShapeView) {
        if (cell.isEmpty || !cell.dmcColor) {
          return (
            <div
              key={`${x}-${y}`}
              style={{
                width: cellSize,
                height: cellSize,
                backgroundColor: 'white',
                ...borders,
              }}
            />
          );
        }

        const shape = getShapeForColor(cell.dmcColor, shapeMap);
        const isAlphanumeric = /^[A-Z0-9]$/.test(shape) || /^\d+$/.test(shape);
        const fontSize = isAlphanumeric
          ? Math.max(8, Math.min(cellSize * 0.72, 18))
          : Math.max(7, Math.min(cellSize * 0.62, 16));
        const [r, g, b] = cell.dmcColor.rgb;

        return (
          <div
            key={`${x}-${y}`}
            style={{
              width: cellSize,
              height: cellSize,
              backgroundColor: `rgba(${r},${g},${b},0.22)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize,
              fontWeight: isAlphanumeric ? 'bold' : 'normal',
              fontFamily: "'Courier New', monospace",
              color: '#111',
              lineHeight: 1,
              overflow: 'hidden',
              ...borders,
            }}
            title={`DMC ${cell.dmcColor.number} – ${cell.dmcColor.name}`}
          >
            {shape}
          </div>
        );
      }

      // Cross-stitch X view
      if (isCrossStitchView) {
        if (cell.isEmpty || !cell.dmcColor) {
          return (
            <div
              key={`${x}-${y}`}
              style={{ width: cellSize, height: cellSize, backgroundColor: FABRIC_COLOR, ...borders }}
            />
          );
        }
        const [r, g, b] = cell.dmcColor.rgb;
        const strokeColor = `rgb(${r},${g},${b})`;
        const strokeWidth = Math.max(1, cellSize * 0.13);
        const pad = cellSize * 0.1;
        return (
          <div
            key={`${x}-${y}`}
            style={{ width: cellSize, height: cellSize, backgroundColor: FABRIC_COLOR, position: 'relative', ...borders }}
            title={`DMC ${cell.dmcColor.number} – ${cell.dmcColor.name}`}
          >
            <svg
              width={cellSize}
              height={cellSize}
              viewBox={`0 0 ${cellSize} ${cellSize}`}
              style={{ position: 'absolute', inset: 0 }}
            >
              <line x1={pad} y1={pad} x2={cellSize - pad} y2={cellSize - pad} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" />
              <line x1={cellSize - pad} y1={pad} x2={pad} y2={cellSize - pad} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" />
            </svg>
          </div>
        );
      }

      // Flat color view
      return (
        <div
          key={`${x}-${y}`}
          style={{
            width: cellSize,
            height: cellSize,
            backgroundColor: cell.isEmpty
              ? 'transparent'
              : cell.dmcColor
              ? `rgb(${cell.dmcColor.rgb.join(',')})`
              : '#ccc',
            ...borders,
          }}
          title={
            cell.dmcColor
              ? `DMC ${cell.dmcColor.number} – ${cell.dmcColor.name}`
              : 'Empty'
          }
        />
      );
    })
  );

  return (
    <div className="pattern-display">
      <div className="pattern-wrapper">
        {/* Top-left spacer + column rulers */}
        {showRulers && (
          <div className="pattern-ruler-top" style={{ paddingLeft: RULER_SIZE }}>
            <div style={{ display: 'flex' }}>{colLabels}</div>
          </div>
        )}

        <div style={{ display: 'flex' }}>
          {/* Row rulers */}
          {showRulers && (
            <div className="pattern-ruler-left" style={{ width: RULER_SIZE }}>
              {rowLabels}
            </div>
          )}

          {/* Main grid */}
          <div
            className="pattern-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${pattern.width}, ${cellSize}px)`,
              gridTemplateRows: `repeat(${pattern.height}, ${cellSize}px)`,
              width: pattern.width * cellSize,
              height: pattern.height * cellSize,
              border: '2px solid #555',
            }}
          >
            {gridContent}
          </div>
        </div>
      </div>
    </div>
  );
};

