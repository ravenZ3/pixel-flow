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
  dirtyNodes: Set<string>;
  executionTime: number | null;
  activePreviewNodeId: string | null;
  showMask: boolean;
  maskOverlayOpacity: number;
  isExecuting: boolean;
  needsExecution: boolean;
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
  markDirty: (nodeId: string) => void;
  markAllDirty: () => void;
  executePipeline: () => Promise<void>;
}

const usePipelineStore = create<PipelineStore>((set, get) => ({
  nodes: [],
  edges: [],
  nodeOutputs: {},
  dirtyNodes: new Set<string>(),
  executionTime: null,
  activePreviewNodeId: null,
  showMask: false,
  maskOverlayOpacity: 0.5,
  isExecuting: false,
  needsExecution: false,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
    // structural change — all nodes potentially affected
    const structuralTypes = ["add", "remove"];
    if (changes.some((c) => structuralTypes.includes(c.type))) {
      get().markAllDirty();
      // Auto-execute on structural change (like deletion)
      setTimeout(() => get().executePipeline(), 0);
    }
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
    get().markAllDirty();
    // Execute on edge change (except when handled by onConnect)
    // ReactFlow often fires onEdgesChange right after onConnect
    // but the guard in executePipeline will catch it anyway.
    setTimeout(() => get().executePipeline(), 0);
  },

  onConnect: (connection: Connection) => {
    set({ edges: addEdge(connection, get().edges) });
    get().markAllDirty();
    // Auto-execute pipeline on new connection
    setTimeout(() => get().executePipeline(), 0);
  },

  addNode: (node) => {
    set({ nodes: [...get().nodes, node] });
    get().markDirty(node.id);
  },

  updateNodeData: (nodeId, data, silent = false) => {
    const { edges, dirtyNodes } = get();
    
    // 1. Mark dirty (recursive)
    const toMark = new Set<string>();
    const traverse = (id: string) => {
      if (toMark.has(id)) return;
      toMark.add(id);
      edges.filter((e) => e.source === id).forEach((e) => traverse(e.target));
    };
    traverse(nodeId);

    // 2. Perform batched update
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      ),
      dirtyNodes: new Set([...state.dirtyNodes, ...toMark]),
    }));

    // 3. Auto-execute
    if (!silent) {
      setTimeout(() => get().executePipeline(), 0);
    }
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

  markDirty: (nodeId: string) => {
    const { edges } = get();
    const toMark = new Set<string>();

    const traverse = (id: string) => {
      if (toMark.has(id)) return;
      toMark.add(id);
      edges
        .filter((e) => e.source === id)
        .forEach((e) => traverse(e.target));
    };

    traverse(nodeId);

    set((state) => ({
      dirtyNodes: new Set([...state.dirtyNodes, ...toMark]),
    }));
  },

  markAllDirty: () => {
    const { nodes } = get();
    set({ dirtyNodes: new Set(nodes.map((n) => n.id)) });
  },

  executePipeline: async () => {
    const { isExecuting, dirtyNodes, nodes, edges, nodeOutputs, activePreviewNodeId, showMask } = get();
    
    // 1. If already executing, just note that we need another run after and bail
    if (isExecuting) {
      set({ needsExecution: true });
      return;
    }

    // 2. If no nodes are dirty AND we have previous outputs, there's nothing new to do
    // This prevents "empty" runs from stale setTimeout calls after an execution finished
    if (dirtyNodes.size === 0 && Object.keys(nodeOutputs).length > 0) {
      return;
    }

    set({ isExecuting: true, needsExecution: false });

    const getNodeData = (id: string) => {
      const node = nodes.find((n) => n.id === id);
      return (node?.data as Record<string, unknown>) ?? {};
    };

    try {
      const result = await executePipeline(
        nodes,
        edges,
        { ...nodeOutputs }, // pass copy to avoid mutation issues
        dirtyNodes,
        getNodeData
      );

      // Auto-select an output node if none active or current one is gone
      const outputNodes = nodes.filter((n) => n.type === "Output");
      let nextActiveId = activePreviewNodeId;
      if (!outputNodes.find((n) => n.id === activePreviewNodeId)) {
        nextActiveId = outputNodes.length > 0 ? outputNodes[0].id : null;
      }

      // Auto-toggle showMask based on connectivity of the active output node
      let nextShowMask = showMask;
      const activeOutputNode = nodes.find((n) => n.id === nextActiveId);
      if (activeOutputNode) {
        const maskEdge = edges.find(
          (e) =>
            e.target === activeOutputNode.id &&
            (e.targetHandle === "mask:input" || e.targetHandle === "mask")
        );
        const hasMask = !!maskEdge;
        if (hasMask && !showMask) nextShowMask = true;
        if (!hasMask && showMask) nextShowMask = false;
      }

      set({
        nodeOutputs: result.outputs,
        dirtyNodes: result.clearedDirtyNodes, // clear all dirty flags after execution
        executionTime: result.executionTimeMs,
        activePreviewNodeId: nextActiveId,
        showMask: nextShowMask,
        isExecuting: false,
      });

      // 3. If a change happened while we were executing, trigger the final run
      if (get().needsExecution) {
        get().executePipeline();
      }
    } catch (err) {
      console.error("Pipeline execution failed:", err);
      set({ isExecuting: false });
    }
  },
}));

export default usePipelineStore;
