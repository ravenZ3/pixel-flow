import { memo, useCallback, useEffect, useRef } from "react";
import { Handle, Position, NodeProps, useEdges } from "reactflow";
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

function ASCIINode({ id, data, selected }: NodeProps) {
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);
  const edges = useEdges();

  const isMaskConnected = edges.some(
    (e) => e.target === id && e.targetHandle === "mask:input"
  );

  const fontSize = data.fontSize ?? 8;
  const charSet = data.charSet ?? "classic";
  const invert = data.invert === true;

  const handleChange = useCallback(
    (key: string, value: any) => {
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
    <NodeWrapper id={id} label="ASCII Art" selected={selected}>
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
          <div className="flex justify-between mb-1">
            <label className="node-label">Font Size</label>
            <span className="text-[10px] text-zinc-500">{fontSize}px</span>
          </div>
          <Slider
            value={[fontSize]}
            min={4}
            max={24}
            step={1}
            onValueChange={(val) => handleChange("fontSize", Array.isArray(val) ? val[0] : val)}
          />
        </div>
        
        <div className="node-control">
          <label className="node-label">Character Set</label>
          <Select value={charSet} onValueChange={(val) => handleChange("charSet", val)}>
            <SelectTrigger className="w-full bg-zinc-950 border-zinc-800 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
              <SelectItem value="classic">Classic (@#S%...)</SelectItem>
              <SelectItem value="blocks">Blocks (█▓▒░)</SelectItem>
              <SelectItem value="minimal">Minimal (@+.)</SelectItem>
              <SelectItem value="braille">Braille (⣿⣷⣯...)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="node-control">
          <label className="node-label">Background</label>
          <Select
            value={data.bgMode ?? "dark"}
            onValueChange={(val) => handleChange("bgMode", val)}
          >
            <SelectTrigger className="w-full bg-zinc-950 border-zinc-800 text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="transparent">Transparent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="node-control">
          <label className="node-label">Color Mode</label>
          <Select
            value={data.colorMode ?? "original"}
            onValueChange={(val) => handleChange("colorMode", val)}
          >
            <SelectTrigger className="w-full bg-zinc-950 border-zinc-800 text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
              <SelectItem value="original">Original</SelectItem>
              <SelectItem value="grayscale">Grayscale</SelectItem>
              <SelectItem value="solid">Solid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isMaskConnected && (
          <div className="mt-2 space-y-2">
             <p className="text-[10px] font-mono text-cyan-400 text-center">
              ● masked mode
            </p>
            <div className="node-control">
              <div className="flex justify-between mb-1">
                <label className="node-label">Threshold</label>
                <span className="text-[10px] text-zinc-500">{data.maskThreshold ?? 30}</span>
              </div>
              <Slider
                value={[data.maskThreshold ?? 30]}
                min={0}
                max={255}
                step={1}
                onValueChange={(val) => handleChange("maskThreshold", Array.isArray(val) ? val[0] : val)}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <label className="text-[10px] text-zinc-500 font-mono uppercase">Invert</label>
          <button 
            onClick={() => handleChange("invert", !invert)}
            className={`text-[10px] px-2 py-1 rounded border transition-all ${
              invert ? "border-cyan-500/50 bg-cyan-950/20 text-cyan-400" : "border-zinc-800 text-zinc-500"
            }`}
          >
            {invert ? "ON" : "OFF"}
          </button>
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

        <div className={leftRow.row()}>
          <Handle
            type="target"
            position={Position.Left}
            id="mask:input"
            className="!left-[-20px]"
          />
          <span className={leftRow.label()}>mask</span>
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

export default memo(ASCIINode);
