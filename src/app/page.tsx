"use client";

import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Sidebar from "@/components/Sidebar";
import ImageCanvas from "@/components/ImageCanvas";

const NodeEditor = dynamic(() => import("@/components/NodeEditor"), {
  ssr: false,
});

const MIN_WIDTH = 280;
const MAX_WIDTH = 700;
const DEFAULT_WIDTH = 360;

export default function Home() {
  const [previewWidth, setPreviewWidth] = useState(DEFAULT_WIDTH);
  const isDragging = useRef(false);

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true;
      const startX = e.clientX;
      const startWidth = previewWidth;

      const onMouseMove = (e: MouseEvent) => {
        if (!isDragging.current) return;
        const delta = startX - e.clientX;
        const newWidth = Math.min(
          MAX_WIDTH,
          Math.max(MIN_WIDTH, startWidth + delta)
        );
        setPreviewWidth(newWidth);
      };

      const onMouseUp = () => {
        isDragging.current = false;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [previewWidth]
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0a0a]">
      {/* Sidebar */}
      <div className="w-[180px] shrink-0 border-r border-zinc-900 bg-[#0c0c0c]">
        <Sidebar />
      </div>

      {/* Node Editor */}
      <div className="flex-1 min-w-0 bg-[#0f0f0f]">
        <NodeEditor />
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={startResize}
        className="w-1 cursor-col-resize bg-zinc-900 hover:bg-cyan-500/50 transition-colors shrink-0 z-50 relative after:absolute after:inset-y-0 after:-left-2 after:-right-2 after:cursor-col-resize"
      />

      {/* Preview Panel */}
      <div
        style={{ width: previewWidth }}
        className="shrink-0 border-l border-zinc-900 flex flex-col bg-[#0a0a0a]"
      >
        <ImageCanvas />
      </div>
    </div>
  );
}
