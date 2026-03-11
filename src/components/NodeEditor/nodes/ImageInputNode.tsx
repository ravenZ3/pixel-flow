"use client";

import { memo, useCallback, useRef, useState, useEffect } from "react";
import { Handle, Position, NodeProps, useReactFlow } from "reactflow";
import usePipelineStore from "@/store/pipelineStore";

function ImageInputNode({ id, data }: NodeProps) {
  const { setNodes, setEdges } = useReactFlow();
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

  const deleteNode = useCallback(() => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  }, [id, setNodes, setEdges]);

  const uploadedImage = data.uploadedImage as ImageBitmap | undefined;

  useEffect(() => {
    if (uploadedImage && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Thumbnail resolution (scaled down for node UI)
        const thumbWidth = 160;
        canvas.width = thumbWidth;
        canvas.height = (uploadedImage.height / uploadedImage.width) * thumbWidth;
        ctx.drawImage(uploadedImage, 0, 0, canvas.width, canvas.height);
      }
    }
  }, [uploadedImage]);

  return (
    <div className="node-surface relative group">
      <button
        onClick={deleteNode}
        className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center
                   text-zinc-600 hover:text-red-400 text-xs rounded
                   opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        ×
      </button>
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
          <canvas
            ref={canvasRef}
            className="node-thumbnail-canvas w-full h-full object-contain block"
          />
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
