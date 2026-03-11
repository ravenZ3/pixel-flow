import { memo, useCallback } from "react";
import { Handle, Position, NodeProps, useReactFlow } from "reactflow";
import usePipelineStore from "@/store/pipelineStore";

function ColorNode({ id, data }: NodeProps) {
  const { setNodes } = useReactFlow();
  const executePipeline = usePipelineStore((s) => s.executePipeline);

  const brightness = data.brightness ?? 0;
  const contrast = data.contrast ?? 0;
  const saturation = data.saturation ?? 0;
  const hue = data.hue ?? 0;
  const gamma = data.gamma ?? 1.0;

  const handleChange = useCallback(
    (key: string, value: number) => {
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
      <div className="node-header">Color</div>
      <div className="node-body">
        <div className="node-control">
          <label className="node-label">Brightness: {brightness}</label>
          <input
            type="range"
            min={-100}
            max={100}
            value={brightness}
            onChange={(e) => handleChange("brightness", Number(e.target.value))}
            className="node-slider"
          />
        </div>
        <div className="node-control">
          <label className="node-label">Contrast: {contrast}</label>
          <input
            type="range"
            min={-100}
            max={100}
            value={contrast}
            onChange={(e) => handleChange("contrast", Number(e.target.value))}
            className="node-slider"
          />
        </div>
        <div className="node-control">
          <label className="node-label">Saturation: {saturation}</label>
          <input
            type="range"
            min={-100}
            max={100}
            value={saturation}
            onChange={(e) => handleChange("saturation", Number(e.target.value))}
            className="node-slider"
          />
        </div>
        <div className="node-control">
          <label className="node-label">Hue: {hue}</label>
          <input
            type="range"
            min={-180}
            max={180}
            value={hue}
            onChange={(e) => handleChange("hue", Number(e.target.value))}
            className="node-slider"
          />
        </div>
        <div className="node-control">
          <label className="node-label">Gamma: {gamma}</label>
          <input
            type="range"
            min={0.1}
            max={3.0}
            step={0.1}
            value={gamma}
            onChange={(e) => handleChange("gamma", Number(e.target.value))}
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

export default memo(ColorNode);
