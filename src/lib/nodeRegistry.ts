import { rgbToHsl, hslToRgb } from "./colorUtils";

// Builds a 256-entry tone LUT from five slider values. blackPoint and whitePoint
// move the endpoints (0..100, lift / clip). shadows/midtones/highlights nudge
// interior anchors at x=64/128/192 (-100..+100). Piecewise linear, clamped.
// Identity when all five are 0.
export function buildToneLUT(
  blackPoint: number,
  shadows: number,
  midtones: number,
  highlights: number,
  whitePoint: number
): Uint8ClampedArray {
  const SCALE = 0.5;
  const points = [
    { x: 0,   y: blackPoint * SCALE },               // 0..50 (lift the floor)
    { x: 64,  y: 64  + shadows    * SCALE },
    { x: 128, y: 128 + midtones   * SCALE },
    { x: 192, y: 192 + highlights * SCALE },
    { x: 255, y: 255 - whitePoint * SCALE },         // 255..205 (clip the ceiling)
  ];
  const lut = new Uint8ClampedArray(256);
  for (let x = 0; x < 256; x++) {
    let i = 0;
    while (i < points.length - 1 && points[i + 1].x < x) i++;
    const p0 = points[i];
    const p1 = points[i + 1];
    const t = p1.x === p0.x ? 0 : (x - p0.x) / (p1.x - p0.x);
    lut[x] = Math.max(0, Math.min(255, Math.round(p0.y + t * (p1.y - p0.y))));
  }
  return lut;
}

// Hue (0..360) → unit RGB centered at 0.5, returned in [-0.5, +0.5] tint-vector form.
// Used by Split Toning to push pixels toward a chromatic axis.
function hueToTintVector(hue: number): { r: number; g: number; b: number } {
  const h = ((hue % 360) + 360) % 360 / 60;
  const i = Math.floor(h);
  const f = h - i;
  let r = 0, g = 0, b = 0;
  switch (i) {
    case 0: r = 1; g = f; b = 0; break;
    case 1: r = 1 - f; g = 1; b = 0; break;
    case 2: r = 0; g = 1; b = f; break;
    case 3: r = 0; g = 1 - f; b = 1; break;
    case 4: r = f; g = 0; b = 1; break;
    case 5: r = 1; g = 0; b = 1 - f; break;
  }
  return { r: r - 0.5, g: g - 0.5, b: b - 0.5 };
}

// Deterministic 32-bit PRNG. Same seed → same noise. Used for film grain so the
// pattern doesn't shimmer between renders when an upstream parameter changes.
function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "").trim();
  const v = h.length === 3
    ? h.split("").map((c) => c + c).join("")
    : h.padEnd(6, "0");
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

export type NodeOutputs = {
  [key: string]: ImageBitmap | string | null | undefined | Record<string, any>;
  _updateNodeData?: Record<string, any>;
};

export type ParamSchema =
  | { type: "number"; min?: number; max?: number; step?: number; default: number; description: string }
  | { type: "enum"; values: string[]; default: string; description: string }
  | { type: "boolean"; default: boolean; description: string }
  | { type: "string"; default: string; description: string }
  | { type: "color"; default: string; description: string };

export interface NodeSchema {
  description: string;
  inputs: { name: string; type: "image" | "mask" | "prompt"; required?: boolean; description?: string }[];
  outputs: { name: string; type: "image" | "mask" | "prompt" }[];
  params: Record<string, ParamSchema>;
}

export interface NodeExecutor {
  execute(
    inputs: Record<string, ImageBitmap | string | null>,
    nodeData?: Record<string, any>
  ): Promise<NodeOutputs>;
  schema: NodeSchema;
}

const nodeRegistry: Record<string, NodeExecutor> = {
  ImageInput: {
    execute: async (inputs, nodeData) => ({
      'image:output': (nodeData?.uploadedImage as unknown as ImageBitmap) ?? null,
    }),
    schema: {
      description: "Source image. Holds the uploaded user image; every pipeline starts here.",
      inputs: [],
      outputs: [{ name: "image:output", type: "image" }],
      params: {},
    },
  },
  Color: {
    execute: async (inputs, nodeData) => {
      const src = inputs['image:input'];
      if (!(src instanceof ImageBitmap)) return { 'image:output': null };

      const canvas = new OffscreenCanvas(src.width, src.height);
      const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
      ctx.drawImage(src, 0, 0);
      const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = id.data;

      const brightness = (nodeData?.brightness ?? 0) / 200;
      const contrast = (nodeData?.contrast ?? 0) / 100;
      const gamma = nodeData?.gamma ?? 1.0;
      const saturation = (nodeData?.saturation ?? 0) / 100;
      const hue = (nodeData?.hue ?? 0) / 360;

      for (let i = 0; i < data.length; i += 4) {
        let r = data[i] / 255;
        let g = data[i + 1] / 255;
        let b = data[i + 2] / 255;

        r += brightness;
        g += brightness;
        b += brightness;

        r = (r - 0.5) * (1 + contrast) + 0.5;
        g = (g - 0.5) * (1 + contrast) + 0.5;
        b = (b - 0.5) * (1 + contrast) + 0.5;

        r = Math.pow(Math.max(0, r), 1 / gamma);
        g = Math.pow(Math.max(0, g), 1 / gamma);
        b = Math.pow(Math.max(0, b), 1 / gamma);

        const [h, s, l] = rgbToHsl(r, g, b);
        const newS = Math.min(1, Math.max(0, s + saturation));
        const newH = (h + hue + 1) % 1;
        [r, g, b] = hslToRgb(newH, newS, l);

        data[i] = Math.min(255, Math.max(0, r * 255));
        data[i + 1] = Math.min(255, Math.max(0, g * 255));
        data[i + 2] = Math.min(255, Math.max(0, b * 255));
      }

      ctx.putImageData(id, 0, 0);
      return { 'image:output': canvas.transferToImageBitmap() };
    },
    schema: {
      description: "Adjusts color properties: brightness, contrast, gamma, saturation, hue shift.",
      inputs: [{ name: "image:input", type: "image", required: true }],
      outputs: [{ name: "image:output", type: "image" }],
      params: {
        brightness: { type: "number", min: -100, max: 100, default: 0, description: "Brightness in percent, -100 to 100." },
        contrast: { type: "number", min: -100, max: 100, default: 0, description: "Contrast in percent, -100 to 100." },
        gamma: { type: "number", min: 0.1, max: 3, step: 0.05, default: 1.0, description: "Gamma correction. <1 darkens, >1 brightens." },
        saturation: { type: "number", min: -100, max: 100, default: 0, description: "Saturation in percent, -100 is grayscale." },
        hue: { type: "number", min: 0, max: 360, default: 0, description: "Hue shift in degrees." },
      },
    },
  },
  Filter: {
    execute: async (inputs, nodeData) => {
      const src = inputs['image:input'];
      if (!(src instanceof ImageBitmap)) return { 'image:output': null };

      const type = nodeData?.filterType ?? "gaussian";
      const strength = nodeData?.strength ?? 1;

      const canvas = new OffscreenCanvas(src.width, src.height);
      const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;

      if (type === "gaussian") {
        ctx.filter = `blur(${strength}px)`;
        ctx.drawImage(src, 0, 0);
        return { 'image:output': canvas.transferToImageBitmap() };
      }

      ctx.drawImage(src, 0, 0);
      const id = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const kernels: Record<string, number[]> = {
        sharpen: [
          0,
          -1 * strength,
          0,
          -1 * strength,
          1 + 4 * strength,
          -1 * strength,
          0,
          -1 * strength,
          0,
        ],
        "edge detect": [-1, -1, -1, -1, 8, -1, -1, -1, -1],
        emboss: [-2 * strength, -1, 0, -1, 1, 1, 0, 1, 2 * strength],
      };

      const kernel = kernels[type] || kernels.sharpen;
      const { width, height } = src;
      const inputData = new Uint8ClampedArray(id.data);
      const outputData = id.data;

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          for (let c = 0; c < 3; c++) {
            let sum = 0;
            for (let ky = -1; ky <= 1; ky++) {
              for (let kx = -1; kx <= 1; kx++) {
                sum +=
                  inputData[((y + ky) * width + (x + kx)) * 4 + c] *
                  kernel[(ky + 1) * 3 + (kx + 1)];
              }
            }
            outputData[(y * width + x) * 4 + c] = Math.min(255, Math.max(0, sum));
          }
          outputData[(y * width + x) * 4 + 3] = inputData[(y * width + x) * 4 + 3];
        }
      }

      ctx.putImageData(id, 0, 0);
      return { 'image:output': canvas.transferToImageBitmap() };
    },
    schema: {
      description: "Convolution filter. Gaussian blur, sharpen, edge-detect, or emboss.",
      inputs: [{ name: "image:input", type: "image", required: true }],
      outputs: [{ name: "image:output", type: "image" }],
      params: {
        filterType: { type: "enum", values: ["gaussian", "sharpen", "edge detect", "emboss"], default: "gaussian", description: "Which convolution to apply." },
        strength: { type: "number", min: 0, max: 10, step: 0.1, default: 1, description: "Filter strength. For gaussian this is blur radius in px." },
      },
    },
  },
  Blend: {
    execute: async (inputs, nodeData) => {
      const a = inputs['imageA:input'];
      const b = inputs['imageB:input'];

      if (!(a instanceof ImageBitmap) && !(b instanceof ImageBitmap)) return { 'image:output': null };
      if (!(a instanceof ImageBitmap)) return { 'image:output': b instanceof ImageBitmap ? b : null };
      if (!(b instanceof ImageBitmap)) return { 'image:output': a };

      const opacity = (nodeData?.opacity ?? 1.0);
      const mode = nodeData?.mode ?? "normal";

      const canvas = new OffscreenCanvas(a.width, a.height);
      const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
      ctx.drawImage(a, 0, 0);
      const idA = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const canvasB = new OffscreenCanvas(a.width, a.height);
      const ctxB = canvasB.getContext("2d") as OffscreenCanvasRenderingContext2D;
      ctxB.drawImage(b, 0, 0, a.width, a.height);
      const idB = ctxB.getImageData(0, 0, a.width, a.height);

      const dataA = idA.data;
      const dataB = idB.data;

      for (let i = 0; i < dataA.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          const av = dataA[i + c] / 255;
          const bv = dataB[i + c] / 255;
          let blended: number;
          switch (mode) {
            case "multiply":
              blended = av * bv;
              break;
            case "screen":
              blended = 1 - (1 - av) * (1 - bv);
              break;
            case "overlay":
              blended = av < 0.5 ? 2 * av * bv : 1 - 2 * (1 - av) * (1 - bv);
              break;
            case "darken":
              blended = Math.min(av, bv);
              break;
            case "lighten":
              blended = Math.max(av, bv);
              break;
            default:
              blended = bv;
          }
          dataA[i + c] = Math.round((blended * opacity + av * (1 - opacity)) * 255);
        }
        dataA[i + 3] = 255;
      }

      ctx.putImageData(idA, 0, 0);
      return { 'image:output': canvas.transferToImageBitmap() };
    },
    schema: {
      description: "Composites two images with a blend mode. Output size matches imageA.",
      inputs: [
        { name: "imageA:input", type: "image", required: true, description: "Base layer." },
        { name: "imageB:input", type: "image", required: true, description: "Layer blended on top." },
      ],
      outputs: [{ name: "image:output", type: "image" }],
      params: {
        mode: { type: "enum", values: ["normal", "multiply", "screen", "overlay", "darken", "lighten"], default: "normal", description: "Blend mode." },
        opacity: { type: "number", min: 0, max: 1, step: 0.05, default: 1, description: "Opacity of the top layer." },
      },
    },
  },
  Mask: {
    execute: async (inputs, nodeData) => {
      const image = inputs['image:input'];
      const externalMask = inputs['mask:input'];
      const drawnMask = (nodeData?.mask as ImageBitmap | null) ?? null;

      if (!(image instanceof ImageBitmap)) {
        return { 'image:output': null, 'mask:output': null, 'inputImage': null };
      }

      return {
        'image:output': image,
        'mask:output': drawnMask ?? (externalMask instanceof ImageBitmap ? externalMask : null),
        'inputImage': image,
        'externalMask': externalMask instanceof ImageBitmap ? externalMask : null,
      };
    },
    schema: {
      description: "Holds a hand-drawn or incoming mask and passes both image and mask downstream. Connect a CannyEdge to mask:input to seed the mask with detected edges.",
      inputs: [
        { name: "image:input", type: "image", required: true },
        { name: "mask:input", type: "mask", required: false, description: "Optional external mask to seed from." },
      ],
      outputs: [
        { name: "image:output", type: "image" },
        { name: "mask:output", type: "mask" },
      ],
      params: {},
    },
  },
  CannyEdge: {
    execute: async (inputs, nodeData) => {
      const src = inputs['image:input']
      if (!(src instanceof ImageBitmap)) return { 'image:output': null }

      const lowThreshold = nodeData?.lowThreshold ?? 20
      const highThreshold = nodeData?.highThreshold ?? 80
      const blurRadius = nodeData?.blurRadius ?? 1

      const width = src.width
      const height = src.height
      const canvas = new OffscreenCanvas(width, height)
      const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D

      // Step 1 — Gaussian blur
      ctx.filter = `blur(${blurRadius}px)`
      ctx.drawImage(src, 0, 0)
      ctx.filter = 'none'

      const id = ctx.getImageData(0, 0, width, height)
      const data = id.data

      // Step 2 — Sobel operator
      const magnitudes = new Float32Array(width * height)
      const directions = new Float32Array(width * height)

      const Kx = [-1, 0, 1, -2, 0, 2, -1, 0, 1]
      const Ky = [-1, -2, -1, 0, 0, 0, 1, 2, 1]

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          let gx = 0, gy = 0
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const idx = ((y + ky) * width + (x + kx)) * 4
              const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
              gx += brightness * Kx[(ky + 1) * 3 + (kx + 1)]
              gy += brightness * Ky[(ky + 1) * 3 + (kx + 1)]
            }
          }
          magnitudes[y * width + x] = Math.sqrt(gx * gx + gy * gy)
          directions[y * width + x] = Math.atan2(gy, gx)
        }
      }

      // Step 3 — Non-maximum suppression
      const suppressed = new Float32Array(width * height)
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const mag = magnitudes[y * width + x]
          const dir = directions[y * width + x]
          const angle = (dir * (180 / Math.PI) + 180) % 180
          const roundedAngle = Math.round(angle / 45) * 45

          let n1x = 0, n1y = 0, n2x = 0, n2y = 0
          if (roundedAngle === 0 || roundedAngle === 180) { n1x = -1; n2x = 1; }
          else if (roundedAngle === 45) { n1x = -1; n1y = -1; n2x = 1; n2y = 1; }
          else if (roundedAngle === 90) { n1y = -1; n2y = 1; }
          else if (roundedAngle === 135) { n1x = 1; n1y = -1; n2x = -1; n2y = 1; }

          const mag1 = magnitudes[(y + n1y) * width + (x + n1x)] || 0
          const mag2 = magnitudes[(y + n2y) * width + (x + n2x)] || 0

          suppressed[y * width + x] = (mag >= mag1 && mag >= mag2) ? mag : 0
        }
      }

      // Step 4 — Double threshold
      const edges = new Uint8Array(width * height)
      const strong = 255, weak = 75, none = 0

      for (let i = 0; i < suppressed.length; i++) {
        const mag = suppressed[i]
        if (mag >= highThreshold) edges[i] = strong
        else if (mag >= lowThreshold) edges[i] = weak
        else edges[i] = none
      }

      // Step 5 — Hysteresis edge tracking
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          if (edges[y * width + x] === weak) {
            let hasStrong = false
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (edges[(y + dy) * width + (x + dx)] === strong) {
                  hasStrong = true
                  break
                }
              }
              if (hasStrong) break
            }
            edges[y * width + x] = hasStrong ? strong : none
          }
        }
      }

      // Step 6 — Render
      for (let i = 0; i < data.length; i += 4) {
        const val = edges[i / 4]
        data[i] = data[i + 1] = data[i + 2] = val
        data[i + 3] = 255
      }

      ctx.putImageData(id, 0, 0)
      return { 'image:output': canvas.transferToImageBitmap() }
    },
    schema: {
      description: "Canny edge detection. Outputs a high-contrast edge map (white edges on black).",
      inputs: [{ name: "image:input", type: "image", required: true }],
      outputs: [{ name: "image:output", type: "image" }],
      params: {
        lowThreshold: { type: "number", min: 0, max: 255, default: 20, description: "Lower hysteresis threshold." },
        highThreshold: { type: "number", min: 0, max: 255, default: 80, description: "Upper hysteresis threshold. Higher = fewer edges." },
        blurRadius: { type: "number", min: 0, max: 10, step: 0.5, default: 1, description: "Pre-blur radius to suppress noise." },
      },
    },
  },
  ASCII: {
    execute: async (inputs, nodeData) => {
      const src = inputs['image:input']
      const mask = inputs['mask:input']
      const baseImage = inputs['base:input']

      if (!(src instanceof ImageBitmap)) return { 'image:output': null }

      const fontSize = nodeData?.fontSize ?? 8
      const charSet = nodeData?.charSet ?? 'classic'
      const invert = nodeData?.invert ?? false
      const bgMode = nodeData?.bgMode ?? 'dark'
      const colorMode = nodeData?.colorMode ?? 'original'
      const maskThreshold = nodeData?.maskThreshold ?? 30
      const glowAmount = nodeData?.glowAmount ?? 0
      const glowColor = nodeData?.glowColor ?? '#00ffcc'

      const charSets: Record<string, string[]> = {
        classic: ['@', '#', 'S', '%', '?', '*', '+', ';', ':', ',', '.', ' '],
        blocks: ['█', '▓', '▒', '░', ' '],
        minimal: ['@', '+', '.', ' '],
        braille: ['⣿', '⣷', '⣯', '⣟', '⡿', '⢿', '⣻', '⣽', ' '],
        dense: ['$', '@', 'B', '%', '8', '&', 'W', 'M', '#', '*', 'o', 'a', 'h', 'k', 'b', 'd', 'p', 'q', 'w', 'm', 'Z', '0', 'O', 'L', 'C', 'J', 'U', 'Y', 'X', 'z', 'c', 'v', 'u', 'n', 'x', 'r', 'j', 'f', 't', '/', '|', '(', ')', '1', '{', '}', '[', ']', '?', '-', '_', '+', '~', '<', '>', 'i', '!', 'l', 'I', ';', ':', ',', '"', '^', '`', "'", '.', ' '],
      }
      const chars = charSets[charSet] ?? charSets.classic

      const { width, height } = src
      const colorSource = baseImage instanceof ImageBitmap ? baseImage : src

      const sampleCanvas = new OffscreenCanvas(width, height)
      const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D
      sampleCtx.drawImage(colorSource, 0, 0, width, height)
      const colorData = sampleCtx.getImageData(0, 0, width, height).data

      let densityData = colorData
      if (baseImage instanceof ImageBitmap) {
        const densityCanvas = new OffscreenCanvas(width, height)
        const densityCtx = densityCanvas.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D
        densityCtx.drawImage(src, 0, 0, width, height)
        densityData = densityCtx.getImageData(0, 0, width, height).data
      }

      let maskData: Uint8ClampedArray | null = null
      if (mask instanceof ImageBitmap) {
        const maskCanvas = new OffscreenCanvas(width, height)
        const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D
        maskCtx.drawImage(mask, 0, 0, width, height)
        maskData = maskCtx.getImageData(0, 0, width, height).data
      }

      const charWidth = Math.max(1, fontSize * 0.6);
      const charHeight = Math.max(1, fontSize * 1.0);

      const cols = Math.floor(width / charWidth);
      const rows = Math.floor(height / charHeight);

      // Render the text onto a TRANSPARENT layer first to avoid N iterations of shadow calculations
      const textCanvas = new OffscreenCanvas(width, height)
      const textCtx = textCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D
      textCtx.font = `bold ${fontSize}px "Courier New", monospace`
      textCtx.textBaseline = 'top'

      const cellW = width / cols
      const cellH = height / rows

      let lastStyle = ''
      
      // Preset solid style to avoid checking in loop if possible
      let solidStyle = '';
      if (colorMode === 'solid') {
        solidStyle = bgMode === 'light' ? '#000000' : '#ffffff';
        textCtx.fillStyle = solidStyle;
        lastStyle = solidStyle;
      }

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const startX = Math.floor(col * cellW)
          const startY = Math.floor(row * cellH)
          let endX = Math.floor((col + 1) * cellW)
          let endY = Math.floor((row + 1) * cellH)
          if (endX > width) endX = width
          if (endY > height) endY = height

          // Sample at least 9 points per cell (or more if cells are small) to never miss an edge
          const sampleStep = Math.max(1, Math.floor(Math.min(cellW, cellH) / 3))

          let maxMask = 0
          let sumLuma = 0
          let sumCr = 0, sumCg = 0, sumCb = 0
          let count = 0

          for (let y = startY; y < endY; y += sampleStep) {
            for (let x = startX; x < endX; x += sampleStep) {
              const idx = (y * width + x) * 4

              if (maskData) {
                if (maskData[idx] > maxMask) maxMask = maskData[idx]
              }

              sumLuma += 0.299 * densityData[idx] + 0.587 * densityData[idx + 1] + 0.114 * densityData[idx + 2]

              sumCr += colorData[idx]
              sumCg += colorData[idx + 1]
              sumCb += colorData[idx + 2]
              count++
            }
          }

          if (count === 0) continue

          // Mask gate
          if (maskData && maxMask < maskThreshold) continue

          const avgLuma = sumLuma / count
          let brightness = avgLuma / 255
          if (invert) brightness = 1 - brightness

          const charIndex = Math.min(chars.length - 1, Math.floor((1 - brightness) * chars.length))
          const char = chars[charIndex]
          if (!char || char === ' ') continue

          // Average color of the cell
          const cr = Math.round(sumCr / count)
          const cg = Math.round(sumCg / count)
          const cb = Math.round(sumCb / count)

          if (colorMode !== 'solid') {
            let style = ''
            switch (colorMode) {
              case 'grayscale': {
                const gray = Math.floor((0.299 * cr + 0.587 * cg + 0.114 * cb))
                style = `rgb(${gray},${gray},${gray})`
                break
              }
              case 'matrix': {
                const v = Math.floor(brightness * 255)
                style = `rgb(0,${Math.max(40, v)},${Math.floor(v * 0.3)})`
                break
              }
              case 'neon': {
                style = brightness > 0.5
                  ? `rgb(${Math.floor(brightness * 80)},${Math.floor(brightness * 255)},${Math.floor(brightness * 255)})`
                  : `rgb(${Math.floor((1 - brightness) * 255)},0,${Math.floor(brightness * 200)})`
                break
              }
              case 'cyberpunk': {
                const t = brightness
                style = `rgb(${Math.floor(255 * t + 200 * (1 - t))},${Math.floor(200 * t)},${Math.floor(255 * (1 - t))})`
                break
              }
              case 'fire': {
                const t = brightness
                style = t < 0.33
                  ? `rgb(${Math.floor(t * 3 * 200)},0,0)`
                  : t < 0.66
                    ? `rgb(200,${Math.floor((t - 0.33) * 3 * 150)},0)`
                    : `rgb(255,${Math.floor((t - 0.66) * 3 * 255)},0)`
                break
              }
              default:
                style = bgMode === 'light'
                  ? `rgb(${255 - cr},${255 - cg},${255 - cb})`
                  : `rgb(${cr},${cg},${cb})`
            }

            if (style !== lastStyle) {
              textCtx.fillStyle = style
              lastStyle = style
            }
          }

          textCtx.fillText(char, startX, startY)
        }
      }

      // Finally composite everything to an output canvas
      const outCanvas = new OffscreenCanvas(width, height)
      const outCtx = outCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D

      if (bgMode === 'dark') {
        outCtx.fillStyle = '#0a0a0a'
        outCtx.fillRect(0, 0, width, height)
      } else if (bgMode === 'light') {
        outCtx.fillStyle = '#f5f5f5'
        outCtx.fillRect(0, 0, width, height)
      }

      // Blitting text with hardware-accelerated drop shadow applies it once across the screen
      // Instead of 50,000 sub-renders
      if (glowAmount > 0) {
        outCtx.shadowBlur = glowAmount
        outCtx.shadowColor = glowColor
        // Because text canvas is transparent, drawing it naturally casts the correct shadow map
        outCtx.drawImage(textCanvas, 0, 0)
        outCtx.shadowBlur = 0
      } else {
        outCtx.drawImage(textCanvas, 0, 0)
      }

      return { 'image:output': outCanvas.transferToImageBitmap() }
    },
    schema: {
      description: "Converts image into character-based art. Use for stylized, terminal-aesthetic output.",
      inputs: [
        { name: "image:input", type: "image", required: true, description: "Source whose luminance picks which char to draw." },
        { name: "mask:input", type: "mask", required: false, description: "Restrict ASCII to masked cells only." },
        { name: "base:input", type: "image", required: false, description: "Optional separate image sampled for color." },
      ],
      outputs: [{ name: "image:output", type: "image" }],
      params: {
        fontSize: { type: "number", min: 4, max: 32, default: 8, description: "Character font size in px." },
        charSet: { type: "enum", values: ["classic", "blocks", "minimal", "braille", "dense"], default: "classic", description: "Character ramp." },
        invert: { type: "boolean", default: false, description: "Invert brightness-to-char mapping." },
        bgMode: { type: "enum", values: ["dark", "light", "transparent"], default: "dark", description: "Background fill." },
        colorMode: { type: "enum", values: ["original", "grayscale", "matrix", "neon", "cyberpunk", "fire", "solid"], default: "original", description: "Color treatment for rendered chars." },
        maskThreshold: { type: "number", min: 0, max: 255, default: 30, description: "Mask value below this is skipped." },
        glowAmount: { type: "number", min: 0, max: 40, default: 0, description: "Glow/drop-shadow blur in px." },
        glowColor: { type: "color", default: "#00ffcc", description: "Glow color." },
      },
    },
  },
  Prompt: {
    execute: async (inputs, nodeData) => {
      return {
        'prompt': {
          positive: nodeData?.prompt || "",
          negative: nodeData?.negativePrompt || "",
        }
      }
    },
    schema: {
      description: "Text prompt node. Emits a prompt value for downstream prompt-consuming nodes.",
      inputs: [],
      outputs: [{ name: "prompt", type: "prompt" }],
      params: {
        prompt: { type: "string", default: "", description: "Positive prompt text." },
        negativePrompt: { type: "string", default: "", description: "Negative prompt text." },
      },
    },
  },
  Curves: {
    execute: async (inputs, nodeData) => {
      const src = inputs['image:input'];
      if (!(src instanceof ImageBitmap)) return { 'image:output': null };

      const get = (k: string) => Number((nodeData?.[k] as number) ?? 0);
      const lutMaster = buildToneLUT(get('masterBlackPoint'), get('masterShadows'), get('masterMidtones'), get('masterHighlights'), get('masterWhitePoint'));
      const lutR      = buildToneLUT(get('redBlackPoint'),    get('redShadows'),    get('redMidtones'),    get('redHighlights'),    get('redWhitePoint'));
      const lutG      = buildToneLUT(get('greenBlackPoint'),  get('greenShadows'),  get('greenMidtones'),  get('greenHighlights'),  get('greenWhitePoint'));
      const lutB      = buildToneLUT(get('blueBlackPoint'),   get('blueShadows'),   get('blueMidtones'),   get('blueHighlights'),   get('blueWhitePoint'));

      const canvas = new OffscreenCanvas(src.width, src.height);
      const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
      ctx.drawImage(src, 0, 0);
      const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = id.data;

      for (let i = 0; i < d.length; i += 4) {
        // master first, then per-channel
        d[i]     = lutR[lutMaster[d[i]]];
        d[i + 1] = lutG[lutMaster[d[i + 1]]];
        d[i + 2] = lutB[lutMaster[d[i + 2]]];
      }
      ctx.putImageData(id, 0, 0);
      return { 'image:output': canvas.transferToImageBitmap() };
    },
    schema: {
      description: "Tone curves for tonal shaping and subtle per-channel color shifts. Refer to the centralized RECIPES for cinematic values.",
      inputs: [{ name: "image:input", type: "image", required: true }],
      outputs: [{ name: "image:output", type: "image" }],
      params: {
        masterBlackPoint:    { type: "number", min: 0, max: 100, default: 0, description: "Master black-point lift (raises (0,0) up). The hazy / faded-film effect. FLOOR FOR VISIBLE LIFT: 20. Values 1–10 are invisible. If a look calls for hazy/lifted blacks, use 25–45." },
        masterShadows:       { type: "number", min: -100, max: 100, default: 0, description: "Master shadows (anchor at input=64)." },
        masterMidtones:      { type: "number", min: -100, max: 100, default: 0, description: "Master midtones (anchor at input=128)." },
        masterHighlights:    { type: "number", min: -100, max: 100, default: 0, description: "Master highlights (anchor at input=192)." },
        masterWhitePoint:    { type: "number", min: 0, max: 100, default: 0, description: "Master white-point clip (lowers (255,255) down). Soft highlight rolloff. FLOOR FOR VISIBLE CLIP: 15. For cinematic looks use 15–25." },
        redBlackPoint:       { type: "number", min: 0, max: 100, default: 0, description: "Red shadows lift (warm haze in shadows)." },
        redShadows:          { type: "number", min: -100, max: 100, default: 0, description: "Red shadows. Positive = warm shadows." },
        redMidtones:         { type: "number", min: -100, max: 100, default: 0, description: "Red midtones." },
        redHighlights:       { type: "number", min: -100, max: 100, default: 0, description: "Red highlights. Positive = warm/orange highlights." },
        redWhitePoint:       { type: "number", min: 0, max: 100, default: 0, description: "Red highlight clip." },
        greenBlackPoint:     { type: "number", min: 0, max: 100, default: 0, description: "Green shadows lift." },
        greenShadows:        { type: "number", min: -100, max: 100, default: 0, description: "Green shadows. Positive = sickly/yellow-green shadows (True Detective)." },
        greenMidtones:       { type: "number", min: -100, max: 100, default: 0, description: "Green midtones." },
        greenHighlights:     { type: "number", min: -100, max: 100, default: 0, description: "Green highlights." },
        greenWhitePoint:     { type: "number", min: 0, max: 100, default: 0, description: "Green highlight clip." },
        blueBlackPoint:      { type: "number", min: 0, max: 100, default: 0, description: "Blue shadows lift (cool haze)." },
        blueShadows:         { type: "number", min: -100, max: 100, default: 0, description: "Blue shadows. Positive = teal/cool shadows." },
        blueMidtones:        { type: "number", min: -100, max: 100, default: 0, description: "Blue midtones." },
        blueHighlights:      { type: "number", min: -100, max: 100, default: 0, description: "Blue highlights. Positive = cool highlights." },
        blueWhitePoint:      { type: "number", min: 0, max: 100, default: 0, description: "Blue highlight clip." },
      },
    },
  },
  SplitToning: {
    execute: async (inputs, nodeData) => {
      const src = inputs['image:input'];
      if (!(src instanceof ImageBitmap)) return { 'image:output': null };

      const shadowsHue        = (nodeData?.shadowsHue        as number) ?? 220; // teal-ish
      const shadowsSaturation = (nodeData?.shadowsSaturation as number) ?? 0;
      const highlightsHue     = (nodeData?.highlightsHue     as number) ?? 30;  // amber-ish
      const highlightsSaturation = (nodeData?.highlightsSaturation as number) ?? 0;
      const balance           = (nodeData?.balance           as number) ?? 0;   // -100..+100

      const sTint = hueToTintVector(shadowsHue);
      const hTint = hueToTintVector(highlightsHue);
      const sStrength = (shadowsSaturation / 100);
      const hStrength = (highlightsSaturation / 100);
      const SCALE = 96; // max push in 0..255 space at full saturation

      // balance shifts the midpoint of "what counts as shadow vs highlight".
      // balance = +50 means more pixels weight as highlight; -50 the opposite.
      const mid = 0.5 - balance / 200;

      const canvas = new OffscreenCanvas(src.width, src.height);
      const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
      ctx.drawImage(src, 0, 0);
      const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = id.data;

      for (let i = 0; i < d.length; i += 4) {
        const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
        // Two complementary weights, centered at `mid`. Smooth linear taper.
        const sw = Math.max(0, mid - lum) / Math.max(0.001, mid);          // 1 at black, 0 above mid
        const hw = Math.max(0, lum - mid) / Math.max(0.001, 1 - mid);      // 0 below mid, 1 at white

        d[i]     += sTint.r * SCALE * sStrength * sw + hTint.r * SCALE * hStrength * hw;
        d[i + 1] += sTint.g * SCALE * sStrength * sw + hTint.g * SCALE * hStrength * hw;
        d[i + 2] += sTint.b * SCALE * sStrength * sw + hTint.b * SCALE * hStrength * hw;
      }
      ctx.putImageData(id, 0, 0);
      return { 'image:output': canvas.transferToImageBitmap() };
    },
    schema: {
      description: "Split Toning — tints shadows and highlights with different hues. Essential for filmic color casts. Refer to RECIPES for named-look values.",
      inputs: [{ name: "image:input", type: "image", required: true }],
      outputs: [{ name: "image:output", type: "image" }],
      params: {
        shadowsHue:        { type: "number", min: 0, max: 360, default: 220, description: "Hue (degrees) used to tint shadows. 0=red, 30=orange, 60=yellow, 120=green, 180=cyan, 200=teal, 240=blue, 300=magenta." },
        shadowsSaturation: { type: "number", min: 0, max: 100, default: 0,   description: "Strength of shadow tint, range 0–100. FLOOR FOR VISIBLE EFFECT: 25. Values 1–24 are invisible. Recipe values (35–65) are intentional, do not reduce them. If you intend any visible tint, set this to 30 or higher." },
        highlightsHue:     { type: "number", min: 0, max: 360, default: 30,  description: "Hue (degrees) used to tint highlights." },
        highlightsSaturation: { type: "number", min: 0, max: 100, default: 0, description: "Strength of highlight tint, range 0–100. FLOOR FOR VISIBLE EFFECT: 25. Same rule as shadowsSaturation: use recipe values, do not halve them. If you intend any visible tint, set this to 30 or higher." },
        balance:           { type: "number", min: -100, max: 100, default: 0, description: "Shifts the shadow/highlight midpoint. Positive = more pixels treated as highlights." },
      },
    },
  },
  Vignette: {
    execute: async (inputs, nodeData) => {
      const src = inputs['image:input'];
      if (!(src instanceof ImageBitmap)) return { 'image:output': null };

      const amount  = (nodeData?.amount  as number) ?? -30; // -100..+100, negative=darken
      const size    = (nodeData?.size    as number) ?? 50;  // 0..100, smaller=tighter inner circle
      const feather = (nodeData?.feather as number) ?? 50;  // 0..100, edge softness

      const canvas = new OffscreenCanvas(src.width, src.height);
      const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
      ctx.drawImage(src, 0, 0);
      const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = id.data;
      const W = canvas.width, H = canvas.height;
      const cx = W / 2, cy = H / 2;

      // Normalize per-axis so the vignette is oval-shaped (matches aspect).
      const innerR = size / 100;          // 0..1, where the falloff begins
      const outerR = innerR + feather / 100; // where it's fully applied; clamped below
      const span = Math.max(0.001, outerR - innerR);
      const k = amount / 100; // -1..+1

      let i = 0;
      for (let y = 0; y < H; y++) {
        const dy = (y - cy) / cy;
        for (let x = 0; x < W; x++) {
          const dx = (x - cx) / cx;
          const dist = Math.sqrt(dx * dx + dy * dy); // 0 at center, ~1.41 at corner
          // smoothstep from innerR..outerR
          const t = Math.max(0, Math.min(1, (dist - innerR) / span));
          const f = t * t * (3 - 2 * t); // smoothstep
          // factor: 1.0 at center, (1 + k * direction) toward edge.
          // Negative amount: multiply by (1 - f * |k|) → darken
          // Positive amount: add f * k * 255 → brighten
          if (k < 0) {
            const m = 1 + k * f; // 1 → 1+k as f goes 0..1
            d[i]     = d[i]     * m;
            d[i + 1] = d[i + 1] * m;
            d[i + 2] = d[i + 2] * m;
          } else if (k > 0) {
            const add = k * f * 255;
            d[i]     = d[i]     + add;
            d[i + 1] = d[i + 1] + add;
            d[i + 2] = d[i + 2] + add;
          }
          i += 4;
        }
      }
      ctx.putImageData(id, 0, 0);
      return { 'image:output': canvas.transferToImageBitmap() };
    },
    schema: {
      description: "Vignette — darkens or brightens corners. Useful for framing and mood.",
      inputs: [{ name: "image:input", type: "image", required: true }],
      outputs: [{ name: "image:output", type: "image" }],
      params: {
        amount:  { type: "number", min: -100, max: 100, default: -30, description: "Darken (negative) or brighten (positive) corners. FLOOR FOR VISIBLE DARKEN: -25 (i.e. -25 or more negative). Values like -10 or -5 are invisible. Use recipe values, do not soften them." },
        size:    { type: "number", min: 0, max: 100, default: 50, description: "Inner radius where falloff begins. Smaller = tighter spotlight." },
        feather: { type: "number", min: 0, max: 100, default: 50, description: "Width of the falloff. Larger = softer edge." },
      },
    },
  },
  Grain: {
    execute: async (inputs, nodeData) => {
      const src = inputs['image:input'];
      if (!(src instanceof ImageBitmap)) return { 'image:output': null };

      const amount = (nodeData?.amount as number) ?? 30;     // 0..100, strength
      const mono   = (nodeData?.mono   as boolean) ?? true;   // luminance-only vs colored
      const seed   = (nodeData?.seed   as number) ?? 1;       // any int

      const canvas = new OffscreenCanvas(src.width, src.height);
      const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
      ctx.drawImage(src, 0, 0);
      const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = id.data;

      const rng = mulberry32(seed);
      const strength = amount * 0.5; // ±50 max in 0..255 space at amount=100

      if (mono) {
        for (let i = 0; i < d.length; i += 4) {
          const n = (rng() - 0.5) * 2 * strength; // [-strength, +strength]
          d[i]     += n;
          d[i + 1] += n;
          d[i + 2] += n;
        }
      } else {
        for (let i = 0; i < d.length; i += 4) {
          d[i]     += (rng() - 0.5) * 2 * strength;
          d[i + 1] += (rng() - 0.5) * 2 * strength;
          d[i + 2] += (rng() - 0.5) * 2 * strength;
        }
      }
      ctx.putImageData(id, 0, 0);
      return { 'image:output': canvas.transferToImageBitmap() };
    },
    schema: {
      description: "Film grain — adds noise. Essential for authentic film textures. Refer to RECIPES for amounts.",
      inputs: [{ name: "image:input", type: "image", required: true }],
      outputs: [{ name: "image:output", type: "image" }],
      params: {
        amount: { type: "number", min: 0, max: 100, default: 30, description: "Grain strength, 0–100. FLOOR FOR VISIBLE GRAIN: 20. Below 15 is invisible at preview resolution. 30 is subtle film, 45+ is heavy 16mm. Use recipe values, do not soften." },
        mono:   { type: "boolean", default: true, description: "Monochromatic grain (authentic film) vs RGB noise (digital sensor)." },
        seed:   { type: "number", min: 1, max: 9999, default: 1, description: "Pattern seed. Change to get a different noise pattern; same seed = same pattern." },
      },
    },
  },
  Posterize: {
    execute: async (inputs, nodeData) => {
      const src = inputs['image:input'];
      if (!(src instanceof ImageBitmap)) return { 'image:output': null };

      const levels = Math.max(2, Math.min(32, Math.round((nodeData?.levels as number) ?? 4)));
      const mode = (nodeData?.mode as string) ?? 'rgb';

      const canvas = new OffscreenCanvas(src.width, src.height);
      const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
      ctx.drawImage(src, 0, 0);
      const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = id.data;
      const step = 255 / (levels - 1);

      if (mode === 'luminance') {
        for (let i = 0; i < data.length; i += 4) {
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          const q = Math.round(lum / step) * step;
          data[i] = data[i + 1] = data[i + 2] = q;
        }
      } else {
        for (let i = 0; i < data.length; i += 4) {
          data[i]     = Math.round(data[i] / step) * step;
          data[i + 1] = Math.round(data[i + 1] / step) * step;
          data[i + 2] = Math.round(data[i + 2] / step) * step;
        }
      }
      ctx.putImageData(id, 0, 0);
      return { 'image:output': canvas.transferToImageBitmap() };
    },
    schema: {
      description: "Quantizes pixel values into N levels per channel. RGB mode = N levels per R/G/B (4 levels = 64 colors total, the Warhol/comic-flat look). Luminance mode = N flat grayscale bands. Pair with GradientMap for full Warhol/poster effects.",
      inputs: [{ name: "image:input", type: "image", required: true }],
      outputs: [{ name: "image:output", type: "image" }],
      params: {
        levels: { type: "number", min: 2, max: 16, step: 1, default: 4, description: "Number of bands per channel. 2 = harshest, 8 = subtle." },
        mode: { type: "enum", values: ["rgb", "luminance"], default: "rgb", description: "rgb = posterize each channel independently. luminance = flat grayscale bands." },
      },
    },
  },
  SolidFill: {
    execute: async (inputs, nodeData) => {
      const src = inputs['image:input'];
      const color = (nodeData?.color as string) ?? '#000080';
      const fallbackW = (nodeData?.width as number) ?? 512;
      const fallbackH = (nodeData?.height as number) ?? 512;
      const w = src instanceof ImageBitmap ? src.width : fallbackW;
      const h = src instanceof ImageBitmap ? src.height : fallbackH;
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, h);
      return { 'image:output': canvas.transferToImageBitmap() };
    },
    schema: {
      description: "Outputs a solid color rectangle. If image:input is connected, the output matches its dimensions; otherwise uses width/height. Pair with Blend to colorize, fill backgrounds, or tint a black-and-white image (e.g. give Canny edges a colored background).",
      inputs: [
        { name: "image:input", type: "image", required: false, description: "Optional. If provided, output matches its size." },
      ],
      outputs: [{ name: "image:output", type: "image" }],
      params: {
        color: { type: "color", default: "#000080", description: "Fill color." },
        width: { type: "number", min: 1, max: 4096, default: 512, description: "Width when no image:input is connected." },
        height: { type: "number", min: 1, max: 4096, default: 512, description: "Height when no image:input is connected." },
      },
    },
  },
  GradientMap: {
    execute: async (inputs, nodeData) => {
      const src = inputs['image:input'];
      if (!(src instanceof ImageBitmap)) return { 'image:output': null };

      const lowHex = (nodeData?.colorLow as string) ?? '#000000';
      const highHex = (nodeData?.colorHigh as string) ?? '#ffffff';
      const low = hexToRgb(lowHex);
      const high = hexToRgb(highHex);

      const canvas = new OffscreenCanvas(src.width, src.height);
      const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
      ctx.drawImage(src, 0, 0);
      const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = id.data;

      for (let i = 0; i < data.length; i += 4) {
        // luminance from existing pixel
        const t = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
        data[i]     = low.r + (high.r - low.r) * t;
        data[i + 1] = low.g + (high.g - low.g) * t;
        data[i + 2] = low.b + (high.b - low.b) * t;
        // alpha unchanged
      }
      ctx.putImageData(id, 0, 0);
      return { 'image:output': canvas.transferToImageBitmap() };
    },
    schema: {
      description: "Maps image luminance to a two-color ramp. Black input → colorLow, white input → colorHigh, gray = blend. The single most useful node for stylized print looks: blueprint (black→navy, white→cyan), duotone, sepia, riso, GameBoy. Run on a Canny output to get colored edges on a colored background.",
      inputs: [{ name: "image:input", type: "image", required: true }],
      outputs: [{ name: "image:output", type: "image" }],
      params: {
        colorLow: { type: "color", default: "#000080", description: "Color that black input pixels become." },
        colorHigh: { type: "color", default: "#ffffff", description: "Color that white input pixels become." },
      },
    },
  },
  Halation: {
    execute: async (inputs, nodeData) => {
      const src = inputs['image:input'];
      if (!(src instanceof ImageBitmap)) return { 'image:output': null };

      try {
        const threshold = (nodeData?.threshold as number) ?? 200;
        const radius = (nodeData?.radius as number) ?? 10;
        const intensity = (nodeData?.intensity as number) ?? 50;

        const { width, height } = src;
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;

        // 1. Extract highlights into a separate layer
        const glowCanvas = new OffscreenCanvas(width, height);
        const glowCtx = glowCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
        
        glowCtx.drawImage(src, 0, 0);
        const id = glowCtx.getImageData(0, 0, width, height);
        const d = id.data;
        for (let i = 0; i < d.length; i += 4) {
          const luma = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
          if (luma < threshold) {
            d[i+3] = 0; // Transparent
          }
        }
        glowCtx.putImageData(id, 0, 0);

        // 2. Prepare final canvas
        ctx.drawImage(src, 0, 0);

        if (intensity > 0) {
          // 3. Create the blurred red glow
          const tintCanvas = new OffscreenCanvas(width, height);
          const tintCtx = tintCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
          
          if (radius > 0 && 'filter' in tintCtx) {
            tintCtx.filter = `blur(${radius}px)`;
          }
          tintCtx.drawImage(glowCanvas, 0, 0);
          
          // Tint red
          tintCtx.globalCompositeOperation = 'source-in';
          tintCtx.fillStyle = '#ff3300';
          tintCtx.fillRect(0, 0, width, height);
          
          // 4. Blend back
          ctx.globalAlpha = intensity / 100;
          ctx.globalCompositeOperation = 'screen';
          ctx.drawImage(tintCanvas, 0, 0);
          ctx.globalAlpha = 1.0;
          ctx.globalCompositeOperation = 'source-over';
        }

        return { 'image:output': canvas.transferToImageBitmap() };
      } catch (err) {
        console.error("Halation failed:", err);
        // Fallback: return original image so the pipeline doesn't break
        return { 'image:output': src };
      }
    },
    schema: {
      description: "Optical halation effect. Adds a soft red glow to highlights, mimicking film emulsion behavior.",
      inputs: [{ name: "image:input", type: "image", required: true }],
      outputs: [{ name: "image:output", type: "image" }],
      params: {
        threshold: { type: "number", min: 0, max: 255, default: 200, description: "Luminance threshold for highlights." },
        radius: { type: "number", min: 0, max: 50, default: 10, description: "Glow spread radius." },
        intensity: { type: "number", min: 0, max: 100, default: 50, description: "Effect strength." },
      },
    },
  },
  Output: {
    execute: async (inputs) => {
      const image = inputs['image:input']
      const mask = inputs['mask:input']
      return {
        'image:output': image instanceof ImageBitmap ? image : null,
        'mask:output': mask instanceof ImageBitmap ? mask : null,
      }
    },
    schema: {
      description: "Final output. Displays whatever is connected to image:input in the preview panel. Every pipeline should end with one.",
      inputs: [
        { name: "image:input", type: "image", required: true },
        { name: "mask:input", type: "mask", required: false },
      ],
      outputs: [],
      params: {},
    },
  },
};

export default nodeRegistry;
