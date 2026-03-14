import type { SemanticTrack, HeuristicFinding } from "../types.js";

export function checkHeadroom(
  tracks: SemanticTrack[],
  masterTrack: SemanticTrack,
): HeuristicFinding[] {
  const findings: HeuristicFinding[] = [];

  // Master volume above 0dB
  const masterDb = parseFloat(masterTrack.volume);
  if (!isNaN(masterDb) && masterDb > 0) {
    findings.push({
      id: "master_above_unity",
      severity: "issue",
      track: "Master",
      device: null,
      message: `Master track volume is ${masterTrack.volume} — no headroom`,
      suggestion: `Bring master fader to 0dB or below. Gain should come from individual tracks.`,
    });
  }

  // Count tracks near or above 0dB
  const hotTracks = tracks.filter((t) => {
    const db = parseFloat(t.volume);
    return !isNaN(db) && db >= -1;
  });

  if (hotTracks.length > 5) {
    findings.push({
      id: "many_hot_tracks",
      severity: "warning",
      track: null,
      device: null,
      message: `${hotTracks.length} tracks are near or above 0dB — gain staging may need attention`,
      suggestion: `Consider pulling track volumes down collectively and using makeup gain or bus volume to compensate.`,
    });
  }

  // Master limiter working hard (check for limiter on master with low threshold)
  for (const device of masterTrack.devices) {
    if (!device.active) continue;
    if (
      device.name.toLowerCase().includes("limiter") ||
      device.name.toLowerCase().includes("glue compressor")
    ) {
      const threshold = device.parameters["Threshold"];
      if (threshold) {
        const threshDb = parseFloat(threshold);
        if (!isNaN(threshDb) && threshDb < -6) {
          findings.push({
            id: "master_limiter_overloaded",
            severity: "warning",
            track: "Master",
            device: device.name,
            message: `Master ${device.name} threshold at ${threshold} — likely doing heavy gain reduction`,
            suggestion: `Mix may be hitting the master too hot. Pull back track/bus levels to reduce limiter workload.`,
          });
        }
      }
    }
  }

  return findings;
}
