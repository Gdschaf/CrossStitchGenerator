import React from 'react';
import { Pattern, DMCColor } from '../types';
import { createShapeMap, getShapeForColor } from '../utils/shapeMapping';
import './ShapeLegend.css';

interface ShapeLegendProps {
  pattern: Pattern | null;
}

export const ShapeLegend: React.FC<ShapeLegendProps> = ({ pattern }) => {
  if (!pattern) {
    return null;
  }

  // Extract unique DMC colors from pattern
  const colorMap = new Map<string, DMCColor>();
  
  pattern.cells.forEach(row => {
    row.forEach(cell => {
      if (cell.dmcColor && !cell.isEmpty) {
        const key = cell.dmcColor.number;
        if (!colorMap.has(key)) {
          colorMap.set(key, cell.dmcColor);
        }
      }
    });
  });

  const colors = Array.from(colorMap.values()).sort((a, b) => {
    const aNum = parseInt(a.number);
    const bNum = parseInt(b.number);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum;
    }
    return a.number.localeCompare(b.number);
  });

  const shapeMap = createShapeMap(colors);

  if (colors.length === 0) {
    return (
      <div className="shape-legend">
        <h3>Shape Key</h3>
        <p className="empty-message">No colors used in pattern</p>
      </div>
    );
  }

  return (
    <div className="shape-legend">
      <h3>Shape Key - Reference Guide</h3>
      <p className="legend-description">Each symbol/letter/number in the pattern corresponds to a DMC color below:</p>
      <div className="legend-items">
        {colors.map((color) => {
          const shape = getShapeForColor(color, shapeMap);
          return (
            <div key={color.number} className="legend-item">
              <div className="shape-display">
                <span className="shape-symbol">{shape}</span>
              </div>
              <div className="color-details">
                <span className="dmc-number">DMC {color.number}</span>
                <span className="color-name">{color.name}</span>
              </div>
              <div 
                className="color-swatch"
                style={{ backgroundColor: `rgb(${color.rgb.join(',')})` }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
