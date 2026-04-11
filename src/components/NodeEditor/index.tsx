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
import ImageInputNode from "./nodes/ImageInputNode";
import OutputNode from "./nodes/OutputNode";
import ColorNode from "./nodes/ColorNode";
import FilterNode from "./nodes/FilterNode";
import MaskNode from "./nodes/MaskNode";
import BlendNode from "./nodes/BlendNode";
import CannyEdgeNode from "./nodes/CannyEdgeNode";
import ASCIINode from "./nodes/ASCIINode";
import PromptInputNode from "./nodes/PromptInputNode";

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

  return (
    <div ref={reactFlowWrapper} className="h-full w-full">
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
        <Controls className="react-flow-controls" />
        <MiniMap
          nodeColor="#1c1c1c1c"
          maskColor="rgba(0,0,0,0.7)"
          className="react-flow-minimap"
        />
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
