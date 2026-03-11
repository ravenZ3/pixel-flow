import { Node, Edge } from "reactflow";
import nodeRegistry from "./nodeRegistry";

export async function executePipeline(
  nodes: Node[],
  edges: Edge[],
  getNodeData: (id: string) => Record<string, unknown>
): Promise<Record<string, Record<string, string | null>>> {
  // Build adjacency list and in-degree map
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, { targetId: string; sourceHandle: string | null; targetHandle: string | null }[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    adjacency.get(edge.source)?.push({
      targetId: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
    });
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  // Kahn's algorithm — topological sort
  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) queue.push(nodeId);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const neighbor of adjacency.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor.targetId) ?? 1) - 1;
      inDegree.set(neighbor.targetId, newDegree);
      if (newDegree === 0) queue.push(neighbor.targetId);
    }
  }

  // Execute each node in topological order
  const allOutputs: Record<string, Record<string, string | null>> = {};

  for (const nodeId of sorted) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || !node.type) continue;

    const executor = nodeRegistry[node.type];
    if (!executor) continue;

    // Gather inputs from upstream edges
    const inputs: Record<string, string | null> = {};
    const nodeData = getNodeData(nodeId);

    // Include node's own data (e.g., uploaded image)
    for (const [key, value] of Object.entries(nodeData)) {
      inputs[key] = typeof value === "string" ? value : null;
    }

    // Overlay inputs from connected upstream nodes
    for (const edge of edges) {
      if (edge.target === nodeId) {
        const sourceOutputs = allOutputs[edge.source];
        if (sourceOutputs) {
          const sourceHandle = edge.sourceHandle ?? "image";
          const targetHandle = edge.targetHandle ?? "image";
          inputs[targetHandle] = sourceOutputs[sourceHandle] ?? null;
        }
      }
    }

    const outputs = await executor.execute(inputs);
    allOutputs[nodeId] = outputs;
  }

  return allOutputs;
}
