import { memo, useCallback } from "react";
import { Handle, Position, NodeProps, useReactFlow } from "reactflow";
import usePipelineStore from "@/store/pipelineStore";

const BLEND_MODES = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "difference",
  "subtract",
];

function BlendNode({ id, data }: NodeProps) {
  const { setNodes } = useReactFlow();
  const executePipeline = usePipelineStore((s) => s.executePipeline);

  const opacity = data.opacity ?? 50;
  const blendMode = data.blendMode ?? "normal";

  const handleChange = useCallback(
    (key: string, value: string | number) => {
      setNodes((nodes) =>
        nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, [key]: value } } : n
        )
      );
      // trigger pipeline after state update
      setTimeout(() => executePipeline(), 0);
    },
    [id, setNodes, executePipeline]
  );

  return (
    <div className="node-surface">
      <div className="node-header">Blend</div>
      <div className="node-body">
        <div className="node-control">
          <label className="node-label">Mode</label>
          <select
            value={blendMode}
            onChange={(e) => handleChange("blendMode", e.target.value)}
            className="node-select"
          >
            {BLEND_MODES.map((m) => (
              <option key={m} value={m}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className="node-control">
          <label className="node-label">Opacity: {opacity}%</label>
          <input
            type="range"
            min={0}
            max={100}
            value={opacity}
            onChange={(e) => handleChange("opacity", Number(e.target.value))}
            className="node-slider"
          />
        </div>
      </div>
      <Handle
        type="target"
        position={Position.Left}
        id="imageA"
        className="handle-image"
        style={{ top: "40%" }}
      />
      <div className="handle-label" style={{ position: "absolute", left: "-32px", top: "35%", fontSize: "9px", color: "#555" }}>A</div>
      <Handle
        type="target"
        position={Position.Left}
        id="imageB"
        className="handle-image"
        style={{ top: "70%" }}
      />
      <div className="handle-label" style={{ position: "absolute", left: "-32px", top: "65%", fontSize: "9px", color: "#555" }}>B</div>
      <Handle
        type="source"
        position={Position.Right}
        id="image"
        className="handle-image"
      />
    </div>
  );
}

export default memo(BlendNode);
