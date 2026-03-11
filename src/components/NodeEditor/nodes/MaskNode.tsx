import { memo, useRef, useEffect, useState, useCallback } from "react";
import { Handle, Position, NodeProps, useReactFlow } from "reactflow";
import usePipelineStore from "@/store/pipelineStore";

function MaskNode({ id, data }: NodeProps) {
  const { setNodes } = useReactFlow();
  const executePipeline = usePipelineStore((s) => s.executePipeline);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const brushSize = data.brushSize ?? 15;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, []);

  const updateBitmapData = useCallback(async () => {
    if (canvasRef.current) {
      const bitmap = await createImageBitmap(canvasRef.current);
      setNodes((nodes) =>
        nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, maskBitmap: bitmap } } : n
        )
      );
      setTimeout(() => executePipeline(), 0);
    }
  }, [id, setNodes, executePipeline]);

  const startDrawing = (e: React.MouseEvent) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = async () => {
    setIsDrawing(false);
    await updateBitmapData();
  };

  const draw = (e: React.MouseEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const clearCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await updateBitmapData();
      }
    }
  }, [updateBitmapData]);

  const handleBrushChange = useCallback(
    (val: number) => {
      setNodes((nodes) =>
        nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, brushSize: val } } : n
        )
      );
    },
    [id, setNodes]
  );

  return (
    <div className="node-surface">
      <div className="node-header">Mask</div>
      <div className="node-body">
        <canvas
          ref={canvasRef}
          width={200}
          height={150}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          className="mask-draw-canvas"
        />
        <div className="node-control">
          <label className="node-label">Brush Size: {brushSize}</label>
          <input
            type="range"
            min={2}
            max={30}
            value={brushSize}
            onChange={(e) => handleBrushChange(Number(e.target.value))}
            className="node-slider"
          />
        </div>
        <button className="node-btn" onClick={clearCanvas}>
          Clear
        </button>
      </div>
      <Handle
        type="target"
        position={Position.Left}
        id="image"
        className="handle-image"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="image"
        className="handle-image"
        style={{ top: "40%" }}
      />
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
