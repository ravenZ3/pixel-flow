import { memo, useCallback } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import usePipelineStore from "@/store/pipelineStore";
import { Slider } from "@/components/ui/slider";
import NodeWrapper from "./NodeWrapper";
import { handleRow } from "./handleStyles";

function ColorNode({ id, data, selected }: NodeProps) {
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);

  const brightness = data.brightness ?? 0;
  const contrast = data.contrast ?? 0;
  const saturation = data.saturation ?? 0;
  const hue = data.hue ?? 0;
  const gamma = data.gamma ?? 1.0;

  const handleChange = useCallback(
    (key: string, value: number) => {
      updateNodeData(id, { [key]: value });
    },
    [id, updateNodeData]
  );

  const leftRow = handleRow({ side: 'left' });
  const rightRow = handleRow({ side: 'right' });

  return (
    <NodeWrapper id={id} label="Color" selected={selected}>
      <div className="space-y-4 nopan nodrag">
        <div className="node-control ">
          <label className="node-label">Brightness: {brightness}</label>
          <Slider
            value={[brightness]}
            min={-100}
            max={100}
            step={1}
            onValueChange={(val) => handleChange("brightness", Array.isArray(val) ? val[0] : val)}
          />
        </div>
        <div className="node-control">
          <label className="node-label">Contrast: {contrast}</label>
          <Slider
            value={[contrast]}
            min={-100}
            max={100}
            step={1}
            onValueChange={(val) => handleChange("contrast", Array.isArray(val) ? val[0] : val)}
          />
        </div>
        <div className="node-control">
          <label className="node-label">Saturation: {saturation}</label>
          <Slider
            value={[saturation]}
            min={-100}
            max={100}
            step={1}
            onValueChange={(val) => handleChange("saturation", Array.isArray(val) ? val[0] : val)}
          />
        </div>
        <div className="node-control">
          <label className="node-label">Hue: {hue}</label>
          <Slider
            value={[hue]}
            min={-180}
            max={180}
            step={1}
            onValueChange={(val) => handleChange("hue", Array.isArray(val) ? val[0] : val)}
          />
        </div>
        <div className="node-control">
          <label className="node-label">Gamma: {gamma}</label>
          <Slider
            value={[gamma]}
            min={0.1}
            max={3.0}
            step={0.05}
            onValueChange={(val) => handleChange("gamma", Array.isArray(val) ? val[0] : val)}
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


export default memo(ColorNode);

