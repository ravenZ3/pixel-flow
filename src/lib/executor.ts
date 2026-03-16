import { Node, Edge } from "reactflow";
import nodeRegistry from "./nodeRegistry";

export async function executePipeline(
  nodes: Node[],
  edges: Edge[],
  nodeOutputs: Record<string, Record<string, any>>,
  dirtyNodes: Set<string>,
  getNodeData: (id: string) => Record<string, unknown>
): Promise<{
  outputs: Record<string, Record<string, any>>;
  clearedDirtyNodes: Set<string>;
  executionTimeMs: number;
  skippedNodes: string[];
  executedNodes: string[];
}> {
  const start = performance.now();
  const skippedNodes: string[] = [];
  const executedNodes: string[] = [];

  // Build adjacency list and in-degree map
  const inDegree = new Map<string, number>();
  const adjacency = new Map<
    string,
    { targetId: string; sourceHandle: string | null; targetHandle: string | null }[]
  >();

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

  const sortedIds: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sortedIds.push(current);
    for (const neighbor of adjacency.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor.targetId) ?? 1) - 1;
      inDegree.set(neighbor.targetId, newDegree);
      if (newDegree === 0) queue.push(neighbor.targetId);
    }
  }

  // Step 2 — execute in order with cache check
  for (const nodeId of sortedIds) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || !node.type) continue;

    const isDirty = dirtyNodes.has(nodeId);
    const hasCachedOutput = !!nodeOutputs[nodeId];

    if (!isDirty && hasCachedOutput) {
      // cache hit — skip this node
      skippedNodes.push(nodeId);
      continue;
    }

    const executor = nodeRegistry[node.type];
    if (!executor) {
      skippedNodes.push(nodeId);
      continue;
    }

    // gather inputs from upstream edges
    const inputs: Record<string, ImageBitmap | string | null> = {};
    const nodeData = getNodeData(nodeId);

    // Include node's own data
    for (const [key, value] of Object.entries(nodeData)) {
      inputs[key] = (value as ImageBitmap | string | null) ?? null;
    }

    // Overlay inputs from connected upstream nodes
    for (const edge of edges) {
      if (edge.target === nodeId) {
        const sourceOutputs = nodeOutputs[edge.source];
        if (sourceOutputs && edge.sourceHandle && edge.targetHandle) {
          // Precise match
          let value = sourceOutputs[edge.sourceHandle];

          // Fallback for legacy handles (before dataType:role rename)
          if (value === undefined) {
            if (edge.sourceHandle === "image") value = sourceOutputs["image:output"];
            if (edge.sourceHandle === "mask") value = sourceOutputs["mask:output"];
          }

          // Map to target handle
          let targetKey = edge.targetHandle;

          // Legacy mapping for target nodes that now expect typed handles
          if (targetKey === "image") targetKey = "image:input";
          if (targetKey === "mask") targetKey = "mask:input";
          if (targetKey === "base") targetKey = "imageA:input";
          if (targetKey === "blend") targetKey = "imageB:input";

          inputs[targetKey] = value ?? null;
        }
      }
    }

    const result = await executor.execute(inputs, nodeData);

    // Check if node requests a data update
    if (result && typeof result === "object" && "_updateNodeData" in result) {
      const { _updateNodeData, ...cleanResult } = result as any;

      // Update store immediately so subsequent nodes see the new state if needed
      const { updateNodeData } = (await import("@/store/pipelineStore")).default.getState() as any;
      updateNodeData(nodeId, _updateNodeData, true);

      nodeOutputs[nodeId] = cleanResult;
    } else {
      nodeOutputs[nodeId] = result;
    }
    executedNodes.push(nodeId);
  }

  const elapsed = performance.now() - start;

  // Log for benchmarking
  console.log(
    `[Pipeline v2.1] Executed: ${executedNodes.length} nodes | ` +
    `Skipped: ${skippedNodes.length} nodes | ` +
    `Time: ${elapsed.toFixed(2)}ms`
  );
  console.log(`[Pipeline v2.1] Executed: ${executedNodes.join(", ")}`);
  console.log(`[Pipeline v2.1] Skipped (cached): ${skippedNodes.join(", ")}`);

  return {
    outputs: nodeOutputs,
    clearedDirtyNodes: new Set<string>(),
    executionTimeMs: elapsed,
    skippedNodes,
    executedNodes,
  };
}
