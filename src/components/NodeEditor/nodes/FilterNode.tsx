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

function FilterNode({ id, data }: NodeProps) {
  const { setNodes, setEdges } = useReactFlow();
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);

  const filterType = data.filterType ?? "gaussian";
  const strength = data.strength ?? 1;

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
      <div className="node-header">Filter</div>
      <div className="node-body space-y-4">
        <div className="node-control">
          <label className="node-label">Filter Type</label>
          <Select
            value={filterType}
            onValueChange={(val) => handleChange("filterType", val)}
          >
            <SelectTrigger className="w-full bg-zinc-950 border-zinc-800 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
              <SelectItem value="gaussian">Gaussian Blur</SelectItem>
              <SelectItem value="sharpen">Sharpen</SelectItem>
              <SelectItem value="edge detect">Edge Detect</SelectItem>
              <SelectItem value="emboss">Emboss</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="node-control">
          <label className="node-label">Strength: {strength}</label>
          <Slider
            value={[strength]}
            min={0}
            max={20}
            step={1}
            onValueChange={(val) => handleChange("strength", Array.isArray(val) ? val[0] : val)}
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
