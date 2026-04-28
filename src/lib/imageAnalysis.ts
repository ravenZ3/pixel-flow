/**
 * Image Analysis Utility
 * Extracts structural and color statistics from an ImageBitmap on the client side.
 */

export interface ImageStats {
  brightness: number; // 0-100
  contrast: number;   // 0-100
  shadows: number;    // 0-100 (percentage of dark pixels)
  highlights: number; // 0-100 (percentage of bright pixels)
  saturation: number; // 0-100
  isWarm: boolean;
  dominantColor?: string;
  summary?: string;
}

export async function calculateImageStats(bitmap: ImageBitmap): Promise<ImageStats> {
  // Use a small canvas for fast analysis (e.g. 128x128)
  const size = 128;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not get canvas context");

  ctx.drawImage(bitmap, 0, 0, size, size);
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;

  let totalLuminance = 0;
  let totalSaturation = 0;
  let shadowCount = 0;
  let highlightCount = 0;
  let rSum = 0, gSum = 0, bSum = 0;

  const pixelCount = size * size;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Relative luminance (standard formula)
    const luma = (0.299 * r + 0.587 * g + 0.114 * b);
    totalLuminance += luma;

    if (luma < 51) shadowCount++; // Bottom 20%
    if (luma > 204) highlightCount++; // Top 20%

    // Rough saturation: max - min channel
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    totalSaturation += (max - min);

    rSum += r;
    gSum += g;
    bSum += b;
  }

  const avgLuma = totalLuminance / pixelCount;
  const avgSat = totalSaturation / pixelCount;
  
  // Calculate contrast as standard deviation of luminance
  let sumSquaredDiff = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luma = (0.299 * r + 0.587 * g + 0.114 * b);
    sumSquaredDiff += Math.pow(luma - avgLuma, 2);
  }
  const stdDev = Math.sqrt(sumSquaredDiff / pixelCount);

  // Normalize to 0-100
  const stats: ImageStats = {
    brightness: Math.round((avgLuma / 255) * 100),
    contrast: Math.round(Math.min(100, (stdDev / 64) * 100)), // 64 is a reasonable "high contrast" std dev
    shadows: Math.round((shadowCount / pixelCount) * 100),
    highlights: Math.round((highlightCount / pixelCount) * 100),
    saturation: Math.round((avgSat / 128) * 100), // 128 is high saturation
    isWarm: rSum > bSum,
  };

  // Generate a human-readable summary for the agent
  const brightnessLabel = stats.brightness > 70 ? "Bright/High-key" : stats.brightness < 30 ? "Dark/Low-key" : "Balanced";
  const contrastLabel = stats.contrast > 70 ? "High Contrast" : stats.contrast < 30 ? "Flat/Low Contrast" : "Normal Contrast";
  const tempLabel = stats.isWarm ? "Warm" : "Cool";
  const saturationLabel = stats.saturation > 60 ? "Vibrant" : stats.saturation < 20 ? "Muted" : "Normal Saturation";

  stats.summary = `Image context: ${brightnessLabel}, ${contrastLabel}, ${tempLabel} cast, ${saturationLabel}. ` +
    `Luminance: ${stats.brightness}%, Shadows: ${stats.shadows}%, Highlights: ${stats.highlights}%, Saturation: ${stats.saturation}%.`;

  return stats;
}
