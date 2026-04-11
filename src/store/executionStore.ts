import { create } from "zustand";
import { executePipeline } from "@/lib/executor";
import useUIStore from "./uiStore";

// Type definitions to help execution logic
export interface ExecutionStore {
  nodeOutputs: Record<string, Record<string, ImageBitmap | string | null>>;
  dirtyNodes: Set<string>;
  executionTime: number | null;
  isExecuting: boolean;
  needsExecution: boolean;
  setNodeOutput: (nodeId: string, outputs: Record<string, ImageBitmap | string | null>) => void;
  setExecutionTime: (ms: number) => void;
  markDirty: (nodeId: string | Set<string>) => void;
  markAllDirty: () => void;
  requestExecution: () => void;
  executePipeline: () => Promise<void>;
}

// Simple debounce implementation
let executionTimeoutId: ReturnType<typeof setTimeout> | null = null;

const useExecutionStore = create<ExecutionStore>((set, get) => ({
  nodeOutputs: {},
  dirtyNodes: new Set<string>(),
  executionTime: null,
  isExecuting: false,
  needsExecution: false,

  setNodeOutput: (nodeId, outputs) => {
    set({
      nodeOutputs: { ...get().nodeOutputs, [nodeId]: outputs },
    });
  },

  setExecutionTime: (executionTime) => set({ executionTime }),

  markDirty: (nodeId) => {
    set((state) => {
      const newSet = new Set(state.dirtyNodes);
      if (nodeId instanceof Set) {
        nodeId.forEach((id) => newSet.add(id));
      } else {
        newSet.add(nodeId);
      }
      return { dirtyNodes: newSet };
    });
  },

  markAllDirty: () => {
    const nodes = useUIStore.getState().nodes;
    set({ dirtyNodes: new Set(nodes.map((n) => n.id)) });
  },

  requestExecution: () => {
    if (executionTimeoutId) {
      clearTimeout(executionTimeoutId);
    }
    executionTimeoutId = setTimeout(() => {
      get().executePipeline();
    }, 150); // 150ms debounce
  },

  executePipeline: async () => {
    const { isExecuting, dirtyNodes, nodeOutputs } = get();
    const uiStore = useUIStore.getState();
    const { nodes, edges, activePreviewNodeId, showMask } = uiStore;
    
    if (isExecuting) {
      set({ needsExecution: true });
      return;
    }

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
        { ...nodeOutputs },
        dirtyNodes,
        getNodeData
      );

      // Auto-select output logic
      const outputNodes = nodes.filter((n) => n.type === "Output");
      let nextActiveId = activePreviewNodeId;
      if (!outputNodes.find((n) => n.id === activePreviewNodeId)) {
        nextActiveId = outputNodes.length > 0 ? outputNodes[0].id : null;
      }

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
        dirtyNodes: result.clearedDirtyNodes,
        executionTime: result.executionTimeMs,
        isExecuting: false,
      });

      uiStore.setActivePreviewNodeId(nextActiveId);
      uiStore.setShowMask(nextShowMask);

      if (get().needsExecution) {
        get().requestExecution();
      }
    } catch (err) {
      console.error("Pipeline execution failed:", err);
      set({ isExecuting: false });
    }
  },
}));

export default useExecutionStore;
