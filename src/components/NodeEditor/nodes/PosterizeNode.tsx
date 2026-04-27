import { memo, useCallback, useEffect, useRef } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import useUIStore from "@/store/uiStore";
import useExecutionStore from "@/store/executionStore";
import { Slider } from "@/components/ui/slider";
import NodeWrapper from "./NodeWrapper";
import { handleRow } from "./handleStyles";

function PosterizeNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useUIStore((s) => s.updateNodeData);
  const levels = (data.levels as number) ?? 4;
  const mode = (data.mode as string) ?? "rgb";

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
    <NodeWrapper id={id} label="Posterize" selected={selected}>
      {outputImage && (
        <div className="mb-4">
          <canvas ref={canvasRef} className="node-thumbnail-canvas w-full h-full object-contain block" />
        </div>
      )}
      <div className="space-y-4 nopan nodrag">
        <div className="node-control">
          <label className="node-label">Levels: {levels}</label>
          <Slider
            value={[levels]}
            min={2}
            max={16}
            step={1}
            onValueChange={(val) => handleChange("levels", Array.isArray(val) ? val[0] : val)}
          />
        </div>
        <div className="node-control">
          <label className="node-label">Mode</label>
          <div className="flex gap-1">
            {["rgb", "luminance"].map((m) => (
              <button
                key={m}
                onClick={() => handleChange("mode", m)}
                className={`flex-1 text-[11px] py-1 rounded border ${
                  mode === m
                    ? "border-cyan-700 bg-cyan-950/40 text-cyan-300"
                    : "border-zinc-800 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className={leftRow.row()}>
          <Handle type="target" position={Position.Left} id="image:input" className="!left-[-20px]" />
          <span className={leftRow.label()}>image</span>
        </div>
        <div className={rightRow.row()}>
          <span className={rightRow.label()}>image</span>
          <Handle type="source" position={Position.Right} id="image:output" className="!right-[-20px]" />
        </div>
      </div>
    </NodeWrapper>
  );
}

export default memo(PosterizeNode);
