import React from 'react';
import { Pattern, DMCColor } from '../types';
import './ShoppingList.css';

interface ShoppingListProps {
  pattern: Pattern | null;
}

export const ShoppingList: React.FC<ShoppingListProps> = ({ pattern }) => {
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
    // Sort by DMC number if numeric, otherwise alphabetically
    const aNum = parseInt(a.number);
    const bNum = parseInt(b.number);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum;
    }
    return a.number.localeCompare(b.number);
  });

  if (colors.length === 0) {
    return (
      <div className="shopping-list">
        <h3>Shopping List</h3>
        <p className="empty-message">No colors used in pattern</p>
      </div>
    );
  }

  return (
    <div className="shopping-list">
      <h3>Shopping List ({colors.length} colors)</h3>
      <div className="shopping-list-items">
        {colors.map((color) => (
          <div key={color.number} className="shopping-list-item">
            <div 
              className="color-swatch"
              style={{ backgroundColor: `rgb(${color.rgb.join(',')})` }}
            />
            <div className="color-details">
              <span className="dmc-number">DMC {color.number}</span>
              <span className="color-name">{color.name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
