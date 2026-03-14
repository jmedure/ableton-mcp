import type { SemanticTrack, HeuristicFinding } from "../types.js";

const TRANSIENT_KEYWORDS = ["kick", "snare", "808", "drum", "perc", "hat", "clap", "rim"];

function isTransientTrack(track: SemanticTrack): boolean {
  const lower = track.name.toLowerCase();
  return TRANSIENT_KEYWORDS.some((kw) => lower.includes(kw));
}

export function checkDynamics(tracks: SemanticTrack[]): HeuristicFinding[] {
  const findings: HeuristicFinding[] = [];

  for (const track of tracks) {
    for (const device of track.devices) {
      if (!device.active) continue;

      // Slow attack on transient-heavy tracks
      if (
        device.name === "Compressor" &&
        isTransientTrack(track)
      ) {
        const attack = device.parameters["Attack"];
        if (attack) {
          const ms = parseFloat(attack);
          if (ms > 50) {
            findings.push({
              id: "slow_attack_on_transient_track",
              severity: "warning",
              track: track.name,
              device: device.name,
              message: `Compressor attack is ${attack} — transients passing through uncompressed on a percussive track`,
              suggestion: `Try 10-20ms for tighter transient control`,
            });
          }
        }
      }

      // High ratio without matching fast attack
      if (device.name === "Compressor") {
        const ratio = device.parameters["Ratio"];
        const attack = device.parameters["Attack"];
        if (ratio && attack) {
          const ratioVal = parseFloat(ratio);
          const attackMs = parseFloat(attack);
          if (ratioVal > 10 && attackMs > 30) {
            findings.push({
              id: "high_ratio_slow_attack",
              severity: "info",
              track: track.name,
              device: device.name,
              message: `High ratio (${ratio}) with slow attack (${attack}) — not catching transients despite aggressive ratio`,
              suggestion: `Either lower the ratio or speed up the attack`,
            });
          }
        }
      }
    }
  }

  return findings;
}
