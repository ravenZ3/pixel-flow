import { create } from "zustand";
import {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Connection,
} from "reactflow";
import { executePipeline } from "@/lib/executor";

interface PipelineStore {
  nodes: Node[];
  edges: Edge[];
  nodeOutputs: Record<string, Record<string, ImageBitmap | string | null>>;
  executionTime: number | null;
  activePreviewNodeId: string | null;
  showMask: boolean;
  maskOverlayOpacity: number;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: Node) => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  setNodeOutput: (nodeId: string, outputs: Record<string, ImageBitmap | string | null>) => void;
  setExecutionTime: (ms: number) => void;
  setActivePreviewNodeId: (id: string | null) => void;
  setShowMask: (show: boolean) => void;
  setMaskOverlayOpacity: (opacity: number) => void;
  executePipeline: () => Promise<void>;
}

const usePipelineStore = create<PipelineStore>((set, get) => ({
  nodes: [],
  edges: [],
  nodeOutputs: {},
  executionTime: null,
  activePreviewNodeId: null,
  showMask: false,
  maskOverlayOpacity: 0.5,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
    // Execute on edge change
    setTimeout(() => get().executePipeline(), 0);
  },

  onConnect: (connection: Connection) => {
    set({ edges: addEdge(connection, get().edges) });
    // Auto-execute pipeline on new connection
    setTimeout(() => get().executePipeline(), 0);
  },

  addNode: (node) => {
    set({ nodes: [...get().nodes, node] });
  },

  updateNodeData: (nodeId, data) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      ),
    }));
    // Auto-execute on data change
    setTimeout(() => get().executePipeline(), 0);
  },

  setNodeOutput: (nodeId, outputs) => {
    set({
      nodeOutputs: { ...get().nodeOutputs, [nodeId]: outputs },
    });
  },

  setExecutionTime: (executionTime) => set({ executionTime }),
  setActivePreviewNodeId: (activePreviewNodeId) => set({ activePreviewNodeId }),
  setShowMask: (showMask) => set({ showMask }),
  setMaskOverlayOpacity: (maskOverlayOpacity) => set({ maskOverlayOpacity }),

  executePipeline: async () => {
    const { nodes, edges, activePreviewNodeId, showMask } = get();
    const getNodeData = (id: string) => {
      const node = nodes.find((n) => n.id === id);
      return (node?.data as Record<string, unknown>) ?? {};
    };

    try {
      const start = performance.now();
      const outputs = await executePipeline(nodes, edges, getNodeData);
      const elapsed = performance.now() - start;

      // Auto-select an output node if none active or current one is gone
      const outputNodes = nodes.filter((n) => n.type === "Output");
      let nextActiveId = activePreviewNodeId;
      if (!outputNodes.find((n) => n.id === activePreviewNodeId)) {
        nextActiveId = outputNodes.length > 0 ? outputNodes[0].id : null;
      }

      // Auto-toggle showMask based on connectivity of the active output node
      let nextShowMask = showMask;
      const activeOutputNode = nodes.find(n => n.id === nextActiveId);
      if (activeOutputNode) {
        const maskEdge = edges.find(
          e => e.target === activeOutputNode.id && (e.targetHandle === 'mask:input' || e.targetHandle === 'mask')
        );
        const hasMask = !!maskEdge;
        if (hasMask && !showMask) nextShowMask = true;
        if (!hasMask && showMask) nextShowMask = false;
      }

      set({ 
        nodeOutputs: outputs, 
        executionTime: elapsed, 
        activePreviewNodeId: nextActiveId,
        showMask: nextShowMask
      });
    } catch (err) {
      console.error("Pipeline execution failed:", err);
    }
  },
}));

export default usePipelineStore;
