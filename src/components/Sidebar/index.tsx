"use client";

import { DragEvent, useCallback, useEffect, useState } from "react";
import useUIStore from "@/store/uiStore";
import { buildShareUrl } from "@/lib/share";

type NodeCategory = "source" | "adjust" | "stylize" | "generate" | "composite" | "sink" | "other";

interface NodeItem {
  type: string;
  label: string;
  category: NodeCategory;
}

const nodeItems: NodeItem[] = [
  { type: "ImageInput", label: "Image Input", category: "source" },
  { type: "Color", label: "Color", category: "adjust" },
  { type: "Curves", label: "Curves", category: "adjust" },
  { type: "SplitToning", label: "Split Toning", category: "adjust" },
  { type: "Filter", label: "Filter", category: "adjust" },
  { type: "CannyEdge", label: "Canny Edge", category: "stylize" },
  { type: "Posterize", label: "Posterize", category: "stylize" },
  { type: "GradientMap", label: "Gradient Map", category: "stylize" },
  { type: "Vignette", label: "Vignette", category: "stylize" },
  { type: "Grain", label: "Grain", category: "stylize" },
  { type: "ASCII", label: "ASCII Art", category: "stylize" },
  { type: "SolidFill", label: "Solid Fill", category: "generate" },
  { type: "Mask", label: "Mask", category: "composite" },
  { type: "Blend", label: "Blend", category: "composite" },
  { type: "Output", label: "Output", category: "sink" },
  { type: "Prompt", label: "Prompt", category: "other" },
];

const categoryOrder: { key: NodeCategory; label: string }[] = [
  { key: "source", label: "Source" },
  { key: "adjust", label: "Adjust" },
  { key: "stylize", label: "Stylize" },
  { key: "generate", label: "Generate" },
  { key: "composite", label: "Composite" },
  { key: "sink", label: "Output" },
  { key: "other", label: "Other" },
];

const categoryDot: Record<NodeCategory, string> = {
  source: "bg-amber-400",
  adjust: "bg-cyan-400",
  stylize: "bg-violet-400",
  generate: "bg-emerald-400",
  composite: "bg-orange-400",
  sink: "bg-rose-400",
  other: "bg-zinc-500",
};

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
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "error">("idle");
  const [filter, setFilter] = useState("");

  const handleShare = useCallback(async () => {
    const { nodes, edges } = useUIStore.getState();
    if (nodes.length === 0) return;
    const url = buildShareUrl(nodes, edges);
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus("copied");
    } catch {
      window.location.hash = new URL(url).hash;
      setShareStatus("error");
    }
    setTimeout(() => setShareStatus("idle"), 2000);
  }, []);

  const refreshTemplates = useCallback(() => {
    if (typeof window !== "undefined") {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith("pixel-flow-template-"));
      setTemplates(keys.map((k) => k.replace("pixel-flow-template-", "")));
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(refreshTemplates, 0);
    return () => clearTimeout(timer);
  }, [refreshTemplates]);

  const handleSave = () => {
    const name = window.prompt("Name this template:");
    if (name && name.trim()) {
      saveTemplate(name.trim());
      refreshTemplates();
    }
  };

  const handleDeleteTemplate = (name: string) => {
    if (!window.confirm(`Delete template "${name}"?`)) return;
    localStorage.removeItem(`pixel-flow-template-${name}`);
    refreshTemplates();
  };

  const f = filter.trim().toLowerCase();
  const filtered = f
    ? nodeItems.filter((n) => n.label.toLowerCase().includes(f) || n.type.toLowerCase().includes(f))
    : nodeItems;
  const grouped = categoryOrder
    .map((cat) => ({ ...cat, items: filtered.filter((n) => n.category === cat.key) }))
    .filter((cat) => cat.items.length > 0);

  return (
    <aside className="sidebar flex flex-col h-full">
      {/* Search */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search nodes…"
          className="w-full bg-zinc-900/60 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-cyan-700 focus:ring-1 focus:ring-cyan-700/30"
        />
      </div>

      {/* Scrollable nodes */}
      <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-3">
        {grouped.map((cat) => (
          <div key={cat.key}>
            <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-semibold px-1 mb-1.5">
              {cat.label}
            </div>
            <div className="space-y-0.5">
              {cat.items.map((item) => (
                <div
                  key={item.type}
                  draggable
                  onDragStart={(e) => onDragStart(e, item.type)}
                  className="group flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-zinc-300 cursor-grab hover:bg-zinc-900/70 hover:text-zinc-100 active:cursor-grabbing border border-transparent hover:border-zinc-800"
                >
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${categoryDot[item.category]}`} />
                  <span className="flex-1 truncate">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {grouped.length === 0 && (
          <div className="text-xs text-zinc-600 text-center py-6">No matches</div>
        )}
      </div>

      {/* Bottom panel: Graph + Templates */}
      <div className="shrink-0 border-t border-zinc-900 px-3 py-3 space-y-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-semibold px-1 mb-1.5">
            Graph
          </div>
          <button
            onClick={handleShare}
            title="Copy a URL that recreates this graph (image not included)"
            className="w-full text-xs px-2.5 py-1.5 rounded-md border border-cyan-700/40 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-900/30 hover:border-cyan-600/60 transition-colors"
          >
            {shareStatus === "copied"
              ? "✓ Link copied"
              : shareStatus === "error"
              ? "URL in address bar — copy"
              : "↗ Share Graph"}
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between px-1 mb-1.5">
            <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-semibold">
              Templates
            </div>
            <button
              onClick={handleSave}
              title="Save current graph as a template"
              className="text-[10px] text-zinc-500 hover:text-cyan-400 px-1"
            >
              + save
            </button>
          </div>

          {templates.length === 0 ? (
            <div className="text-[11px] text-zinc-600 italic px-1 py-1">No saved templates</div>
          ) : (
            <div className="space-y-0.5 max-h-[140px] overflow-y-auto">
              {templates.map((name) => (
                <div
                  key={name}
                  className="group flex items-center gap-2 px-2 py-1 rounded-md text-xs text-zinc-300 hover:bg-zinc-900/70 hover:text-zinc-100 cursor-pointer border border-transparent hover:border-zinc-800"
                  onClick={() => loadTemplate(name)}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shrink-0" />
                  <span className="flex-1 truncate">{name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTemplate(name);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 text-[11px] px-1 transition-opacity"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
