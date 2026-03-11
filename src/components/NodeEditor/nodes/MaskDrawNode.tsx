"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";

function MaskDrawNode(_props: NodeProps) {
  return (
    <div className="node-surface">
      <div className="node-header">Mask Draw</div>
      <div className="node-body">
        <button className="node-btn node-btn-disabled" disabled>
          Draw Mask (coming soon)
        </button>
      </div>
      <Handle
        type="target"
        position={Position.Left}
        id="image"
        className="handle-image"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="image"
        className="handle-image"
        style={{ top: "40%" }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="mask"
        className="handle-mask"
        style={{ top: "60%" }}
      />
    </div>
  );
}

export default memo(MaskDrawNode);
