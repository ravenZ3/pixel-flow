"use client";

import { DragEvent, useCallback, useEffect, useState } from "react";
import useUIStore from "@/store/uiStore";

const nodeItems = [
  { type: "ImageInput", label: "Image Input" },
  { type: "Color", label: "Color" },
  { type: "Filter", label: "Filter" },
  { type: "CannyEdge", label: "Canny Edge" },
  { type: "ASCII", label: "ASCII Art" },
  { type: "Mask", label: "Mask" },
  { type: "Blend", label: "Blend" },
  { type: "Output", label: "Output" },
  { type: "Prompt", label: "Prompt" }
];

export default function Sidebar() {
  const onDragStart = useCallback(
    (event: DragEvent, nodeType: string) => {
      event.dataTransfer.setData("application/reactflow", nodeType);
      event.dataTransfer.effectAllowed = "move";
    },
    []
  );

  const saveTemplate = useUIStore((s) => s.saveTemplate);
  const loadTemplate = useUIStore((s) => s.loadTemplate);

  const [templates, setTemplates] = useState<string[]>([]);

  const refreshTemplates = useCallback(() => {
    if (typeof window !== "undefined") {
      const keys = Object.keys(localStorage).filter(k => k.startsWith("pixel-flow-template-"));
      setTemplates(keys.map(k => k.replace("pixel-flow-template-", "")));
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(refreshTemplates, 0);
    return () => clearTimeout(timer);
  }, [refreshTemplates]);

  const handleSave = () => {
    const name = window.prompt("Enter a name for this Pipeline Template:");
    if (name && name.trim()) {
      saveTemplate(name.trim());
      refreshTemplates();
    }
  };

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
      <div className="sidebar-title mt-6">Templates</div>
      <div className="sidebar-list">
        <button
          onClick={handleSave}
          className="sidebar-item !border-cyan-500/30 !bg-cyan-950/20 text-cyan-400 justify-center font-bold"
        >
          ✚ Save Layout
        </button>

        {templates.length === 0 && (
          <div className="text-xs text-zinc-500 p-2 text-center">No saved templates</div>
        )}

        {templates.map((name) => (
          <div
            key={name}
            className="sidebar-item cursor-pointer hover:!border-zinc-500"
            onClick={() => loadTemplate(name)}
          >
            <span className="sidebar-item-dot bg-cyan-400" />
            {name}
          </div>
        ))}
      </div>
    </aside>
  );
}
