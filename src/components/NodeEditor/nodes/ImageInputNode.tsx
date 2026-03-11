"use client";

import { memo, useCallback, useRef } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import usePipelineStore from "@/store/pipelineStore";

function ImageInputNode({ id, data }: NodeProps) {
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        updateNodeData(id, { uploadedImage: base64 });
      };
      reader.readAsDataURL(file);
    },
    [id, updateNodeData]
  );

  const uploadedImage = data.uploadedImage as string | undefined;

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
        <button
          className="node-btn"
          onClick={() => fileRef.current?.click()}
        >
          Upload Image
        </button>
        {uploadedImage && (
          <img
            src={uploadedImage}
            alt="Uploaded preview"
            className="node-thumbnail"
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
