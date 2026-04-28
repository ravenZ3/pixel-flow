import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import useUIStore from "@/store/uiStore";
import useExecutionStore from "@/store/executionStore";
import { Slider } from "@/components/ui/slider";
import { buildToneLUT } from "@/lib/nodeRegistry";
import NodeWrapper from "./NodeWrapper";
import { handleRow } from "./handleStyles";
import NodePreview from "./NodePreview";

type Channel = "master" | "red" | "green" | "blue";

const CHANNELS: { key: Channel; label: string; color: string }[] = [
  { key: "master", label: "Master", color: "#e5e5e5" },
  { key: "red", label: "R", color: "#ef4444" },
  { key: "green", label: "G", color: "#22c55e" },
  { key: "blue", label: "B", color: "#3b82f6" },
];

const SLIDER_KEYS = ["BlackPoint", "Shadows", "Midtones", "Highlights", "WhitePoint"] as const;
type SliderKey = typeof SLIDER_KEYS[number];

// x-position of each anchor on the input axis (0..255).
const ANCHOR_X: Record<SliderKey, number> = {
  BlackPoint: 0,
  Shadows: 64,
  Midtones: 128,
  Highlights: 192,
  WhitePoint: 255,
};

// Per-slider range. Endpoints are unidirectional (positive = the effect).
const SLIDER_RANGE: Record<SliderKey, { min: number; max: number }> = {
  BlackPoint: { min: 0, max: 100 },
  Shadows: { min: -100, max: 100 },
  Midtones: { min: -100, max: 100 },
  Highlights: { min: -100, max: 100 },
  WhitePoint: { min: 0, max: 100 },
};

const SLIDER_LABEL: Record<SliderKey, string> = {
  BlackPoint: "Black Point",
  Shadows: "Shadows",
  Midtones: "Midtones",
  Highlights: "Highlights",
  WhitePoint: "White Point",
};

function paramName(channel: Channel, slider: SliderKey): string {
  return `${channel}${slider}`;
}

function CurvesNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useUIStore((s) => s.updateNodeData);
  const [active, setActive] = useState<Channel>("master");

  const get = useCallback(
    (channel: Channel, slider: SliderKey): number =>
      Number((data[paramName(channel, slider)] as number | undefined) ?? 0),
    [data]
  );

  const set = useCallback(
    (channel: Channel, slider: SliderKey, value: number) => {
      const r = SLIDER_RANGE[slider];
      const clamped = Math.max(r.min, Math.min(r.max, value));
      updateNodeData(id, { [paramName(channel, slider)]: clamped });
    },
    [id, updateNodeData]
  );

  const resetChannel = useCallback(
    (channel: Channel) => {
      const update: Record<string, number> = {};
      for (const s of SLIDER_KEYS) update[paramName(channel, s)] = 0;
      updateNodeData(id, update);
    },
    [id, updateNodeData]
  );

  // Output thumb
  const nodeOutputs = useExecutionStore((s) => s.nodeOutputs);
  const outputImage = nodeOutputs[id]?.["image:output"] as ImageBitmap | undefined;

  // Curve preview canvas — composited from all four channels, with draggable anchor points.
  const curveRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<SliderKey | null>(null);
  const CURVE_W = 180;
  const CURVE_H = 100;

  // Convert a canvas y to a slider value, with per-slider math.
  // Interior anchors: y = x + value * 0.5  →  value = (yOutput - xInput) * 2
  // BlackPoint:       y = value * 0.5      →  value = yOutput * 2 (clamp 0..100)
  // WhitePoint:       y = 255 - value*0.5  →  value = (255 - yOutput) * 2 (clamp 0..100)
  const canvasYToSliderValue = useCallback((slider: SliderKey, canvasY: number): number => {
    const yOutput = (1 - canvasY / CURVE_H) * 255;
    if (slider === "BlackPoint") {
      return Math.max(0, Math.min(100, Math.round(yOutput * 2)));
    }
    if (slider === "WhitePoint") {
      return Math.max(0, Math.min(100, Math.round((255 - yOutput) * 2)));
    }
    const xInput = ANCHOR_X[slider];
    const delta = yOutput - xInput;
    return Math.max(-100, Math.min(100, Math.round(delta * 2)));
  }, []);

  const pickClosestAnchor = useCallback(
    (canvasX: number): SliderKey | null => {
      let closest: SliderKey | null = null;
      let best = 28; // px tolerance on x
      for (const s of SLIDER_KEYS) {
        const ax = (ANCHOR_X[s] / 255) * CURVE_W;
        const dx = Math.abs(canvasX - ax);
        if (dx < best) {
          best = dx;
          closest = s;
        }
      }
      return closest;
    },
    []
  );

  const onCurvePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CURVE_W;
    const closest = pickClosestAnchor(x);
    if (!closest) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = closest;
    const y = ((e.clientY - rect.top) / rect.height) * CURVE_H;
    set(active, closest, canvasYToSliderValue(closest, y));
  }, [active, set, canvasYToSliderValue, pickClosestAnchor]);

  const onCurvePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const slider = dragRef.current;
    if (!slider) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = ((e.clientY - rect.top) / rect.height) * CURVE_H;
    set(active, slider, canvasYToSliderValue(slider, y));
  }, [active, set, canvasYToSliderValue]);

  const onCurvePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
  }, []);

  const onCurveDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CURVE_W;
    const closest = pickClosestAnchor(x);
    if (closest) set(active, closest, 0);
  }, [active, set, pickClosestAnchor]);

  const lutFor = useCallback(
    (ch: Channel) =>
      buildToneLUT(
        get(ch, "BlackPoint"),
        get(ch, "Shadows"),
        get(ch, "Midtones"),
        get(ch, "Highlights"),
        get(ch, "WhitePoint")
      ),
    [get]
  );

  const luts = useMemo(
    () => ({ master: lutFor("master"), red: lutFor("red"), green: lutFor("green"), blue: lutFor("blue") }),
    [lutFor]
  );

  useEffect(() => {
    const c = curveRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const W = c.width = CURVE_W;
    const H = c.height = CURVE_H;

    // backing
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, W, H);

    // grid
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo((i / 4) * W, 0);
      ctx.lineTo((i / 4) * W, H);
      ctx.moveTo(0, (i / 4) * H);
      ctx.lineTo(W, (i / 4) * H);
      ctx.stroke();
    }

    // identity diagonal
    ctx.strokeStyle = "#333";
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(W, 0);
    ctx.stroke();

    // draw each curve, dim if not active
    const drawCurve = (lut: Uint8ClampedArray, color: string, opacity: number) => {
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x < 256; x++) {
        const px = (x / 255) * W;
        const py = H - (lut[x] / 255) * H;
        if (x === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    for (const ch of CHANNELS) {
      const isActive = ch.key === active;
      drawCurve(luts[ch.key], ch.color, isActive ? 1 : 0.25);
    }

    // Draw draggable anchor handles for the active channel.
    const activeColor = CHANNELS.find((c) => c.key === active)!.color;
    const lut = luts[active];
    for (const slider of SLIDER_KEYS) {
      const xInput = ANCHOR_X[slider];
      const px = (xInput / 255) * W;
      const py = H - (lut[xInput] / 255) * H;
      ctx.fillStyle = "#0a0a0a";
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }, [luts, active]);

  const leftRow = handleRow({ side: "left" });
  const rightRow = handleRow({ side: "right" });

  return (
    <NodeWrapper id={id} label="Curves" selected={selected}>
      <NodePreview image={outputImage} visible={selected} />

      <div className="space-y-2 nopan nodrag">
        {/* Channel tabs */}
        <div className="flex gap-1">
          {CHANNELS.map((ch) => (
            <button
              key={ch.key}
              onClick={() => setActive(ch.key)}
              className={`flex-1 text-[10px] font-mono py-1 rounded border transition-colors ${
                active === ch.key
                  ? "bg-zinc-800 border-zinc-600 text-zinc-100"
                  : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300"
              }`}
              style={active === ch.key ? { borderColor: ch.color, color: ch.color } : undefined}
            >
              {ch.label}
            </button>
          ))}
        </div>

        {/* Curve preview — draggable anchors */}
        <canvas
          ref={curveRef}
          onPointerDown={onCurvePointerDown}
          onPointerMove={onCurvePointerMove}
          onPointerUp={onCurvePointerUp}
          onPointerCancel={onCurvePointerUp}
          onDoubleClick={onCurveDoubleClick}
          className="w-full rounded border border-zinc-800 bg-zinc-950 block cursor-crosshair touch-none select-none"
        />

        {/* Sliders for the active channel */}
        <div className="space-y-2 pt-1">
          {SLIDER_KEYS.map((slider) => {
            const value = get(active, slider);
            const range = SLIDER_RANGE[slider];
            return (
              <div key={slider} className="node-control">
                <label className="node-label flex items-center justify-between">
                  <span>{SLIDER_LABEL[slider]}</span>
                  <span className="font-mono text-zinc-500">{value > 0 ? `+${value}` : value}</span>
                </label>
                <Slider
                  value={[value]}
                  min={range.min}
                  max={range.max}
                  step={1}
                  onValueChange={(v) => set(active, slider, Array.isArray(v) ? v[0] : v)}
                />
              </div>
            );
          })}
        </div>

        <button
          onClick={() => resetChannel(active)}
          className="text-[10px] text-zinc-500 hover:text-cyan-400 w-full text-right pt-1"
        >
          reset {active}
        </button>
      </div>

      <div className="mt-4 space-y-2">
        <div className={leftRow.row()}>
          <Handle type="target" position={Position.Left} id="image:input" className="!left-[-20px]" />
          <span className={leftRow.label()}>image</span>
        </div>
        <div className={rightRow.row()}>
          <span className={rightRow.label()}>image</span>
          <Handle type="source" position={Position.Right} id="image:output" className="!right-[-20px]" />
        </div>
      </div>
    </NodeWrapper>
  );
}

export default memo(CurvesNode);
