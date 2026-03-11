import { memo, useCallback, useRef, useState, useEffect } from "react";
import { Handle, Position, NodeProps, useReactFlow } from "reactflow";
import usePipelineStore from "@/store/pipelineStore";
import { Slider } from "@/components/ui/slider";

function MaskNode({ id, data }: NodeProps) {
  const { setNodes, setEdges } = useReactFlow();
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);
  const executePipeline = usePipelineStore((s) => s.executePipeline);
  const nodeOutputs = usePipelineStore((s) => s.nodeOutputs);

  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  const brushSize = data.brushSize ?? 20;
  const inputImage = nodeOutputs[id]?.inputImage as ImageBitmap | null;

  const handleChange = useCallback(
    (key: string, value: number) => {
      updateNodeData(id, { [key]: value });
    },
    [id, updateNodeData]
  );

  const deleteNode = useCallback(() => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  }, [id, setNodes, setEdges]);

  const exportMaskAndExecute = useCallback(async () => {
    const drawingCanvas = maskCanvasRef.current;
    if (!drawingCanvas) return;

    // Create a proper black+white mask bitmap
    // black background + white strokes from drawing canvas
    const exportCanvas = new OffscreenCanvas(drawingCanvas.width, drawingCanvas.height);
    const exportCtx = exportCanvas.getContext("2d")!;

    // fill black
    exportCtx.fillStyle = "#000000";
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // draw white strokes on top
    exportCtx.drawImage(drawingCanvas, 0, 0);

    const bitmap = await createImageBitmap(exportCanvas);
    updateNodeData(id, { mask: bitmap });
    setTimeout(() => executePipeline(), 0);
  }, [id, updateNodeData, executePipeline]);

  // Initial canvas fill is now handled by container background black
  // and exportMaskAndExecute filling black for the mask output.

  // Draw reference image on background layer
  useEffect(() => {
    if (!inputImage || !bgCanvasRef.current) return;
    const canvas = bgCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Matching resolution or using default? Let's use 400x300 as baseline
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
    ctx.strokeStyle = "#ffffff";
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updateNodeData(id, { mask: null });
    setTimeout(() => executePipeline(), 0);
  };

  return (
    <div className="node-surface relative group">
      <Handle type="target" position={Position.Left} id="image" className="handle-image" style={{ top: "50%" }} />
      <button
        onClick={deleteNode}
        className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center
                   text-zinc-600 hover:text-red-400 text-xs rounded
                   opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        ×
      </button>
      <div className="node-header text-mask-color">Mask Drawing</div>
      <div className="node-body space-y-4">
        <div
          className="relative w-full nodrag nopan bg-black"
          style={{
            height: "300px",
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

          {/* Drawing layer — transparent background, white strokes */}
          <canvas
            ref={maskCanvasRef}
            width={400}
            height={300}
            className="absolute inset-0 w-full h-full nodrag nopan cursor-crosshair"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>

        <p className="text-[10px] text-zinc-500 mt-1 text-center font-mono uppercase tracking-widest">
          right click to draw · left click to move
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
        <button className="node-btn w-full mt-2" onClick={clearMask}>
          Clear Mask
        </button>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="mask"
        className="handle-mask"
        style={{ top: "60%" }}
      />
    </div>
  );
}

export default memo(MaskNode);
