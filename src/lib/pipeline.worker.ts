import nodeRegistry from "./nodeRegistry";

self.onmessage = async (e: MessageEvent) => {
  if (e.data.type !== 'EXECUTE') return;

  const { nodes, edges, nodeOutputs, dirtyNodes, nodeDataMap } = e.data.payload;
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
    const node = nodes.find((n: any) => n.id === nodeId);
    if (!node || !node.type) continue;

    const isDirty = dirtyNodes.has(nodeId);
    const hasCachedOutput = !!nodeOutputs[nodeId];

    if (!isDirty && hasCachedOutput) {
      skippedNodes.push(nodeId);
      continue;
    }

    const executor = nodeRegistry[node.type];
    if (!executor) {
      skippedNodes.push(nodeId);
      continue;
    }

    const inputs: Record<string, ImageBitmap | string | null> = {};
    const nodeData = nodeDataMap[nodeId];

    for (const [key, value] of Object.entries(nodeData)) {
      inputs[key] = (value as ImageBitmap | string | null) ?? null;
    }

    // Overlay inputs from connected upstream nodes
    for (const edge of edges) {
      if (edge.target === nodeId) {
        const sourceOutputs = nodeOutputs[edge.source];
        if (sourceOutputs && edge.sourceHandle && edge.targetHandle) {
          let value = sourceOutputs[edge.sourceHandle];

          if (value === undefined) {
            if (edge.sourceHandle === "image") value = sourceOutputs["image:output"];
            if (edge.sourceHandle === "mask") value = sourceOutputs["mask:output"];
          }

          let targetKey = edge.targetHandle;
          if (targetKey === "image") targetKey = "image:input";
          if (targetKey === "mask") targetKey = "mask:input";
          if (targetKey === "base") targetKey = "imageA:input";
          if (targetKey === "blend") targetKey = "imageB:input";

          inputs[targetKey] = value ?? null;
        }
      }
    }

    try {
      const result = await executor.execute(inputs, nodeData);
      nodeOutputs[nodeId] = result;
      executedNodes.push(nodeId);
    } catch (err: any) {
      console.error(`Error executing node ${nodeId}:`, err);
      // Skip it and proceed
    }
  }

  const elapsed = performance.now() - start;

  console.log(
    `[Worker Pipeline v3.0] Executed: ${executedNodes.length} nodes | ` +
    `Skipped: ${skippedNodes.length} nodes | ` +
    `Time: ${elapsed.toFixed(2)}ms`
  );

  self.postMessage({
    type: 'SUCCESS',
    payload: {
      outputs: nodeOutputs,
      clearedDirtyNodes: new Set<string>(), // Needs to be constructed as a list, Wait, postMessage treats Set fine in modern browsers, but actually it is safer to pass Arrays
      executionTimeMs: elapsed,
      skippedNodes,
      executedNodes,
    }
  });
};
