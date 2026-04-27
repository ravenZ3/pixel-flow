"use client";

import { useCallback, useRef, DragEvent, useEffect } from "react";
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  ReactFlowInstance,
  Connection,
} from "reactflow";
import "reactflow/dist/style.css";

import useUIStore from "@/store/uiStore";
import useExecutionStore from "@/store/executionStore";
import { readGraphFromHash, clearGraphHash } from "@/lib/share";
import ImageInputNode from "./nodes/ImageInputNode";
import OutputNode from "./nodes/OutputNode";
import ColorNode from "./nodes/ColorNode";
import FilterNode from "./nodes/FilterNode";
import MaskNode from "./nodes/MaskNode";
import BlendNode from "./nodes/BlendNode";
import CannyEdgeNode from "./nodes/CannyEdgeNode";
import ASCIINode from "./nodes/ASCIINode";
import PromptInputNode from "./nodes/PromptInputNode";
import SolidFillNode from "./nodes/SolidFillNode";
import GradientMapNode from "./nodes/GradientMapNode";
import PosterizeNode from "./nodes/PosterizeNode";
import CurvesNode from "./nodes/CurvesNode";
import SplitToningNode from "./nodes/SplitToningNode";
import VignetteNode from "./nodes/VignetteNode";
import GrainNode from "./nodes/GrainNode";

const nodeTypes = {
  ImageInput: ImageInputNode,
  Color: ColorNode,
  Filter: FilterNode,
  Mask: MaskNode,
  Blend: BlendNode,
  Output: OutputNode,
  CannyEdge: CannyEdgeNode,
  ASCII: ASCIINode,
  Prompt: PromptInputNode,
  SolidFill: SolidFillNode,
  GradientMap: GradientMapNode,
  Posterize: PosterizeNode,
  Curves: CurvesNode,
  SplitToning: SplitToningNode,
  Vignette: VignetteNode,
  Grain: GrainNode,
};

let nodeIdCounter = 0;
function getNextId() {
  return `node_${++nodeIdCounter}_${Date.now()}`;
}

function NodeEditorInner() {
  const nodes = useUIStore((s) => s.nodes);
  const edges = useUIStore((s) => s.edges);
  const onNodesChange = useUIStore((s) => s.onNodesChange);
  const onEdgesChange = useUIStore((s) => s.onEdgesChange);
  const onConnect = useUIStore((s) => s.onConnect);
  const addNode = useUIStore((s) => s.addNode);
  const markAllDirty = useExecutionStore((s) => s.markAllDirty);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
  }, []);

  useEffect(() => {
    // Hydrate from a shared URL hash on first mount, then clean the hash so it
    // doesn't keep re-applying on save/template/etc.
    const shared = readGraphFromHash();
    if (shared) {
      useUIStore.getState().setNodes(shared.nodes);
      useUIStore.getState().setEdges(shared.edges);
      clearGraphHash();
    }
    markAllDirty();
  }, [markAllDirty]);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow");
      if (!type || !reactFlowInstance.current || !reactFlowWrapper.current) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.current.project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      addNode({
        id: getNextId(),
        type,
        position,
        data: {},
      });
    },
    [addNode]
  );

  const onNodesDelete = useCallback(() => {
    // handled by onNodesChange in store
  }, []);

  const onEdgesDelete = useCallback(() => {
    // handled by onEdgesChange in store
  }, []);

  const isValidConnection = useCallback((connection: Connection) => {
    const sourceHandle = connection.sourceHandle ?? "";
    const targetHandle = connection.targetHandle ?? "";

    const sourceType = sourceHandle.split(":")[0] ?? "";
    const targetType = targetHandle.split(":")[0] ?? "";

    // normalize imageA and imageB to image for matching
    const normalize = (t: string) => {
      if (t.startsWith("image")) return "image";
      if (t.startsWith("prompt")) return "prompt";
      return t;
    };

    // image:output can connect to mask:input and base:input
    if (sourceHandle === "image:output" && (targetHandle === "mask:input" || targetHandle === "base:input")) {
      return true;
    }

    return normalize(sourceType) === normalize(targetType);
  }, []);

  const isEmpty = nodes.length === 0;

  return (
    <div ref={reactFlowWrapper} className="h-full w-full relative">
      {isEmpty && (
        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
          <div className="text-center max-w-sm px-6">
            <div className="text-zinc-600 text-sm font-mono uppercase tracking-widest mb-3">
              empty canvas
            </div>
            <div className="text-zinc-400 text-base mb-2">
              Drag a node from the left, or
            </div>
            <div className="text-zinc-400 text-base">
              ask the <span className="text-cyan-400">Agent</span> to build a pipeline.
            </div>
            <div className="mt-6 text-zinc-600 text-xs">
              Try: <span className="text-zinc-400 italic">&quot;ASCII art with neon glow&quot;</span>
            </div>
          </div>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={onInit}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes}
        onPaneContextMenu={(e) => e.preventDefault()}
        fitView
        deleteKeyCode="Backspace"
        className="bg-[#0f0f0f]"
      >
        <Controls className="react-flow-controls" position="bottom-left" />
        {nodes.length > 3 && (
          <MiniMap
            nodeColor="#1c1c1c1c"
            maskColor="rgba(0,0,0,0.7)"
            className="react-flow-minimap"
            position="top-right"
            pannable
            zoomable
          />
        )}
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
        />
      </ReactFlow>
    </div>
  );
}

export default function NodeEditor() {
  return (
    <ReactFlowProvider>
      <NodeEditorInner />
    </ReactFlowProvider>
  );
}
