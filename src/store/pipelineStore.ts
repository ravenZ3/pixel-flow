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
  nodeOutputs: Record<string, Record<string, string | null>>;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: Node) => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  setNodeOutput: (nodeId: string, outputs: Record<string, string | null>) => void;
  executePipeline: () => Promise<void>;
}

const usePipelineStore = create<PipelineStore>((set, get) => ({
  nodes: [],
  edges: [],
  nodeOutputs: {},

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
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
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      ),
    });
    // Auto-execute on data change
    setTimeout(() => get().executePipeline(), 0);
  },

  setNodeOutput: (nodeId, outputs) => {
    set({
      nodeOutputs: { ...get().nodeOutputs, [nodeId]: outputs },
    });
  },

  executePipeline: async () => {
    const { nodes, edges } = get();
    const getNodeData = (id: string) => {
      const node = nodes.find((n) => n.id === id);
      return (node?.data as Record<string, unknown>) ?? {};
    };

    try {
      const outputs = await executePipeline(nodes, edges, getNodeData);
      set({ nodeOutputs: outputs });
    } catch (err) {
      console.error("Pipeline execution failed:", err);
    }
  },
}));

export default usePipelineStore;
