import type {
  SemanticSession,
  SemanticTrack,
  HeuristicFinding,
} from "../types.js";
import { checkDynamics } from "./dynamics.js";
import { checkFrequencyBuildup } from "./frequency-buildup.js";
import { checkHeadroom } from "./headroom.js";
import { checkRouting } from "./routing.js";

export function runHeuristics(session: SemanticSession): HeuristicFinding[] {
  const allTracks: SemanticTrack[] = [
    ...session.tracks,
    ...session.returnTracks,
    session.masterTrack,
  ];

  const findings: HeuristicFinding[] = [
    ...checkDynamics(session.tracks),
    ...checkFrequencyBuildup(session.tracks),
    ...checkHeadroom(session.tracks, session.masterTrack),
    ...checkRouting(session.tracks, session.returnTracks),
  ];

  // Sort by severity: issue > warning > info
  const severityOrder = { issue: 0, warning: 1, info: 2 };
  findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return findings;
}
