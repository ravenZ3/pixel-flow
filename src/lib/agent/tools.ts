import nodeRegistry, { NodeSchema } from "@/lib/nodeRegistry";
import useUIStore, { GraphPatch } from "@/store/uiStore";

export type AnthropicTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export const tools: AnthropicTool[] = [
  {
    name: "list_node_types",
    description:
      "List every available node type with its description, input/output handles, and parameter schema. Call this first when planning a new graph so you know which nodes exist and how to wire them.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "read_graph",
    description:
      "Return the current graph: all nodes (id, type, data) and all edges (source/target handle pairs). Use this to understand what already exists before modifying.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "apply_patch",
    description:
      "Atomically mutate the graph. You can add nodes, remove nodes, add edges, remove edges, and set parameters in one call. Handle names must match the node's schema exactly (e.g. 'image:input', 'image:output'). If you omit a node id when adding, one is generated and returned. Prefer batching related changes into a single patch.",
    input_schema: {
      type: "object",
      properties: {
        add_nodes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Optional. Auto-generated if omitted." },
              type: { type: "string", description: "Node type from list_node_types." },
              position: {
                type: "object",
                properties: { x: { type: "number" }, y: { type: "number" } },
                required: ["x", "y"],
              },
              data: { type: "object", description: "Initial param values." },
            },
            required: ["type"],
          },
        },
        remove_nodes: { type: "array", items: { type: "string" } },
        add_edges: {
          type: "array",
          items: {
            type: "object",
            properties: {
              source: { type: "string" },
              sourceHandle: { type: "string" },
              target: { type: "string" },
              targetHandle: { type: "string" },
            },
            required: ["source", "sourceHandle", "target", "targetHandle"],
          },
        },
        remove_edges: { type: "array", items: { type: "string" } },
        set_params: {
          type: "array",
          items: {
            type: "object",
            properties: {
              node_id: { type: "string" },
              data: { type: "object" },
            },
            required: ["node_id", "data"],
          },
        },
      },
      additionalProperties: false,
    },
  },
];

export function runTool(name: string, input: Record<string, unknown>): unknown {
  switch (name) {
    case "list_node_types": {
      const out: Record<string, NodeSchema> = {};
      for (const [type, exec] of Object.entries(nodeRegistry)) {
        out[type] = exec.schema;
      }
      return out;
    }
    case "read_graph": {
      const { nodes, edges } = useUIStore.getState();
      return {
        nodes: nodes.map((n) => {
          const { uploadedImage, mask, externalMask, ...safeData } = (n.data || {}) as Record<string, unknown>;
          return { id: n.id, type: n.type, data: safeData, position: n.position };
        }),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          sourceHandle: e.sourceHandle,
          target: e.target,
          targetHandle: e.targetHandle,
        })),
      };
    }
    case "apply_patch": {
      const result = useUIStore.getState().applyPatch(input as GraphPatch);
      return { ok: true, added_node_ids: result.addedIds };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
