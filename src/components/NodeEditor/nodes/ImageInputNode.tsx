"use client";

import { memo, useCallback, useRef, useEffect } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import usePipelineStore from "@/store/pipelineStore";
import NodeWrapper from "./NodeWrapper";

import { handleRow } from "./handleStyles";

function ImageInputNode({ id, data, selected }: NodeProps) {
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
        // Thumbnail resolution (scaled down for node UI)
        const thumbWidth = 160;
        canvas.width = thumbWidth;
        canvas.height = (uploadedImage.height / uploadedImage.width) * thumbWidth;
        ctx.drawImage(uploadedImage, 0, 0, canvas.width, canvas.height);
      }
    }
  }, [uploadedImage]);

  const rightRow = handleRow({ side: "right" });

  return (
    <NodeWrapper id={id} label="Image Input" selected={selected}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
        id={`file-upload-${id}`}
      />
      <button className="node-btn w-full mb-4" onClick={() => fileRef.current?.click()}>
        Upload Image
      </button>
      {uploadedImage && (
        <div className="mb-4">
          <canvas
            ref={canvasRef}
            className="node-thumbnail-canvas w-full h-full object-contain block"
          />
        </div>
      )}
      
      <div className="mt-4">
        <div className={rightRow.row()}>
          <span className={rightRow.label()}>image</span>
          <Handle
            type="source"
            position={Position.Right}
            id="image:output"
            className="!right-[-20px]"
          />
        </div>
      </div>
    </NodeWrapper>
  );
}


export default memo(ImageInputNode);

