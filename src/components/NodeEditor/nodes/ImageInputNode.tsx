"use client";

import { memo, useCallback, useRef, useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import usePipelineStore from "@/store/pipelineStore";

function ImageInputNode({ id, data }: NodeProps) {
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const bitmap = await createImageBitmap(file);
        updateNodeData(id, { uploadedImage: bitmap });
      } catch (err) {
        console.error("Failed to create ImageBitmap:", err);
      }
    },
    [id, updateNodeData]
  );

  const uploadedImage = data.uploadedImage as ImageBitmap | undefined;

  useEffect(() => {
    if (uploadedImage && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = 160;
        canvas.height = (uploadedImage.height / uploadedImage.width) * 160;
        ctx.drawImage(uploadedImage, 0, 0, canvas.width, canvas.height);
      }
    }
  }, [uploadedImage]);

  return (
    <div className="node-surface">
      <div className="node-header">Image Input</div>
      <div className="node-body">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleUpload}
          className="hidden"
          id={`file-upload-${id}`}
        />
        <button className="node-btn" onClick={() => fileRef.current?.click()}>
          Upload Image
        </button>
        {uploadedImage && (
          <canvas ref={canvasRef} className="node-thumbnail-canvas" />
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="image"
        className="handle-image"
      />
    </div>
  );
}

export default memo(ImageInputNode);
