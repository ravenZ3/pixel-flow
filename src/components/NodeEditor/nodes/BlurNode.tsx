"use client";

import { memo, useCallback } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import usePipelineStore from "@/store/pipelineStore";

function BlurNode({ id, data }: NodeProps) {
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);
  const radius = (data.radius as number) ?? 5;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { radius: Number(e.target.value) });
    },
    [id, updateNodeData]
  );

  return (
    <div className="node-surface">
      <div className="node-header">Blur</div>
      <div className="node-body">
        <label className="node-label">
          Radius: {radius}
        </label>
        <input
          type="range"
          min={0}
          max={20}
          value={radius}
          onChange={handleChange}
          className="node-slider"
        />
      </div>
      <Handle
        type="target"
        position={Position.Left}
        id="image"
        className="handle-image"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="image"
        className="handle-image"
      />
    </div>
  );
}

export default memo(BlurNode);
