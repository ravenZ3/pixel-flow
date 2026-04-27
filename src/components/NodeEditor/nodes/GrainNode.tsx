import { memo, useCallback, useEffect, useRef } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import useUIStore from "@/store/uiStore";
import useExecutionStore from "@/store/executionStore";
import { Slider } from "@/components/ui/slider";
import NodeWrapper from "./NodeWrapper";
import { handleRow } from "./handleStyles";

function GrainNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useUIStore((s) => s.updateNodeData);
  const amount = (data.amount as number) ?? 30;
  const mono = (data.mono as boolean) ?? true;
  const seed = (data.seed as number) ?? 1;

  const change = useCallback(
    (key: string, value: unknown) => updateNodeData(id, { [key]: value }),
    [id, updateNodeData]
  );

  const nodeOutputs = useExecutionStore((s) => s.nodeOutputs);
  const outputImage = nodeOutputs[id]?.["image:output"] as ImageBitmap | undefined;
  const thumbRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (outputImage && thumbRef.current) {
      const c = thumbRef.current;
      const ctx = c.getContext("2d");
      if (ctx) {
        const w = 160;
        c.width = w;
        c.height = (outputImage.height / outputImage.width) * w;
        ctx.drawImage(outputImage, 0, 0, c.width, c.height);
      }
    }
  }, [outputImage]);

  const leftRow = handleRow({ side: "left" });
  const rightRow = handleRow({ side: "right" });

  return (
    <NodeWrapper id={id} label="Grain" selected={selected}>
      {outputImage && (
        <div className="mb-3">
          <canvas ref={thumbRef} className="node-thumbnail-canvas w-full h-full object-contain block" />
        </div>
      )}
      <div className="space-y-3 nopan nodrag">
        <div className="node-control">
          <label className="node-label flex items-center justify-between">
            <span>Amount</span>
            <span className="font-mono text-zinc-500">{amount}</span>
          </label>
          <Slider
            value={[amount]} min={0} max={100} step={1}
            onValueChange={(v) => change("amount", Array.isArray(v) ? v[0] : v)}
          />
        </div>
        <div className="node-control">
          <label className="node-label">Mode</label>
          <div className="flex gap-1">
            {[
              { v: true, l: "Mono (film)" },
              { v: false, l: "Color (digital)" },
            ].map((opt) => (
              <button
                key={String(opt.v)}
                onClick={() => change("mono", opt.v)}
                className={`flex-1 text-[11px] py-1 rounded border ${
                  mono === opt.v
                    ? "border-cyan-700 bg-cyan-950/40 text-cyan-300"
                    : "border-zinc-800 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {opt.l}
              </button>
            ))}
          </div>
        </div>
        <div className="node-control">
          <label className="node-label flex items-center justify-between">
            <span>Seed</span>
            <span className="font-mono text-zinc-500">{seed}</span>
          </label>
          <Slider
            value={[seed]} min={1} max={9999} step={1}
            onValueChange={(v) => change("seed", Array.isArray(v) ? v[0] : v)}
          />
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

export default memo(GrainNode);
