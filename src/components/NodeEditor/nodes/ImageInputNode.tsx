"use client";

import { memo, useCallback, useRef, useEffect } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import useUIStore from "@/store/uiStore";
import { calculateImageStats } from "@/lib/imageAnalysis";
import NodePreview from "./NodePreview";
import { handleRow } from "./handleStyles";
import NodeWrapper from "./NodeWrapper";

function ImageInputNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useUIStore((s) => s.updateNodeData);
  const setImageStats = useUIStore((s) => s.setImageStats);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const bitmap = await createImageBitmap(file);
        updateNodeData(id, { uploadedImage: bitmap });
        
        // Analyze image and store stats
        const stats = await calculateImageStats(bitmap);
        setImageStats(stats);
      } catch (err) {
        console.error("Failed to process image:", err);
      }
    },
    [id, updateNodeData, setImageStats]
  );

  const uploadedImage = data.uploadedImage as ImageBitmap | undefined;

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
      
      <NodePreview image={uploadedImage} visible={true} />
      
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

