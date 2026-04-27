import { GoogleGenAI, Type } from "@google/genai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type InBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

type InMessage =
  | { role: "user"; content: string | InBlock[] }
  | { role: "assistant"; content: InBlock[] };

type InTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

// Strip JSON-schema keywords Gemini doesn't accept. Gemini wants its own Schema shape.
function toGeminiSchema(s: unknown): Record<string, unknown> | undefined {
  if (!s || typeof s !== "object") return undefined;
  const src = s as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const t = src.type as string | undefined;
  if (t === "object") out.type = Type.OBJECT;
  else if (t === "array") out.type = Type.ARRAY;
  else if (t === "string") out.type = Type.STRING;
  else if (t === "number") out.type = Type.NUMBER;
  else if (t === "integer") out.type = Type.INTEGER;
  else if (t === "boolean") out.type = Type.BOOLEAN;

  if (typeof src.description === "string") out.description = src.description;
  if (src.enum) out.enum = src.enum;

  if (src.properties && typeof src.properties === "object") {
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(src.properties as Record<string, unknown>)) {
      const converted = toGeminiSchema(v);
      if (converted) props[k] = converted;
    }
    out.properties = props;
  }
  if (Array.isArray(src.required)) out.required = src.required;
  if (src.items) out.items = toGeminiSchema(src.items);
  return out;
}

function toolsToFunctionDeclarations(tools: InTool[]) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: toGeminiSchema(t.input_schema),
  }));
}

type Part =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

function messagesToContents(messages: InMessage[]) {
  // Track tool_use_id -> name so we can label tool_result parts correctly
  const toolIdToName = new Map<string, string>();
  const contents: { role: "user" | "model"; parts: Part[] }[] = [];

  for (const m of messages) {
    if (m.role === "assistant") {
      const parts: Part[] = [];
      for (const b of m.content) {
        if (b.type === "text") parts.push({ text: b.text });
        else if (b.type === "tool_use") {
          toolIdToName.set(b.id, b.name);
          parts.push({ functionCall: { name: b.name, args: b.input } });
        }
      }
      if (parts.length) contents.push({ role: "model", parts });
    } else {
      if (typeof m.content === "string") {
        contents.push({ role: "user", parts: [{ text: m.content }] });
      } else {
        const parts: Part[] = [];
        for (const b of m.content) {
          if (b.type === "text") parts.push({ text: b.text });
          else if (b.type === "tool_result") {
            const name = toolIdToName.get(b.tool_use_id) ?? "unknown_tool";
            let parsed: unknown;
            try {
              parsed = JSON.parse(b.content);
            } catch {
              parsed = { result: b.content };
            }
            const response =
              parsed && typeof parsed === "object" && !Array.isArray(parsed)
                ? (parsed as Record<string, unknown>)
                : { result: parsed };
            parts.push({ functionResponse: { name, response } });
          }
        }
        if (parts.length) contents.push({ role: "user", parts });
      }
    }
  }
  return contents;
}

let callCounter = 0;

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY (or GOOGLE_API_KEY) not set in .env.local" },
      { status: 500 }
    );
  }

  const body = await req.json();
  const { system, messages, tools } = body as {
    system: string;
    messages: InMessage[];
    tools: InTool[];
  };

  try {
    const ai = new GoogleGenAI({ apiKey });

    const contents = messagesToContents(messages);
    const functionDeclarations = toolsToFunctionDeclarations(tools);

    const modelChain = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
    let response;
    let lastErr: unknown;
    outer: for (const model of modelChain) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction: system,
              tools: [{ functionDeclarations }],
              // Enough headroom for tool calls + a short reply. Default budget
              // can be small once thinking tokens are subtracted, which causes
              // mid-sentence truncation.
              maxOutputTokens: 16384,
              // Cap thinking so it can't starve the actual output. -1 = dynamic
              // (Gemini decides), 0 disables, positive = explicit budget.
              thinkingConfig: { thinkingBudget: 2048 },
            },
          });
          break outer;
        } catch (e: unknown) {
          lastErr = e;
          const msg = e instanceof Error ? e.message : String(e);
          const overloaded = /503|UNAVAILABLE|overloaded|high demand/i.test(msg);
          const quota = /429|RESOURCE_EXHAUSTED|quota/i.test(msg);
          if (quota) break; // try next model in chain
          if (!overloaded || attempt === 2) {
            if (overloaded) break; // try next model
            throw e;
          }
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }
    if (!response) throw lastErr ?? new Error("no response");

    // Convert Gemini response parts back into Anthropic-shaped blocks for the client
    const outBlocks: InBlock[] = [];
    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    for (const p of parts) {
      if (p.text) outBlocks.push({ type: "text", text: p.text });
      else if (p.functionCall) {
        outBlocks.push({
          type: "tool_use",
          id: `call_${++callCounter}_${Date.now()}`,
          name: p.functionCall.name ?? "",
          input: (p.functionCall.args ?? {}) as Record<string, unknown>,
        });
      }
    }

    const hasToolUse = outBlocks.some((b) => b.type === "tool_use");
    const stop_reason = hasToolUse ? "tool_use" : "end_turn";

    return NextResponse.json({ content: outBlocks, stop_reason });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
