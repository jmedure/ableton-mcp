import type { SemanticTrack, HeuristicFinding } from "../types.js";

export function checkRouting(
  tracks: SemanticTrack[],
  returnTracks: SemanticTrack[],
): HeuristicFinding[] {
  const findings: HeuristicFinding[] = [];

  // Check for many tracks routing directly to master with no bus structure
  const directToMaster = tracks.filter(
    (t) =>
      t.type !== "group" &&
      (t.outputRouting.toLowerCase() === "master" ||
        t.outputRouting === ""),
  );

  if (directToMaster.length > 12 && tracks.some((t) => t.type !== "group")) {
    const groupCount = tracks.filter((t) => t.type === "group").length;
    if (groupCount === 0) {
      findings.push({
        id: "no_bus_structure",
        severity: "info",
        track: null,
        device: null,
        message: `${directToMaster.length} tracks routing directly to master with no group buses — session could benefit from bus structure`,
        suggestion: `Consider creating group tracks (e.g., Drums Bus, Music Bus, Vocal Bus) for better mix management and processing.`,
      });
    }
  }

  // Check for duplicate reverb settings across tracks
  const reverbDevices: { track: string; params: string }[] = [];
  for (const track of tracks) {
    for (const device of track.devices) {
      if (!device.active) continue;
      if (
        device.name.toLowerCase().includes("reverb") ||
        device.name === "Reverb"
      ) {
        // Create a rough fingerprint of the reverb settings
        const fingerprint = Object.entries(device.parameters)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}:${v}`)
          .join("|");
        reverbDevices.push({ track: track.name, params: fingerprint });
      }
    }
  }

  if (reverbDevices.length >= 4) {
    // Check if many have similar settings
    const fingerprints = new Map<string, string[]>();
    for (const rd of reverbDevices) {
      const existing = fingerprints.get(rd.params) ?? [];
      existing.push(rd.track);
      fingerprints.set(rd.params, existing);
    }

    for (const [, trackNames] of fingerprints) {
      if (trackNames.length >= 3) {
        findings.push({
          id: "duplicate_reverbs",
          severity: "info",
          track: null,
          device: null,
          message: `${trackNames.length} tracks have similar reverb settings (${trackNames.join(", ")}) — consider consolidating to a return track`,
          suggestion: `Move the reverb to a return track and use sends. This gives a more cohesive space and saves CPU.`,
        });
      }
    }
  }

  return findings;
}
