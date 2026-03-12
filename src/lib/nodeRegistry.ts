import { rgbToHsl, hslToRgb } from "./colorUtils";

export interface NodeExecutor {
  execute(
    inputs: Record<string, ImageBitmap | string | null>,
    nodeData?: Record<string, any>
  ): Promise<Record<string, ImageBitmap | string | null>>;
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
      const src = inputs['image:input']
      if (!(src instanceof ImageBitmap)) return { 'image:output': null, 'mask:output': null, 'inputImage': null }
      
      return {
        'image:output': src,
        'mask:output': nodeData?.mask ?? null,
        'inputImage': src, // For drawing background reference in UI
      };
    },
  },
  Output: {
    execute: async (inputs) => {
      const image = inputs['image:input']
      const mask  = inputs['mask:input']
      return {
        'image:output': image instanceof ImageBitmap ? image : null,
        'mask:output':  mask  instanceof ImageBitmap ? mask  : null,
      }
    },
  },
};

export default nodeRegistry;
