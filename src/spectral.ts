import type { SpectralSnapshot } from "./types.js";

// ============================================================
// Frequency band labels for human-readable spectral analysis
// ============================================================

const BAND_LABELS: Record<string, [number, number]> = {
  "sub-bass": [20, 60],
  bass: [60, 250],
  "low-mids": [250, 500],
  mids: [500, 2000],
  "upper-mids": [2000, 4000],
  presence: [4000, 6000],
  brilliance: [6000, 12000],
  air: [12000, 20000],
};

// ============================================================
// Spectral observations — interpret FFT data into mix insights
// ============================================================

export interface SpectralObservation {
  band: string;
  rangeHz: [number, number];
  description: string;
}

export function analyzeSpectral(
  snapshot: SpectralSnapshot,
): SpectralObservation[] {
  const observations: SpectralObservation[] = [];

  for (const band of snapshot.bands) {
    // Excess low-mid energy (muddiness indicator)
    if (
      band.label === "low-mids" &&
      band.rmsDb > -12
    ) {
      observations.push({
        band: band.label,
        rangeHz: band.rangeHz,
        description: `Elevated energy in low-mids (${band.rmsDb.toFixed(1)}dB RMS) — potential muddiness`,
      });
    }

    // Harsh upper-mids
    if (
      band.label === "upper-mids" &&
      band.peakDb > -6
    ) {
      observations.push({
        band: band.label,
        rangeHz: band.rangeHz,
        description: `Peak energy in upper-mids (${band.peakDb.toFixed(1)}dB peak) — may sound harsh or fatiguing`,
      });
    }

    // Missing air
    if (
      band.label === "air" &&
      band.rmsDb < -36
    ) {
      observations.push({
        band: band.label,
        rangeHz: band.rangeHz,
        description: `Very low energy above 12kHz (${band.rmsDb.toFixed(1)}dB RMS) — mix may lack air/sparkle`,
      });
    }

    // Sub-bass buildup
    if (
      band.label === "sub-bass" &&
      band.rmsDb > -18
    ) {
      observations.push({
        band: band.label,
        rangeHz: band.rangeHz,
        description: `Significant sub-bass energy (${band.rmsDb.toFixed(1)}dB RMS) — check for low-frequency buildup`,
      });
    }
  }

  return observations;
}

export function formatSpectralSummary(snapshot: SpectralSnapshot): string {
  const observations = analyzeSpectral(snapshot);

  if (observations.length === 0) {
    return "Spectral balance appears even — no notable peaks or deficiencies detected.";
  }

  return observations.map((o) => o.description).join(". ") + ".";
}
