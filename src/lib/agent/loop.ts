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
9. CRITICAL — you MUST actually call apply_patch to create / modify nodes. Saying "I applied X" or "Added a curves node" without calling apply_patch this turn is a LIE — the canvas does not change unless apply_patch executes. If the user asks you to build something, your turn is incomplete until apply_patch has been called.

10. EFFICIENCY — emit your one-sentence summary text in the SAME response as your apply_patch tool call (text and tool_use blocks together in the same content). Do not wait for a separate round-trip. The user's "what was applied" message and your apply_patch should arrive together.

11. The summary must be ONE plain-text sentence — what look you applied, no more.
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

CRITICAL — NODE PAIRING for cinematic looks. Every cinematic / named-film pipeline needs ALL FOUR of these nodes — leaving any one out makes the look read as "a filter" rather than the named aesthetic:
- Curves handles TWO things: master tone (lifted blacks, clipped whites, contrast) AND surgical per-channel shifts (subtle skin warmth, dirty shadows, cool sky). Use BOTH master and per-channel values from the recipe — the master gives shape, the per-channel gives polish.
- SplitToning handles the LOUD color cast (saturations 30+) — the recognizable teal-and-orange / yellow-green / sepia tint.
- Vignette gives the framing/mood (almost always mild darken at corners).
- Grain gives the film texture (always include, even at low amount; without grain the look feels like a digital filter, not film).

CRITICAL — DO NOT skip per-channel Curves values. The recipes list both master values AND per-channel values (greenShadows, redHighlights, blueMidtones, etc.). Earlier prompts told you to "use Curves for tone, SplitToning for color"; ignore that. Curves per-channel does subtle nudges (±5 to ±15) that complement SplitToning's bigger cast. Set both. A pipeline with master-only Curves looks half-baked.

Commit to recipe values. The schema descriptions list specific numbers per look — use them or values close to them. Halving a recipe (because "subtle is safer") makes the look invisible. If a user asks for "really commit to it," push values 20% higher than the recipe.

NEVER set saturation values below 25, vignette amount above -25 (i.e. weaker than -25), grain amount below 20, or BlackPoint below 20 — those values are below the visibility floor and produce no perceptible change. The 0–100 scales are PERCENT-OF-EFFECT, not 0–1 normalized values; treat 50 as "moderate," not "extreme." If the recipe says 45, use 45 — do not round down to "be safe."

If you find yourself picking a number under 20 for any saturation/amount/lift parameter, you have misjudged the scale. Re-read the schema's "FLOOR FOR VISIBLE EFFECT" hint and use a higher number.

CRITICAL — NAMED-LOOK MATCHING. When the user names a specific film, mood, or aesthetic (Twilight, True Detective, Drive, Wes Anderson, sepia, cyanotype, etc.), the SplitToning schema lists EXACT recipes for each. Use the recipe whose name matches verbatim. Do NOT:
- Reuse the previous turn's SplitToning values "because they were close enough."
- Average two recipes.
- Default to a generic teal-and-orange when the user said "Twilight."
- Tweak only Curves and leave SplitToning unchanged from the previous look.

Each named look has DIFFERENT shadowsHue / highlightsHue values. If you build pipelines for two different looks and the SplitToning numbers come out identical, you have failed to read the recipes — re-read list_node_types output and use the named entry verbatim.`;

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

  // Round 1 is always list_node_types (deterministic per the system prompt) —
  // Flash handles it fine and costs ~10x less. From round 2 onward we use Pro
  // because the model may emit read_graph and apply_patch together in a
  // parallel call, and apply_patch must run on Pro to dial recipe values
  // correctly. Reactive routing ("upgrade after read_graph appears") fails in
  // that parallel-call case because the upgrade comes one turn too late.
  const calledTools = new Set<string>();

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const preferModel: "flash" | "pro" = i === 0 ? "flash" : "pro";

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
