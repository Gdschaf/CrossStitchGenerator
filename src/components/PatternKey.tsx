import { useMemo } from 'react';
import { Pattern, DMCColor } from '../types';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface PatternKeyProps {
  pattern: Pattern;
  shapeMap: Map<string, string>;
}

interface ColorEntry {
  color: DMCColor;
  symbol: string;
  stitchCount: number;
}

export function PatternKey({ pattern, shapeMap }: PatternKeyProps) {
  const entries = useMemo<ColorEntry[]>(() => {
    const countMap = new Map<string, { color: DMCColor; count: number }>();

    for (const row of pattern.cells) {
      for (const cell of row) {
        if (!cell.isEmpty && cell.dmcColor) {
          const key = cell.dmcColor.number;
          const existing = countMap.get(key);
          if (existing) {
            existing.count++;
          } else {
            countMap.set(key, { color: cell.dmcColor, count: 1 });
          }
        }
      }
    }

    return Array.from(countMap.values())
      .sort((a, b) => {
        const an = parseInt(a.color.number);
        const bn = parseInt(b.color.number);
        if (!isNaN(an) && !isNaN(bn)) return an - bn;
        return a.color.number.localeCompare(b.color.number);
      })
      .map(({ color, count }) => ({
        color,
        symbol: shapeMap.get(color.number) ?? '●',
        stitchCount: count,
      }));
  }, [pattern, shapeMap]);

  const totalStitches = entries.reduce((sum, e) => sum + e.stitchCount, 0);

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-semibold text-foreground">
          Pattern Key
        </span>
        <Badge variant="secondary">{entries.length} colors</Badge>
      </div>

      <p className="text-xs text-muted-foreground px-1">
        {totalStitches.toLocaleString()} total stitches
      </p>

      <Separator />

      {/* Column headers */}
      <div className="grid items-center gap-2 px-1 text-xs font-medium text-muted-foreground"
        style={{ gridTemplateColumns: '20px 18px 1fr auto' }}>
        <span>Sym</span>
        <span></span>
        <span>DMC # / Name</span>
        <span>Sts</span>
      </div>

      <Separator />

      {/* Color rows */}
      <ScrollArea className="h-72">
        <div className="flex flex-col">
          {entries.map(({ color, symbol, stitchCount }) => {
            const isAlphanumeric = /^[A-Z0-9]$/.test(symbol) || /^\d+$/.test(symbol);
            const [r, g, b] = color.rgb;

            return (
              <div
                key={color.number}
                className="grid items-center gap-2 px-1 py-1 hover:bg-muted/50 rounded"
                style={{ gridTemplateColumns: '20px 18px 1fr auto' }}
              >
                {/* Symbol cell */}
                <div
                  className="flex items-center justify-center rounded-sm text-xs leading-none border border-border"
                  style={{
                    width: 20,
                    height: 20,
                    backgroundColor: `rgba(${r},${g},${b},0.22)`,
                    fontFamily: "'Courier New', monospace",
                    fontWeight: isAlphanumeric ? 'bold' : 'normal',
                    fontSize: isAlphanumeric ? 11 : 10,
                  }}
                >
                  {symbol}
                </div>

                {/* Color swatch */}
                <div
                  className="rounded-sm border border-border flex-shrink-0"
                  style={{
                    width: 18,
                    height: 18,
                    backgroundColor: `rgb(${r},${g},${b})`,
                  }}
                />

                {/* DMC number + name */}
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold leading-tight truncate">
                    DMC {color.number}
                  </span>
                  <span className="text-xs text-muted-foreground leading-tight truncate">
                    {color.name}
                  </span>
                </div>

                {/* Stitch count */}
                <span className="text-xs text-muted-foreground tabular-nums text-right">
                  {stitchCount.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
