import type { ParamMap } from "./index.js";

export const compressorMap: ParamMap = {
  deviceClassName: "Compressor",
  parameters: {
    Threshold: {
      unit: "dB",
      toHuman: (raw) => `${Math.round(-36 + raw * 36)}dB`,
      fromHuman: (value) => (value + 36) / 36,
      observe: (raw, human) => {
        if (raw > 0.83) return `High threshold (${human}) — compressor rarely triggering`;
        return null;
      },
    },
    Ratio: {
      unit: ":1",
      toHuman: (raw) =>
        raw >= 0.99 ? "inf:1 (limiting)" : `${(1 + raw * 63).toFixed(1)}:1`,
      fromHuman: (value) => (value - 1) / 63,
      observe: (raw, human) => {
        if (raw > 0.14) return `High ratio (${human}) — behaving more like a limiter`;
        return null;
      },
    },
    Attack: {
      unit: "ms",
      toHuman: (raw) => `${(raw * 200).toFixed(1)}ms`,
      fromHuman: (value) => value / 200,
      observe: (raw, human) => {
        if (raw > 0.25) return `Slow attack (${human}) — transients passing through uncompressed`;
        return null;
      },
    },
    Release: {
      unit: "ms",
      toHuman: (raw) => `${(raw * 1190 + 10).toFixed(0)}ms`,
      fromHuman: (value) => (value - 10) / 1190,
    },
    Makeup: {
      unit: "dB",
      toHuman: (raw) => `+${(raw * 24).toFixed(1)}dB`,
      fromHuman: (value) => value / 24,
    },
    "Dry/Wet": {
      unit: "%",
      toHuman: (raw) => `${Math.round(raw * 100)}%`,
      fromHuman: (value) => value / 100,
    },
  },
};
