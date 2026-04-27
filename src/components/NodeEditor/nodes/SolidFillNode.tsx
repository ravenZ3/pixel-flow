import { memo, useCallback, useEffect, useRef } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import useUIStore from "@/store/uiStore";
import useExecutionStore from "@/store/executionStore";
import { Slider } from "@/components/ui/slider";
import NodeWrapper from "./NodeWrapper";
import { handleRow } from "./handleStyles";

function SolidFillNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useUIStore((s) => s.updateNodeData);

  const color = (data.color as string) ?? "#000080";
  const width = (data.width as number) ?? 512;
  const height = (data.height as number) ?? 512;

  const handleChange = useCallback(
    (key: string, value: unknown) => updateNodeData(id, { [key]: value }),
    [id, updateNodeData]
  );

  const nodeOutputs = useExecutionStore((s) => s.nodeOutputs);
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

  const leftRow = handleRow({ side: "left" });
  const rightRow = handleRow({ side: "right" });

  return (
    <NodeWrapper id={id} label="Solid Fill" selected={selected}>
      {outputImage && (
        <div className="mb-4">
          <canvas ref={canvasRef} className="node-thumbnail-canvas w-full h-full object-contain block" />
        </div>
      )}
      <div className="space-y-4 nopan nodrag">
        <div className="node-control">
          <label className="node-label flex items-center justify-between">
            <span>Color</span>
            <span className="font-mono text-zinc-500">{color}</span>
          </label>
          <input
            type="color"
            value={color}
            onChange={(e) => handleChange("color", e.target.value)}
            className="w-full h-7 rounded cursor-pointer bg-zinc-900 border border-zinc-800"
          />
        </div>
        <div className="node-control">
          <label className="node-label">Width: {width}</label>
          <Slider
            value={[width]}
            min={32}
            max={2048}
            step={1}
            onValueChange={(val) => handleChange("width", Array.isArray(val) ? val[0] : val)}
          />
        </div>
        <div className="node-control">
          <label className="node-label">Height: {height}</label>
          <Slider
            value={[height]}
            min={32}
            max={2048}
            step={1}
            onValueChange={(val) => handleChange("height", Array.isArray(val) ? val[0] : val)}
          />
        </div>
        <div className="text-[10px] text-zinc-600 leading-snug">
          When image:input is connected, output matches its size and width/height are ignored.
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className={leftRow.row()}>
          <Handle type="target" position={Position.Left} id="image:input" className="!left-[-20px]" />
          <span className={leftRow.label()}>image (size only)</span>
        </div>
        <div className={rightRow.row()}>
          <span className={rightRow.label()}>image</span>
          <Handle type="source" position={Position.Right} id="image:output" className="!right-[-20px]" />
        </div>
      </div>
    </NodeWrapper>
  );
}

export default memo(SolidFillNode);
