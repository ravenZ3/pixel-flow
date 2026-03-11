"use client";

import { memo, useCallback } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import usePipelineStore from "@/store/pipelineStore";

function BrightnessNode({ id, data }: NodeProps) {
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);
  const brightness = (data.brightness as number) ?? 0;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { brightness: Number(e.target.value) });
    },
    [id, updateNodeData]
  );

  return (
    <div className="node-surface">
      <div className="node-header">Brightness</div>
      <div className="node-body">
        <label className="node-label">
          Value: {brightness}
        </label>
        <input
          type="range"
          min={-100}
          max={100}
          value={brightness}
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

export default memo(BrightnessNode);
