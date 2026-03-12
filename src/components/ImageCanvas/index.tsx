"use client";

import { useRef, useEffect } from "react";
import usePipelineStore from "@/store/pipelineStore";
import { Slider } from "@/components/ui/slider";

export default function ImageCanvas() {
  const nodeOutputs = usePipelineStore((s) => s.nodeOutputs);
  const executionTime = usePipelineStore((s) => s.executionTime);
  const showMask = usePipelineStore((s) => s.showMask);
  const maskOverlayOpacity = usePipelineStore((s) => s.maskOverlayOpacity);
  const activePreviewNodeId = usePipelineStore((s) => s.activePreviewNodeId);
  const setShowMask = usePipelineStore((s) => s.setShowMask);
  const setMaskOverlayOpacity = usePipelineStore((s) => s.setMaskOverlayOpacity);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Get both image and mask from the active output node
  const outputData = activePreviewNodeId ? nodeOutputs[activePreviewNodeId] : null;
  const imageBitmap = (outputData?.["image:output"] as ImageBitmap) ?? (outputData?.image as ImageBitmap) ?? null;
  const maskBitmap = (outputData?.["mask:output"] as ImageBitmap) ?? (outputData?.mask as ImageBitmap) ?? null;

  const isMaskConnected = !!maskBitmap;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageBitmap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Step 1 — set canvas resolution
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;

    // Step 2 — draw the base image
    ctx.drawImage(imageBitmap, 0, 0);

    // Step 3 — draw mask overlay if enabled
    if (showMask && maskBitmap) {
      // draw mask into a temp canvas to get pixel data
      const tempCanvas = new OffscreenCanvas(canvas.width, canvas.height);
      const tempCtx = tempCanvas.getContext("2d")!;
      tempCtx.drawImage(maskBitmap, 0, 0, canvas.width, canvas.height);
      const maskData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);

      // create red overlay using mask as alpha
      const overlayData = ctx.createImageData(canvas.width, canvas.height);
      for (let i = 0; i < maskData.data.length; i += 4) {
        const maskValue = maskData.data[i] / 255; // white = 1, black = 0
        overlayData.data[i] = 220; // R
        overlayData.data[i + 1] = 40; // G
        overlayData.data[i + 2] = 40; // B
        overlayData.data[i + 3] = Math.round(maskValue * maskOverlayOpacity * 255);
      }

      // draw overlay on top of image
      const overlayCanvas = new OffscreenCanvas(canvas.width, canvas.height);
      const overlayCtx = overlayCanvas.getContext("2d")!;
      overlayCtx.putImageData(overlayData, 0, 0);
      ctx.drawImage(overlayCanvas, 0, 0);
    }
  }, [imageBitmap, maskBitmap, showMask, maskOverlayOpacity]);

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
      <div className="flex-1 relative overflow-hidden flex items-center justify-center p-4 dashboard-grid">
        {imageBitmap ? (
          <div className="relative group max-w-full max-h-full">
            <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-cyan-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity blur" />
            <canvas
              ref={canvasRef}
              className="relative rounded-lg border border-zinc-800 shadow-2xl max-w-full max-h-full object-contain block"
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
