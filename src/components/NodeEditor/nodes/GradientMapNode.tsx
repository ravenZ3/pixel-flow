import { memo, useCallback } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import useUIStore from "@/store/uiStore";
import useExecutionStore from "@/store/executionStore";
import NodeWrapper from "./NodeWrapper";
import { handleRow } from "./handleStyles";
import NodePreview from "./NodePreview";

function GradientMapNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useUIStore((s) => s.updateNodeData);

  const colorLow = (data.colorLow as string) ?? "#000080";
  const colorHigh = (data.colorHigh as string) ?? "#ffffff";

  const handleChange = useCallback(
    (key: string, value: unknown) => updateNodeData(id, { [key]: value }),
    [id, updateNodeData]
  );

  const nodeOutputs = useExecutionStore((s) => s.nodeOutputs);
  const outputImage = nodeOutputs[id]?.["image:output"] as ImageBitmap | undefined;

  const leftRow = handleRow({ side: "left" });
  const rightRow = handleRow({ side: "right" });

  return (
    <NodeWrapper id={id} label="Gradient Map" selected={selected}>
      <NodePreview image={outputImage} visible={selected} />
      <div className="space-y-3 nopan nodrag">
        <div className="node-control">
          <label className="node-label flex items-center justify-between">
            <span>Black →</span>
            <span className="font-mono text-zinc-500">{colorLow}</span>
          </label>
          <input
            type="color"
            value={colorLow}
            onChange={(e) => handleChange("colorLow", e.target.value)}
            className="w-full h-7 rounded cursor-pointer bg-zinc-900 border border-zinc-800"
          />
        </div>
        <div className="node-control">
          <label className="node-label flex items-center justify-between">
            <span>White →</span>
            <span className="font-mono text-zinc-500">{colorHigh}</span>
          </label>
          <input
            type="color"
            value={colorHigh}
            onChange={(e) => handleChange("colorHigh", e.target.value)}
            className="w-full h-7 rounded cursor-pointer bg-zinc-900 border border-zinc-800"
          />
        </div>
        <div
          className="h-3 w-full rounded"
          style={{ background: `linear-gradient(to right, ${colorLow}, ${colorHigh})` }}
        />
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

export default memo(GradientMapNode);
