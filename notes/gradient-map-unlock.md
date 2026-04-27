# All-white pipeline → blueprint works (GradientMap unlock)

## The problem

Asked the agent: *"edges only, blueprint style — white lines on dark blue."*
It built **ImageInput → CannyEdge → Color → Output**. Every preview
downstream of Color was solid white. Output pane: white rectangle.

## What was actually happening — two bugs stacked

### Bug 1 — Color node's brightness was nuclear

```ts
const brightness = (nodeData?.brightness ?? 0) / 100;  // = 1.0 at max
r += brightness;  // black → white in one step
```

The agent set `brightness: 100`, the math added 1.0 to every channel
in [0,1] space, everything clipped to white. The slider went to 100
but the executor was tuned as if 100 meant "doubled." A range/scale
mismatch.

Fix: divisor `100 → 200`. `+100` now means `+0.5` ("very bright"),
not "obliterate."

### Bug 2 — the pipeline was physically impossible

This is the deeper one. The agent picked **CannyEdge → Color** to go
from grayscale edges to "white on blue." That can't work, ever:

- CannyEdge outputs pure black (0,0,0) and pure white (255,255,255).
- Color's hue rotation operates in HSL space. **Hue rotation on a pure
  black pixel stays black** — there's no chroma to rotate.
- Saturation can't add color where there isn't any either.

So no matter which params the agent picked, the output couldn't be
"white on blue." The library lacked the operation that maps grayscale
to a colored ramp.

## The fix — add the missing primitive

Added two nodes:

- **GradientMap** — maps luminance to a two-color ramp.
  Black input → `colorLow`, white input → `colorHigh`, gray → blend.
  ~25 lines.
- **SolidFill** — outputs a solid color rectangle, optionally sized
  from a connected image. ~15 lines.

Plus updated the system prompt with a **worked example** for blueprint
specifically, and a "DO NOT silently approximate" rule listing
known-missing primitives (Posterize, halftone, dither, vignette,
grain, chromatic aberration).

After the fix, the agent re-built the same prompt as
**ImageInput → CannyEdge → GradientMap → Output**. White edges, navy
background. Worked first try.

## Why GradientMap is so high-leverage

A single node unlocks an entire family of named looks because every
stylized print aesthetic is a luminance-to-palette mapping:

| Look          | Low color | High color |
|---------------|-----------|------------|
| Blueprint     | Navy      | White      |
| Sepia         | Dark brown| Cream      |
| Cyanotype     | Prussian blue | Pale yellow |
| GameBoy       | #0f380f   | #9bbc0f    |
| Riso pink/cyan| Hot pink  | Cyan       |
| Duotone       | Any 2 colors |          |

Posterize would multiply this by another dimension (number of bands).
The two together cover most of "print stylization" without ever
reaching for ML.

## Wider lessons

### 1. Range-vs-scale mismatches are silent killers
The brightness bug existed for weeks before anyone noticed. The slider
went to 100 and felt right; the executor treated 100 as "doubled" and
also felt right. Together they produced solid white at maximum, but
nobody hits maximum in normal use.

When adding a node, **explicitly check what the extreme values do.**
If `param=max` produces nonsense output, the math is wrong, the schema
is wrong, or both. Either fix the math or clamp the schema.

### 2. The agent is a sensor for library gaps
Every time the agent picks a wrong tool for a job, ask: *did it pick
the wrong tool because it's confused, or because the right tool
doesn't exist?*

In this case the right tool didn't exist. The agent did the smartest
possible thing with what it had. A better agent would have produced
the same wrong output more apologetically.

When you see the agent reaching for the wrong thing repeatedly, that's
the next node to add. Treat the agent's failures as a TODO list for
the library.

### 3. Worked examples > rules in the system prompt
Vague rules ("don't silently approximate") didn't change behavior.
A **specific worked example** ("blueprint = CannyEdge → GradientMap
with colorLow=navy, colorHigh=white") did. The agent generalized from
the one example to similar prompts (sepia, GameBoy, riso) without
needing each one spelled out.

When a prompt rule isn't taking, replace it with a concrete example
of correct reasoning. Examples teach; rules nag.
