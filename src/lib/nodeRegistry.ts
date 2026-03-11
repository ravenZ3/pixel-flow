export interface NodeExecutor {
  execute(
    inputs: Record<string, string | null>
  ): Promise<Record<string, string | null>>;
}

const nodeRegistry: Record<string, NodeExecutor> = {
  ImageInput: {
    execute: async (inputs) => ({
      image: inputs.uploadedImage ?? null,
    }),
  },
  Blur: {
    execute: async (inputs) => ({
      image: inputs.image ?? null,
    }),
  },
  Brightness: {
    execute: async (inputs) => ({
      image: inputs.image ?? null,
    }),
  },
  MaskDraw: {
    execute: async (inputs) => ({
      image: inputs.image ?? null,
      mask: null,
    }),
  },
  Preview: {
    execute: async (inputs) => ({
      image: inputs.image ?? null,
    }),
  },
};

export default nodeRegistry;
