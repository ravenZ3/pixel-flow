import { rgbToHsl, hslToRgb } from "./colorUtils";

export interface NodeExecutor {
  execute(
    inputs: Record<string, ImageBitmap | string | null>,
    nodeData?: Record<string, any>
  ): Promise<Record<string, ImageBitmap | string | null>>;
}

const nodeRegistry: Record<string, NodeExecutor> = {
  ImageInput: {
    execute: async (inputs) => ({
      image: (inputs.uploadedImage as unknown as ImageBitmap) ?? null,
    }),
  },
  Color: {
    execute: async (inputs, nodeData) => {
      if (!inputs.image || !(inputs.image instanceof ImageBitmap)) return { image: null };
      const src = inputs.image;
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

        // brightness
        r += brightness;
        g += brightness;
        b += brightness;

        // contrast
        r = (r - 0.5) * (1 + contrast) + 0.5;
        g = (g - 0.5) * (1 + contrast) + 0.5;
        b = (b - 0.5) * (1 + contrast) + 0.5;

        // gamma
        r = Math.pow(Math.max(0, r), 1 / gamma);
        g = Math.pow(Math.max(0, g), 1 / gamma);
        b = Math.pow(Math.max(0, b), 1 / gamma);

        // saturation + hue via HSL
        const [h, s, l] = rgbToHsl(r, g, b);
        const newS = Math.min(1, Math.max(0, s + saturation));
        const newH = (h + hue + 1) % 1;
        [r, g, b] = hslToRgb(newH, newS, l);

        data[i] = Math.min(255, Math.max(0, r * 255));
        data[i + 1] = Math.min(255, Math.max(0, g * 255));
        data[i + 2] = Math.min(255, Math.max(0, b * 255));
      }

      ctx.putImageData(id, 0, 0);
      return { image: canvas.transferToImageBitmap() };
    },
  },
  Filter: {
    execute: async (inputs, nodeData) => {
      if (!inputs.image || !(inputs.image instanceof ImageBitmap)) return { image: null };
      const src = inputs.image;
      const type = nodeData?.filterType ?? "gaussian";
      const strength = nodeData?.strength ?? 1;

      const canvas = new OffscreenCanvas(src.width, src.height);
      const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;

      if (type === "gaussian") {
        ctx.filter = `blur(${strength}px)`;
        ctx.drawImage(src, 0, 0);
        return { image: canvas.transferToImageBitmap() };
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
      return { image: canvas.transferToImageBitmap() };
    },
  },
  Blend: {
    execute: async (inputs, nodeData) => {
      if (!inputs.imageA || !(inputs.imageA instanceof ImageBitmap)) {
        return { image: inputs.imageB instanceof ImageBitmap ? inputs.imageB : null };
      }
      if (!inputs.imageB || !(inputs.imageB instanceof ImageBitmap)) {
        return { image: inputs.imageA instanceof ImageBitmap ? inputs.imageA : null };
      }

      const a = inputs.imageA;
      const b = inputs.imageB;
      const opacity = (nodeData?.opacity ?? 50) / 100;
      const mode = nodeData?.blendMode ?? "normal";

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
            case "difference":
              blended = Math.abs(av - bv);
              break;
            case "subtract":
              blended = Math.max(0, av - bv);
              break;
            default:
              blended = bv;
          }
          dataA[i + c] = Math.round((blended * opacity + av * (1 - opacity)) * 255);
        }
        dataA[i + 3] = 255;
      }

      ctx.putImageData(idA, 0, 0);
      return { image: canvas.transferToImageBitmap() };
    },
  },
  Mask: {
    execute: async (inputs, nodeData) => {
      return {
        image: inputs.image ?? null,
        mask: nodeData?.maskBitmap ?? null,
      };
    },
  },
  Preview: {
    execute: async (inputs) => ({
      image: inputs.image ?? null,
    }),
  },
};

export default nodeRegistry;
