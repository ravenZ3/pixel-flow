"use client";

import { useCallback, useRef, DragEvent } from "react";
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";

import usePipelineStore from "@/store/pipelineStore";
import ImageInputNode from "./nodes/ImageInputNode";
import PreviewNode from "./nodes/PreviewNode";
import BlurNode from "./nodes/BlurNode";
import BrightnessNode from "./nodes/BrightnessNode";
import MaskDrawNode from "./nodes/MaskDrawNode";

const nodeTypes = {
  ImageInput: ImageInputNode,
  Preview: PreviewNode,
  Blur: BlurNode,
  Brightness: BrightnessNode,
  MaskDraw: MaskDrawNode,
};

let nodeIdCounter = 0;
function getNextId() {
  return `node_${++nodeIdCounter}_${Date.now()}`;
}

function NodeEditorInner() {
  const nodes = usePipelineStore((s) => s.nodes);
  const edges = usePipelineStore((s) => s.edges);
  const onNodesChange = usePipelineStore((s) => s.onNodesChange);
  const onEdgesChange = usePipelineStore((s) => s.onEdgesChange);
  const onConnect = usePipelineStore((s) => s.onConnect);
  const addNode = usePipelineStore((s) => s.addNode);
  const executePipeline = usePipelineStore((s) => s.executePipeline);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
  }, []);

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
    setTimeout(() => executePipeline(), 0);
  }, [executePipeline]);

  const onEdgesDelete = useCallback(() => {
    setTimeout(() => executePipeline(), 0);
  }, [executePipeline]);

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
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode="Backspace"
        className="bg-[#0f0f0f]"
      >
        <Controls className="react-flow-controls" />
        <MiniMap
          nodeColor="#1c1c1c"
          maskColor="rgba(0,0,0,0.7)"
          className="react-flow-minimap"
        />
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#1a1a1a"
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
