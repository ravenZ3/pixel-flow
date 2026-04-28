"use client";

import { DragEvent, useCallback, useEffect, useState } from "react";
import useUIStore from "@/store/uiStore";
import { buildShareUrl } from "@/lib/share";

type NodeCategory = "source" | "adjust" | "stylize" | "generate" | "composite" | "sink" | "other";

interface NodeItem {
  type: string;
  label: string;
  category: NodeCategory;
  description?: string;
}

const nodeItems: NodeItem[] = [
  { type: "ImageInput", label: "Image Input", category: "source", description: "Upload a photo" },
  { type: "Color", label: "Color", category: "adjust", description: "Hue, saturation, brightness" },
  { type: "Curves", label: "Curves", category: "adjust", description: "RGB tone curves" },
  { type: "SplitToning", label: "Split Toning", category: "adjust", description: "Shadows & highlights color" },
  { type: "Filter", label: "Filter", category: "adjust", description: "Blur, sharpen" },
  { type: "CannyEdge", label: "Canny Edge", category: "stylize", description: "Edge detection" },
  { type: "Posterize", label: "Posterize", category: "stylize", description: "Reduce color levels" },
  { type: "GradientMap", label: "Gradient Map", category: "stylize", description: "Luminance to color ramp" },
  { type: "Vignette", label: "Vignette", category: "stylize", description: "Radial darkening" },
  { type: "Grain", label: "Grain", category: "stylize", description: "Film grain" },
  { type: "ASCII", label: "ASCII Art", category: "stylize", description: "Character rendering" },
  { type: "SolidFill", label: "Solid Fill", category: "generate", description: "Flat color emitter" },
  { type: "Mask", label: "Mask", category: "composite", description: "Draw a mask" },
  { type: "Blend", label: "Blend", category: "composite", description: "Layer blend modes" },
  { type: "Output", label: "Output", category: "sink", description: "Preview node" },
];

const categoryOrder: { key: NodeCategory; label: string }[] = [
  { key: "source", label: "Source" },
  { key: "adjust", label: "Adjust" },
  { key: "stylize", label: "Stylize" },
  { key: "generate", label: "Generate" },
  { key: "composite", label: "Composite" },
  { key: "sink", label: "Output" },
];

const categoryColor: Record<NodeCategory, { dot: string; hover: string; text: string }> = {
  source:    { dot: "bg-amber-400",   hover: "hover:border-amber-900/60 hover:bg-amber-950/20",   text: "text-amber-500" },
  adjust:    { dot: "bg-cyan-400",    hover: "hover:border-cyan-900/60 hover:bg-cyan-950/20",     text: "text-cyan-500" },
  stylize:   { dot: "bg-violet-400",  hover: "hover:border-violet-900/60 hover:bg-violet-950/20", text: "text-violet-500" },
  generate:  { dot: "bg-emerald-400", hover: "hover:border-emerald-900/60 hover:bg-emerald-950/20", text: "text-emerald-500" },
  composite: { dot: "bg-orange-400",  hover: "hover:border-orange-900/60 hover:bg-orange-950/20", text: "text-orange-500" },
  sink:      { dot: "bg-rose-400",    hover: "hover:border-rose-900/60 hover:bg-rose-950/20",     text: "text-rose-500" },
  other:     { dot: "bg-zinc-500",    hover: "hover:border-zinc-700 hover:bg-zinc-900/50",        text: "text-zinc-500" },
};

export default function Sidebar() {
  const onDragStart = useCallback((event: DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  }, []);

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
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none"
            width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search nodes…"
            className="w-full bg-zinc-900/60 border border-zinc-800 rounded-md pl-7 pr-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-cyan-700/60 focus:ring-1 focus:ring-cyan-700/20 transition-colors"
          />
        </div>
      </div>

      {/* Scrollable nodes */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
        {grouped.map((cat) => (
          <div key={cat.key}>
            <div className="flex items-center gap-2 px-2 pt-2 pb-1">
              <span className={`h-1 w-1 rounded-full shrink-0 ${categoryColor[cat.key].dot}`} />
              <span className="text-[9px] uppercase tracking-[0.12em] text-zinc-600 font-semibold">
                {cat.label}
              </span>
              <div className="flex-1 h-px bg-zinc-900" />
            </div>
            <div className="space-y-px">
              {cat.items.map((item) => (
                <div
                  key={item.type}
                  draggable
                  onDragStart={(e) => onDragStart(e, item.type)}
                  title={item.description}
                  className={`group flex items-center gap-2.5 px-2 py-2 rounded-md cursor-grab active:cursor-grabbing border border-transparent transition-all ${categoryColor[item.category].hover}`}
                >
                  {/* Drag handle */}
                  <svg
                    className="shrink-0 text-zinc-700 group-hover:text-zinc-500 transition-colors"
                    width="8" height="12" viewBox="0 0 8 12" fill="currentColor"
                  >
                    <circle cx="2" cy="2" r="1.2" /><circle cx="6" cy="2" r="1.2" />
                    <circle cx="2" cy="6" r="1.2" /><circle cx="6" cy="6" r="1.2" />
                    <circle cx="2" cy="10" r="1.2" /><circle cx="6" cy="10" r="1.2" />
                  </svg>
                  <span className="flex-1 text-xs text-zinc-300 group-hover:text-zinc-100 truncate transition-colors">
                    {item.label}
                  </span>
                  {item.description && (
                    <span className="hidden group-hover:block text-[10px] text-zinc-600 truncate max-w-[80px] shrink-0">
                      {item.description}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {grouped.length === 0 && (
          <div className="text-xs text-zinc-600 text-center py-8">No matches</div>
        )}
      </div>

      {/* Bottom panel */}
      <div className="shrink-0 border-t border-zinc-900 px-3 py-3 space-y-2">
        {/* Share */}
        <button
          onClick={handleShare}
          title="Copy a URL that recreates this graph (image not included)"
          className={`w-full text-xs px-3 py-2 rounded-md border transition-all font-mono tracking-wide ${
            shareStatus === "copied"
              ? "border-emerald-700/50 bg-emerald-950/30 text-emerald-300"
              : shareStatus === "error"
              ? "border-amber-700/50 bg-amber-950/30 text-amber-300"
              : "border-cyan-800/40 bg-cyan-950/20 text-cyan-400 hover:bg-cyan-900/30 hover:border-cyan-700/50"
          }`}
        >
          {shareStatus === "copied"
            ? "✓ Link copied"
            : shareStatus === "error"
            ? "URL in address bar"
            : "↗  Share Graph"}
        </button>

        {/* Templates */}
        <div>
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-[9px] uppercase tracking-[0.12em] text-zinc-600 font-semibold">
              Templates
            </span>
            <button
              onClick={handleSave}
              title="Save current graph as a template"
              className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-cyan-400 transition-colors px-1 py-0.5 rounded"
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              save
            </button>
          </div>

          {templates.length === 0 ? (
            <div className="text-[11px] text-zinc-700 italic px-1 py-1">No saved templates</div>
          ) : (
            <div className="space-y-px max-h-[120px] overflow-y-auto">
              {templates.map((name) => (
                <div
                  key={name}
                  className="group flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60 cursor-pointer border border-transparent hover:border-zinc-800 transition-all"
                  onClick={() => loadTemplate(name)}
                >
                  <span className="h-1 w-1 rounded-full bg-cyan-500 shrink-0" />
                  <span className="flex-1 truncate">{name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(name); }}
                    className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all text-[11px] px-1"
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
