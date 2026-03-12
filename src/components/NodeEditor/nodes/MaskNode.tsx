import { memo, useCallback, useRef, useEffect } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import usePipelineStore from "@/store/pipelineStore";
import { Slider } from "@/components/ui/slider";
import NodeWrapper from "./NodeWrapper";
import { handleRow } from "./handleStyles";

function MaskNode({ id, data, selected }: NodeProps) {
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

  const exportMaskAndExecute = useCallback(async () => {
    const drawingCanvas = maskCanvasRef.current;
    if (!drawingCanvas) return;

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

  const leftRow = handleRow({ side: 'left' });
  const rightRow = handleRow({ side: 'right' });

  return (
    <NodeWrapper id={id} label="Mask Drawing" selected={selected}>
      <div className="space-y-4">
        <div
          className="relative w-full nodrag nopan"
          style={{
            height: "300px",
            background: "#1231232",
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

        <div className="mt-4 space-y-2">
          <div className={leftRow.row()}>
            <Handle type="target" position={Position.Left} id="image:input" className="!left-[-20px]" />
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
          <div className={rightRow.row()}>
            <span className={rightRow.label()}>mask</span>
            <Handle
              type="source"
              position={Position.Right}
              id="mask:output"
              className="!right-[-20px]"
            />
          </div>
        </div>
      </div>
    </NodeWrapper>
  );
}


export default memo(MaskNode);

