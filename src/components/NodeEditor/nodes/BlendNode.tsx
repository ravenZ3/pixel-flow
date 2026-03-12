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

function BlendNode({ id, data, selected }: NodeProps) {
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);

  const mode = data.mode ?? "normal";
  const opacity = data.opacity ?? 1.0;

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
    <NodeWrapper id={id} label="Blend" selected={selected}>
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
      <div className="flex flex-col gap-2 mt-4">
        <div className={leftRow.row()}>
          <Handle
            type="target"
            position={Position.Left}
            id="imageA:input"
            className="!left-[-20px]"
          />
          <span className={leftRow.label()}>image A</span>
        </div>
        <div className={leftRow.row()}>
          <Handle
            type="target"
            position={Position.Left}
            id="imageB:input"
            className="!left-[-20px]"
          />
          <span className={leftRow.label()}>image B</span>
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

export default memo(BlendNode);
