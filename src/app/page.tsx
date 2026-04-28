"use client";

import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Sidebar from "@/components/Sidebar";
import ImageCanvas from "@/components/ImageCanvas";
import ChatPanel from "@/components/ChatPanel";

const NodeEditor = dynamic(() => import("@/components/NodeEditor"), {
  ssr: false,
});

const MIN_PREVIEW = 280;
const MAX_PREVIEW = 700;
const DEFAULT_PREVIEW = 360;

const MIN_SIDEBAR = 160;
const MAX_SIDEBAR = 400;
const DEFAULT_SIDEBAR = 180;

export default function Home() {
  const [previewWidth, setPreviewWidth] = useState(DEFAULT_PREVIEW);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR);
  const isDraggingPreview = useRef(false);
  const isDraggingSidebar = useRef(false);

  const startResizePreview = useCallback(
    (e: React.MouseEvent) => {
      isDraggingPreview.current = true;
      const startX = e.clientX;
      const startWidth = previewWidth;

      const onMouseMove = (e: MouseEvent) => {
        if (!isDraggingPreview.current) return;
        const delta = startX - e.clientX;
        setPreviewWidth(Math.min(MAX_PREVIEW, Math.max(MIN_PREVIEW, startWidth + delta)));
      };

      const onMouseUp = () => {
        isDraggingPreview.current = false;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [previewWidth]
  );

  const startResizeSidebar = useCallback(
    (e: React.MouseEvent) => {
      isDraggingSidebar.current = true;
      const startX = e.clientX;
      const startWidth = sidebarWidth;

      const onMouseMove = (e: MouseEvent) => {
        if (!isDraggingSidebar.current) return;
        const delta = e.clientX - startX;
        setSidebarWidth(Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, startWidth + delta)));
      };

      const onMouseUp = () => {
        isDraggingSidebar.current = false;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [sidebarWidth]
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0a0a]">
      {/* Sidebar */}
      <div style={{ width: sidebarWidth }} className="shrink-0 bg-[#0c0c0c]">
        <Sidebar />
      </div>

      {/* Sidebar resize handle */}
      <div
        onMouseDown={startResizeSidebar}
        className="w-1 cursor-col-resize bg-zinc-900 hover:bg-cyan-500/50 transition-colors shrink-0 z-50 relative after:absolute after:inset-y-0 after:-left-2 after:-right-2 after:cursor-col-resize"
      />

      {/* Node Editor */}
      <div className="flex-1 min-w-0 bg-[#0f0f0f] relative">
        <NodeEditor />
        <ChatPanel />
      </div>

      {/* Preview resize handle */}
      <div
        onMouseDown={startResizePreview}
        className="w-1 cursor-col-resize bg-zinc-900 hover:bg-cyan-500/50 transition-colors shrink-0 z-50 relative after:absolute after:inset-y-0 after:-left-2 after:-right-2 after:cursor-col-resize"
      />

      {/* Preview Panel */}
      <div
        style={{ width: previewWidth }}
        className="shrink-0 flex flex-col bg-[#0a0a0a]"
      >
        <ImageCanvas />
      </div>
    </div>
  );
}
