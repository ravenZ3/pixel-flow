"use client";

import { useEffect, useRef } from "react";
import usePipelineStore from "@/store/pipelineStore";

export default function ImageCanvas() {
  const nodes = usePipelineStore((s) => s.nodes);
  const nodeOutputs = usePipelineStore((s) => s.nodeOutputs);
  const executionTime = usePipelineStore((s) => s.executionTime);
  const showMask = usePipelineStore((s) => s.showMask);
  const setShowMask = usePipelineStore((s) => s.setShowMask);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Find the last Preview node in the graph
  const previewNodes = nodes.filter((n) => n.type === "Preview");
  const lastPreview = previewNodes[previewNodes.length - 1];
  const previewOutput = lastPreview ? nodeOutputs[lastPreview.id] : null;
  const image = previewOutput?.image as ImageBitmap | null;

  // Find the last Mask node to overlay if requested
  const maskNodes = nodes.filter((n) => n.type === "Mask");
  const lastMask = maskNodes[maskNodes.length - 1];
  const maskOutput = lastMask ? nodeOutputs[lastMask.id] : null;
  const mask = maskOutput?.mask as ImageBitmap | null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set internal resolution to match bitmap
    canvas.width = image.width;
    canvas.height = image.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);

    if (showMask && mask) {
      ctx.globalAlpha = 0.5;
      // Draw mask overlay
      const tempCanvas = new OffscreenCanvas(mask.width, mask.height);
      const tCtx = tempCanvas.getContext("2d")!;
      tCtx.drawImage(mask, 0, 0);
      const id = tCtx.getImageData(0, 0, mask.width, mask.height);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] > 128) {
          d[i] = 255;
          d[i + 1] = 0;
          d[i + 2] = 0;
          d[i + 3] = 255;
        } else {
          d[i + 3] = 0;
        }
      }
      tCtx.putImageData(id, 0, 0);
      ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1.0;
    }
  }, [image, mask, showMask]);

  return (
    <aside className="preview-panel">
      <div className="preview-title">Output Preview</div>
      <div className="preview-container">
        {image ? (
          <div className="preview-content-stack">
            <div className="preview-image-wrapper">
              <canvas 
                ref={canvasRef} 
                className="preview-canvas w-full h-full object-contain block" 
              />
            </div>
            <div className="preview-stats">
              <div className="preview-stat">
                <span className="stat-label">Dimensions:</span>
                <span className="stat-value">{image.width} × {image.height}</span>
              </div>
              <div className="preview-stat">
                <span className="stat-label">Performance:</span>
                <span className="stat-value">
                  {executionTime ? `Executed in ${executionTime.toFixed(2)}ms` : "---"}
                </span>
              </div>
              <div className="preview-toggle-container">
                <label className="preview-toggle-label">
                  <input
                    type="checkbox"
                    checked={showMask}
                    onChange={(e) => setShowMask(e.target.checked)}
                    className="preview-checkbox"
                  />
                  Show Mask Overlay
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div className="preview-placeholder">
            <div className="preview-placeholder-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
            <span className="preview-placeholder-text">No output</span>
          </div>
        )}
      </div>
    </aside>
  );
}
