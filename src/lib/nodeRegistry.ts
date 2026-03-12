import { rgbToHsl, hslToRgb } from "./colorUtils";

export type NodeOutputs = {
  [key: string]: ImageBitmap | string | null | undefined | Record<string, any>;
  _updateNodeData?: Record<string, any>;
};

export interface NodeExecutor {
  execute(
    inputs: Record<string, ImageBitmap | string | null>,
    nodeData?: Record<string, any>
  ): Promise<NodeOutputs>;
}

const nodeRegistry: Record<string, NodeExecutor> = {
  ImageInput: {
    execute: async (inputs, nodeData) => ({
      'image:output': (nodeData?.uploadedImage as unknown as ImageBitmap) ?? null,
    }),
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

      const brightness = (nodeData?.brightness ?? 0) / 100;
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

      const canvasB = new OffscreenCanvas(b.width, b.height);
      const ctxB = canvasB.getContext("2d") as OffscreenCanvasRenderingContext2D;
      ctxB.drawImage(b, 0, 0);
      const idB = ctxB.getImageData(0, 0, canvasB.width, canvasB.height);

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
  },
  Mask: {
    execute: async (inputs, nodeData) => {
      const image = inputs['image:input']
      const externalMask = inputs['mask:input']
      const drawnMask = (nodeData?.mask as ImageBitmap | null) ?? null

      if (!(image instanceof ImageBitmap)) {
        return { 'image:output': null, 'mask:output': null, 'inputImage': null }
      }

      // Store external mask in node data so the component can load it onto canvas
      if (externalMask instanceof ImageBitmap) {
        const currentExternal = nodeData?.externalMask
        if (currentExternal !== externalMask) {
          return {
            'image:output': image,
            'mask:output': drawnMask ?? externalMask,
            'inputImage': image,
            '_updateNodeData': { externalMask }
          }
        }
      }

      return {
        'image:output': image,
        'mask:output': drawnMask,
        'inputImage': image,
      };
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
    }
  },
  ASCII: {
    execute: async (inputs, nodeData) => {
      const src = inputs['image:input']
      const mask = inputs['mask:input']

      if (!(src instanceof ImageBitmap)) return { 'image:output': null }

      const fontSize = nodeData?.fontSize ?? 8
      const charSet = nodeData?.charSet ?? 'classic'
      const invert = nodeData?.invert ?? false
      const bgMode = nodeData?.bgMode ?? 'dark'
      const colorMode = nodeData?.colorMode ?? 'original'
      const maskThreshold = nodeData?.maskThreshold ?? 30

      const charSets: Record<string, string[]> = {
        classic: ['@', '#', 'S', '%', '?', '*', '+', ';', ':', ',', ' '],
        blocks: ['█', '▓', '▒', '░', ' '],
        minimal: ['@', '+', ' '],
        braille: ['⣿', '⣷', '⣯', '⣟', '⡿', '⢿', '⣻', '⣽', ' '],
      }
      const chars = charSets[charSet] ?? charSets.classic

      const { width, height } = src

      // Sample source image once
      const sampleCanvas = new OffscreenCanvas(width, height)
      const sampleCtx = sampleCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D
      sampleCtx.drawImage(src, 0, 0)
      const fullImageData = sampleCtx.getImageData(0, 0, width, height)
      const data = fullImageData.data

      // Sample mask once (if connected)
      let maskData: Uint8ClampedArray | null = null
      if (mask instanceof ImageBitmap) {
        const maskCanvas = new OffscreenCanvas(width, height)
        const maskCtx = maskCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D
        maskCtx.drawImage(mask, 0, 0, width, height) // scale mask to image size
        maskData = maskCtx.getImageData(0, 0, width, height).data
      }

      const cols = Math.floor(width / fontSize)
      const rows = Math.floor(height / (fontSize * 1.8))

      const outCanvas = new OffscreenCanvas(width, height)
      const outCtx = outCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D

      // Background
      if (bgMode === 'dark') {
        outCtx.fillStyle = '#0a0a0a'
        outCtx.fillRect(0, 0, width, height)
      } else if (bgMode === 'light') {
        outCtx.fillStyle = '#f5f5f5'
        outCtx.fillRect(0, 0, width, height)
      }
      // transparent: no fill

      outCtx.font = `${fontSize}px "Courier New", monospace`
      outCtx.textBaseline = 'top'

      const cellW = width / cols
      const cellH = height / rows

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          // Sample center of cell
          const px = Math.floor(col * cellW + cellW / 2)
          const py = Math.floor(row * cellH + cellH / 2)

          if (px >= width || py >= height) continue

          // Check mask at cell center — skip character if below threshold
          if (maskData) {
            const maskIdx = (py * width + px) * 4
            const maskBrightness = maskData[maskIdx] // 0-255
            if (maskBrightness < maskThreshold) continue // skip this cell
          }

          // Sample image at cell center
          const idx = (py * width + px) * 4
          const r = data[idx]
          const g = data[idx + 1]
          const b = data[idx + 2]
          let brightness = (r + g + b) / 3 / 255

          if (invert) brightness = 1 - brightness

          const charIndex = Math.floor((1 - brightness) * (chars.length - 1))
          const char = chars[charIndex]

          // Character color
          if (colorMode === 'solid') {
            outCtx.fillStyle = bgMode === 'light' ? '#000000' : '#ffffff'
          } else if (colorMode === 'grayscale') {
            const gray = Math.floor(brightness * 255)
            outCtx.fillStyle = `rgb(${gray},${gray},${gray})`
          } else {
            // original color mode
            if (bgMode === 'light') {
              outCtx.fillStyle = `rgb(${255 - r},${255 - g},${255 - b})`
            } else {
              outCtx.fillStyle = `rgb(${r},${g},${b})`
            }
          }

          outCtx.fillText(char, col * cellW, row * cellH)
        }
      }

      return { 'image:output': outCanvas.transferToImageBitmap() }
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
  },
};

export default nodeRegistry;
