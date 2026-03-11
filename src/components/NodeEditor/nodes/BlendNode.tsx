import { memo, useCallback } from "react";
import { Handle, Position, NodeProps, useReactFlow } from "reactflow";
import usePipelineStore from "@/store/pipelineStore";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function BlendNode({ id, data }: NodeProps) {
  const { setNodes, setEdges } = useReactFlow();
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);

  const mode = data.mode ?? "normal";
  const opacity = data.opacity ?? 1.0;

  const handleChange = useCallback(
    (key: string, value: string | number) => {
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
      <div className="node-header">Blend</div>
      <div className="node-body space-y-4">
        <div className="node-control">
          <label className="node-label">Blend Mode</label>
          <Select
            value={mode}
            onValueChange={(val) => handleChange("mode", val)}
          >
            <SelectTrigger className="w-full bg-zinc-950 border-zinc-800 text-xs text-zinc-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="multiply">Multiply</SelectItem>
              <SelectItem value="screen">Screen</SelectItem>
              <SelectItem value="overlay">Overlay</SelectItem>
              <SelectItem value="darken">Darken</SelectItem>
              <SelectItem value="lighten">Lighten</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="node-control">
          <label className="node-label">Opacity: {(opacity * 100).toFixed(0)}%</label>
          <Slider
            value={[opacity]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={(val) => handleChange("opacity", Array.isArray(val) ? val[0] : val)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2 mt-2">
        <div className="flex items-center justify-between relative h-6">
          <Handle
            type="target"
            position={Position.Left}
            id="base"
            className="handle-image !left-[-12px]"
          />
          <span className="text-[10px] text-zinc-500 ml-2">Base</span>
        </div>
        <div className="flex items-center justify-between relative h-6">
          <Handle
            type="target"
            position={Position.Left}
            id="blend"
            className="handle-image !left-[-12px]"
          />
          <span className="text-[10px] text-zinc-500 ml-2">Blend</span>
        </div>
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

export default memo(BlendNode);
