"use client";

import { DragEvent, useCallback } from "react";

const nodeItems = [
  { type: "ImageInput", label: "Image Input" },
  { type: "Color", label: "Color" },
  { type: "Filter", label: "Filter" },
  { type: "Mask", label: "Mask" },
  { type: "Blend", label: "Blend" },
  { type: "Preview", label: "Preview" },
];

export default function Sidebar() {
  const onDragStart = useCallback(
    (event: DragEvent, nodeType: string) => {
      event.dataTransfer.setData("application/reactflow", nodeType);
      event.dataTransfer.effectAllowed = "move";
    },
    []
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-title">Nodes</div>
      <div className="sidebar-list">
        {nodeItems.map((item) => (
          <div
            key={item.type}
            className="sidebar-item"
            draggable
            onDragStart={(e) => onDragStart(e, item.type)}
          >
            <span className="sidebar-item-dot" />
            {item.label}
          </div>
        ))}
      </div>
    </aside>
  );
}
