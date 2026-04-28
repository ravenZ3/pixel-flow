"use client";

import { useEffect, useRef, useState } from "react";

function pyramidDownscale(src: ImageBitmap, targetW: number, targetH: number): OffscreenCanvas | ImageBitmap {
  let curW = src.width;
  let curH = src.height;
  if (curW <= targetW * 2 && curH <= targetH * 2) return src;

  let cur: OffscreenCanvas | ImageBitmap = src;
  while (curW > targetW * 2 && curH > targetH * 2) {
    const nextW = Math.max(targetW, Math.floor(curW / 2));
    const nextH = Math.max(targetH, Math.floor(curH / 2));
    const next = new OffscreenCanvas(nextW, nextH);
    const nctx = next.getContext("2d")!;
    nctx.imageSmoothingEnabled = true;
    nctx.imageSmoothingQuality = "high";
    nctx.drawImage(cur, 0, 0, nextW, nextH);
    cur = next;
    curW = nextW;
    curH = nextH;
  }
  return cur;
}

interface FullscreenModalProps {
  imageBitmap: ImageBitmap;
  originalBitmap: ImageBitmap | null;
  maskBitmap: ImageBitmap | null;
  showMask: boolean;
  maskOverlayOpacity: number;
  onClose: () => void;
}

export default function FullscreenModal({
  imageBitmap,
  originalBitmap,
  maskBitmap,
  showMask,
  maskOverlayOpacity,
  onClose,
}: FullscreenModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewOriginal, setViewOriginal] = useState(false);
  const canCompare = !!originalBitmap && originalBitmap !== imageBitmap;
  const displayedBitmap = viewOriginal && originalBitmap ? originalBitmap : imageBitmap;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = window.innerWidth - 80;
      const ch = window.innerHeight - 120;
      const scale = Math.min(cw / displayedBitmap.width, ch / displayedBitmap.height, 1);
      const displayW = Math.max(1, Math.round(displayedBitmap.width * scale));
      const displayH = Math.max(1, Math.round(displayedBitmap.height * scale));
      const targetW = Math.max(1, Math.round(displayW * dpr));
      const targetH = Math.max(1, Math.round(displayH * dpr));

      canvas.width = targetW;
      canvas.height = targetH;
      canvas.style.width = `${displayW}px`;
      canvas.style.height = `${displayH}px`;

      const downscaled = pyramidDownscale(displayedBitmap, targetW, targetH);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.clearRect(0, 0, targetW, targetH);
      ctx.drawImage(downscaled, 0, 0, targetW, targetH);

      if (showMask && maskBitmap) {
        const m = pyramidDownscale(maskBitmap, targetW, targetH);
        const mc = new OffscreenCanvas(targetW, targetH);
        const mctx = mc.getContext("2d")!;
        mctx.drawImage(m, 0, 0, targetW, targetH);
        const mdata = mctx.getImageData(0, 0, targetW, targetH);

        const od = ctx.createImageData(targetW, targetH);
        for (let i = 0; i < mdata.data.length; i += 4) {
          const v = mdata.data[i] / 255;
          od.data[i] = 220;
          od.data[i + 1] = 40;
          od.data[i + 2] = 40;
          od.data[i + 3] = Math.round(v * maskOverlayOpacity * 255);
        }
        const oc = new OffscreenCanvas(targetW, targetH);
        const octx = oc.getContext("2d")!;
        octx.putImageData(od, 0, 0);
        ctx.drawImage(oc, 0, 0);
      }
    };

    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [displayedBitmap, maskBitmap, showMask, maskOverlayOpacity]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="relative bg-[#0a0a0a] border border-zinc-800 rounded-lg shadow-2xl flex flex-col max-w-[95vw] max-h-[95vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-900 surface-glass shrink-0">
          <span className="text-xs font-mono text-zinc-400 tracking-widest uppercase">
            Preview
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-zinc-500">
              {displayedBitmap.width} × {displayedBitmap.height}
            </span>
            {canCompare && (
              <button
                title="Tap to toggle, hold to compare"
                onPointerDown={(e) => {
                  const start = Date.now();
                  const wasShowingOriginal = viewOriginal;
                  setViewOriginal(true);
                  const release = () => {
                    const heldMs = Date.now() - start;
                    if (heldMs > 180) {
                      setViewOriginal(wasShowingOriginal);
                    } else {
                      setViewOriginal(!wasShowingOriginal);
                    }
                    window.removeEventListener("pointerup", release);
                    window.removeEventListener("pointercancel", release);
                  };
                  window.addEventListener("pointerup", release);
                  window.addEventListener("pointercancel", release);
                  e.preventDefault();
                }}
                className={`text-[11px] font-mono px-2 py-1 rounded border transition-all select-none ${
                  viewOriginal
                    ? "border-amber-500/50 bg-amber-950/30 text-amber-300"
                    : "border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:border-zinc-700"
                }`}
              >
                {viewOriginal ? "● original" : "○ original"}
              </button>
            )}
            <button
              onClick={onClose}
              title="Close (Esc)"
              className="p-1 rounded border border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-900 hover:bg-red-950/20 transition-all"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4 overflow-auto dashboard-grid">
          <canvas ref={canvasRef} className="rounded border border-zinc-800 block" />
        </div>
      </div>
    </div>
  );
}
