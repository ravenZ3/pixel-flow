"use client";

import { memo, useRef, useEffect } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import usePipelineStore from "@/store/pipelineStore";

function PreviewNode({ id }: NodeProps) {
  const nodeOutputs = usePipelineStore((s) => s.nodeOutputs);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const output = nodeOutputs[id];
  const image = output?.image as ImageBitmap | null;

  useEffect(() => {
    if (image && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = 160;
        canvas.height = (image.height / image.width) * 160;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      }
    }
  }, [image]);

  return (
    <div className="node-surface">
      <div className="node-header">Preview</div>
      <div className="node-body">
        {image ? (
          <canvas ref={canvasRef} className="node-thumbnail-canvas" />
        ) : (
          <div className="node-placeholder">No image</div>
        )}
      </div>
      <Handle
        type="target"
        position={Position.Left}
        id="image"
        className="handle-image"
      />
    </div>
  );
}

export default memo(PreviewNode);
