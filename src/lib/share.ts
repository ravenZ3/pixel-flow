import { Node, Edge } from "reactflow";

export interface SharedGraph {
  v: 1;
  nodes: Node[];
  edges: Edge[];
}

const RUNTIME_KEYS = new Set(["uploadedImage", "mask", "externalMask"]);

function stripRuntime(nodes: Node[]): Node[] {
  return nodes.map((n) => {
    if (!n.data) return n;
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(n.data)) {
      if (!RUNTIME_KEYS.has(k)) clean[k] = v;
    }
    return { ...n, data: clean };
  });
}

// btoa/atob handle binary as latin-1; we re-encode UTF-8 first so any user text in
// param values (e.g. Prompt nodes) survives the round-trip.
function utf8ToBase64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}
function base64ToUtf8(s: string): string {
  return decodeURIComponent(escape(atob(s)));
}

// URL-safe base64: + / → - _ , drop trailing =
function toUrlSafe(b64: string): string {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromUrlSafe(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return s.replace(/-/g, "+").replace(/_/g, "/") + pad;
}

export function encodeGraph(nodes: Node[], edges: Edge[]): string {
  const payload: SharedGraph = { v: 1, nodes: stripRuntime(nodes), edges };
  return toUrlSafe(utf8ToBase64(JSON.stringify(payload)));
}

export function decodeGraph(encoded: string): SharedGraph | null {
  try {
    const parsed = JSON.parse(base64ToUtf8(fromUrlSafe(encoded))) as SharedGraph;
    if (parsed.v !== 1 || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildShareUrl(nodes: Node[], edges: Edge[]): string {
  const encoded = encodeGraph(nodes, edges);
  const url = new URL(window.location.href);
  url.hash = `g=${encoded}`;
  return url.toString();
}

export function readGraphFromHash(): SharedGraph | null {
  if (typeof window === "undefined") return null;
  const h = window.location.hash;
  if (!h) return null;
  const m = /[#&]g=([^&]+)/.exec(h);
  if (!m) return null;
  return decodeGraph(m[1]);
}

export function clearGraphHash() {
  if (typeof window === "undefined") return;
  // Replace state without triggering navigation/reload.
  history.replaceState(null, "", window.location.pathname + window.location.search);
}
