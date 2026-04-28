import { memo, useCallback } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import useUIStore from "@/store/uiStore";
import useExecutionStore from "@/store/executionStore";
import { Slider } from "@/components/ui/slider";
import NodeWrapper from "./NodeWrapper";
import { handleRow } from "./handleStyles";
import NodePreview from "./NodePreview";

function HalationNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useUIStore((s) => s.updateNodeData);
  const threshold = (data.threshold as number) ?? 200;
  const radius = (data.radius as number) ?? 10;
  const intensity = (data.intensity as number) ?? 50;

  const change = useCallback(
    (key: string, value: number) => updateNodeData(id, { [key]: value }),
    [id, updateNodeData]
  );

  const nodeOutputs = useExecutionStore((s) => s.nodeOutputs);
  const outputImage = nodeOutputs[id]?.["image:output"] as ImageBitmap | undefined;

  const leftRow = handleRow({ side: "left" });
  const rightRow = handleRow({ side: "right" });

  return (
    <NodeWrapper id={id} label="Halation" selected={selected}>
      <NodePreview image={outputImage} visible={selected} />
      <div className="space-y-3 nopan nodrag">
        <div className="node-control">
          <label className="node-label flex items-center justify-between">
            <span>Threshold</span>
            <span className="font-mono text-zinc-500">{threshold}</span>
          </label>
          <Slider
            value={[threshold]} min={0} max={255} step={1}
            onValueChange={(v) => change("threshold", Array.isArray(v) ? v[0] : v)}
          />
        </div>
        <div className="node-control">
          <label className="node-label flex items-center justify-between">
            <span>Radius</span>
            <span className="font-mono text-zinc-500">{radius}</span>
          </label>
          <Slider
            value={[radius]} min={0} max={50} step={1}
            onValueChange={(v) => change("radius", Array.isArray(v) ? v[0] : v)}
          />
        </div>
        <div className="node-control">
          <label className="node-label flex items-center justify-between">
            <span>Intensity</span>
            <span className="font-mono text-zinc-500">{intensity}%</span>
          </label>
          <Slider
            value={[intensity]} min={0} max={100} step={1}
            onValueChange={(v) => change("intensity", Array.isArray(v) ? v[0] : v)}
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

export default memo(HalationNode);
