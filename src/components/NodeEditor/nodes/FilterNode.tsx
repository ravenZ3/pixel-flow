import { memo, useCallback, useEffect, useRef } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import usePipelineStore from "@/store/pipelineStore";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import NodeWrapper from "./NodeWrapper";
import { handleRow } from "./handleStyles";

function FilterNode({ id, data, selected }: NodeProps) {
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);

  const filterType = data.filterType ?? "gaussian";
  const strength = data.strength ?? 1;

  const handleChange = useCallback(
    (key: string, value: string | number) => {
      updateNodeData(id, { [key]: value });
    },
    [id, updateNodeData]
  );

  const nodeOutputs = usePipelineStore((s) => s.nodeOutputs);
  const outputImage = nodeOutputs[id]?.["image:output"] as ImageBitmap | undefined;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (outputImage && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const thumbWidth = 160;
        canvas.width = thumbWidth;
        canvas.height = (outputImage.height / outputImage.width) * thumbWidth;
        ctx.drawImage(outputImage, 0, 0, canvas.width, canvas.height);
      }
    }
  }, [outputImage]);

  const leftRow = handleRow({ side: 'left' });
  const rightRow = handleRow({ side: 'right' });

  return (
    <NodeWrapper id={id} label="Filter" selected={selected}>
      {outputImage && (
        <div className="mb-4">
          <canvas
            ref={canvasRef}
            className="node-thumbnail-canvas w-full h-full object-contain block"
          />
        </div>
      )}
      <div className="space-y-4 nodrag nopan">
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

      <div className="mt-4 space-y-2">
        <div className={leftRow.row()}>
          <Handle
            type="target"
            position={Position.Left}
            id="image:input"
            className="!left-[-20px]"
          />
          <span className={leftRow.label()}>image</span>
        </div>
        <div className={rightRow.row()}>
          <span className={rightRow.label()}>image</span>
          <Handle
            type="source"
            position={Position.Right}
            id="image:output"
            className="!right-[-20px]"
          />
        </div>
      </div>
    </NodeWrapper>
  );
}

export default memo(FilterNode);
