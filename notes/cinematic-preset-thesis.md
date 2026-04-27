# The cinematic preset thesis — the actual product

## The idea

People watch reels of someone tuning ~12 sliders in Snapseed or
Lightroom and turning a vacation photo into something that looks like
*Twilight* or *True Detective* or *Drive*. The transformations go
viral. The presets are buyable in packs ($5–50). None of it uses AI.

What's missing for normal people: the dialing process is tedious,
the parameter knowledge is specialist, and the result depends on the
specific photo.

What Pixel Flow can become: **type a movie name, get the look.**

## Why this is different from everything I'd been thinking before

I'd been pushing the project toward *named print aesthetics* —
Warhol, halftone, riso, ASCII. Those are real but the audience is
small (designers, indie devs, merch makers).

**Cinematic color grading has a much bigger audience and a much
better-proven viral mechanic.** Snapseed/Lightroom tutorial reels are
a content engine that already exists and already converts. The market
already pays.

This is the first idea that unifies every defensible angle in one
sentence:

- *Has paying customers* (preset pack market is real)
- *Has a viral loop* (before/after reels already work without paid
  distribution)
- *Maps to graph-as-recipe* (every "look" = a Pixel Flow graph URL)
- *Sidesteps ComfyUI* (color grading isn't their lane; their users
  go there for diffusion)
- *Doesn't need diffusion* (color grading is pure math, settled
  since the 1930s)
- *Makes the agent the value-prop, not a gimmick* ("make it look
  like Drive" is genuinely useful, not a parlour trick)

## The looks, broken into operations

Every cinematic look reduces to a handful of operations applied
with specific values. The library doesn't need to be huge — it needs
the *right* nodes.

| Look                 | Doing the work                                                                  |
| -------------------- | ------------------------------------------------------------------------------- |
| Twilight             | Teal shadows + orange highlights, low saturation, soft glow, light vignette     |
| True Detective S1    | Yellow-green cast, crushed shadows, lifted blacks (hazy), heavy grain           |
| Drive (2011)         | Magenta highlights, teal shadows, neon glow, low mid-tone contrast              |
| Moonlight            | Hyper-saturated teals on skin, deep shadow blocking, gentle grain               |
| Wes Anderson         | Pastel palette, low saturation overall except yellows/pinks, symmetric tone    |
| Blade Runner 2049    | Heavy split-tone, cyan shadows, orange highlights, strong vignette              |
| Christopher Nolan    | Cool overall, crushed blacks, slight green-yellow in shadows                    |

**Same recipe, different numbers.** That's why preset packs work as
a category, and that's why a graph engine is a near-perfect substrate.

## What's missing in the current node library

Around 6 nodes, none of them ML. Roughly 5 days of focused work.

1. **Curves** — RGB and per-channel tone curves. The single most
   important grading tool ever invented. ~80 lines.
2. **Split Toning** — different colors in shadows vs highlights.
   Defines half the looks above. ~40 lines.
3. **HSL Adjust** — push individual color ranges (mute greens, warm
   skin tones). ~60 lines.
4. **LUT** — apply a 3D LUT from a `.cube` file. Imports any
   professional grade. ~100 lines + parser.
5. **Vignette** — radial darkening. Trivial. ~25 lines.
6. **Film Grain** — overlay procedural noise. ~30 lines.

After these exist, every preset in the table above becomes a
saveable Pixel Flow graph URL.

## The go-to-market that already exists

The hardest part of starting a content business is figuring out what
content compounds. **For this product the content niche is already
established.** Just plug in:

1. Build the first 6 cinematic presets manually. Each is a saved
   graph URL.
2. Record before/after reels. 15 seconds each: *"want your photo to
   look like Twilight? Click my link, upload, done."*
3. Each preset URL is the call-to-action. Click → Pixel Flow opens
   with the graph pre-loaded → user uploads → transformed photo.
4. Add "remix this preset" so users share their own version.
5. Charge later. Premium preset packs at $5–15. Or a $10/mo
   subscription for unlimited.

A month to a credible launch on a proven content angle. **The agent
already knows what "Drive" looks like — it just needs nodes that can
execute it.**

## The shift this represents

Before: Pixel Flow is *an agent-native node editor for stylized
image effects.*

After: Pixel Flow is *the cinematic-preset tool with an agent that
builds the look from a movie name.*

The first sentence is a portfolio piece. The second is a product.

## The trap to actively avoid

Once this works, the temptation will be to bolt on diffusion ("but
what if the agent could also generate a new sky to match?"). **Do not.**
The moment Pixel Flow has diffusion in it, it becomes a worse
ComfyUI/Krea/Magnific competing on capabilities it can't win.

Stay deterministic. The whole pitch is *recipes you can run on any
photo, any video frame, any batch — and get the same look.* Diffusion
breaks that promise.

The only neural nodes that belong here are *sensors* — depth maps,
segmentation masks — used to *inform* the deterministic grade, not
to generate pixels.

## What to do next

Stop adding stylization primitives. Start adding grading primitives.
Specifically: **Curves first. Split Toning second.** With those two
alone, half the listed looks become buildable.
