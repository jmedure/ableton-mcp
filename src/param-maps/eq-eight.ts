import type { ParamMap, ParamMapEntry } from "./index.js";

// EQ Eight has 8 bands, each with: Frequency, Gain, Q, Filter Type, Band On/Off
// Parameter names in LOM follow the pattern: "1 Frequency A", "1 Gain A", etc.

// ---- Frequency ----

function freqToHuman(raw: number): string {
  // EQ Eight frequency range: ~20Hz to ~20kHz, logarithmic
  const hz = 20 * Math.pow(1000, raw);
  if (hz >= 1000) return `${(hz / 1000).toFixed(1)}kHz`;
  return `${Math.round(hz)}Hz`;
}

function freqFromHuman(hz: number): number {
  return Math.log(hz / 20) / Math.log(1000);
}

// ---- Gain ----

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

// ---- Filter Type ----
// EQ Eight filter types are quantized: 8 types mapped to 0-1 in steps of 1/7

const FILTER_TYPES = [
  "Low Cut 48",
  "Low Cut 12",
  "Low Shelf",
  "Bell",
  "Notch",
  "High Shelf",
  "High Cut 12",
  "High Cut 48",
] as const;

type FilterTypeName = (typeof FILTER_TYPES)[number];

const FILTER_TYPE_INDEX: Record<string, number> = {};
for (let i = 0; i < FILTER_TYPES.length; i++) {
  FILTER_TYPE_INDEX[FILTER_TYPES[i].toLowerCase()] = i;
}

function filterTypeToHuman(raw: number): string {
  const index = Math.round(raw * 7);
  return FILTER_TYPES[index] ?? `Unknown (${raw.toFixed(2)})`;
}

function filterTypeFromHuman(value: number): number {
  // Accept the type index directly (0-7) and convert to 0-1
  const index = Math.round(Math.max(0, Math.min(7, value)));
  return index / 7;
}

// ---- Band On/Off ----

function bandOnToHuman(raw: number): string {
  return raw >= 0.5 ? "On" : "Off";
}

function bandOnFromHuman(value: number): number {
  return value >= 1 ? 1 : 0;
}

// Build parameters for all 8 bands
const parameters: Record<string, ParamMapEntry> = {};

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
  parameters[`${band} Filter Type A`] = {
    unit: "type",
    toHuman: filterTypeToHuman,
    fromHuman: filterTypeFromHuman,
  };
  parameters[`${band} Filter On A`] = {
    unit: "on/off",
    toHuman: bandOnToHuman,
    fromHuman: bandOnFromHuman,
  };
}

// Global parameters
parameters["Scale"] = {
  unit: "%",
  toHuman: (raw) => `${Math.round(raw * 100)}%`,
  fromHuman: (value) => value / 100,
};

parameters["Output Gain"] = {
  unit: "dB",
  toHuman: gainToHuman,
  fromHuman: gainFromHuman,
};

export const eqEightMap: ParamMap = {
  deviceClassName: "Eq8",
  parameters,
};
