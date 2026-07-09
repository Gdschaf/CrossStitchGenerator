import { useState, useRef, useCallback, useEffect } from 'react';
import { CropRegion } from '../types';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '../hooks/useIsMobile';

interface CropScreenProps {
  imageFile: File;
  initialCrop: CropRegion | null;
  onConfirm: (crop: CropRegion) => void;
  onCancel: () => void;
}

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move';

const HANDLE_PX_MOUSE = 18;
const HANDLE_PX_TOUCH = 28;
const MIN_CROP = 0.01;

export function CropScreen({ imageFile, initialCrop, onConfirm, onCancel }: CropScreenProps) {
  const [imageUrl, setImageUrl] = useState('');
  const [imageDims, setImageDims] = useState({ w: 0, h: 0 });
  const [displayDims, setDisplayDims] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState<CropRegion>(initialCrop ?? { x: 0, y: 0, width: 1, height: 1 });
  const [isDetecting, setIsDetecting] = useState(false);
  const [isCoarsePointer] = useState(() => window.matchMedia('(pointer: coarse)').matches);
  const isMobile = useIsMobile();
  const handlePx = isCoarsePointer ? HANDLE_PX_TOUCH : HANDLE_PX_MOUSE;
  const containerPad = isMobile ? 12 : 24;

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ handle: Handle; startMouse: { x: number; y: number }; startCrop: CropRegion } | null>(null);

  // Load image URL and natural dimensions
  useEffect(() => {
    const url = URL.createObjectURL(imageFile);
    setImageUrl(url);
    const img = new Image();
    img.onload = () => setImageDims({ w: img.width, h: img.height });
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  // Compute display dimensions to fit within the container
  useEffect(() => {
    if (!imageDims.w) return;
    const compute = () => {
      const el = containerRef.current;
      if (!el) return;
      const maxW = el.clientWidth - containerPad * 2;
      const maxH = el.clientHeight - containerPad * 2;
      const scale = Math.min(maxW / imageDims.w, maxH / imageDims.h);
      setDisplayDims({ w: Math.round(imageDims.w * scale), h: Math.round(imageDims.h * scale) });
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [imageDims, containerPad]);

  const applyDrag = useCallback((clientX: number, clientY: number) => {
    if (!dragRef.current || !displayDims.w) return;
    const { handle, startMouse, startCrop } = dragRef.current;
    const dx = (clientX - startMouse.x) / displayDims.w;
    const dy = (clientY - startMouse.y) / displayDims.h;

    setCrop(() => {
      let { x, y, width, height } = startCrop;
      if (handle === 'move') {
        x = Math.max(0, Math.min(1 - width, x + dx));
        y = Math.max(0, Math.min(1 - height, y + dy));
      } else {
        if (handle.includes('w')) {
          const nx = Math.max(0, Math.min(x + width - MIN_CROP, x + dx));
          width = width + (x - nx); x = nx;
        }
        if (handle.includes('e')) width = Math.max(MIN_CROP, Math.min(1 - x, width + dx));
        if (handle.includes('n')) {
          const ny = Math.max(0, Math.min(y + height - MIN_CROP, y + dy));
          height = height + (y - ny); y = ny;
        }
        if (handle.includes('s')) height = Math.max(MIN_CROP, Math.min(1 - y, height + dy));
      }
      return { x, y, width, height };
    });
  }, [displayDims]);

  const handleMouseMove = useCallback((e: MouseEvent) => applyDrag(e.clientX, e.clientY), [applyDrag]);
  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    if (e.touches[0]) applyDrag(e.touches[0].clientX, e.touches[0].clientY);
  }, [applyDrag]);

  const endDrag = useCallback(() => { dragRef.current = null; }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', endDrag);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', endDrag);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', endDrag);
    };
  }, [handleMouseMove, handleTouchMove, endDrag]);

  const startDrag = (e: React.MouseEvent, handle: Handle) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { handle, startMouse: { x: e.clientX, y: e.clientY }, startCrop: { ...crop } };
  };

  const startDragTouch = (e: React.TouchEvent, handle: Handle) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.touches[0]) {
      dragRef.current = { handle, startMouse: { x: e.touches[0].clientX, y: e.touches[0].clientY }, startCrop: { ...crop } };
    }
  };

  // Auto-detect non-transparent content bounds by scanning a downsampled canvas
  const handleAutoDetect = async () => {
    if (!imageUrl) return;
    setIsDetecting(true);
    try {
      const img = new Image();
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = imageUrl; });
      const SCAN = 400;
      const scale = Math.min(SCAN / img.width, SCAN / img.height, 1);
      const sw = Math.round(img.width * scale);
      const sh = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = sw; canvas.height = sh;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, sw, sh);
      const { data } = ctx.getImageData(0, 0, sw, sh);
      let minX = sw, maxX = 0, minY = sh, maxY = 0, hasContent = false;
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          if (data[(y * sw + x) * 4 + 3] >= 128) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
            hasContent = true;
          }
        }
      }
      if (hasContent) {
        setCrop({
          x: minX / sw, y: minY / sh,
          width: (maxX - minX + 1) / sw,
          height: (maxY - minY + 1) / sh,
        });
      }
    } finally {
      setIsDetecting(false);
    }
  };

  // Crop in display pixels
  const cd = {
    x: crop.x * displayDims.w,
    y: crop.y * displayDims.h,
    w: crop.width * displayDims.w,
    h: crop.height * displayDims.h,
  };

  // Crop in original image pixels (for the info display)
  const cpx = imageDims.w ? {
    x: Math.round(crop.x * imageDims.w),
    y: Math.round(crop.y * imageDims.h),
    w: Math.round(crop.width * imageDims.w),
    h: Math.round(crop.height * imageDims.h),
  } : null;

  const handles: { id: Handle; cursor: string; left: number; top: number }[] = [
    { id: 'nw', cursor: 'nw-resize', left: cd.x - handlePx / 2,                top: cd.y - handlePx / 2 },
    { id: 'n',  cursor: 'n-resize',  left: cd.x + cd.w / 2 - handlePx / 2,     top: cd.y - handlePx / 2 },
    { id: 'ne', cursor: 'ne-resize', left: cd.x + cd.w - handlePx / 2,          top: cd.y - handlePx / 2 },
    { id: 'e',  cursor: 'e-resize',  left: cd.x + cd.w - handlePx / 2,          top: cd.y + cd.h / 2 - handlePx / 2 },
    { id: 'se', cursor: 'se-resize', left: cd.x + cd.w - handlePx / 2,          top: cd.y + cd.h - handlePx / 2 },
    { id: 's',  cursor: 's-resize',  left: cd.x + cd.w / 2 - handlePx / 2,      top: cd.y + cd.h - handlePx / 2 },
    { id: 'sw', cursor: 'sw-resize', left: cd.x - handlePx / 2,                 top: cd.y + cd.h - handlePx / 2 },
    { id: 'w',  cursor: 'w-resize',  left: cd.x - handlePx / 2,                 top: cd.y + cd.h / 2 - handlePx / 2 },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#111', display: 'flex', flexDirection: 'column' }} className="no-print">
      {/* Header */}
      <div style={{ flexShrink: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: isMobile ? '10px 12px' : '12px 20px', background: '#1e1e1e', borderBottom: '1px solid #333' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'white' }}>Crop Image</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            {cpx
              ? `${cpx.w} × ${cpx.h} px · offset (${cpx.x}, ${cpx.y})`
              : 'Drag the handles or use Auto-detect to set the crop region'}
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Button size="sm" variant="outline" onClick={handleAutoDetect} disabled={isDetecting} className="border-gray-500 bg-gray-700 text-gray-100 hover:bg-gray-600 hover:text-white disabled:opacity-50">
            {isDetecting ? 'Detecting…' : 'Auto-detect'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCrop({ x: 0, y: 0, width: 1, height: 1 })} className="border-gray-500 bg-gray-700 text-gray-100 hover:bg-gray-600 hover:text-white">
            Use full image
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel} className="border-gray-500 bg-gray-700 text-gray-100 hover:bg-gray-600 hover:text-white">
            Cancel
          </Button>
          <Button size="sm" onClick={() => onConfirm(crop)}>
            Confirm Crop →
          </Button>
        </div>
      </div>

      {/* Image + crop overlay */}
      <div ref={containerRef} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: containerPad }}>
        {imageUrl && displayDims.w > 0 && (
          <div style={{ position: 'relative', width: displayDims.w, height: displayDims.h, userSelect: 'none' }}>
            <img src={imageUrl} style={{ width: displayDims.w, height: displayDims.h, display: 'block' }} draggable={false} />

            {/* Dark overlay strips outside crop */}
            <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: cd.y, background: 'rgba(0,0,0,0.6)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', left: 0, top: cd.y + cd.h, width: '100%', height: displayDims.h - cd.y - cd.h, background: 'rgba(0,0,0,0.6)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', left: 0, top: cd.y, width: cd.x, height: cd.h, background: 'rgba(0,0,0,0.6)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', left: cd.x + cd.w, top: cd.y, width: displayDims.w - cd.x - cd.w, height: cd.h, background: 'rgba(0,0,0,0.6)', pointerEvents: 'none' }} />

            {/* Crop border + move handle */}
            <div
              style={{ position: 'absolute', left: cd.x, top: cd.y, width: cd.w, height: cd.h, border: '1.5px solid white', boxSizing: 'border-box', cursor: 'move', touchAction: 'none' }}
              onMouseDown={e => startDrag(e, 'move')}
              onTouchStart={e => startDragTouch(e, 'move')}
            >
              {(['33.33%', '66.66%'] as const).map(p => (
                <div key={`v${p}`} style={{ position: 'absolute', left: p, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.25)', pointerEvents: 'none' }} />
              ))}
              {(['33.33%', '66.66%'] as const).map(p => (
                <div key={`h${p}`} style={{ position: 'absolute', top: p, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.25)', pointerEvents: 'none' }} />
              ))}
            </div>

            {/* Resize handles */}
            {handles.map(({ id, cursor, left, top }) => (
              <div
                key={id}
                style={{ position: 'absolute', left, top, width: handlePx, height: handlePx, background: 'white', border: '1.5px solid #333', borderRadius: 3, cursor, zIndex: 10, touchAction: 'none' }}
                onMouseDown={e => startDrag(e, id)}
                onTouchStart={e => startDragTouch(e, id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
