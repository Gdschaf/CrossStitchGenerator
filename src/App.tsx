import { useState, useEffect, useRef, useMemo } from 'react';
import { Pattern, DMCColor, CropRegion } from './types';
import { dmcColors as defaultDMCColors } from './utils/dmcColors';
import { generatePattern } from './utils/imageProcessing';
import { CropScreen } from './components/CropScreen';
import { createShapeMap } from './utils/shapeMapping';
import { ImageUpload } from './components/ImageUpload';
import { PatternDisplay } from './components/PatternDisplay';
import { PatternControls } from './components/PatternControls';
import { ColorLibrary } from './components/ColorLibrary';
import { PatternKey } from './components/PatternKey';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { PrintPreview } from './components/PrintPreview';
import { BuyMeACoffee } from './components/BuyMeACoffee';
import { useIsMobile } from './hooks/useIsMobile';
import './App.css';

function App() {
  const [dmcColors, setDmcColors] = useState<DMCColor[]>(defaultDMCColors);
  const [currentImage, setCurrentImage] = useState<File | null>(null);
  const [pattern, setPattern] = useState<Pattern | null>(null);
  const [patternWidth, setPatternWidth] = useState(50);
  const [patternHeight, setPatternHeight] = useState(50);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
  const [maxColors, setMaxColors] = useState(30);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showCropScreen, setShowCropScreen] = useState(false);
  const [cropRegion, setCropRegion] = useState<CropRegion | null>(null);
  const [clothCount, setClothCount] = useState(14);
  const [isGenerating, setIsGenerating] = useState(false);
  const [cellSize, setCellSize] = useState(20);
  const [viewMode, setViewMode] = useState<'color' | 'crossstitch' | 'shape'>('color');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const isMobile = useIsMobile();
  const displayContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sidebarResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const handleSidebarResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    sidebarResizeRef.current = { startX: e.clientX, startWidth: sidebarWidth };
    setIsResizingSidebar(true);

    const onMove = (ev: MouseEvent) => {
      if (!sidebarResizeRef.current) return;
      const delta = ev.clientX - sidebarResizeRef.current.startX;
      const next = Math.max(220, Math.min(600, sidebarResizeRef.current.startWidth + delta));
      setSidebarWidth(next);
    };
    const onUp = () => {
      sidebarResizeRef.current = null;
      setIsResizingSidebar(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Create shape map from pattern colors
  const shapeMap = useMemo(() => {
    if (!pattern) return new Map<string, string>();
    const colorMap = new Map<string, DMCColor>();
    pattern.cells.forEach(row => {
      row.forEach(cell => {
        if (cell.dmcColor && !cell.isEmpty) {
          const key = cell.dmcColor.number;
          if (!colorMap.has(key)) colorMap.set(key, cell.dmcColor);
        }
      });
    });
    return createShapeMap(Array.from(colorMap.values()));
  }, [pattern]);

  // Calculate cell size dynamically to fit pattern on screen
  const calculateCellSize = (width: number, height: number, currentViewMode: 'color' | 'crossstitch' | 'shape' = 'color'): number => {
    if (!displayContainerRef.current || width === 0 || height === 0) {
      return 20; // default fallback
    }

    const container = displayContainerRef.current;
    const containerWidth = container.clientWidth - 40; // account for padding
    const containerHeight = container.clientHeight - 40;

    // Calculate cell size based on both width and height constraints
    const cellSizeByWidth = containerWidth / width;
    const cellSizeByHeight = containerHeight / height;

    // Use the smaller one to ensure the entire pattern fits
    let calculatedSize = Math.floor(Math.min(cellSizeByWidth, cellSizeByHeight));

    // Shape view needs a minimum cell size for readable symbols; cross-stitch X's also benefit from a minimum
    if (currentViewMode === 'shape') {
      calculatedSize = Math.max(12, calculatedSize);
    } else if (currentViewMode === 'crossstitch') {
      calculatedSize = Math.max(6, calculatedSize);
    } else {
      calculatedSize = Math.max(1, calculatedSize); // Ensure at least 1px
    }

    return calculatedSize;
  };

  // Update cell size when pattern or view mode changes
  useEffect(() => {
    if (pattern && displayContainerRef.current) {
      setTimeout(() => {
        const newCellSize = calculateCellSize(pattern.width, pattern.height, viewMode);
        setCellSize(newCellSize);
      }, 0);
    }
  }, [pattern, viewMode]);

  // Update cell size when window resizes
  useEffect(() => {
    const updateCellSize = () => {
      if (pattern && displayContainerRef.current) {
        const newCellSize = calculateCellSize(pattern.width, pattern.height, viewMode);
        setCellSize(newCellSize);
      }
    };

    window.addEventListener('resize', updateCellSize);
    return () => window.removeEventListener('resize', updateCellSize);
  }, [pattern, viewMode]);

  // Handle zoom controls
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.25));
  };

  const handleZoomReset = () => {
    setZoomLevel(1);
  };

  const effectiveCellSize = cellSize * zoomLevel;

  // Recompute aspect ratio and initial stitch dimensions whenever crop changes
  useEffect(() => {
    if (!currentImage) return;
    const img = new Image();
    const url = URL.createObjectURL(currentImage);
    img.onload = () => {
      const rawRatio = img.width / img.height;
      const effectiveRatio = cropRegion
        ? rawRatio * (cropRegion.width / cropRegion.height)
        : rawRatio;
      setImageAspectRatio(effectiveRatio);
      const initialWidth = 50;
      const initialHeight = Math.round(50 / effectiveRatio);
      setPatternWidth(initialWidth);
      setPatternHeight(initialHeight);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [currentImage, cropRegion]);

  // Maintain aspect ratio when width changes
  const handleWidthChange = (width: number) => {
    const clampedWidth = Math.max(10, Math.min(1000, width));
    setPatternWidth(clampedWidth);
    if (imageAspectRatio) {
      const newHeight = Math.round(clampedWidth / imageAspectRatio);
      const clampedHeight = Math.max(10, Math.min(1000, newHeight));
      setPatternHeight(clampedHeight);
    }
  };

  // Maintain aspect ratio when height changes
  const handleHeightChange = (height: number) => {
    const clampedHeight = Math.max(10, Math.min(1000, height));
    setPatternHeight(clampedHeight);
    if (imageAspectRatio) {
      const newWidth = Math.round(clampedHeight * imageAspectRatio);
      const clampedWidth = Math.max(10, Math.min(1000, newWidth));
      setPatternWidth(clampedWidth);
    }
  };

  // Generate pattern when image or dimensions change
  useEffect(() => {
    if (currentImage) {
      // Cancel any ongoing pattern generation
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Create new abort controller for this generation
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;
      
      setIsGenerating(true);
      generatePattern(currentImage, patternWidth, patternHeight, dmcColors, signal, maxColors, cropRegion)
        .then((newPattern) => {
          // Only update if not cancelled
          if (!signal.aborted) {
            setPattern(newPattern);
            setIsGenerating(false);
          }
        })
        .catch((error) => {
          // Don't log cancellation as an error
          if (error.message !== 'Pattern generation cancelled') {
            console.error('Error generating pattern:', error);
          }
          if (!signal.aborted) {
            setIsGenerating(false);
          }
        });
    }
    
    // Cleanup: cancel generation when component unmounts or dependencies change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [currentImage, patternWidth, patternHeight, dmcColors, maxColors, cropRegion]);

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleImageUpload = (file: File) => {
    setCurrentImage(file);
    setCropRegion(null);
    setShowCropScreen(true);
  };

  const handleCropConfirm = (crop: CropRegion) => {
    setCropRegion(crop);
    setShowCropScreen(false);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Cross Stitch Pattern Generator</h1>
        <p>Upload an image to create a custom cross stitch pattern</p>
        <BuyMeACoffee />
      </header>

      <main className="app-main" style={isResizingSidebar ? { userSelect: 'none', cursor: 'col-resize' } : undefined}>
        {currentImage && (
          <div className="app-sidebar no-print" style={isMobile ? undefined : { width: sidebarWidth }}>
            {!isMobile && (
              <div
                className={`sidebar-resize-handle${isResizingSidebar ? ' dragging' : ''}`}
                onMouseDown={handleSidebarResizeStart}
              />
            )}
            <ImageUpload onImageUpload={handleImageUpload} className="sidebar-upload" />

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowCropScreen(true)}
            >
              ✂ Adjust crop
            </Button>

            <Separator className="my-2" />

            <PatternControls
              patternWidth={patternWidth}
              patternHeight={patternHeight}
              maxColors={maxColors}
              clothCount={clothCount}
              onWidthChange={handleWidthChange}
              onHeightChange={handleHeightChange}
              onMaxColorsChange={setMaxColors}
              onClothCountChange={setClothCount}
            />

            {pattern && (
              <>
                {!isMobile && (
                  <>
                    <Separator className="my-2" />

                    {/* View toggle */}
                    <div className="flex flex-col gap-1">
                      <div className="flex gap-2">
                        <Button
                          variant={viewMode === 'color' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => setViewMode('color')}
                        >
                          Color
                        </Button>
                        <Button
                          variant={viewMode === 'crossstitch' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => setViewMode('crossstitch')}
                        >
                          Cross Stitch
                        </Button>
                        <Button
                          variant={viewMode === 'shape' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => setViewMode('shape')}
                        >
                          Symbol
                        </Button>
                      </div>
                    </div>

                    {/* Zoom controls */}
                    <div className="flex items-center gap-2 mt-2 w-full">
                      <span className="text-xs text-muted-foreground flex-shrink-0">Zoom</span>
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0 flex-shrink-0" onClick={handleZoomOut} title="Zoom Out">−</Button>
                      <span className="text-xs font-semibold tabular-nums text-center flex-1">{Math.round(zoomLevel * 100)}%</span>
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0 flex-shrink-0" onClick={handleZoomIn} title="Zoom In">+</Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs px-2 flex-shrink-0" onClick={handleZoomReset}>Reset</Button>
                    </div>
                  </>
                )}

                <Separator className="my-2" />

                {/* Print */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowPrintPreview(true)}
                >
                  🖨 Print Pattern
                </Button>

                <Separator className="my-2" />

                <PatternKey pattern={pattern!} shapeMap={shapeMap} />
              </>
            )}

            <Separator className="my-2" />

            <ColorLibrary
              colors={dmcColors}
              onColorsChange={setDmcColors}
            />
          </div>
        )}

        {/* Compact view/zoom toolbar shown above the pattern on mobile */}
        {isMobile && currentImage && pattern && (
          <div className="mobile-pattern-toolbar no-print">
            <div className="flex flex-1 gap-1.5 min-w-[220px]">
              <Button
                variant={viewMode === 'color' ? 'default' : 'outline'}
                size="sm"
                className="flex-1 h-9 text-xs"
                onClick={() => setViewMode('color')}
              >
                Color
              </Button>
              <Button
                variant={viewMode === 'crossstitch' ? 'default' : 'outline'}
                size="sm"
                className="flex-1 h-9 text-xs"
                onClick={() => setViewMode('crossstitch')}
              >
                Cross Stitch
              </Button>
              <Button
                variant={viewMode === 'shape' ? 'default' : 'outline'}
                size="sm"
                className="flex-1 h-9 text-xs"
                onClick={() => setViewMode('shape')}
              >
                Symbol
              </Button>
            </div>
            <div className="flex flex-1 items-center gap-2 min-w-[180px]">
              <Button variant="outline" size="sm" className="h-9 w-9 p-0 flex-shrink-0" onClick={handleZoomOut} title="Zoom Out">−</Button>
              <span className="text-xs font-semibold tabular-nums text-center flex-1">{Math.round(zoomLevel * 100)}%</span>
              <Button variant="outline" size="sm" className="h-9 w-9 p-0 flex-shrink-0" onClick={handleZoomIn} title="Zoom In">+</Button>
              <Button variant="outline" size="sm" className="h-9 text-xs px-3 flex-shrink-0" onClick={handleZoomReset}>Reset</Button>
            </div>
          </div>
        )}

        <div className={`app-content${zoomLevel > 1 ? ' overflowing' : ''}`} ref={displayContainerRef}>
          {!currentImage ? (
            <ImageUpload onImageUpload={handleImageUpload} />
          ) : isGenerating ? (
            <div className="loading">
              <p>Generating pattern...</p>
              <Button variant="destructive" size="sm" onClick={handleStopGeneration}>
                Stop
              </Button>
            </div>
          ) : (
            <PatternDisplay
              pattern={pattern}
              cellSize={effectiveCellSize}
              viewMode={viewMode}
              shapeMap={shapeMap}
            />
          )}
        </div>
      </main>

      {showCropScreen && currentImage && (
        <CropScreen
          imageFile={currentImage}
          initialCrop={cropRegion}
          onConfirm={handleCropConfirm}
          onCancel={() => setShowCropScreen(false)}
        />
      )}

      {showPrintPreview && pattern && (
        <PrintPreview
          pattern={pattern}
          shapeMap={shapeMap}
          clothCount={clothCount}
          onClose={() => setShowPrintPreview(false)}
        />
      )}
    </div>
  );
}

export default App;
