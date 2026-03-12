import { memo, useCallback, useRef, useEffect, useState } from "react";
import { Handle, Position, NodeProps, useEdges } from "reactflow";
import usePipelineStore from "@/store/pipelineStore";
import { Slider } from "@/components/ui/slider";
import NodeWrapper from "./NodeWrapper";
import { handleRow } from "./handleStyles";

function MaskNode({ id, data, selected }: NodeProps) {
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);
  const executePipeline = usePipelineStore((s) => s.executePipeline);
  const nodeOutputs = usePipelineStore((s) => s.nodeOutputs);
  const edges = useEdges();

  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');

  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const skipAutoLoad = useRef(false);

  const brushSize = data.brushSize ?? 20;
  const inputImage = nodeOutputs[id]?.inputImage as ImageBitmap | null;

  const isExternalMaskConnected = edges.some(
    (e) => e.target === id && e.targetHandle === "mask:input"
  );

  const handleChange = useCallback(
    (key: string, value: any) => {
      updateNodeData(id, { [key]: value });
    },
    [id, updateNodeData]
  );

  const exportMaskAndExecute = useCallback(async () => {
    const drawingCanvas = maskCanvasRef.current;
    if (!drawingCanvas) return;

    const exportCanvas = new OffscreenCanvas(drawingCanvas.width, drawingCanvas.height);
    const exportCtx = exportCanvas.getContext("2d")!;

    exportCtx.fillStyle = "#000000";
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    exportCtx.drawImage(drawingCanvas, 0, 0);

    const bitmap = await createImageBitmap(exportCanvas);
    
    // Set flag to avoid useEffect loop
    skipAutoLoad.current = true;
    updateNodeData(id, { mask: bitmap });
    setTimeout(() => executePipeline(), 0);
  }, [id, updateNodeData, executePipeline]);

  // Load external mask when it changes
  useEffect(() => {
    const externalMask = data.externalMask as ImageBitmap | null;
    if (!externalMask || !maskCanvasRef.current) return;

    if (skipAutoLoad.current) {
      skipAutoLoad.current = false;
      return;
    }

    const canvas = maskCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(externalMask, 0, 0, canvas.width, canvas.height);

    exportMaskAndExecute();
  }, [data.externalMask]);

  // Draw reference image on background layer
  useEffect(() => {
    if (!inputImage || !bgCanvasRef.current) return;
    const canvas = bgCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(inputImage, 0, 0, canvas.width, canvas.height);
  }, [inputImage]);

  const getPos = (e: React.MouseEvent) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startDrawing = (e: React.MouseEvent) => {
    if (e.button !== 2) return; // only right mouse button
    e.preventDefault();
    e.stopPropagation();
    isDrawing.current = true;

    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    draw(e);
  };

  const stopDrawing = (e: React.MouseEvent) => {
    if (!isDrawing.current) return;
    e.stopPropagation();
    isDrawing.current = false;
    exportMaskAndExecute();
  };

  const draw = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDrawing.current || !maskCanvasRef.current) return;
    const canvas = maskCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getPos(e);
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = 'source-over';

    if (tool === 'brush') {
      ctx.strokeStyle = "#ffffff";
    } else {
      ctx.strokeStyle = "#000000";
    }
    
    ctx.lineTo(x, y);
    ctx.stroke();

    // Live update on every stroke
    exportMaskAndExecute();
  };

  const clearMask = () => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    skipAutoLoad.current = false;
    updateNodeData(id, { mask: null });
    setTimeout(() => executePipeline(), 0);
  };

  const resetToExternal = () => {
    const externalMask = data.externalMask as ImageBitmap | null;
    if (!externalMask || !maskCanvasRef.current) return;
    const canvas = maskCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(externalMask, 0, 0, canvas.width, canvas.height);
    
    skipAutoLoad.current = false;
    exportMaskAndExecute();
  };

  const leftRow = handleRow({ side: 'left' });
  const rightRow = handleRow({ side: 'right' });

  return (
    <NodeWrapper id={id} label="Mask Editor" selected={selected}>
      <div className="space-y-4 nodrag nopan">
        <div className={rightRow.row()}>
          <span className={rightRow.label()}>image</span>
          <Handle
            type="source"
            position={Position.Right}
            id="image:output"
            className="!right-[-20px]"
          />
        </div>
        <div className={rightRow.row()}>
          <span className={rightRow.label()}>mask</span>
          <Handle
            type="source"
            position={Position.Right}
            id="mask:output"
            className="!right-[-20px]"
          />
        </div>

        <div className="flex gap-1 mb-2">
          <button
            onClick={() => setTool('brush')}
            className={`flex-1 text-[10px] font-mono py-1 rounded border transition-colors ${
              tool === 'brush'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
            }`}
          >
            ✦ brush
          </button>
          <button
            onClick={() => setTool('eraser')}
            className={`flex-1 text-[10px] font-mono py-1 rounded border transition-colors ${
              tool === 'eraser'
                ? 'border-red-400 text-red-400'
                : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
            }`}
          >
            ◌ eraser
          </button>
        </div>

        <div
          className="relative w-full nodrag nopan"
          style={{
            height: "300px",
            background: "#000",
            borderRadius: "4px",
            overflow: "hidden",
            width: "400px",
          }}
        >
          {/* Background layer — dim image reference */}
          <canvas
            ref={bgCanvasRef}
            width={400}
            height={300}
            className="absolute inset-0 w-full h-full"
            style={{ opacity: 0.35, pointerEvents: "none" }}
          />

          {/* Drawing layer — black background, white/black strokes */}
          <canvas
            ref={maskCanvasRef}
            width={400}
            height={300}
            className={`absolute inset-0 w-full h-full nodrag nopan ${
              tool === 'brush' ? 'cursor-crosshair' : 'cursor-cell'
            }`}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>

        <p className="text-[10px] text-zinc-500 mt-1 text-center font-mono uppercase tracking-widest">
          right click to paint · left click to move
        </p>

        <div className="node-control">
          <label className="node-label">Brush Size: {brushSize}</label>
          <Slider
            value={[brushSize]}
            min={1}
            max={100}
            step={1}
            onValueChange={(val) =>
              handleChange("brushSize", Array.isArray(val) ? val[0] : val)
            }
          />
        </div>

        {isExternalMaskConnected && (
          <button
            onClick={resetToExternal}
            className="w-full text-[10px] font-mono text-zinc-500 hover:text-cyan-400
                       border border-zinc-700 hover:border-cyan-400 rounded py-1
                       transition-colors mt-1"
          >
            ↺ reset to external
          </button>
        )}

        <button className="node-btn w-full mt-2" onClick={clearMask}>
          Clear Mask
        </button>

        <div className="mt-4 space-y-2">
          <div className={leftRow.row()}>
            <Handle type="target" position={Position.Left} id="image:input" className="!left-[-20px]" />
            <span className={leftRow.label()}>image</span>
          </div>
          <div className={leftRow.row()}>
            <Handle
              type="target"
              position={Position.Left}
              id="mask:input"
              className="!left-[-20px]"
            />
            <span className={leftRow.label()}>mask in</span>
          </div>
        </div>
      </div>
    </NodeWrapper>
  );
}

export default memo(MaskNode);
