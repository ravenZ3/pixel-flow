import { memo, useEffect, useRef, useCallback } from "react";
import { Handle, Position, NodeProps, useReactFlow, useEdges } from "reactflow";
import usePipelineStore from "@/store/pipelineStore";
import { Badge } from "@/components/ui/badge";

function OutputNode({ id, selected }: NodeProps) {
  const { setNodes, setEdges } = useReactFlow();
  const edges = useEdges();
  const nodeOutputs = usePipelineStore((s) => s.nodeOutputs);
  const { activePreviewNodeId, setActivePreviewNodeId } = usePipelineStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const output = nodeOutputs[id];
  const image = output?.image as ImageBitmap | undefined;
  const isActive = activePreviewNodeId === id;

  const isMaskConnected = edges.some(
    (e) => e.target === id && e.targetHandle === "mask"
  );

  // Auto-activate on selection
  useEffect(() => {
    if (selected && !isActive) {
      setActivePreviewNodeId(id);
    }
  }, [selected, isActive, id, setActivePreviewNodeId]);

  useEffect(() => {
    if (image && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Larger thumbnail for Output node
        const thumbWidth = 320;
        canvas.width = thumbWidth;
        canvas.height = (image.height / image.width) * thumbWidth;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      }
    }
  }, [image]);

  const deleteNode = useCallback(() => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    if (isActive) {
      setActivePreviewNodeId(null);
    }
  }, [id, setNodes, setEdges, isActive, setActivePreviewNodeId]);

  return (
    <div
      className={`node-surface node-preview-surface relative group rounded border transition-colors ${
        isActive ? "border-cyan-400 bg-cyan-950/10" : "border-zinc-700 bg-zinc-900"
      }`}
    >
      <button
        onClick={deleteNode}
        className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center
                   text-zinc-600 hover:text-red-400 text-xs rounded
                   opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        ×
      </button>

      <div className="node-header flex items-center justify-between">
        <span className="text-zinc-400">Output</span>
        {isActive && (
          <Badge
            variant="outline"
            className="text-cyan-400 border-cyan-400 text-[10px] h-4 px-1 leading-none"
          >
            ● Active
          </Badge>
        )}
      </div>

      <div className="node-body node-preview-body">
        <div className="flex flex-col gap-1 text-[10px] font-mono text-zinc-500 mb-2">
          <span>● image</span>
          <span style={{ marginTop: "32px" }}>● mask</span>
        </div>
        {image ? (
          <canvas
            ref={canvasRef}
            className="node-thumbnail-canvas w-full h-full object-contain block"
          />
        ) : (
          <div className="node-placeholder">No image</div>
        )}
      </div>
      <Handle
        type="target"
        position={Position.Left}
        id="image"
        className="handle-image"
        style={{ top: "35%" }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="mask"
        className="handle-mask"
        style={{ top: "65%" }}
      />
    </div>
  );
}

export default memo(OutputNode);
