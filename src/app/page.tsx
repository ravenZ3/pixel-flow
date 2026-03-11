"use client";

import dynamic from "next/dynamic";
import Sidebar from "@/components/Sidebar";
import ImageCanvas from "@/components/ImageCanvas";

const NodeEditor = dynamic(() => import("@/components/NodeEditor"), {
  ssr: false,
});

export default function Home() {
  return (
    <main className="app-shell">
      <Sidebar />
      <div className="editor-panel">
        <NodeEditor />
      </div>
      <ImageCanvas />
    </main>
  );
}
