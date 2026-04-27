import { memo, useCallback, useEffect, useRef } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import useUIStore from "@/store/uiStore";
import useExecutionStore from "@/store/executionStore";
import { Slider } from "@/components/ui/slider";
import NodeWrapper from "./NodeWrapper";
import { handleRow } from "./handleStyles";

function hslHue(hue: number): string {
  return `hsl(${hue}, 100%, 50%)`;
}

function SplitToningNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useUIStore((s) => s.updateNodeData);

  const sHue = (data.shadowsHue as number) ?? 220;
  const sSat = (data.shadowsSaturation as number) ?? 0;
  const hHue = (data.highlightsHue as number) ?? 30;
  const hSat = (data.highlightsSaturation as number) ?? 0;
  const balance = (data.balance as number) ?? 0;

  const change = useCallback(
    (key: string, value: number) => updateNodeData(id, { [key]: value }),
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
    <NodeWrapper id={id} label="Split Toning" selected={selected}>
      {outputImage && (
        <div className="mb-3">
          <canvas ref={thumbRef} className="node-thumbnail-canvas w-full h-full object-contain block" />
        </div>
      )}

      <div className="space-y-4 nopan nodrag">
        {/* Shadows */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">Shadows</span>
            <span
              className="h-3 w-6 rounded border border-zinc-700"
              style={{ background: hslHue(sHue) }}
            />
          </div>
          <div className="node-control">
            <label className="node-label flex items-center justify-between">
              <span>Hue</span>
              <span className="font-mono text-zinc-500">{sHue}°</span>
            </label>
            <Slider
              value={[sHue]} min={0} max={360} step={1}
              onValueChange={(v) => change("shadowsHue", Array.isArray(v) ? v[0] : v)}
            />
          </div>
          <div className="node-control">
            <label className="node-label flex items-center justify-between">
              <span>Saturation</span>
              <span className="font-mono text-zinc-500">{sSat}</span>
            </label>
            <Slider
              value={[sSat]} min={0} max={100} step={1}
              onValueChange={(v) => change("shadowsSaturation", Array.isArray(v) ? v[0] : v)}
            />
          </div>
        </div>

        {/* Highlights */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">Highlights</span>
            <span
              className="h-3 w-6 rounded border border-zinc-700"
              style={{ background: hslHue(hHue) }}
            />
          </div>
          <div className="node-control">
            <label className="node-label flex items-center justify-between">
              <span>Hue</span>
              <span className="font-mono text-zinc-500">{hHue}°</span>
            </label>
            <Slider
              value={[hHue]} min={0} max={360} step={1}
              onValueChange={(v) => change("highlightsHue", Array.isArray(v) ? v[0] : v)}
            />
          </div>
          <div className="node-control">
            <label className="node-label flex items-center justify-between">
              <span>Saturation</span>
              <span className="font-mono text-zinc-500">{hSat}</span>
            </label>
            <Slider
              value={[hSat]} min={0} max={100} step={1}
              onValueChange={(v) => change("highlightsSaturation", Array.isArray(v) ? v[0] : v)}
            />
          </div>
        </div>

        {/* Balance */}
        <div className="node-control">
          <label className="node-label flex items-center justify-between">
            <span>Balance</span>
            <span className="font-mono text-zinc-500">{balance > 0 ? `+${balance}` : balance}</span>
          </label>
          <Slider
            value={[balance]} min={-100} max={100} step={1}
            onValueChange={(v) => change("balance", Array.isArray(v) ? v[0] : v)}
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

export default memo(SplitToningNode);
