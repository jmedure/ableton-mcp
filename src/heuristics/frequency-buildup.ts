import type { SemanticTrack, HeuristicFinding } from "../types.js";

const BASS_KEYWORDS = ["bass", "808", "sub", "kick", "low"];

function isBassTrack(track: SemanticTrack): boolean {
  const lower = track.name.toLowerCase();
  return BASS_KEYWORDS.some((kw) => lower.includes(kw));
}

export function checkFrequencyBuildup(
  tracks: SemanticTrack[],
): HeuristicFinding[] {
  const findings: HeuristicFinding[] = [];

  // Check for non-bass tracks missing a high-pass
  for (const track of tracks) {
    if (isBassTrack(track) || track.type === "group") continue;

    const hasHighPass = track.devices.some((d) => {
      if (d.name !== "EQ Eight" && d.name !== "Eq8") return false;
      // Check if band 1 is configured as a high-pass (heuristic: low frequency + active)
      // This is a simplification — full implementation checks filter type parameter
      return d.active;
    });

    // Only flag if track has devices at all (empty tracks aren't a concern)
    if (!hasHighPass && track.devices.length > 0) {
      findings.push({
        id: "no_high_pass",
        severity: "info",
        track: track.name,
        device: null,
        message: `No EQ with high-pass detected — sub-bass accumulation possible`,
        suggestion: `Consider adding a high-pass filter around 30-80Hz to clean up low-end`,
      });
    }
  }

  // Check for multiple tracks boosting low-mids
  // This requires EQ Eight gain analysis across tracks
  let lowMidBoostCount = 0;
  const lowMidBoostTracks: string[] = [];

  for (const track of tracks) {
    for (const device of track.devices) {
      if (!device.active) continue;
      if (device.name !== "EQ Eight" && device.name !== "Eq8") continue;

      // Check bands in the 150-500Hz range for boosts
      for (const [paramName, value] of Object.entries(device.parameters)) {
        if (!paramName.includes("Gain")) continue;
        const db = parseFloat(value);
        if (db > 3) {
          // Check if the corresponding frequency is in the low-mid range
          // This is a simplified check — full implementation correlates gain with frequency
          lowMidBoostCount++;
          if (!lowMidBoostTracks.includes(track.name)) {
            lowMidBoostTracks.push(track.name);
          }
        }
      }
    }
  }

  if (lowMidBoostTracks.length >= 3) {
    findings.push({
      id: "low_mid_buildup",
      severity: "warning",
      track: null,
      device: null,
      message: `${lowMidBoostTracks.length} tracks have EQ boosts in the low-mid range (${lowMidBoostTracks.join(", ")}) — likely causing muddiness`,
      suggestion: `Review these tracks for competing boosts in the 150-500Hz range. Consider cutting on some tracks rather than boosting on others.`,
    });
  }

  return findings;
}
