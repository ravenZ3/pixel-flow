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
import useExecutionStore from "./executionStore";

interface UIStore {
  nodes: Node[];
  edges: Edge[];
  activePreviewNodeId: string | null;
  showMask: boolean;
  maskOverlayOpacity: number;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: Node) => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>, silent?: boolean) => void;
  setActivePreviewNodeId: (id: string | null) => void;
  setShowMask: (show: boolean) => void;
  setMaskOverlayOpacity: (opacity: number) => void;
  saveTemplate: (name: string) => void;
  loadTemplate: (name: string) => void;
}

const useUIStore = create<UIStore>((set, get) => ({
  nodes: [],
  edges: [],
  activePreviewNodeId: null,
  showMask: false,
  maskOverlayOpacity: 0.5,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
    const structuralTypes = ["add", "remove"];
    if (changes.some((c) => structuralTypes.includes(c.type))) {
      const exec = useExecutionStore.getState();
      exec.markAllDirty();
      exec.requestExecution();
    }
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
    const exec = useExecutionStore.getState();
    exec.markAllDirty();
    exec.requestExecution();
  },

  onConnect: (connection: Connection) => {
    set({ edges: addEdge(connection, get().edges) });
    const exec = useExecutionStore.getState();
    exec.markAllDirty();
    exec.requestExecution();
  },

  addNode: (node) => {
    set({ nodes: [...get().nodes, node] });
    useExecutionStore.getState().markDirty(node.id);
  },

  updateNodeData: (nodeId, data, silent = false) => {
    const { edges } = get();
    
    // 1. Traverse to find dirty nodes
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
    }));
    
    // 3. Mark in execution store
    const exec = useExecutionStore.getState();
    exec.markDirty(toMark);

    // 4. Request execution (debounced)
    if (!silent) {
      exec.requestExecution();
    }
  },

  setActivePreviewNodeId: (activePreviewNodeId) => set({ activePreviewNodeId }),
  setShowMask: (showMask) => set({ showMask }),
  setMaskOverlayOpacity: (maskOverlayOpacity) => set({ maskOverlayOpacity }),

  saveTemplate: (name: string) => {
    const { nodes, edges } = get();
    const cleanNodes = nodes.map((n) => {
      const { uploadedImage, mask, externalMask, ...safeData } = n.data || {};
      return { ...n, data: safeData };
    });
    const template = { nodes: cleanNodes, edges, name };
    localStorage.setItem(`pixel-flow-template-${name}`, JSON.stringify(template));
  },

  loadTemplate: (name: string) => {
    const str = localStorage.getItem(`pixel-flow-template-${name}`);
    if (!str) return;
    try {
      const template = JSON.parse(str);
      set({ nodes: template.nodes || [], edges: template.edges || [] });
      const exec = useExecutionStore.getState();
      exec.markAllDirty();
      exec.requestExecution();
    } catch (e) {
      console.error("Failed to load template", e);
    }
  },
}));

export default useUIStore;
