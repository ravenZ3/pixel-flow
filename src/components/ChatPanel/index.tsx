"use client";

import React, { useEffect, useRef, useState } from "react";
import { runAgent, ChatMessage, TokenUsage } from "@/lib/agent/loop";

type LogEntry =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "tool"; name: string; input: Record<string, unknown> }
  | { kind: "error"; text: string };

const EXAMPLES = [
  "ASCII art with neon glow",
  "pencil sketch",
  "punchy black and white",
  "edges only, blueprint style",
];

export default function ChatPanel() {
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastModel, setLastModel] = useState<string | null>(null);
  const [tokens, setTokens] = useState<{ input: number; output: number; thinking: number; total: number }>({
    input: 0, output: 0, thinking: 0, total: 0,
  });
  const historyRef = useRef<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [log, busy]);

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || busy) return;
    setInput("");
    // Drop any stale error from a previous turn
    setLog((l) => [...l.filter((e) => e.kind !== "error"), { kind: "user", text }]);
    historyRef.current.push({ role: "user", content: text });
    setBusy(true);
    try {
      const updated = await runAgent(historyRef.current, {
        onAssistantText: (t) => setLog((l) => [...l, { kind: "assistant", text: t }]),
        onToolUse: (name, inp) => setLog((l) => [...l, { kind: "tool", name, input: inp }]),
        onModel: (m) => setLastModel(m),
        onUsage: (u: TokenUsage) =>
          setTokens((prev) => ({
            input: prev.input + u.input,
            output: prev.output + u.output,
            thinking: prev.thinking + u.thinking,
            total: prev.total + u.total,
          })),
      });
      historyRef.current = updated;
    } catch (e) {
      setLog((l) => [...l, { kind: "error", text: friendlyError(e) }]);
    } finally {
      setBusy(false);
    }
  };

  const clearConversation = () => {
    historyRef.current = [];
    setLog([]);
    setTokens({ input: 0, output: 0, thinking: 0, total: 0 });
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-4 right-4 z-40 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 hover:border-cyan-700/60 text-zinc-300 hover:text-cyan-300 px-4 py-2 text-sm shadow-lg backdrop-blur transition-colors"
      >
        <span>Agent</span>
      </button>
    );
  }

  return (
    <div className="absolute bottom-4 right-4 z-40 w-[400px] h-[520px] flex flex-col rounded-xl border border-zinc-800 bg-[#0a0a0a]/95 backdrop-blur shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-950/50">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-sm font-semibold text-zinc-100 shrink-0">Graph Agent</div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-600 shrink-0">
            {lastModel ? lastModel.replace("gemini-2.5-", "gemini · ") : "gemini"}
          </div>
          {tokens.total > 0 && (
            <div
              title={`input ${tokens.input.toLocaleString()}\noutput ${tokens.output.toLocaleString()}\nthinking ${tokens.thinking.toLocaleString()}\ntotal ${tokens.total.toLocaleString()}\n\napprox cost ≈ $${estimateCost(tokens, lastModel).toFixed(4)}`}
              className="text-[10px] font-mono text-zinc-500 truncate"
            >
              {formatTokens(tokens.total)} tok
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {log.length > 0 && (
            <button
              onClick={clearConversation}
              disabled={busy}
              title="Clear conversation"
              className="text-zinc-500 hover:text-zinc-200 text-xs px-1.5 py-0.5 rounded hover:bg-zinc-800 disabled:opacity-40"
            >
              clear
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            title="Hide"
            className="text-zinc-500 hover:text-zinc-200 text-sm px-1.5"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 text-sm">
        {log.length === 0 && <EmptyState onPick={(t) => send(t)} disabled={busy} />}

        {log.map((entry, i) => {
          if (entry.kind === "user") {
            return (
              <div key={i} className="flex gap-2">
                <div className="text-cyan-500 select-none">›</div>
                <div className="text-zinc-100 flex-1">{entry.text}</div>
              </div>
            );
          }
          if (entry.kind === "assistant") {
            return (
              <div key={i} className="text-zinc-300 leading-relaxed pl-3 border-l border-zinc-800">
                <Markdown text={entry.text} />
              </div>
            );
          }
          if (entry.kind === "tool") {
            return <ToolChip key={i} name={entry.name} input={entry.input} />;
          }
          return (
            <div
              key={i}
              className="text-xs text-red-300 bg-red-950/40 border border-red-900/50 rounded px-2 py-1.5"
            >
              {entry.text}
            </div>
          );
        })}

        {busy && (
          <div className="flex items-center gap-1.5 text-zinc-500 text-xs">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
            <span>thinking…</span>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="p-2 border-t border-zinc-800 bg-zinc-950/30">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          disabled={busy}
          placeholder="Describe a look…  (Enter to send · Shift+Enter for newline)"
          rows={2}
          className="w-full resize-none bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/30 disabled:opacity-60"
        />
      </div>
    </div>
  );
}

function EmptyState({ onPick, disabled }: { onPick: (t: string) => void; disabled: boolean }) {
  return (
    <div className="space-y-3 pt-2">
      <div className="text-zinc-400 text-xs leading-relaxed">
        Describe a look and the agent will build a node graph on your canvas. Upload an image first.
      </div>
      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => onPick(ex)}
            disabled={disabled}
            className="text-[11px] px-2 py-1 rounded-full border border-zinc-800 text-zinc-400 hover:text-cyan-300 hover:border-cyan-700 transition-colors disabled:opacity-50"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToolChip({ name, input }: { name: string; input: Record<string, unknown> }) {
  const detail = name === "apply_patch" ? summarizePatch(input) : "";
  const icon = name === "apply_patch" ? "✚" : name === "read_graph" ? "👁" : "≡";
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-500">
      <span className="text-amber-500/80">{icon}</span>
      <span className="text-zinc-400">{name}</span>
      {detail && <span className="text-zinc-600">{detail}</span>}
    </div>
  );
}

// Minimal markdown renderer — handles **bold**, `code`, and dash/numbered lists.
// Anything else passes through as plain text. No new dependency.
function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  // Tokenize on **bold** and `code`. Greedy enough for our use case.
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      out.push(<strong key={`b${key++}`} className="text-zinc-100">{tok.slice(2, -2)}</strong>);
    } else {
      out.push(<code key={`c${key++}`} className="font-mono text-[12px] bg-zinc-900 px-1 rounded text-cyan-300">{tok.slice(1, -1)}</code>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let listType: "ul" | "ol" | null = null;
  let para: string[] = [];
  let key = 0;

  const flushList = () => {
    if (!listType || listItems.length === 0) return;
    const Tag = listType;
    blocks.push(
      <Tag key={`l${key++}`} className={`my-1 pl-4 space-y-0.5 ${listType === "ul" ? "list-disc" : "list-decimal"}`}>
        {listItems}
      </Tag>
    );
    listItems = [];
    listType = null;
  };

  const flushPara = () => {
    if (para.length === 0) return;
    blocks.push(
      <p key={`p${key++}`} className="my-1">
        {renderInline(para.join(" "))}
      </p>
    );
    para = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushList();
      flushPara();
      continue;
    }
    const ulMatch = /^[-*]\s+(.*)$/.exec(line);
    const olMatch = /^\d+\.\s+(.*)$/.exec(line);
    if (ulMatch || olMatch) {
      flushPara();
      const next: "ul" | "ol" = ulMatch ? "ul" : "ol";
      if (listType && listType !== next) flushList();
      listType = next;
      const content = (ulMatch ?? olMatch)![1];
      listItems.push(<li key={`i${key++}`}>{renderInline(content)}</li>);
    } else {
      flushList();
      para.push(line);
    }
  }
  flushList();
  flushPara();
  return <>{blocks}</>;
}

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return (n / 1000).toFixed(1) + "k";
  return Math.round(n / 1000) + "k";
}

// Rough public-pricing estimate (per million tokens, as of early 2026).
// Numbers are best-effort; treat the displayed cost as an order-of-magnitude.
function estimateCost(
  t: { input: number; output: number; thinking: number },
  model: string | null
): number {
  // Pro is the priciest in the chain; default to its rates if model unknown.
  let inPerM = 1.25;
  let outPerM = 10.0;
  if (model?.includes("flash-lite")) {
    inPerM = 0.10;
    outPerM = 0.40;
  } else if (model?.includes("flash")) {
    inPerM = 0.30;
    outPerM = 2.50;
  } else if (model?.includes("pro")) {
    inPerM = 1.25;
    outPerM = 10.0;
  }
  // Thinking tokens billed at output rate per Gemini's docs.
  const inputCost = (t.input * inPerM) / 1_000_000;
  const outputCost = ((t.output + t.thinking) * outPerM) / 1_000_000;
  return inputCost + outputCost;
}

function summarizePatch(input: Record<string, unknown>): string {
  const parts: string[] = [];
  const add = input.add_nodes as unknown[] | undefined;
  const rem = input.remove_nodes as unknown[] | undefined;
  const ae = input.add_edges as unknown[] | undefined;
  const re = input.remove_edges as unknown[] | undefined;
  const sp = input.set_params as unknown[] | undefined;
  if (add?.length) parts.push(`+${add.length} node${add.length > 1 ? "s" : ""}`);
  if (rem?.length) parts.push(`−${rem.length} node${rem.length > 1 ? "s" : ""}`);
  if (ae?.length) parts.push(`+${ae.length} edge${ae.length > 1 ? "s" : ""}`);
  if (re?.length) parts.push(`−${re.length} edge${re.length > 1 ? "s" : ""}`);
  if (sp?.length) parts.push(`~${sp.length} param${sp.length > 1 ? "s" : ""}`);
  return parts.join(" · ");
}

function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(raw)) {
    return "Rate limit hit. Wait ~60s or enable billing on your Gemini key.";
  }
  if (/503|UNAVAILABLE|overloaded|high demand/i.test(raw)) {
    return "Gemini is overloaded right now. Try again in a moment.";
  }
  if (/API_KEY_INVALID|API key/i.test(raw)) {
    return "API key invalid or expired. Update GEMINI_API_KEY in .env.local and restart the dev server.";
  }
  if (/network|fetch/i.test(raw)) {
    return "Network error reaching the agent. Check the dev server.";
  }
  // Default: show first 200 chars, no JSON walls
  return raw.length > 240 ? raw.slice(0, 240) + "…" : raw;
}
