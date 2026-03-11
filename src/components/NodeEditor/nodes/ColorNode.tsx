import { memo, useCallback } from "react";
import { Handle, Position, NodeProps, useReactFlow } from "reactflow";
import usePipelineStore from "@/store/pipelineStore";
import { Slider } from "@/components/ui/slider";

function ColorNode({ id, data }: NodeProps) {
  const { setNodes, setEdges } = useReactFlow();
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);
  const executePipeline = usePipelineStore((s) => s.executePipeline);

  const brightness = data.brightness ?? 0;
  const contrast = data.contrast ?? 0;
  const saturation = data.saturation ?? 0;
  const hue = data.hue ?? 0;
  const gamma = data.gamma ?? 1.0;

  const handleChange = useCallback(
    (key: string, value: number) => {
      updateNodeData(id, { [key]: value });
    },
    [id, updateNodeData]
  );

  const deleteNode = useCallback(() => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  }, [id, setNodes, setEdges]);

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
      <div className="node-header">Color</div>
      <div className="node-body space-y-4">
        <div className="node-control">
          <label className="node-label">Brightness: {brightness}</label>
          <Slider
            value={[brightness]}
            min={-100}
            max={100}
            step={1}
            onValueChange={(val) => handleChange("brightness", Array.isArray(val) ? val[0] : val)}
          />
        </div>
        <div className="node-control">
          <label className="node-label">Contrast: {contrast}</label>
          <Slider
            value={[contrast]}
            min={-100}
            max={100}
            step={1}
            onValueChange={(val) => handleChange("contrast", Array.isArray(val) ? val[0] : val)}
          />
        </div>
        <div className="node-control">
          <label className="node-label">Saturation: {saturation}</label>
          <Slider
            value={[saturation]}
            min={-100}
            max={100}
            step={1}
            onValueChange={(val) => handleChange("saturation", Array.isArray(val) ? val[0] : val)}
          />
        </div>
        <div className="node-control">
          <label className="node-label">Hue: {hue}</label>
          <Slider
            value={[hue]}
            min={-180}
            max={180}
            step={1}
            onValueChange={(val) => handleChange("hue", Array.isArray(val) ? val[0] : val)}
          />
        </div>
        <div className="node-control">
          <label className="node-label">Gamma: {gamma}</label>
          <Slider
            value={[gamma]}
            min={0.1}
            max={3.0}
            step={0.1}
            onValueChange={(val) => handleChange("gamma", Array.isArray(val) ? val[0] : val)}
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
