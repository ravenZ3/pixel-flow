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
  },
  Prompt: {
    execute: async (inputs, nodeData) => {
      return {
        'prompt': {
          positive: nodeData?.prompt || "",
          negative: nodeData?.negativePrompt || "",
        }
      }
    }
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
