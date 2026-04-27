# The node library is the bottleneck — not the agent

## The problem

Asked the agent: *"make it look like an Andy Warhol poster."*
It built a pipeline (Color node, cranked saturation + contrast).
The output looked like a **lomography filter** — vintage 35mm, blown
highlights, vignetted darks.

Not Warhol. Not even close.

## Why it failed

What "Warhol" actually means visually:

- Hard color **posterization** — flatten to 3–6 colors, no gradients
- High-contrast silkscreen feel — like a threshold, not pushed contrast
- Often a tiled grid of the same image with different palettes
- Loud, *unnatural* color pairings (magenta hair, cyan skin)

Look at the current node library: Color, Filter, CannyEdge, Blend,
Mask, ASCII. **None of these can posterize.** None can quantize a
palette. None can threshold to binary.

The agent did the only thing it could with what it had: max out
saturation and contrast. A smarter model wouldn't help — it would
just write a more apologetic message about why the result is wrong.

## The wrong instinct

When the agent produces something bad, the instinct is to blame the
agent: better prompt, bigger model, more context. **Resist it.**

For Pixel Flow specifically, the agent is well-behaved. It calls
the right tools in the right order. It picks reasonable parameters.
It explains itself. The reason the output is wrong is that no
combination of available operations *can* produce the requested look.

## The right move

Add the missing primitive. One node unlocks an entire aesthetic
family:

- **Posterize** (quantize to N levels per channel) → Warhol, riso,
  retro game, comic-flat. ~30 lines.
- **Threshold** (binarize at a cutoff) → silkscreen, Obey, Obra Dinn.
  ~20 lines.
- **Palette-map** (quantize to a fixed palette like riso pink+cyan,
  Game Boy green) → builds on Posterize. ~50 lines.
- **Halftone** (dot pattern dithering) → comic, newspaper print.
  Harder, ~150 lines, but high payoff.

With Posterize alone, retry the Warhol prompt. The agent will have
the *vocabulary* to attempt it.

## Wider lesson — pick a wedge and own it

"Generic node-based image editor" is a crowded graveyard. The
defensible position is **named aesthetics** — print-style effects,
ASCII, halftone, riso. Each has a buyer (designers, indie devs,
merch-makers) and is genuinely under-served.

Every new node should be evaluated by: *what named aesthetic does
this unlock?* Not by *what classical DSP operation is this?*
Posterize alone unlocks four. Edge-detect alone (which we already
have) unlocks blueprint and pencil sketch.

Anti-pattern: adding nodes by Photoshop-feature-parity ("we should
have curves, levels, hue/sat as separate nodes"). Every extra
parameter knob is friction; every aesthetic unlock is leverage.

## Order of work going forward

Stop adding agent features until the node library can produce **at
least one named aesthetic from each of these families**:

1. ✓ ASCII / character-based
2. ✓ Edge / line-art (Canny gives blueprint, sketch)
3. ✗ Quantized / printed (need Posterize, Threshold, Palette-map)
4. ✗ Patterned / dithered (need Halftone, ordered dither)
5. ✗ Painterly (need Bilateral or Kuwahara filter)

Three of the five are missing. Fill those gaps. Then come back to
the agent.
