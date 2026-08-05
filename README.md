# Pixel Flow

Pixel Flow is a node-based image editor that runs entirely in the browser. No install, no diffusion model, no server-side rendering. You describe a look, an agent builds the pipeline, and you get a graph you can inspect, tweak, and rerun.

```
"true detective season 1 vibe, really commit to it"
    |
    v
ImageInput -> Curves -> SplitToning -> Vignette -> Grain -> Output
```

## Why this exists

Most "AI image editing" today means diffusion: stochastic, single-shot, hard to rerun. That's the wrong tool for a lot of real work, brand grading, batch photo sets, video frames, anything that needs the same recipe applied consistently across many images.

Pixel Flow bets on the opposite approach: deterministic image graphs as the unit of work, with an LLM as the way you build them. The graph is the artifact, not the picture. The agent is the interface for constructing it. The output is reproducible every time.

## What it does

**Describe a look, get a graph.** Tell the agent what you want, `"Drive 2011, neon teal and orange"`, and it assembles a pipeline on your canvas. It works with three tools: `list_node_types`, `read_graph`, and `apply_patch`. It plans first, then mutates the graph atomically, and each tool call shows up inline as a compact chip so you can see exactly what it did. It's powered by Gemini 2.5 Flash through a server-side proxy, so your API key never touches the browser.

**A node library built for cinematic recipes.** Every node's schema carries specific values tied to named aesthetics, so the agent can reach for the right look instead of guessing at raw parameters.

- **Curves**: five-anchor tone curves per channel (master + R/G/B), with black-point lift and white-point clip. Click and drag directly on the curve.
- **Split Toning**: Lightroom-style hue and saturation, set separately for shadows and highlights. This is the node behind teal-and-orange, sepia, Twilight, Drive.
- **Vignette**: oval radial darken or brighten with smooth-step falloff.
- **Grain**: deterministic-seed film grain, mono for an authentic look or RGB for a digital-sensor feel.
- **Posterize**: level quantization, per-channel or per-luminance.
- **Gradient Map**: maps luminance onto a two-color ramp, for blueprint, duotone, or riso effects.
- **Solid Fill**: a solid-color emitter, sized from an optional input.
- Plus the original stylized set: Color, Filter, Canny Edge, ASCII Art, Mask, Blend.

**Share a graph as a URL.** Click Share Graph and a link encoding the whole pipeline copies to your clipboard. Anyone who opens it gets the graph fully hydrated, ready to run against a new image. Runtime state like uploaded images and drawn masks is stripped before encoding, so links stay small and private.

**A workspace built for graphs that grow.** The sidebar groups nodes by category (Source, Adjust, Stylize, Generate, Composite, Output) with color-coded dots and search. A minimap appears once a graph gets big enough to need one. The preview canvas pyramid-downscales before drawing, which kills the moire and rainbow aliasing that dense outputs like ASCII and halftones tend to produce. Templates let you save common pipelines locally and delete them with a hover.

## Quick start

```bash
git clone https://github.com/ravenZ3/pixel-flow.git
cd pixel-flow
npm install
echo GEMINI_API_KEY=your_key_here > .env.local   # https://aistudio.google.com/apikey
npm run dev
```

Open <http://localhost:3000>, drop an `ImageInput` node, upload an image, and either wire things up manually or ask the agent:

> "make this look like a Wes Anderson film"
>
> "sepia old photograph"
>
> "blueprint, white lines on dark blue"

## How it's built

Graph state lives in Zustand (`uiStore`). Every node type has a schema in `nodeRegistry.ts` describing its inputs, outputs, params, and executor function, and that one schema drives the UI, the executor, and the agent's tool descriptions. Adding a node is a single registry entry; the agent picks it up automatically.

Execution runs in a Web Worker, topologically sorted and dirty-flag aware, so only the nodes downstream of a change actually re-run. The agent loop itself runs client-side, in `src/lib/agent/loop.ts`, calling a thin Next.js API route (`/api/agent`) that holds the key and proxies to Gemini. Tool calls execute directly against the local store, which is why node creation feels instant instead of round-tripping through a server.

See [`notes/`](./notes/) for the reasoning behind these choices and what didn't work along the way.

## Stack

- [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- [React Flow](https://reactflow.dev/) for the graph canvas
- [@google/genai](https://github.com/googleapis/js-genai) (Gemini 2.5 Flash) for the agent
- [Zustand](https://github.com/pmndrs/zustand) for state
- [Tailwind CSS](https://tailwindcss.com/) and [shadcn/ui](https://ui.shadcn.com/) for the UI

## Roadmap

Still missing for a credible cinematic-preset launch:

- [ ] LUT node: apply 3D LUTs (`.cube` files), so any professional grade can be imported directly.
- [ ] HSL Adjust: push individual color ranges, mute greens, warm skin tones.
- [ ] Gallery and remix: every shared graph becomes a starting point someone else can fork.
- [ ] Batch processing: apply a graph across a folder of images.
- [ ] Neural sensors: depth and segmentation as graph primitives, content-aware without being generative.

Deliberately not on the roadmap: diffusion or generative models, the wrong tool for a lane built on determinism; and a desktop app, since staying web-first is the point, not a gap to fill.

## License

MIT.
