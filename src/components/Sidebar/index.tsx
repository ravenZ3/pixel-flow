"use client";

import { DragEvent, useCallback } from "react";

const nodeItems = [
  { type: "ImageInput", label: "Image Input" },
  { type: "Preview", label: "Preview" },
  { type: "Blur", label: "Blur" },
  { type: "Brightness", label: "Brightness" },
  { type: "MaskDraw", label: "Mask Draw" },
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
