import { Node, Edge } from "reactflow";

let workerInstance: Worker | null = null;
let currentResolve: ((res: any) => void) | null = null;
let currentReject: ((err: any) => void) | null = null;

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
  if (typeof window !== "undefined" && !workerInstance) {
    workerInstance = new Worker(new URL('./pipeline.worker.ts', import.meta.url), { type: 'module' });
    workerInstance.onmessage = (e) => {
      if (e.data.type === 'SUCCESS' && currentResolve) {
        currentResolve(e.data.payload);
      } else if (e.data.type === 'ERROR' && currentReject) {
        currentReject(e.data.error);
      }
    };
  }

  return new Promise((resolve, reject) => {
    currentResolve = resolve;
    currentReject = reject;
    
    // map node data because functions in data are not serializable
    const nodeDataMap: Record<string, any> = {};
    for (const n of nodes) {
      nodeDataMap[n.id] = getNodeData(n.id);
    }
    
    if (workerInstance) {
      workerInstance.postMessage({
        type: 'EXECUTE',
        payload: {
          nodes,
          edges,
          nodeOutputs,
          dirtyNodes,
          nodeDataMap
        }
      });
    } else {
       reject(new Error("Worker not available"));
    }
  });
}
