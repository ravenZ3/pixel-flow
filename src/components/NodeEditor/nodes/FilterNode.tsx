"use client";

import { memo, useCallback } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import usePipelineStore from "@/store/pipelineStore";

const FILTER_TYPES = ["gaussian", "sharpen", "edge detect", "emboss"];

function FilterNode({ id, data }: NodeProps) {
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);

  const filterType = data.filterType ?? "gaussian";
  const strength = data.strength ?? 1;

  const handleTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { filterType: e.target.value });
    },
    [id, updateNodeData]
  );

  const handleStrengthChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { strength: Number(e.target.value) });
    },
    [id, updateNodeData]
  );

  return (
    <div className="node-surface">
      <div className="node-header">Filter</div>
      <div className="node-body">
        <div className="node-control">
          <label className="node-label">Type</label>
          <select
            value={filterType}
            onChange={handleTypeChange}
            className="node-select"
          >
            {FILTER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className="node-control">
          <label className="node-label">Strength: {strength}</label>
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={strength}
            onChange={handleStrengthChange}
            className="node-slider"
          />
        </div>
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

export default memo(FilterNode);
