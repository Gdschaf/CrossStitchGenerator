import { useState, useMemo } from 'react';
import { DMCColor } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';

interface ColorLibraryProps {
  colors: DMCColor[];
  onColorsChange: (colors: DMCColor[]) => void;
}

export function ColorLibrary({ colors, onColorsChange }: ColorLibraryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newNumber, setNewNumber] = useState('');
  const [newName, setNewName] = useState('');
  const [newRgb, setNewRgb] = useState<[number, number, number]>([0, 0, 0]);

  const enabledCount = colors.filter(c => c.enabled !== false).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return colors;
    return colors.filter(
      c =>
        c.number.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q)
    );
  }, [colors, search]);

  const handleToggle = (number: string) => {
    onColorsChange(
      colors.map(c =>
        c.number === number ? { ...c, enabled: c.enabled === false ? true : false } : c
      )
    );
  };

  const handleEnableAll = () =>
    onColorsChange(colors.map(c => ({ ...c, enabled: true })));

  const handleDisableAll = () =>
    onColorsChange(colors.map(c => ({ ...c, enabled: false })));

  const handleReset = () =>
    onColorsChange(colors.map(c => ({ ...c, enabled: true })));

  const handleAdd = () => {
    if (!newNumber.trim() || !newName.trim()) return;
    const exists = colors.some(c => c.number === newNumber.trim());
    if (exists) return;
    onColorsChange([
      ...colors,
      { number: newNumber.trim(), name: newName.trim(), rgb: newRgb, enabled: true },
    ]);
    setNewNumber('');
    setNewName('');
    setNewRgb([0, 0, 0]);
    setShowAdd(false);
  };

  const handleRgbChange = (channel: 0 | 1 | 2, value: string) => {
    const n = Math.max(0, Math.min(255, parseInt(value) || 0));
    const next: [number, number, number] = [...newRgb];
    next[channel] = n;
    setNewRgb(next);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Toggle header */}
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-between"
        onClick={() => setIsOpen(o => !o)}
      >
        <span className="font-medium">Color Library</span>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {enabledCount} / {colors.length}
          </Badge>
          <span className="text-muted-foreground text-xs">{isOpen ? '▲' : '▼'}</span>
        </div>
      </Button>

      {isOpen && (
        <div className="flex flex-col gap-3">
          {/* Search */}
          <Input
            placeholder="Search by DMC # or name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 text-sm"
          />

          {/* Bulk controls */}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={handleEnableAll}>
              Enable all
            </Button>
            <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={handleDisableAll}>
              Disable all
            </Button>
            <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={handleReset}>
              Reset
            </Button>
          </div>

          {search && (
            <p className="text-xs text-muted-foreground px-1">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </p>
          )}

          <Separator />

          {/* Color list */}
          <ScrollArea className="h-64">
            <div className="flex flex-col gap-0.5 pr-2">
              {filtered.map(color => {
                const enabled = color.enabled !== false;
                const [r, g, b] = color.rgb;
                return (
                  <div
                    key={color.number}
                    className={`flex items-center gap-2 px-1 py-1 rounded hover:bg-muted/50 transition-colors ${!enabled ? 'opacity-40' : ''}`}
                  >
                    <Checkbox
                      id={`color-${color.number}`}
                      checked={enabled}
                      onCheckedChange={() => handleToggle(color.number)}
                    />
                    <div
                      className="rounded-sm border border-border flex-shrink-0"
                      style={{ width: 16, height: 16, backgroundColor: `rgb(${r},${g},${b})` }}
                    />
                    <Label
                      htmlFor={`color-${color.number}`}
                      className="flex flex-col cursor-pointer min-w-0 flex-1"
                    >
                      <span className="text-xs font-semibold leading-tight">DMC {color.number}</span>
                      <span className="text-xs text-muted-foreground leading-tight truncate">{color.name}</span>
                    </Label>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <Separator />

          {/* Add custom color */}
          {!showAdd ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-7 text-muted-foreground"
              onClick={() => setShowAdd(true)}
            >
              + Add custom color
            </Button>
          ) : (
            <div className="flex flex-col gap-2 p-2 border border-border rounded-md bg-muted/30">
              <p className="text-xs font-medium">Add Custom Color</p>
              <Input
                placeholder="DMC Number"
                value={newNumber}
                onChange={e => setNewNumber(e.target.value)}
                className="h-7 text-xs"
              />
              <Input
                placeholder="Color Name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="h-7 text-xs"
              />
              <div className="flex items-center gap-2">
                <div
                  className="rounded-sm border border-border flex-shrink-0"
                  style={{ width: 24, height: 24, backgroundColor: `rgb(${newRgb.join(',')})` }}
                />
                {(['R', 'G', 'B'] as const).map((ch, i) => (
                  <div key={ch} className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">{ch}</span>
                    <Input
                      type="number"
                      min={0}
                      max={255}
                      value={newRgb[i]}
                      onChange={e => handleRgbChange(i as 0 | 1 | 2, e.target.value)}
                      className="h-7 text-xs w-14"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleAdd}
                  disabled={!newNumber.trim() || !newName.trim()}>
                  Add
                </Button>
                <Button size="sm" variant="outline" className="flex-1 h-7 text-xs"
                  onClick={() => { setShowAdd(false); setNewNumber(''); setNewName(''); setNewRgb([0, 0, 0]); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
