"use client";

import usePipelineStore from "@/store/pipelineStore";

export default function ImageCanvas() {
  const nodes = usePipelineStore((s) => s.nodes);
  const nodeOutputs = usePipelineStore((s) => s.nodeOutputs);

  // Find the last Preview node in the graph
  const previewNodes = nodes.filter((n) => n.type === "Preview");
  const lastPreview = previewNodes[previewNodes.length - 1];
  const previewOutput = lastPreview ? nodeOutputs[lastPreview.id] : null;
  const image = previewOutput?.image ?? null;

  return (
    <aside className="preview-panel">
      <div className="preview-title">Output Preview</div>
      <div className="preview-container">
        {image ? (
          <div className="preview-image-wrapper">
            <img
              src={image}
              alt="Pipeline output"
              className="preview-image"
            />
          </div>
        ) : (
          <div className="preview-placeholder">
            <div className="preview-placeholder-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
            <span className="preview-placeholder-text">No output</span>
          </div>
        )}
      </div>
    </aside>
  );
}
