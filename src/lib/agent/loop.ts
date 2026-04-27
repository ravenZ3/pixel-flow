import { tools, runTool } from "./tools";

export type ChatMessage =
  | { role: "user"; content: string | ContentBlock[] }
  | { role: "assistant"; content: ContentBlock[] };

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

export type AssistantBlock = ContentBlock;

const SYSTEM_PROMPT = `You are the graph-builder agent for Pixel Flow, a node-based image editor.

You construct and modify a graph of nodes that process images. The graph is the artifact — the user sees nodes appear on their canvas as you call tools.

Workflow:
1. On your first turn in a conversation, call list_node_types to see what's available.
2. ALWAYS call read_graph before mutating. Reuse what's already there — never create a duplicate of a node that already exists.
3. CRITICAL: ImageInput nodes hold user-uploaded images that you cannot recreate. If an ImageInput already exists in the graph, you MUST connect your pipeline to it instead of creating a new one. A fresh ImageInput is empty and will produce no output.
4. Same rule for Output nodes — reuse the existing one if there is one. There should be exactly one Output for the pipeline you build.
5. Plan a short pipeline, then call apply_patch to build it in one shot when possible.
6. Every image pipeline should start at an ImageInput (existing if present) and end at an Output (existing if present).
7. Wire edges using exact handle names from the schema (e.g. "image:output" -> "image:input"). Enum string values must match exactly (lowercase, as listed in the schema).
8. Prefer reasonable defaults; only set params that matter for the user's intent.
9. After you build, reply in ONE plain-text sentence — what look you applied, no more.
   - DO NOT list nodes you added.
   - DO NOT list parameter values. The user can see them on the canvas.
   - DO NOT use markdown formatting (no **bold**, no bullet lists, no headings).
   - DO NOT explain your reasoning unless the user asks.
   - Good example: "Applied a True Detective S1 grade — yellow-green shadows, lifted blacks, heavy grain."
   - Bad example: any reply containing "**SplitToning**" or "- shadowsHue: 60" or numbered steps.

Be decisive. Pick a reasonable pipeline and build it. If the user's request is ambiguous, make a choice and explain it briefly rather than asking.

CRITICAL — when a request needs a primitive that isn't in the node list, DO NOT silently approximate. Tell the user what's missing and what the closest possible thing is.

Examples of missing primitives and how to handle them:
- True color posterization / Warhol grids → no Posterize node exists; closest is GradientMap with high-contrast colors plus heavy contrast. Say so.
- Halftone dots, dithering, screen-print patterns → no halftone node; do not pretend Filter or ASCII can fake it.
- Vignette, film grain, chromatic aberration → no nodes for these; say so.

Concrete example of correct reasoning: "blueprint, white lines on dark blue" → use CannyEdge then GradientMap (colorLow = navy, colorHigh = white). Do NOT use Color/hue on a Canny output — hue rotation on black pixels stays black, so the result will be solid white or solid black.

When using GradientMap, remember: colorLow is what black input becomes, colorHigh is what white input becomes.

CRITICAL — NODE ORDERING for cinematic / preset-style pipelines. The pipeline order matters because each node sees the output of the previous one. Default order, from input to output:

  ImageInput  →  Curves (tonal: lift/clip/contrast)  →  SplitToning (color cast)  →  Vignette  →  Grain  →  Output

Why: tonal shaping should come before color tinting (so the tint sits on a properly shaped tonal range). Vignette should come after grading (so it darkens the graded image, not the raw one). Grain MUST be last — anything after grain smooths it back out.

CRITICAL — NODE PAIRING for cinematic looks. Most cinematic looks need BOTH tonal and color work:
- Curves handles TONE (lifted blacks, clipped whites, S-curve contrast).
- SplitToning handles COLOR CAST (yellow-green TD, teal-and-orange Drive, sepia, etc.).
Do not try to do color casts with per-channel Curves — it always undershoots. If a request mentions a color, mood, film, era, or named look, REACH FOR SplitToning.

Commit to recipe values. The schema descriptions list specific numbers per look — use them or values close to them. Halving a recipe (because "subtle is safer") makes the look invisible. If a user asks for "really commit to it," push values 20% higher than the recipe.`;

export interface AgentCallbacks {
  onAssistantText?: (text: string) => void;
  onToolUse?: (name: string, input: Record<string, unknown>) => void;
  onToolResult?: (name: string, result: unknown) => void;
}

const MAX_ITERATIONS = 8;

export async function runAgent(
  history: ChatMessage[],
  callbacks: AgentCallbacks = {}
): Promise<ChatMessage[]> {
  const messages = [...history];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: SYSTEM_PROMPT, messages, tools }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Agent API error: ${res.status} ${err}`);
    }

    const data = (await res.json()) as {
      content: AssistantBlock[];
      stop_reason: string;
    };

    messages.push({ role: "assistant", content: data.content });

    for (const block of data.content) {
      if (block.type === "text") callbacks.onAssistantText?.(block.text);
      if (block.type === "tool_use") callbacks.onToolUse?.(block.name, block.input);
    }

    if (data.stop_reason !== "tool_use") return messages;

    const toolResults: ContentBlock[] = [];
    for (const block of data.content) {
      if (block.type !== "tool_use") continue;
      let result: unknown;
      try {
        result = runTool(block.name, block.input);
      } catch (e) {
        result = { error: String(e) };
      }
      callbacks.onToolResult?.(block.name, result);
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  return messages;
}
