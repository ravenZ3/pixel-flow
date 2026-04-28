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
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
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
  applyPatch: (patch: GraphPatch) => { addedIds: string[] };
}

export interface GraphPatch {
  add_nodes?: { id?: string; type: string; position?: { x: number; y: number }; data?: Record<string, unknown> }[];
  remove_nodes?: string[];
  add_edges?: { id?: string; source: string; sourceHandle: string; target: string; targetHandle: string }[];
  remove_edges?: string[];
  set_params?: { node_id: string; data: Record<string, unknown> }[];
}

let patchIdCounter = 0;
const nextPatchId = () => `agent_${++patchIdCounter}_${Date.now()}`;

const useUIStore = create<UIStore>((set, get) => ({
  nodes: [],
  edges: [],
  activePreviewNodeId: null,
  showMask: false,
  maskOverlayOpacity: 0.5,
  chatOpen: true,
  setChatOpen: (chatOpen) => set({ chatOpen }),

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

  applyPatch: (patch: GraphPatch) => {
    const { nodes, edges } = get();
    const addedIds: string[] = [];

    let nextNodes = nodes;
    let nextEdges = edges;

    if (patch.remove_edges?.length) {
      const set = new Set(patch.remove_edges);
      nextEdges = nextEdges.filter((e) => !set.has(e.id));
    }

    if (patch.remove_nodes?.length) {
      const set = new Set(patch.remove_nodes);
      nextNodes = nextNodes.filter((n) => !set.has(n.id));
      nextEdges = nextEdges.filter((e) => !set.has(e.source) && !set.has(e.target));
    }

    if (patch.add_nodes?.length) {
      const added: Node[] = patch.add_nodes.map((n, i) => {
        const id = n.id ?? nextPatchId();
        addedIds.push(id);
        return {
          id,
          type: n.type,
          position: n.position ?? { x: 80 + i * 260, y: 80 + (i % 2) * 160 },
          data: n.data ?? {},
        };
      });
      nextNodes = [...nextNodes, ...added];
    }

    if (patch.add_edges?.length) {
      const added: Edge[] = patch.add_edges.map((e) => ({
        id: e.id ?? nextPatchId(),
        source: e.source,
        sourceHandle: e.sourceHandle,
        target: e.target,
        targetHandle: e.targetHandle,
      }));
      nextEdges = [...nextEdges, ...added];
    }

    if (patch.set_params?.length) {
      const byId = new Map(patch.set_params.map((p) => [p.node_id, p.data]));
      nextNodes = nextNodes.map((n) =>
        byId.has(n.id) ? { ...n, data: { ...n.data, ...byId.get(n.id) } } : n
      );
    }

    set({ nodes: nextNodes, edges: nextEdges });

    const exec = useExecutionStore.getState();
    exec.markAllDirty();
    exec.requestExecution();

    return { addedIds };
  },

  loadTemplate: (name: string) => {
    const str = localStorage.getItem(`pixel-flow-template-${name}`);
    if (!str) return;
    try {
      const template = JSON.parse(str);
      const tplNodes: Node[] = template.nodes || [];
      const tplEdges: Edge[] = template.edges || [];

      // If the user already has an ImageInput with an uploaded photo on the
      // canvas, preserve it and adapt the template to plug into it instead of
      // wiping the upload. Templates are recipes — they should fit your input.
      const liveSource = get().nodes.find(
        (n) => n.type === "ImageInput" && (n.data as Record<string, unknown>)?.uploadedImage
      );
      const tplSources = tplNodes.filter((n) => n.type === "ImageInput");

      if (liveSource && tplSources.length > 0) {
        // Map every template ImageInput id → the existing live one, then drop
        // the template's ImageInputs from the node list.
        const idMap = new Map(tplSources.map((s) => [s.id, liveSource.id]));
        const mergedNodes: Node[] = [
          liveSource,
          ...tplNodes.filter((n) => n.type !== "ImageInput"),
        ];
        const mergedEdges: Edge[] = tplEdges.map((e) => ({
          ...e,
          source: idMap.get(e.source) ?? e.source,
          target: idMap.get(e.target) ?? e.target,
        }));
        set({ nodes: mergedNodes, edges: mergedEdges });
      } else {
        // No upload to preserve — straight replace.
        set({ nodes: tplNodes, edges: tplEdges });
      }

      const exec = useExecutionStore.getState();
      exec.markAllDirty();
      exec.requestExecution();
    } catch (e) {
      console.error("Failed to load template", e);
    }
  },
}));

export default useUIStore;
