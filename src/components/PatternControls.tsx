import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

const CLOTH_COUNTS = [11, 14, 16, 18, 28] as const;

interface PatternControlsProps {
  patternWidth: number;
  patternHeight: number;
  maxColors: number;
  clothCount: number;
  onWidthChange: (width: number) => void;
  onHeightChange: (height: number) => void;
  onMaxColorsChange: (max: number) => void;
  onClothCountChange: (count: number) => void;
}

type InputMode = 'stitches' | 'inches';

export function PatternControls({
  patternWidth,
  patternHeight,
  maxColors,
  clothCount,
  onWidthChange,
  onHeightChange,
  onMaxColorsChange,
  onClothCountChange,
}: PatternControlsProps) {
  const [inputMode, setInputMode] = useState<InputMode>('stitches');

  // Local input state — always stored as strings so the user can type freely
  const [widthInput, setWidthInput] = useState('');
  const [heightInput, setHeightInput] = useState('');

  // Sync inputs from props whenever props or mode changes
  useEffect(() => {
    if (inputMode === 'stitches') {
      setWidthInput(patternWidth.toString());
      setHeightInput(patternHeight.toString());
    } else {
      setWidthInput((patternWidth / clothCount).toFixed(2));
      setHeightInput((patternHeight / clothCount).toFixed(2));
    }
  }, [patternWidth, patternHeight, clothCount, inputMode]);

  const commitWidth = () => {
    if (inputMode === 'stitches') {
      const v = Math.max(10, Math.min(1000, parseInt(widthInput) || 10));
      setWidthInput(v.toString());
      onWidthChange(v);
    } else {
      const inches = Math.max(0.5, Math.min(70, parseFloat(widthInput) || 0.5));
      setWidthInput(inches.toFixed(2));
      onWidthChange(Math.round(inches * clothCount));
    }
  };

  const commitHeight = () => {
    if (inputMode === 'stitches') {
      const v = Math.max(10, Math.min(1000, parseInt(heightInput) || 10));
      setHeightInput(v.toString());
      onHeightChange(v);
    } else {
      const inches = Math.max(0.5, Math.min(70, parseFloat(heightInput) || 0.5));
      setHeightInput(inches.toFixed(2));
      onHeightChange(Math.round(inches * clothCount));
    }
  };

  const inchesW = (patternWidth / clothCount).toFixed(1);
  const inchesH = (patternHeight / clothCount).toFixed(1);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-semibold text-foreground">Pattern Settings</p>

      {/* Cloth count */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Cloth count (stitches per inch)</Label>
        <div className="flex gap-1">
          {CLOTH_COUNTS.map(count => (
            <Button
              key={count}
              size="sm"
              variant={clothCount === count ? 'default' : 'outline'}
              className="flex-1 h-7 text-xs px-0"
              onClick={() => onClothCountChange(count)}
            >
              {count}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {clothCount === 11 && 'Large stitches, great for beginners'}
          {clothCount === 14 && 'Most common — standard Aida'}
          {clothCount === 16 && 'More detail than 14-count'}
          {clothCount === 18 && 'Fine detail work'}
          {clothCount === 28 && 'Evenweave, worked over 2 threads'}
        </p>
      </div>

      <Separator />

      {/* Input mode toggle */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Size input mode</Label>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={inputMode === 'stitches' ? 'default' : 'outline'}
            className="flex-1 h-7 text-xs"
            onClick={() => setInputMode('stitches')}
          >
            Stitch count
          </Button>
          <Button
            size="sm"
            variant={inputMode === 'inches' ? 'default' : 'outline'}
            className="flex-1 h-7 text-xs"
            onClick={() => setInputMode('inches')}
          >
            Inches
          </Button>
        </div>
      </div>

      {/* Size inputs */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="width-input" className="text-xs">
            Width {inputMode === 'inches' ? '(inches)' : '(stitches)'}
          </Label>
          <Input
            id="width-input"
            type="number"
            min={inputMode === 'stitches' ? 10 : 0.5}
            max={inputMode === 'stitches' ? 1000 : 70}
            step={inputMode === 'inches' ? 0.25 : 1}
            value={widthInput}
            onChange={e => setWidthInput(e.target.value)}
            onBlur={commitWidth}
            onKeyDown={e => e.key === 'Enter' && commitWidth()}
            className="h-8 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="height-input" className="text-xs">
            Height {inputMode === 'inches' ? '(inches)' : '(stitches)'}
          </Label>
          <Input
            id="height-input"
            type="number"
            min={inputMode === 'stitches' ? 10 : 0.5}
            max={inputMode === 'stitches' ? 1000 : 70}
            step={inputMode === 'inches' ? 0.25 : 1}
            value={heightInput}
            onChange={e => setHeightInput(e.target.value)}
            onBlur={commitHeight}
            onKeyDown={e => e.key === 'Enter' && commitHeight()}
            className="h-8 text-sm"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {patternWidth} × {patternHeight} stitches · {inchesW}" × {inchesH}" on {clothCount}-count
        </p>
      </div>

      <Separator />

      {/* Max colors slider */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Max colors</Label>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {maxColors}
          </span>
        </div>
        <Slider
          min={1}
          max={50}
          step={1}
          value={[maxColors]}
          onValueChange={(val) => {
            const v = Array.isArray(val) ? val[0] : val;
            onMaxColorsChange(v as number);
          }}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Pattern will use the {maxColors} best-matching colors from your library.
        </p>
      </div>

    </div>
  );
}
