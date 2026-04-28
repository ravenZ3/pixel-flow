"use client";

import { useEffect, useRef, memo } from "react";

interface NodePreviewProps {
  image: ImageBitmap | undefined;
  visible?: boolean;
  thumbWidth?: number;
}

function NodePreview({ image, visible = true, thumbWidth = 160 }: NodePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (visible && image && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = thumbWidth;
        canvas.height = (image.height / image.width) * thumbWidth;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      }
    }
  }, [image, visible]);

  if (!visible || !image) return null;

  return (
    <div className="mb-4">
      <canvas
        ref={canvasRef}
        className="node-thumbnail-canvas w-full h-full object-contain block border border-zinc-800 rounded bg-zinc-950"
      />
    </div>
  );
}

export default memo(NodePreview);
