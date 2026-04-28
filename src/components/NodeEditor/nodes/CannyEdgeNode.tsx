import { memo, useCallback } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import useUIStore from "@/store/uiStore";
import useExecutionStore from "@/store/executionStore";
import { Slider } from "@/components/ui/slider";
import NodeWrapper from "./NodeWrapper";
import { handleRow } from "./handleStyles";
import NodePreview from "./NodePreview";

function CannyEdgeNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useUIStore((s) => s.updateNodeData);

  const lowThreshold = data.lowThreshold ?? 20;
  const highThreshold = data.highThreshold ?? 80;
  const blurRadius = data.blurRadius ?? 1;

  const handleChange = useCallback(
    (key: string, value: number) => {
      updateNodeData(id, { [key]: value });
    },
    [id, updateNodeData]
  );

  const nodeOutputs = useExecutionStore((s) => s.nodeOutputs);
  const outputImage = nodeOutputs[id]?.["image:output"] as ImageBitmap | undefined;

  const leftRow = handleRow({ side: 'left' });
  const rightRow = handleRow({ side: 'right' });

  return (
    <NodeWrapper id={id} label="Canny Edge" selected={selected}>
      <NodePreview image={outputImage} visible={selected} />
      <div className="space-y-4 nodrag nopan">
        <div className="node-control">
          <label className="node-label">Low Threshold: {lowThreshold}</label>
          <Slider
            value={[lowThreshold]}
            min={0}
            max={100}
            step={1}
            onValueChange={(val) => handleChange("lowThreshold", Array.isArray(val) ? val[0] : val)}
          />
        </div>
        <div className="node-control">
          <label className="node-label">High Threshold: {highThreshold}</label>
          <Slider
            value={[highThreshold]}
            min={0}
            max={200}
            step={1}
            onValueChange={(val) => handleChange("highThreshold", Array.isArray(val) ? val[0] : val)}
          />
        </div>
        <div className="node-control">
          <label className="node-label">Blur Radius: {blurRadius}</label>
          <Slider
            value={[blurRadius]}
            min={0}
            max={5}
            step={0.1}
            onValueChange={(val) => handleChange("blurRadius", Array.isArray(val) ? val[0] : val)}
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

export default memo(CannyEdgeNode);
