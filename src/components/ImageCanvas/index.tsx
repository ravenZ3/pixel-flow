"use client";

import { useRef, useEffect, useState } from "react";
import useUIStore from "@/store/uiStore";
import useExecutionStore from "@/store/executionStore";
import { Slider } from "@/components/ui/slider";

// Halve the source repeatedly until it's within 2x of the target, then return the
// final canvas. Each halving uses a smooth bilinear average which acts as a low-pass
// filter — this is what prevents moire/rainbow bands when downscaling dense content.
function pyramidDownscale(src: ImageBitmap, targetW: number, targetH: number): OffscreenCanvas | ImageBitmap {
  let curW = src.width;
  let curH = src.height;
  // If we're already close to target (or upscaling), no pyramid needed.
  if (curW <= targetW * 2 && curH <= targetH * 2) {
    return src;
  }

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

export default function ImageCanvas() {
  const nodeOutputs = useExecutionStore((s) => s.nodeOutputs);
  const executionTime = useExecutionStore((s) => s.executionTime);
  const showMask = useUIStore((s) => s.showMask);
  const maskOverlayOpacity = useUIStore((s) => s.maskOverlayOpacity);
  const activePreviewNodeId = useUIStore((s) => s.activePreviewNodeId);
  const setShowMask = useUIStore((s) => s.setShowMask);
  const setMaskOverlayOpacity = useUIStore((s) => s.setMaskOverlayOpacity);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // Get both image and mask from the active output node
  const outputData = activePreviewNodeId ? nodeOutputs[activePreviewNodeId] : null;
  const imageBitmap = (outputData?.["image:output"] as ImageBitmap) ?? (outputData?.image as ImageBitmap) ?? null;
  const maskBitmap = (outputData?.["mask:output"] as ImageBitmap) ?? (outputData?.mask as ImageBitmap) ?? null;

  const isMaskConnected = !!maskBitmap;

  // Track container size so we can render the canvas at display resolution (avoids browser's
  // low-quality bilinear downscale that turns high-frequency content like ASCII into moire stripes).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setContainerSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageBitmap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Compute display size that fits the container while preserving aspect ratio.
    // Account for devicePixelRatio so retina screens stay crisp.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.max(1, containerSize.w);
    const ch = Math.max(1, containerSize.h);
    const scale = Math.min(cw / imageBitmap.width, ch / imageBitmap.height, 1);
    const displayW = Math.max(1, Math.round(imageBitmap.width * scale));
    const displayH = Math.max(1, Math.round(imageBitmap.height * scale));
    const targetW = Math.max(1, Math.round(displayW * dpr));
    const targetH = Math.max(1, Math.round(displayH * dpr));

    canvas.width = targetW;
    canvas.height = targetH;
    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;

    // Pyramid downscale: halve the source repeatedly until within 2x of the target,
    // then a final smooth draw. This is what proper image viewers (Photoshop) do
    // and avoids the rainbow-band aliasing bilinear gives on dense content.
    const downscaled = pyramidDownscale(imageBitmap, targetW, targetH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, targetW, targetH);
    ctx.drawImage(downscaled, 0, 0, targetW, targetH);

    // Mask overlay (drawn at display res, also benefits from the smoother downscale)
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
  }, [imageBitmap, maskBitmap, showMask, maskOverlayOpacity, containerSize]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0a0a0a]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-900 shrink-0 surface-glass">
        <span className="text-xs font-mono text-zinc-400 tracking-widest uppercase">
          Output Preview
        </span>
        {executionTime !== null && (
          <div className="px-2 py-0.5 rounded-full bg-cyan-950/20 border border-cyan-900/50">
            <span className="text-[10px] font-mono text-cyan-400">
              {executionTime.toFixed(1)}ms
            </span>
          </div>
        )}
      </div>

      {/* Canvas area — fills remaining space */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden flex items-center justify-center p-4 dashboard-grid">
        {imageBitmap ? (
          <div className="relative group">
            <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-cyan-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity blur" />
            <canvas
              ref={canvasRef}
              className="relative rounded-lg border border-zinc-800 shadow-2xl block"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-zinc-700">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span className="text-xs font-mono uppercase tracking-widest">
              No Output
            </span>
          </div>
        )}
      </div>

      {/* Metadata + controls */}
      <div className="shrink-0 px-3 py-3 border-t border-zinc-900 surface-glass space-y-3">
        {imageBitmap && (
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-tight">
            Resolution: {imageBitmap.width} × {imageBitmap.height}
          </p>
        )}

        {isMaskConnected && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMask(!showMask)}
                className={`text-xs font-mono px-2 py-1 rounded border transition-all ${
                  showMask
                    ? "border-red-500/50 bg-red-950/20 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                    : "border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900"
                }`}
              >
                {showMask ? "● mask on" : "○ mask off"}
              </button>

              {showMask && (
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest shrink-0">
                    Opacity
                  </span>
                  <Slider
                    value={[maskOverlayOpacity * 100]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={(val) =>
                      setMaskOverlayOpacity((Array.isArray(val) ? val[0] : val) / 100)
                    }
                    className="flex-1"
                  />
                  <span className="text-[10px] text-cyan-400 font-mono w-8 text-right shrink-0">
                    {Math.round(maskOverlayOpacity * 100)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
