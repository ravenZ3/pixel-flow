# Preview aliasing — rainbow stripes on ASCII output

## The problem

Running an ASCII pipeline produced an output bitmap that looked correct
when downloaded full-size, but inside the preview pane it showed
horizontal rainbow stripes — red, cyan, yellow bands that were not in
the actual image.

It got worse when the preview pane was made smaller.

## What was actually happening

Two facts collided:

1. The output bitmap was at **source resolution** (e.g. 3000 × 2000 px),
   with thousands of tiny ASCII characters. Each character spans only
   a few pixels.
2. The canvas element was sized to those source dimensions, then CSS
   shrank it via `max-width: 100%`. The browser used its default
   **bilinear** filter to draw the canvas to ~600 px on screen.

Bilinear downscale samples one pixel for every ~5 source pixels and
linearly blends a 2×2 neighborhood. That works fine for natural photos
but is catastrophic for *high-frequency content* — content with detail
at the same scale as the sample step.

ASCII output is the worst case: thin bright character strokes on a
dark background, repeating at near-pixel frequency. Adjacent stroke
rows beat against the sample grid and produce **moire / aliasing
patterns** that we perceive as colored bands.

This is a Nyquist sampling problem, not a bug in the canvas.

## The Photoshop trick — pyramid downscale

Real image viewers (Photoshop, Lightroom, browsers' image elements
when loading a `<img>`) don't do single-pass bilinear when the scale
ratio is large. They use **mipmap-style pyramid downscaling**:

1. Halve the source dimensions with a smoothing filter — this is a
   low-pass filter that *removes* the high frequencies that would
   otherwise alias.
2. Halve again. And again.
3. Stop when the result is within 2× of the target size.
4. Do one final smooth draw to the exact target size.

Each halving averages 2×2 neighborhoods. By the time you reach the
target resolution, the bands that were aliasing have already been
blurred together into the intended grayscale tone of "many chars
in a small area."

> The rule of thumb: **never downscale by more than 2× in one step.**
> Above 2×, you must low-pass first.

## How we fixed it

In [ImageCanvas/index.tsx](../src/components/ImageCanvas/index.tsx):

- A `ResizeObserver` measures the preview container.
- The canvas is sized to the **display** dimensions (× devicePixelRatio
  for retina), not the source dimensions.
- A helper `pyramidDownscale(src, targetW, targetH)` halves the source
  repeatedly into a chain of `OffscreenCanvas`es until within 2× of
  target, with `imageSmoothingQuality = "high"` at each step.
- The final draw goes from the pyramid output into the visible canvas.

Cost: O(log₂(scaleFactor)) extra blits. For a 3000→600 px preview
that's 2 halvings — well under 1 ms. Cheap.

The exported bitmap is unchanged — only the preview is improved.
If we ever add Save/Download, we save from the source `ImageBitmap`,
not the preview canvas.

## When this trick matters

Anywhere we display a high-resolution generated bitmap in a smaller
viewport. ASCII is the most extreme case. Halftone, dither, edges,
fine line art — same principle. Photographs alias too but less
noticeably because their spectrum is broader.

## Wider lesson

This is the first time the **product has had to think about
sampling theory.** It will not be the last. As we add more nodes
that produce structured / high-frequency content (halftone,
threshold, fine pattern fills), the same class of bug will recur
at every scale boundary — preview, thumbnail, export-at-different-DPI.

Keep `pyramidDownscale` as a shared utility. Anything that displays
a bitmap at a smaller-than-source size should go through it.
