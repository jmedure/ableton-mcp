import type { ParamMap } from "./index.js";

// EQ Eight has 8 bands, each with: Frequency, Gain, Q, Filter Type, Band On/Off
// Parameter names in LOM follow the pattern: "1 Frequency A", "1 Gain A", etc.
// This map covers the common parameters.

function freqToHuman(raw: number): string {
  // EQ Eight frequency range: ~20Hz to ~20kHz, logarithmic
  const hz = 20 * Math.pow(1000, raw);
  if (hz >= 1000) return `${(hz / 1000).toFixed(1)}kHz`;
  return `${Math.round(hz)}Hz`;
}

function freqFromHuman(hz: number): number {
  return Math.log(hz / 20) / Math.log(1000);
}

function gainToHuman(raw: number): string {
  // Gain range: -15dB to +15dB, centered at 0.5
  const db = (raw - 0.5) * 30;
  const sign = db > 0 ? "+" : "";
  return `${sign}${db.toFixed(1)}dB`;
}

function gainFromHuman(db: number): number {
  return db / 30 + 0.5;
}

function observeGain(raw: number, human: string): string | null {
  const db = (raw - 0.5) * 30;
  if (db > 4) return `Notable boost (${human})`;
  if (db < -6) return `Significant cut (${human})`;
  return null;
}

// Build parameters for all 8 bands
const parameters: Record<string, import("./index.js").ParamMapEntry> = {};

for (let band = 1; band <= 8; band++) {
  parameters[`${band} Frequency A`] = {
    unit: "Hz",
    toHuman: freqToHuman,
    fromHuman: freqFromHuman,
  };
  parameters[`${band} Gain A`] = {
    unit: "dB",
    toHuman: gainToHuman,
    fromHuman: gainFromHuman,
    observe: observeGain,
  };
  parameters[`${band} Resonance A`] = {
    unit: "Q",
    toHuman: (raw) => `Q ${(0.1 + raw * 17.9).toFixed(1)}`,
    fromHuman: (value) => (value - 0.1) / 17.9,
  };
}

export const eqEightMap: ParamMap = {
  deviceClassName: "Eq8",
  parameters,
};
