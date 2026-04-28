import { tools, runTool } from "./tools";
import nodeRegistry from "@/lib/nodeRegistry";
import { RECIPES } from "@/lib/recipes";

function buildNodeSchema(): string {
  const out: Record<string, unknown> = {};
  for (const [type, exec] of Object.entries(nodeRegistry)) {
    out[type] = exec.schema;
  }
  return JSON.stringify(out);
}

export type ChatMessage =
  | { role: "user"; content: string | ContentBlock[] }
  | { role: "assistant"; content: ContentBlock[] };

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

export type AssistantBlock = ContentBlock;

const NODE_SCHEMA = buildNodeSchema();

const SYSTEM_PROMPT = `You are the graph-builder agent for Pixel Flow, a node-based image editor.

You construct and modify a graph of nodes that process images. The graph is the artifact — the user sees nodes appear on their canvas as you call tools.

The complete node type schema is provided below — do NOT call list_node_types, it no longer exists. Use this schema directly to plan pipelines and wire edges.

--- NODE TYPES ---
${NODE_SCHEMA}
--- END NODE TYPES ---

${RECIPES}

Workflow:
1. ALWAYS call read_graph before mutating. Reuse what's already there — never create a duplicate of a node that already exists.
2. CRITICAL: ImageInput nodes hold user-uploaded images that you cannot recreate. If an ImageInput already exists in the graph, you MUST connect your pipeline to it instead of creating a new one. A fresh ImageInput is empty and will produce no output.
3. Same rule for Output nodes — reuse the existing one if there is one. There should be exactly one Output for the pipeline you build.
4. Plan a short pipeline, then call apply_patch to build it in one shot when possible.
5. Every image pipeline should start at an ImageInput (existing if present) and end at an Output (existing if present).
6. Wire edges using exact handle names from the schema (e.g. "image:output" -> "image:input"). Enum string values must match exactly (lowercase, as listed in the schema).
7. Prefer reasonable defaults; only set params that matter for the user's intent.
8. CRITICAL — you MUST actually call apply_patch to create / modify nodes. Saying "I applied X" or "Added a curves node" without calling apply_patch this turn is a LIE — the canvas does not change unless apply_patch executes. If the user asks you to build something, your turn is incomplete until apply_patch has been called.

9. EFFICIENCY — emit your one-sentence summary text in the SAME response as your apply_patch tool call (text and tool_use blocks together in the same content). Do not wait for a separate round-trip. The user's "what was applied" message and your apply_patch should arrive together.

10. The summary must be ONE plain-text sentence — what look you applied, no more.
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

CRITICAL — NODE ORDERING: ImageInput → Curves (tonal/surgical) → SplitToning (color cast) → Vignette → Grain → Output. Tonal shaping must precede tinting; grain must be last to preserve texture.

EVERY cinematic pipeline MUST include all four nodes (Curves, SplitToning, Vignette, Grain). Omitting one makes the look read as a "filter" rather than film.
- Curves: Use both Master (tone) and per-channel (surgical nudges ±5-15) as listed in recipes.
- SplitToning: Handles the main color cast (saturation 30+).
- Vignette: Framing/mood (usually darken).
- Grain: Essential texture (always include).

FLOOR RULES: Never set saturation < 25, vignette amount > -25 (weaker), grain < 20, or BlackPoint < 20. Values below these floors are invisible. The 0-100 scale is percent-of-effect; treat 50 as moderate. Use recipe values verbatim; do not "soften" them.

CRITICAL — NAMED-LOOK MATCHING. When the user names a specific film, mood, or aesthetic (Twilight, True Detective, Drive, Wes Anderson, sepia, cyanotype, etc.), refer to the [CINEMATIC LOOK RECIPES] block above for the EXACT values. Use the recipe whose name matches verbatim. Do NOT:
- Reuse the previous turn's values "because they were close enough."
- Average two recipes.
- Default to a generic cinematic preset.
- Tweak only Curves and leave SplitToning unchanged from the previous look.

Each turn, the user message may be prepended with an [Image context: ...] block containing luminance, contrast, and color statistics about their photo.
- USE these stats to dial in your node parameters.
- If Luminance is >70% (Bright), do NOT lift blacks/shadows in Curves unless specifically asked.
- If Contrast is <30% (Flat), use Curves to add a slight S-curve to bring life back.
- If there is a "Cool" or "Warm" cast, use SplitToning to either neutralize it (using the opposite hue) or lean into it (using the same hue) based on the requested aesthetic.
- If Saturation is >60% (Vibrant), be conservative with SplitToning saturations.

Each named look has DIFFERENT values. If you build pipelines for two different looks and the numbers come out identical, you have failed to read the recipes — re-read the [CINEMATIC LOOK RECIPES] block and use the entries verbatim.`;

export interface TokenUsage {
  input: number;
  output: number;
  thinking: number;
  total: number;
}

export interface AgentCallbacks {
  onAssistantText?: (text: string) => void;
  onToolUse?: (name: string, input: Record<string, unknown>) => void;
  onToolResult?: (name: string, result: unknown) => void;
  onModel?: (model: string) => void;
  onUsage?: (usage: TokenUsage) => void;
}

const MAX_ITERATIONS = 8;

export async function runAgent(
  history: ChatMessage[],
  callbacks: AgentCallbacks = {}
): Promise<ChatMessage[]> {
  const messages = [...history];

  // Node schema is now embedded in the system prompt — no list_node_types call.
  // Round 1 is read_graph; round 2 is apply_patch. Both need Pro's recipe-dialing.
  const calledTools = new Set<string>();

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const preferModel: "flash" | "pro" = "pro";

    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: SYSTEM_PROMPT, messages, tools, preferModel }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Agent API error: ${res.status} ${err}`);
    }

    const data = (await res.json()) as {
      content: AssistantBlock[];
      stop_reason: string;
      model?: string;
      usage?: TokenUsage | null;
    };

    if (data.model) callbacks.onModel?.(data.model);
    if (data.usage) callbacks.onUsage?.(data.usage);

    messages.push({ role: "assistant", content: data.content });

    let hasApplyPatch = false;
    let hasFinalText = false;
    for (const block of data.content) {
      if (block.type === "text") {
        callbacks.onAssistantText?.(block.text);
        if (block.text.trim().length > 0) hasFinalText = true;
      }
      if (block.type === "tool_use") {
        callbacks.onToolUse?.(block.name, block.input);
        calledTools.add(block.name);
        if (block.name === "apply_patch") hasApplyPatch = true;
      }
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

    // Short-circuit: if the model emitted apply_patch AND a final text in the
    // same response, the work is done — no need for another round-trip just to
    // get a summary it already gave us.
    if (hasApplyPatch && hasFinalText) return messages;
  }

  return messages;
}
