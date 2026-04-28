# Pixel Flow

An agent-driven, node-based image editor for **cinematic looks and stylized effects** — entirely in the browser, no install, no diffusion model.

Type a movie name. The agent builds a deterministic, reproducible pipeline that grades your photo into the look. Every "preset" is a node graph you can inspect, tweak, and share as a URL.

```
"true detective season 1 vibe — really commit to it"
  ↓
ImageInput → Curves → SplitToning → Vignette → Grain → Output
```

---

## Why this exists

Most "AI image editing" today means diffusion: stochastic, single-shot, un-rerunnable. That's wrong for a lot of real work — brand grading, batch photo sets, video frames, anything that needs the *same recipe* applied consistently.

Pixel Flow is the opposite bet: **deterministic image graphs as the unit of work, with an LLM as the way you build them.** The graph is the artifact. The agent is the UI. The output is reproducible.

---

## Key Features

### Agent — type a look, get a graph
- Describe what you want (`"Drive 2011 — neon teal and orange"`) and the agent assembles the pipeline on your canvas.
- The model has three tools: `list_node_types`, `read_graph`, `apply_patch`. It plans, then mutates the graph atomically.
- Tool calls show inline as compact chips so you can see exactly what the agent did.
- Powered by Gemini 2.5 Flash via a server-side proxy (your key never reaches the browser).

### Cinematic & stylize node library
Built around named-aesthetic recipes. Each node's schema description carries specific recipe values so the agent can reach for the right look.

- **Curves** — 5-anchor tone curves per channel (master + R/G/B), with endpoint controls (BlackPoint lift, WhitePoint clip). Click-and-drag on the curve canvas.
- **Split Toning** — Lightroom-style separate hue+saturation for shadows and highlights. *The* node for teal-and-orange, sepia, Twilight, Drive.
- **Vignette** — oval radial darken/brighten with smooth-step falloff.
- **Grain** — deterministic-seed film grain, mono (authentic) or RGB (digital sensor).
- **Posterize** — per-channel or per-luminance level quantization.
- **Gradient Map** — maps luminance to a two-color ramp (blueprint, duotone, riso).
- **Solid Fill** — solid-color emitter, sized from optional input.
- **Color, Filter, Canny Edge, ASCII Art, Mask, Blend** — the original stylized library.

### Share-by-URL
- Click **Share Graph** → a URL encoding the whole graph copies to your clipboard.
- Open it in any browser → graph hydrates, ready to run on a new image.
- Runtime state (uploaded images, drawn masks) is stripped before encoding so links stay portable and private.

### Refined workspace
- Sidebar: nodes grouped by category (Source / Adjust / Stylize / Generate / Composite / Output) with color-coded dots and search.
- Adaptive minimap appears once your graph grows.
- Pyramid-downscale on the preview canvas eliminates moire / rainbow aliasing on dense outputs (ASCII, halftones).
- Templates: save common pipelines locally, hover to delete.

---

## Quick start

```bash
git clone https://github.com/ravenZ3/pixel-flow.git
cd pixel-flow
npm install
echo GEMINI_API_KEY=your_key_here > .env.local   # https://aistudio.google.com/apikey
npm run dev
```

Open <http://localhost:3000>, drop an `ImageInput`, upload an image, then either drag nodes manually **or** ask the agent:

> *"make this look like a Wes Anderson film"*
>
> *"sepia old photograph"*
>
> *"blueprint, white lines on dark blue"*

---

## Architecture (1-minute version)

- **Graph state** lives in Zustand (`uiStore`). Every node has a schema in `nodeRegistry.ts` describing inputs, outputs, params, and the executor function.
- **Pipeline execution** runs in a Web Worker — topologically sorted, dirty-flag aware, only re-runs nodes whose upstream changed.
- **Agent loop** runs *client-side* in `src/lib/agent/loop.ts`. It calls a thin Next.js API route (`/api/agent`) that holds the API key and proxies to Gemini. Tool calls execute against the local Zustand store, so node creation feels instant.
- **Schema-driven everything** — the same `NodeSchema` powers the UI, the executor, and the agent's tool descriptions. Add a new node by writing one entry; agent picks it up automatically.

See [`notes/`](./notes/) for the design decisions behind these choices and the lessons learned along the way.

---

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **Visual Programming**: [React Flow](https://reactflow.dev/)
- **Agent**: [@google/genai](https://github.com/googleapis/js-genai) (Gemini 2.5 Flash)
- **State**: [Zustand](https://github.com/pmndrs/zustand)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI primitives**: [shadcn/ui](https://ui.shadcn.com/)

---

## Roadmap

What's missing for a credible cinematic-preset launch:

- [ ] **LUT node** — apply 3D LUTs (`.cube` files), import any professional grade.
- [ ] **HSL Adjust** — push individual color ranges (mute greens, warm skin tones).
- [ ] **Gallery + remix** — every shared graph as a remixable starting point.
- [ ] **Batch processing** — apply a graph to a folder of images.
- [ ] **Neural sensors** — depth + segmentation as graph primitives (no generative model, just content awareness).

Not on the roadmap, intentionally:

- ❌ Diffusion / generative models — wrong tool for this lane, eats determinism.
- ❌ Desktop app — the web-first wedge is a feature, not a limitation.

---

## License

MIT.
