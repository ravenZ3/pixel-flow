"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import usePipelineStore from "@/store/pipelineStore";

function PreviewNode({ id }: NodeProps) {
  const nodeOutputs = usePipelineStore((s) => s.nodeOutputs);
  const output = nodeOutputs[id];
  const image = output?.image ?? null;

  return (
    <div className="node-surface">
      <div className="node-header">Preview</div>
      <div className="node-body">
        {image ? (
          <img
            src={image}
            alt="Preview output"
            className="node-thumbnail"
          />
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
